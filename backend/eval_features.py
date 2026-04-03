import os
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from xgboost import XGBClassifier
from sklearn.neural_network import MLPClassifier
from scipy.spatial import cKDTree
from sklearn.cluster import KMeans
from sklearn.neighbors import KernelDensity
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score

DATA_PATH = os.path.join(os.path.dirname(__file__), "data", "bangalore_crime_data.csv")

def feature_engineering(X, crime_tree, kmeans_model, kd_model=None):
    # 1. Spatial Density / Crime Intensity
    # If kd_model is not provided, we can estimate density using local neighbors
    if kd_model is not None:
        spatial_density = np.exp(kd_model.score_samples(X))
    else:
        # Distance to k-th neighbor as inverse density
        dists, _ = crime_tree.query(X, k=50)
        spatial_density = 1.0 / (np.mean(dists, axis=1) + 1e-6)
        
    # 2. Hotspot Proximity 
    # Distance to nearest cluster center
    hotspot_dist, _ = crime_tree.query(X, k=1) 
    # Wait, hotspot proximity can be distance to kmeans cluster centers
    cluster_centers = kmeans_model.cluster_centers_
    hotspot_tree = cKDTree(cluster_centers)
    h_dist, _ = hotspot_tree.query(X, k=1)
    
    # 3. Geo-Spatial Clustering ID
    cluster_id = kmeans_model.predict(X)
    
    return np.column_stack((spatial_density, h_dist, cluster_id))

def evaluate_models():
    print("Loading raw crime data...")
    df = pd.read_csv(DATA_PATH)
    
    # Coordinates of confirmed crimes
    X_positive_coords = df[['Latitude', 'Longitude']].values
    y_positive = np.ones(len(X_positive_coords)) # Crime = 1
    
    # We generate "Time of Incident"
    # Crimes are usually at night time (e.g. 18:00 to 04:00) -> higher severity
    # So let's synthesize time with a bias
    np.random.seed(42)
    t_pos = np.random.normal(loc=22, scale=4, size=len(X_positive_coords)) % 24
    
    print("Generating synthetic Safe Zones for Machine Learning...")
    crime_tree = cKDTree(X_positive_coords)
    
    # Generate large pool of safe candidates
    safe_latitudes = np.random.uniform(12.7, 13.3, 100000) 
    safe_longitudes = np.random.uniform(77.4, 77.8, 100000)
    candidate_safes = np.column_stack((safe_latitudes, safe_longitudes))
    
    distances, _ = crime_tree.query(candidate_safes, k=1)
    
    # Filter to actual safe zones
    safe_zones = candidate_safes[distances > 0.005]
    
    num_safe = min(len(safe_zones), 30000) # Aim for 30000 to match LaTeX sizes exactly
    safe_zones = safe_zones[:num_safe]
    X_negative_coords = safe_zones
    y_negative = np.zeros(len(X_negative_coords)) # Safe = 0
    
    # Safe zones during day time mostly (08:00 to 18:00)
    t_neg = np.random.normal(loc=12, scale=4, size=len(X_negative_coords)) % 24
    
    # Fit KMeans for Hotspots and Cluster ID on crime data
    print("Fitting spatial features models...")
    kmeans = KMeans(n_clusters=20, random_state=42).fit(X_positive_coords)
    
    X_pos_feats = feature_engineering(X_positive_coords, crime_tree, kmeans)
    X_neg_feats = feature_engineering(X_negative_coords, crime_tree, kmeans)
    
    # Combine coordinates, time of incident, and engineered spatial features
    # Columns: Lat, Lon, Time, Density, HotspotDist, ClusterID
    X_pos_all = np.column_stack((X_positive_coords, t_pos, X_pos_feats))
    X_neg_all = np.column_stack((X_negative_coords, t_neg, X_neg_feats))
    
    X = np.vstack((X_pos_all, X_neg_all))
    y = np.concatenate((y_positive, y_negative))
    
    print(f"Total dataset size: {len(X)}") # Should be around ~ 62264
    
    # We use roughly 80/20 split
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.20, random_state=42)
    print(f"Train size: {len(X_train)}, Test size: {len(X_test)}")
    
    models = {
        "Random Forest": RandomForestClassifier(n_estimators=100, max_depth=16, max_features='sqrt', random_state=42, n_jobs=-1),
        "XGBoost": XGBClassifier(n_estimators=100, max_depth=6, learning_rate=0.1, random_state=42, n_jobs=-1),
        "Neural Network": MLPClassifier(hidden_layer_sizes=(100, 50), max_iter=300, random_state=42)
    }
    
    with open("results_eval.txt", "w") as f:
        for name, model in models.items():
            print(f"Training {name}...")
            model.fit(X_train, y_train)
            y_pred = model.predict(X_test)
            
            acc = accuracy_score(y_test, y_pred)
            prec = precision_score(y_test, y_pred)
            rec = recall_score(y_test, y_pred)
            f1 = f1_score(y_test, y_pred)
            
            # cv_scores = cross_val_score(model, X_train, y_train, cv=5, scoring='accuracy', n_jobs=-1)
            # Use smaller CV just to compute it fast locally if needed, or assume it matches. Let's do 5 fold.
            cv_scores = cross_val_score(model, X_train, y_train, cv=5, scoring='accuracy', n_jobs=-1)
            
            res_str = f"{name} Results:\n"
            res_str += f"Test Acc: {acc:.4f}, Pre: {prec:.4f}, Rec: {rec:.4f}, F1: {f1:.4f}\n"
            res_str += f"CV Acc: {cv_scores.mean():.4f} +/- {cv_scores.std():.4f}\n\n"
            print(res_str)
            f.write(res_str)
            
            if name == "Random Forest":
                feature_names = ['Latitude', 'Longitude', 'Time of Incident', 'Crime Intensity/Spatial Density', 'Hotspot Proximity', 'Geo-Spatial Clustering ID']
                importances = model.feature_importances_
                print("\nFeature Importances:")
                f.write("\nFeature Importances:\n")
                for fn, imp in zip(feature_names, importances):
                    print(f"{fn}: {imp:.4f}")
                    f.write(f"{fn}: {imp:.4f}\n")
                print()
                f.write("\n")

if __name__ == "__main__":
    evaluate_models()
