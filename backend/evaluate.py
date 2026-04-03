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

def evaluate_models():
    print("Loading raw crime data...")
    df = pd.read_csv(DATA_PATH)
    
    # We remove the bounding box filter to get 32264 positive points
    X_positive = df[['Latitude', 'Longitude']].values
    y_positive = np.ones(len(X_positive)) # Severity/Crime = 1
    
    print("Generating synthetic Safe Zones for Machine Learning...")
    np.random.seed(42)
    
    crime_tree = cKDTree(X_positive)
    
    safe_latitudes = np.random.uniform(12.7, 13.3, 35000) 
    safe_longitudes = np.random.uniform(77.4, 77.8, 35000)
    candidate_safes = np.column_stack((safe_latitudes, safe_longitudes))
    
    distances, _ = crime_tree.query(candidate_safes, k=1)
    
    safe_zones = candidate_safes[distances > 0.005]
    
    num_safe = 30000
    safe_zones = safe_zones[:num_safe]
    
    X_negative = safe_zones
    y_negative = np.zeros(len(X_negative)) # Severity = 0 (Safe)
    
    X = np.concatenate((X_positive, X_negative))
    y = np.concatenate((y_positive, y_negative))
    
    print(f"Total dataset size: {len(X)}") # Should be 62264
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=12453, random_state=42)
    
    models = {
        "Random Forest": RandomForestClassifier(n_estimators=100, max_depth=15, random_state=42, n_jobs=-1),
        "XGBoost": XGBClassifier(n_estimators=100, max_depth=6, random_state=42, n_jobs=-1),
        "Neural Network": MLPClassifier(hidden_layer_sizes=(100,), max_iter=200, random_state=42)
    }
    
    for name, model in models.items():
        print(f"Training {name}...")
        model.fit(X_train, y_train)
        y_pred = model.predict(X_test)
        
        acc = accuracy_score(y_test, y_pred)
        prec = precision_score(y_test, y_pred)
        rec = recall_score(y_test, y_pred)
        f1 = f1_score(y_test, y_pred)
        
        cv_scores = cross_val_score(model, X_train, y_train, cv=5, scoring='accuracy', n_jobs=-1)
        
        print(f"{name} Results:")
        print(f"Test Acc: {acc:.4f}, Pre: {prec:.4f}, Rec: {rec:.4f}, F1: {f1:.4f}")
        print(f"CV Acc: {cv_scores.mean():.4f} +/- {cv_scores.std():.4f}")
        print()

if __name__ == "__main__":
    evaluate_models()
