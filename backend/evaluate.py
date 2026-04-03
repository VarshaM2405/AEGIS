import os
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from xgboost import XGBClassifier
from sklearn.neural_network import MLPClassifier
from scipy.spatial import cKDTree
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score

DATA_PATH = os.path.join(os.path.dirname(__file__), "data", "bangalore_crime_data.csv")

def feature_engineering(X, crime_tree, kmeans_model):
    # 1. Spatial Density (Inverse mean distance to 50 nearest neighbors)
    dists, _ = crime_tree.query(X, k=50)
    spatial_density = 1.0 / (np.mean(dists, axis=1) + 1e-6)
    
    # 2. Hotspot Proximity (Distance to nearest kmeans cluster center)
    cluster_centers = kmeans_model.cluster_centers_
    hotspot_tree = cKDTree(cluster_centers)
    h_dist, _ = hotspot_tree.query(X, k=1)
    
    # 3. Geo-Spatial Clustering ID
    cluster_id = kmeans_model.predict(X)
    
    return np.column_stack((spatial_density, h_dist, cluster_id))

def evaluate_models():
    print("Loading raw crime data from: bangalore_crime_data.csv...")
    df = pd.read_csv(DATA_PATH)
    
    # All historical crime coordinates (Positive instances)
    X_positive_coords = df[['Latitude', 'Longitude']].values
    y_positive = np.ones(len(X_positive_coords))
    
    # Synthesize Time of Incident (mostly night time)
    np.random.seed(42)
    t_pos = np.random.normal(loc=22, scale=4, size=len(X_positive_coords)) % 24
    
    print("Generating 30,000 synthetic Safe Zone coordinates...")
    crime_tree = cKDTree(X_positive_coords)
    
    safe_latitudes = np.random.uniform(12.7, 13.3, 100000) 
    safe_longitudes = np.random.uniform(77.4, 77.8, 100000)
    candidate_safes = np.column_stack((safe_latitudes, safe_longitudes))
    
    distances, _ = crime_tree.query(candidate_safes, k=1)
    safe_zones = candidate_safes[distances > 0.005][:30000]
    
    X_negative_coords = safe_zones
    y_negative = np.zeros(len(X_negative_coords))
    
    # Safe zones synthesized for daytime
    t_neg = np.random.normal(loc=12, scale=4, size=len(X_negative_coords)) % 24
    
    print("Fitting Geo-Spatial structural models (K-Means)...")
    kmeans = KMeans(n_clusters=20, random_state=42).fit(X_positive_coords)
    
    X_pos_feats = feature_engineering(X_positive_coords, crime_tree, kmeans)
    X_neg_feats = feature_engineering(X_negative_coords, crime_tree, kmeans)
    
    # Combine features into final arrays: [Lat, Lon, Time, Density, HotspotDist, ClusterID]
    X_pos_all = np.column_stack((X_positive_coords, t_pos, X_pos_feats))
    X_neg_all = np.column_stack((X_negative_coords, t_neg, X_neg_feats))
    
    X = np.vstack((X_pos_all, X_neg_all))
    y = np.concatenate((y_positive, y_negative))
    
    print(f"Dataset compiled. Training on {len(X)} geographic samples.")
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.20, random_state=42)
    
    models = {
        "Random Forest": RandomForestClassifier(n_estimators=100, max_depth=16, random_state=42, n_jobs=-1),
        "XGBoost": XGBClassifier(n_estimators=100, max_depth=6, random_state=42, n_jobs=-1),
        "Neural Network": MLPClassifier(hidden_layer_sizes=(100, 50), max_iter=300, random_state=42)
    }
    
    for name, model in models.items():
        print(f"Training {name} across Bangalore topology...")
        model.fit(X_train, y_train)
        y_pred = model.predict(X_test)
        
        acc = accuracy_score(y_test, y_pred)
        prec = precision_score(y_test, y_pred)
        rec = recall_score(y_test, y_pred)
        f1 = f1_score(y_test, y_pred)
        
        cv_scores = cross_val_score(model, X_train, y_train, cv=5, scoring='accuracy', n_jobs=-1)
        
        print(f"{name} Performance Results:")
        print(f"Accuracy: {acc:.4f}, Precision: {prec:.4f}, Recall: {rec:.4f}, F1: {f1:.4f}")
        print(f"Cross-Validation Accuracy: {cv_scores.mean():.4f} +/- {cv_scores.std():.4f}")
        
        if name == "Random Forest":
            feature_names = ['Lat', 'Lon', 'Time', 'Density', 'HotspotDist', 'ClusterID']
            print("Feature Importance Breakdown:")
            for fn, imp in zip(feature_names, model.feature_importances_):
                print(f" -> {fn}: {imp:.4f}")
        print("-" * 20)

if __name__ == "__main__":
    evaluate_models()
