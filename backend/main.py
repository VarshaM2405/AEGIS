import os
import pandas as pd
from fastapi import FastAPI, Depends
from sqlalchemy import text
from database import engine, Base, SessionLocal, get_db
import models
import time
import joblib
import numpy as np
import requests
from scipy.spatial import cKDTree
from datetime import datetime

app = FastAPI(title="AEGIS API")

# Load pre-trained Random Forest ML Model for Routing Safety
MODEL_PATH = os.path.join(os.path.dirname(__file__), "safety_model.pkl")
safety_data = None
safety_model = None
kmeans_model = None
crime_tree = None

if os.path.exists(MODEL_PATH):
    safety_data = joblib.load(MODEL_PATH)
    safety_model = safety_data.get('model')
    kmeans_model = safety_data.get('kmeans')
    crime_tree = safety_data.get('crime_tree')
    print("Machine Learning Safety Model and Spatial Trees Loaded Successfully!")
else:
    print("Warning: safety_model.pkl not found! Routes will not have active ML scoring.")

# Create all tables (note: PostGIS extension must be active in DB)
Base.metadata.create_all(bind=engine)

@app.on_event("startup")
def load_csv_data():
    db = SessionLocal()
    try:
        data_dir = os.path.join(os.path.dirname(__file__), "data")
        
        # 1. Load Crime Data
        # Ensure we have the full dataset (> 30,000 records)
        if db.query(models.CrimeIncident).count() < 30000:
            print("Full dataset not found. Clearing and loading 32,500+ crime coordinates...")
            db.query(models.CrimeIncident).delete()
            db.commit()
            crime_file = os.path.join(data_dir, "bangalore_crime_data.csv")
            if os.path.exists(crime_file):
                # The columns match: Latitude, Longitude, Crime_Type, Severity
                df_crimes = pd.read_csv(crime_file)
                rows = []
                for _, row in df_crimes.iterrows():
                    geom_wkt = f"SRID=4326;POINT({row['Longitude']} {row['Latitude']})"
                    incident = models.CrimeIncident(
                        crime_type=str(row['Crime_Type']),
                        severity=int(row['Severity']),
                        latitude=float(row['Latitude']),
                        longitude=float(row['Longitude']),
                        geom=geom_wkt
                    )
                    rows.append(incident)
                db.bulk_save_objects(rows)
                print(f"Loaded {len(rows)} crime incidents.")
            else:
                print(f"Could not find {crime_file}. Skipping data load.")
        
        db.commit()
    except Exception as e:
        print(f"Error loading initial CSV data: {e}")
        db.rollback()
    finally:
        db.close()

@app.get("/")
def health_check():
    return {"status": "ok", "app": "AEGIS API"}

@app.get("/api/crimes/heatmap")
def get_heatmap_data(db = Depends(get_db)):
    """Fetch clustered crime incidents for the frontend heat map."""
    query = text("""
        SELECT lat, lon, max_weight
        FROM (
            SELECT 
                latitude as lat, 
                longitude as lon, 
                severity as max_weight,
                ROW_NUMBER() OVER(
                    PARTITION BY ROUND(CAST(latitude AS numeric), 2), ROUND(CAST(longitude AS numeric), 2) 
                    ORDER BY severity DESC
                ) as rn
            FROM crime_incidents
            WHERE latitude BETWEEN 12.5 AND 13.5
              AND longitude BETWEEN 77.4 AND 77.9
        ) sub
        WHERE rn <= 10
        ORDER BY max_weight DESC
        LIMIT 6000;
    """)
    results = db.execute(query).fetchall()
    
    heatmap_data = [
        {
            "latitude": float(row[0]),
            "longitude": float(row[1]),
            "weight": int(row[2])
        }
        for row in results
    ]
    return heatmap_data

@app.get("/api/routes")
def get_safe_routes(start_lat: float, start_lon: float, end_lat: float, end_lon: float):
    """Generates alternative geographic routes and ranks them using AI Safety Evaluation."""
    
    # Ping OSRM Public API for 3 alternative driving routes
    osrm_url = f"http://router.project-osrm.org/route/v1/driving/{start_lon},{start_lat};{end_lon},{end_lat}?alternatives=3&geometries=geojson&overview=full"
    
    headers = {"User-Agent": "AEGIS_Safety_App/1.0"}
    resp = requests.get(osrm_url, headers=headers)
    if resp.status_code != 200:
        return {"error": "Routing API completely failed."}
        
    data = resp.json()
    routes = data.get("routes", [])
    
    if not routes:
        return {"error": "No viable routes found between these points."}
        
    evaluated_routes = []
    
    for idx, r in enumerate(routes):
        coords = r["geometry"]["coordinates"] # List of [lon, lat]
        
        danger_score = 0.0
        
        if safety_model and crime_tree and kmeans_model and len(coords) > 0:
            # 1. Coordinate Prep
            test_coords = np.array([[c[1], c[0]] for c in coords])
            
            # 2. Time context (Current hour)
            current_hour = datetime.now().hour
            times = np.full((len(test_coords), 1), current_hour)
            
            # 3. Spatial Density (Inverse mean distance to 50 nearest crimes)
            dists, _ = crime_tree.query(test_coords, k=50)
            spatial_density = 1.0 / (np.mean(dists, axis=1) + 1e-6)
            
            # 4. Hotspot Proximity (Distance to nearest kmeans cluster center)
            cluster_centers = kmeans_model.cluster_centers_
            hotspot_tree = cKDTree(cluster_centers)
            h_dist, _ = hotspot_tree.query(test_coords, k=1)
            
            # 5. Geo-Spatial Clustering ID
            cluster_ids = kmeans_model.predict(test_coords)
            
            # 6. Combine all 6 features: Lat, Lon, Time, Density, HotspotDist, ClusterID
            X_inference = np.column_stack((
                test_coords, 
                times, 
                spatial_density, 
                h_dist, 
                cluster_ids
            ))
            
            # Run the route through the geographic Random Forest pipeline
            predictions = safety_model.predict(X_inference)
            
            # The danger algorithm averages the route severity, but aggressively penalizes 
            # if the route cuts directly through a Level 10 red zone.
            danger_score = float(np.mean(predictions) + (np.max(predictions) * 0.4))
            
        evaluated_routes.append({
            "id": idx,
            "duration": r.get("duration", 0),  # in seconds
            "distance": r.get("distance", 0),  # in meters
            "geometry": r["geometry"],
            "danger_score": danger_score,
            "type": "REGULAR" # Placeholder
        })
        
    if len(evaluated_routes) == 1:
        # If only one possible road exists, it defaults to both Fastest & Safest
        evaluated_routes[0]["type"] = "FASTEST / SAFEST"
    else:
        # 1. Sort by travel time to find the absolute FASTEST route
        evaluated_routes.sort(key=lambda x: x["duration"])
        evaluated_routes[0]["type"] = "FASTEST"
        
        # 2. Find the absolute SAFEST route (lowest ML Danger Score)
        safest_route = min(evaluated_routes, key=lambda x: x["danger_score"])
        
        if safest_route["id"] != evaluated_routes[0]["id"]:
            safest_route["type"] = "SAFEST"
        else:
            safest_route["type"] = "FASTEST / SAFEST"
            
        # 3. Label any remaining alternatives as BALANCED
        for route in evaluated_routes:
            if route["type"] == "REGULAR":
                route["type"] = "BALANCED"

    return {"routes": evaluated_routes}
