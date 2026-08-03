import os
from typing import Optional
import pandas as pd
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import text, or_
from database import engine, Base, SessionLocal, get_db
import models
import time
import joblib
import numpy as np
import requests
import random
from scipy.spatial import cKDTree
from datetime import datetime, timedelta
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import math

app = FastAPI(title="AEGIS API")

# Add CORS Middleware to allow all origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load pre-trained Random Forest ML Model for Routing Safety
MODEL_PATH = os.path.join(os.path.dirname(__file__), "aegis_safety_v2.pkl")
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

# Pydantic Schemas for Auth
class PhoneRequest(BaseModel):
    phone: str

class VerifyRequest(BaseModel):
    phone: str
    otp_code: str

class RegisterRequest(BaseModel):
    phone: str
    name: str
    area: str
    latitude: float
    longitude: float

class ReportRequest(BaseModel):
    type: str
    description: str
    latitude: float
    longitude: float
    timestamp: str
    userId: str = None
    status: str = "pending"

class ReportRespondRequest(BaseModel):
    userId: str
    action: str


def get_user_info(db, phone: str):
    if not phone:
        return None
    user = db.query(models.User).filter(models.User.phone == phone).first()
    return {
        "name": user.name if user else None,
        "phone": phone,
        "area": user.area if user else None,
        "profile_photo": None
    }

def haversine_km(lat1, lon1, lat2, lon2):
    """Great-circle distance between two lat/lon points, in kilometers."""
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))

# Create all tables (note: PostGIS extension must be active in DB)
Base.metadata.create_all(bind=engine)

@app.on_event("startup")
def ensure_report_columns():
    db = SessionLocal()
    try:
        db.execute(text("ALTER TABLE incident_reports ADD COLUMN IF NOT EXISTS responder_id VARCHAR"))
        db.commit()
    except Exception as e:
        print(f"Error ensuring report columns: {e}")
        db.rollback()
    finally:
        db.close()

@app.on_event("startup")
def ensure_sos_columns():
    db = SessionLocal()
    try:
        db.execute(text("ALTER TABLE sos_events ADD COLUMN IF NOT EXISTS responder_id VARCHAR"))
        db.execute(text("ALTER TABLE sos_events ADD COLUMN IF NOT EXISTS responder_name VARCHAR"))
        db.execute(text("ALTER TABLE sos_events ADD COLUMN IF NOT EXISTS responder_phone VARCHAR"))
        db.commit()
    except Exception as e:
        print(f"Error ensuring sos columns: {e}")
        db.rollback()
    finally:
        db.close()

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

class SOSTriggerRequest(BaseModel):
    user_name: str
    user_phone: str
    latitude: float
    longitude: float

class SOSResponse(BaseModel):
    id: int
    user_name: str
    user_phone: str
    latitude: float
    longitude: float
    status: str
    created_at: datetime
    cancelled_at: Optional[datetime] = None
    responder_id: Optional[str] = None
    responder_name: Optional[str] = None
    responder_phone: Optional[str] = None

    class Config:
        from_attributes = True

class SOSRespondRequest(BaseModel):
    responder_phone: str
    responder_name: str

@app.post("/api/sos/trigger", response_model=SOSResponse)
def trigger_sos(payload: SOSTriggerRequest, db = Depends(get_db)):
    """Create an active SOS event for the triggering user."""
    sos = models.SOSEvent(
        user_name=payload.user_name,
        user_phone=payload.user_phone,
        latitude=payload.latitude,
        longitude=payload.longitude,
        status="active",
    )
    db.add(sos)
    db.commit()
    db.refresh(sos)
    return sos

@app.patch("/api/sos/{sos_id}/cancel", response_model=SOSResponse)
def cancel_sos(sos_id: int, db = Depends(get_db)):
    """Mark an SOS event as cancelled once the user confirms they're safe."""
    sos = db.query(models.SOSEvent).filter(models.SOSEvent.id == sos_id).first()
    if not sos:
        raise HTTPException(status_code=404, detail="SOS event not found")
    sos.status = "cancelled"
    sos.cancelled_at = datetime.utcnow()
    db.commit()
    db.refresh(sos)
    return sos

@app.get("/api/sos/active")
def get_active_sos(lat: float, lon: float, radius: float = 5.0, exclude_phone: str = None, db = Depends(get_db)):
    """Return active/responding SOS events within `radius` km of (lat, lon), nearest first."""
    query = db.query(models.SOSEvent).filter(models.SOSEvent.status.in_(["active", "responding"]))
    if exclude_phone:
        query = query.filter(models.SOSEvent.user_phone != exclude_phone)

    results = []
    for e in query.all():
        distance = haversine_km(lat, lon, e.latitude, e.longitude)
        if distance <= radius:
            results.append({
                "id": e.id,
                "user_name": e.user_name,
                "user_phone": e.user_phone,
                "latitude": e.latitude,
                "longitude": e.longitude,
                "status": e.status,
                "created_at": e.created_at.isoformat() if e.created_at else None,
                "responder_id": e.responder_id,
                "responder_name": e.responder_name,
                "responder_phone": e.responder_phone,
                "distance_km": round(distance, 3),
            })

    results.sort(key=lambda r: r["distance_km"])
    return {"sos_events": results}

@app.post("/api/sos/{sos_id}/respond", response_model=SOSResponse)
def respond_to_sos(sos_id: int, payload: SOSRespondRequest, db = Depends(get_db)):
    """Claim an active SOS as a community responder.

    Uses a single atomic conditional UPDATE (rather than read-then-write) so that
    two near-simultaneous claims on the same SOS can't both succeed: the DB row
    is only updated if it still satisfies all the claim conditions at UPDATE time,
    closing the TOCTOU gap between the check and the commit.
    """
    updated = db.query(models.SOSEvent).filter(
        models.SOSEvent.id == sos_id,
        models.SOSEvent.status != "cancelled",
        models.SOSEvent.user_phone != payload.responder_phone,
        or_(models.SOSEvent.responder_id.is_(None), models.SOSEvent.responder_id == payload.responder_phone),
    ).update({
        "status": "responding",
        "responder_id": payload.responder_phone,
        "responder_name": payload.responder_name,
        "responder_phone": payload.responder_phone,
    }, synchronize_session=False)
    db.commit()

    if updated == 0:
        # Nothing matched the atomic UPDATE's conditions — re-fetch to determine
        # which specific error applies.
        sos = db.query(models.SOSEvent).filter(models.SOSEvent.id == sos_id).first()
        if not sos:
            raise HTTPException(status_code=404, detail="SOS event not found")
        if sos.status == "cancelled":
            raise HTTPException(status_code=400, detail="This SOS is no longer active")
        if sos.user_phone == payload.responder_phone:
            raise HTTPException(status_code=400, detail="Cannot respond to your own SOS")
        raise HTTPException(status_code=400, detail="This SOS is already being handled by another responder")

    sos = db.query(models.SOSEvent).filter(models.SOSEvent.id == sos_id).first()
    return sos

@app.get("/api/sos/{sos_id}/status", response_model=SOSResponse)
def get_sos_status(sos_id: int, db = Depends(get_db)):
    """Poll the current state of an SOS event (for the victim's screen)."""
    sos = db.query(models.SOSEvent).filter(models.SOSEvent.id == sos_id).first()
    if not sos:
        raise HTTPException(status_code=404, detail="SOS event not found")
    return sos

# --- AUTHENTICATION ENDPOINTS ---

@app.post("/api/auth/send-otp")
def send_otp(req: PhoneRequest, db=Depends(get_db)):
    """Generates and 'sends' a 4-digit OTP."""
    otp_code = f"{random.randint(1000, 9999)}"
    expires_at = datetime.now() + timedelta(minutes=5)
    
    # Update or create OTP record
    existing_otp = db.query(models.UserOTP).filter(models.UserOTP.phone == req.phone).first()
    if existing_otp:
        existing_otp.otp_code = otp_code
        existing_otp.expires_at = expires_at
    else:
        new_otp = models.UserOTP(phone=req.phone, otp_code=otp_code, expires_at=expires_at)
        db.add(new_otp)
    
    db.commit()
    
    # SIMULATED SMS SENDING
    print("\n" + "="*40)
    print(f"SMS SENT TO: {req.phone}")
    print(f"YOUR AEGIS OTP IS: {otp_code}")
    print("="*40 + "\n")
    
    return {"status": "sent", "message": "OTP log generated in backend terminal."}

@app.post("/api/auth/verify-otp")
def verify_otp(req: VerifyRequest, db=Depends(get_db)):
    """Verifies the 4-digit OTP and returns user status."""
    otp_record = db.query(models.UserOTP).filter(
        models.UserOTP.phone == req.phone,
        models.UserOTP.otp_code == req.otp_code
    ).first()
    
    if not otp_record or otp_record.expires_at < datetime.now():
        return {"status": "failed", "message": "Invalid or expired OTP"}
    
    # Check if user exists
    user = db.query(models.User).filter(models.User.phone == req.phone).first()
    if not user:
        # Create a skeleton user
        user = models.User(phone=req.phone, is_verified=True)
        db.add(user)
    else:
        user.is_verified = True
    
    db.delete(otp_record) # Cleanup
    db.commit()
    
    return {
        "status": "success", 
        "user_exists": user.name is not None,
        "user": {
            "name": user.name,
            "area": user.area,
            "phone": user.phone
        }
    }

@app.post("/api/auth/register")
def register_user(req: RegisterRequest, db=Depends(get_db)):
    """Completes the user profile registration."""
    user = db.query(models.User).filter(models.User.phone == req.phone).first()
    if not user:
        return {"status": "error", "message": "User must verify phone first"}
    
    user.name = req.name
    user.area = req.area
    user.latitude = req.latitude
    user.longitude = req.longitude
    
    # Set PostGIS geometry
    geom_wkt = f"SRID=4326;POINT({req.longitude} {req.latitude})"
    user.geom = geom_wkt
    
    db.commit()
    return {"status": "success", "message": "Profile completed"}

@app.get("/api/crimes/heatmap")
def get_heatmap_data(db = Depends(get_db)):
    """Fetch clustered crime incidents for the frontend heat map."""
    query = text("""
        SELECT latitude as lat, longitude as lon, severity as max_weight
        FROM crime_incidents
        WHERE latitude BETWEEN 12.5 AND 13.5
          AND longitude BETWEEN 77.4 AND 77.9
        ORDER BY severity DESC
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
    try:
        resp = requests.get(osrm_url, headers=headers, timeout=10)
    except requests.exceptions.RequestException:
        return {"error": "Routing API completely failed."}
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

@app.post("/api/reports")
def submit_incident_report(req: ReportRequest, db=Depends(get_db)):
    """Submits a new incident report from the mobile app."""
    try:
        # Create the report
        geom_wkt = f"SRID=4326;POINT({req.longitude} {req.latitude})"
        report = models.IncidentReport(
            type=req.type,
            description=req.description,
            latitude=req.latitude,
            longitude=req.longitude,
            user_id=req.userId,
            status=req.status,
            geom=geom_wkt
        )
        
        db.add(report)
        db.commit()
        db.refresh(report)
        
        print(f"New incident report submitted: {req.type} at ({req.latitude}, {req.longitude})")
        
        return {
            "status": "success", 
            "message": "Report submitted successfully",
            "report_id": report.id
        }
    except Exception as e:
        db.rollback()
        print(f"Error submitting report: {e}")
        return {"status": "error", "message": "Failed to submit report"}

@app.patch("/api/reports/{report_id}/respond")
def respond_to_incident_report(report_id: int, req: ReportRespondRequest, db=Depends(get_db)):
    report = db.query(models.IncidentReport).filter(models.IncidentReport.id == report_id).first()
    if not report:
        return {"status": "error", "message": "Report not found"}

    if req.action == "respond":
        if report.user_id and report.user_id == req.userId:
            return {"status": "error", "message": "Reporter cannot mark themselves as responder"}
        if report.responder_id and report.responder_id != req.userId:
            return {"status": "error", "message": "This report is already being handled by another responder."}
        report.status = "in_review"
        report.responder_id = req.userId
    elif req.action == "resolve":
        if report.user_id != req.userId and report.responder_id != req.userId:
            return {"status": "error", "message": "Only the report creator or assigned responder can resolve this report."}
        report.status = "resolved"
        if not report.responder_id:
            report.responder_id = req.userId
    else:
        return {"status": "error", "message": "Invalid action"}

    db.commit()
    db.refresh(report)

    return {
        "status": "success",
        "report": {
            "id": report.id,
            "type": report.type,
            "description": report.description,
            "latitude": float(report.latitude) if report.latitude is not None else None,
            "longitude": float(report.longitude) if report.longitude is not None else None,
            "status": report.status,
            "responder_id": report.responder_id,
            "created_at": report.created_at.isoformat() if report.created_at else None,
            "user_id": report.user_id,
            "reporter": get_user_info(db, report.user_id),
            "responder": get_user_info(db, report.responder_id),
        }
    }

@app.get("/api/reports")
def get_incident_reports(db=Depends(get_db)):
    """Returns all incident reports for frontend notifications and map alerts."""
    reports = db.query(models.IncidentReport).order_by(models.IncidentReport.id.desc()).limit(50).all()
    return {
        "reports": [
            {
                "id": r.id,
                "type": r.type,
                "description": r.description,
                "latitude": float(r.latitude) if r.latitude is not None else None,
                "longitude": float(r.longitude) if r.longitude is not None else None,
                "status": r.status,
                "responder_id": r.responder_id,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "user_id": r.user_id,
                "reporter": get_user_info(db, r.user_id),
                "responder": get_user_info(db, r.responder_id),
                "responder_status": "responding" if r.responder_id else "waiting"
            }
            for r in reports
        ]
    }
