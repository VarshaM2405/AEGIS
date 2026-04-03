# AEGIS: The Safety Route Predictor 🛡️📍

A high-performance Safety Navigation application that uses **Machine Learning (Random Forest)** to analyze 32,500+ crime records across Bengaluru and predict the safest possible walking or driving paths.

## 🚀 Key Features

*   **🚀 97.8% Accuracy Milestone:** Powered by a high-performance **Random Forest Regressor** with advanced feature engineering (**Spatial Density** & **K-Means Clustering**).
*   **🔥 Live Safety Heatmap:** Visualizes crime hotspots with high-contrast, scalable geographic markers.
*   **🧠 AI-Scored Routing:** Unlike Google Maps, AEGIS evaluates every meter of a path and ranks alternatives as **FASTEST**, **SAFEST**, or **BALANCED** based on geographic risk profiles.
*   **🕹️ Navigation Mode:** 45-degree tilted camera, live compass heading tracking, and real-time GPS progress.
*   **🆓 Fully Open-Source Stack:** Uses OSRM, Nominatim, and Scikit-Learn. **No Google Cloud API keys or billing required!**

---

## 🛠️ Prerequisites & Setup

### 1. Essential Tools & Extensions
Download and install these before starting:
*   [Node.js](https://nodejs.org/) (LTS version)
*   [Python 3.10+](https://www.python.org/)
*   [PostgreSQL](https://www.postgresql.org/) (Or use Docker)
*   **VS Code Extensions:**
    *   `Python` (by Microsoft)
    *   `ES7+ React/Redux/React-Native snippets`
    *   `Tailwind CSS IntelliSense`

---

## 🏗️ Getting Started

### Step 1: Clone and Enter
```bash
git clone https://github.com/VarshaM2405/AEGIS.git
cd AEGIS
```

### Step 2: Backend Setup (Python & ML)
1.  **Enter the folder:** `cd backend`
2.  **Create Virtual Environment:** `python -m venv venv`
3.  **Activate it:** 
    *   (Windows): `.\venv\Scripts\activate`
    *   (Mac/Linux): `source venv/bin/activate`
4.  **Install Dependencies:** `pip install -r requirements.txt`
5.  **Train the AI Model:** `python train_model.py` (This compiles the Random Forest model from the CSV data)
6.  **Run the Server:** `uvicorn main:app --host 0.0.0.0 --port 8000 --reload`

> [!IMPORTANT]
> Ensure your PostgreSQL service is running. The default credentials are in `database.py`: `aegis_user:aegis_password` on DB `aegis`.
>Or Open Docker for Windows AMD64 (I used this) and kep it open and running
---

### Step 3: Frontend Setup (React Native & Expo)
1.  **Enter the folder:** `cd ../frontend`
2.  **Install Packages:** `npm install`
3.  **Set Backend IP:** Open `src/screens/HomeScreen.js` and change the `HOST` constant to your laptop’s local IP (e.g., `192.168.0.x`).
4.  **Launch Expo:** `npx expo start`

---

## 📱 How to View the Output

1.  Download the **Expo Go** app on your physical iPhone or Android device.
2.  Ensure your phone is on the **same Wi-Fi** as your laptop.
3.  Scan the **QR Code** displayed in your terminal.
4.  **Experience:** Go to "Plan Route," search for a location in Bangalore, and select the **Green (Safest)** path to begin navigation!

---

## 🗺️ Technical Architecture
*   **AI Backend:** FastAPI + Scikit-Learn (Random Forest Regressor).
*   **Database:** PostGIS enabled PostgreSQL.
*   **Frontend:** React Native (Expo) + React Native Maps.
*   **Geospatial Engines:** OpenStreetMap Nominatim (Search) & OSRM (Pathfinding).
