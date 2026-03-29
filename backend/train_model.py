import os
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from scipy.spatial import cKDTree
import joblib

DATA_PATH = os.path.join(os.path.dirname(__file__), "data", "bangalore_crime_data.csv")
MODEL_PATH = os.path.join(os.path.dirname(__file__), "safety_model.pkl")

def generate_and_train_model():
    print("Loading raw crime data...")
    df = pd.read_csv(DATA_PATH)
    
    # Clean data (Bounding Box limits for Bangalore)
    df = df[(df['Latitude'] >= 12.0) & (df['Latitude'] <= 14.0) & 
            (df['Longitude'] >= 77.0) & (df['Longitude'] <= 78.0)]
            
    # Positive Instances (Danger Zones)
    # Features: Latitude, Longitude. Target: Severity
    X_positive = df[['Latitude', 'Longitude']].values
    y_positive = df['Severity'].values
    
    print(f"Loaded {len(X_positive)} confirmed crime coordinates.")
    
    # Generate Negative Instances (Safe Zones)
    # We need to explicitly teach the ML model what a "Safe Zone" looks like
    print("Generating synthetic Safe Zones for Machine Learning...")
    np.random.seed(42)
    
    # Create a fast spatial index of all crimes
    crime_tree = cKDTree(X_positive)
    
    safe_latitudes = np.random.uniform(12.7, 13.3, 30000) # Tighter inner city bound
    safe_longitudes = np.random.uniform(77.4, 77.8, 30000)
    candidate_safes = np.column_stack((safe_latitudes, safe_longitudes))
    
    # Query distance to nearest crime (k=1)
    # distance is Euclidean in degrees. 0.01 deg is ~1.1km
    distances, _ = crime_tree.query(candidate_safes, k=1)
    
    # Keep candidates that are at least ~500 meters (0.005 degrees) away from ANY crime
    safe_zones = candidate_safes[distances > 0.005]
    
    # We will pick enough safe zones to balance the dataset
    num_safe = min(len(safe_zones), len(X_positive))
    safe_zones = safe_zones[:num_safe]
    
    X_negative = safe_zones
    y_negative = np.zeros(len(X_negative)) # Severity = 0 (Safe)
    
    print(f"Generated {len(X_negative)} confirmed Safe Zone coordinates.")
    
    # Combine and Shuffle
    X = np.concatenate((X_positive, X_negative))
    y = np.concatenate((y_positive, y_negative))
    
    # Train Random Forest Regressor
    print("Training Random Forest AI Model across Bangalore geographical topology...")
    model = RandomForestRegressor(n_estimators=100, max_depth=15, random_state=42, n_jobs=-1)
    model.fit(X, y)
    
    # Score evaluating the model's spatial awareness
    score = model.score(X, y)
    print(f"Model Training Complete! Spatial Fitting R^2 Score: {score:.3f}")
    
    # Export the AI to disk so the backend can load it instantly
    joblib.dump(model, MODEL_PATH)
    print(f"Machine Learning Model securely saved to: {MODEL_PATH}")

if __name__ == "__main__":
    generate_and_train_model()
