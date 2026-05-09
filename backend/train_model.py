import os
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from scipy.spatial import cKDTree
from sklearn.cluster import KMeans
import joblib

DATA_PATH = os.path.join(os.path.dirname(__file__), "data", "bangalore_crime_data.csv")
MODEL_PATH = os.path.join(os.path.dirname(__file__), "aegis_safety_v2.pkl")

def feature_engineering(X, crime_tree, kmeans_model):
    # 1. Spatial Density
    dists, _ = crime_tree.query(X, k=50)
    spatial_density = 1.0 / (np.mean(dists, axis=1) + 1e-6)
    
    # 2. Hotspot Proximity
    cluster_centers = kmeans_model.cluster_centers_
    hotspot_tree = cKDTree(cluster_centers)
    h_dist, _ = hotspot_tree.query(X, k=1)
    
    # 3. Geo-Spatial Clustering ID
    cluster_id = kmeans_model.predict(X)
    
    return np.column_stack((spatial_density, h_dist, cluster_id))

def generate_and_train_model():
    print("Loading raw crime data...")
    df = pd.read_csv(DATA_PATH)
    
    # Positive Instances (Danger Zones)
    X_positive_coords = df[['Latitude', 'Longitude']].values
    y_positive = np.ones(len(X_positive_coords)) # Severity 1
    
    print(f"Loaded {len(X_positive_coords)} confirmed crime coordinates.")
    
    # Synthesize time of incident (mostly nighttime)
    np.random.seed(42)
    t_pos = np.random.normal(loc=22, scale=4, size=len(X_positive_coords)) % 24
    
    print("Generating synthetic Safe Zones for Machine Learning...")
    crime_tree = cKDTree(X_positive_coords)
    
    safe_latitudes = np.random.uniform(12.7, 13.3, 20000) 
    safe_longitudes = np.random.uniform(77.4, 77.8, 20000)
    candidate_safes = np.column_stack((safe_latitudes, safe_longitudes))
    
    distances, _ = crime_tree.query(candidate_safes, k=1)
    safe_zones = candidate_safes[distances > 0.005]
    
    num_safe = min(len(safe_zones), 10000)
    safe_zones = safe_zones[:num_safe]
    X_negative_coords = safe_zones
    y_negative = np.zeros(len(X_negative_coords)) # Severity 0
    
    # Safe zones synthesized for daytime
    t_neg = np.random.normal(loc=12, scale=4, size=len(X_negative_coords)) % 24
    
    print(f"Generated {len(X_negative_coords)} confirmed Safe Zone coordinates.")
    
    print("Fitting spatial structural models (KMeans)...")
    kmeans = KMeans(n_clusters=20, random_state=42).fit(X_positive_coords)
    
    X_pos_feats = feature_engineering(X_positive_coords, crime_tree, kmeans)
    X_neg_feats = feature_engineering(X_negative_coords, crime_tree, kmeans)
    
    # Final array: Lat, Lon, Time, Density, HotspotDist, ClusterID
    X_pos_all = np.column_stack((X_positive_coords, t_pos, X_pos_feats))
    X_neg_all = np.column_stack((X_negative_coords, t_neg, X_neg_feats))
    
    X = np.vstack((X_pos_all, X_neg_all))
    y = np.concatenate((y_positive, y_negative))
    
    # Train Random Forest
    print("Training Random Forest AI Model across Bangalore geographical topology...")
    # NOTE: As per previous iterations, train_model used a Regressor to output safety/danger scores smoothly.
    model = RandomForestRegressor(n_estimators=100, max_depth=16, max_features='sqrt', random_state=42, n_jobs=-1)
    model.fit(X, y)
    
    score = model.score(X, y)
    print(f"Model Training Complete! Spatial Fitting R^2 Score: {score:.3f}")
    
    # Package into a single dict to export because feature engineering will be needed at inference
    export_payload = {
        'model': model,
        'kmeans': kmeans,
        'crime_tree': crime_tree
    }
    
    joblib.dump(export_payload, MODEL_PATH)
    print(f"Machine Learning Model securely saved to: {MODEL_PATH}")

if __name__ == "__main__":
    generate_and_train_model()
