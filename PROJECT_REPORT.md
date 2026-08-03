# AEGIS — Project Report

*A safety-first route navigation app for Bengaluru: it doesn't just find the fastest way from A to B, it scores the route against real crime data and lets the user pick FASTEST, SAFEST, or BALANCED — plus a manual SOS system for active emergencies.*

---

## 1. Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| Backend framework | **FastAPI** + **Uvicorn** | REST API, ASGI server |
| ORM / DB access | **SQLAlchemy 2.0** | Table models, queries, sessions |
| Spatial DB | **PostgreSQL + PostGIS** (`GeoAlchemy2`, `psycopg2-binary`) | Stores crime incidents, community members, SOS events with geometry columns |
| ML | **scikit-learn** (`RandomForestRegressor`), **joblib**, **numpy**, **pandas** | Trains and serves the route danger-scoring model |
| Validation | **Pydantic** | Request/response schemas for the SOS endpoints |
| External routing | **OSRM** (`router.project-osrm.org`, public instance) | Generates alternative route geometries between two points |
| External geocoding | **OpenStreetMap Nominatim** | Free-text place search in Route Planning |
| Mobile framework | **React Native 0.81** on **Expo SDK 54** | Cross-platform (iOS/Android) app shell |
| Navigation | **React Navigation** (native-stack, bottom-tabs) | Screen routing |
| Maps | **react-native-maps** with `PROVIDER_GOOGLE` | Map rendering, markers, polylines, heatmap circles |
| Location | **expo-location** | GPS permission, live position + heading tracking |
| Styling | React Native `StyleSheet` (NativeWind/Tailwind installed but not actually used in any screen) | UI styling |
| Infra (declared, dev machine) | `docker-compose.yml` → `postgis/postgis:15-3.3` | Containerized Postgres+PostGIS (a native Postgres 18 install is what's actually running on the current dev machine, doing the same job) |
| Declared but unused | `twilio`, `firebase-admin` | Scaffolded in `requirements.txt`/`.env.example` for real SMS/push dispatch, never wired into any endpoint |

---

## 2. Features

### 2.1 Onboarding & Login
**What it does:** A splash/logo animation (`OnboardingScreen.js`) auto-advances to a 3-step login flow (`LoginScreen.js`): phone number → OTP → profile completion (name, home area, and — as of this session — an emergency contact name/phone).

**Technology:** Pure React Native state/animation (`Animated` API), no backend calls at all.

**Reality check:** The OTP step is fully mocked — any 4-digit input is accepted, no SMS is actually sent or verified. The completed profile is held in `GlobalContext` in memory only; it is not persisted to a device store or a backend `User` table (none exists), so it's lost on app restart.

### 2.2 Safest Route Planning
**What it does:** User searches for an origin and destination (`RoutePlanningScreen.js`), the backend fetches up to 3 alternative routes from OSRM, scores each with the ML model, and labels them FASTEST / SAFEST / BALANCED / FASTEST-SAFEST. The user picks one and starts navigation, which hands the selected route to `HomeScreen.js` for turn-by-turn-style map tracking (tilted camera, live heading).

**Technology:**
- Frontend geocoding: free-text search hits Nominatim directly (`nominatim.openstreetmap.org`), bounded to a Bengaluru viewbox.
- `GET /api/routes` (`backend/main.py`) calls the public OSRM API for route geometries, then for each route runs every coordinate through the loaded `safety_model.pkl` (`RandomForestRegressor`), averaging predicted danger plus a penalty weighted by the route's single worst point (`mean + max*0.4`) to get one `danger_score` per route.
- Route classification logic: fastest by duration, safest by lowest danger score, everything else labeled BALANCED (or a combined FASTEST/SAFEST label if one route wins both).
- Frontend converts `danger_score` into a 0–100 "safety %" badge and colors the route polyline accordingly (green/blue/purple).

**Reality check:** The ML model is trained on **latitude/longitude and crime severity only** — no time-of-day, crime type weighting, or road-type features. There's no evaluation/holdout set in `train_model.py`, so a bad retrain could silently replace a working model with a worse one.

### 2.3 Live Safety Map & Crime Heatmap
**What it does:** `HomeScreen.js` renders a base map with the user's live location, and an optional heatmap overlay of Bengaluru crime hotspots (colored circles sized/colored by severity).

**Technology:** `GET /api/crimes/heatmap` runs a windowed SQL aggregation (`ROW_NUMBER() OVER (PARTITION BY ... ORDER BY severity DESC)`) over the `crime_incidents` table to return up to ~3000 clustered points, capped to severity ≥ 3. Data originates from a static 32,500-row CSV (`backend/data/bangalore_crime_data.csv`) seeded into Postgres at backend startup.

**Reality check:** There are two separate, inconsistent loaders for this same data — `main.py`'s `load_csv_data()` (runs at every startup, loads the full CSV) and the standalone `backend/load_db.py` (hardcoded Windows path, caps at the first 10,000 rows). No live/periodic refresh exists; it's one-time seed data.

### 2.4 Manual SOS
**What it does:** Accessible from a floating red button rendered globally over every screen (`GlobalSOSButton.js`, mounted in `App.js` alongside the navigator — not tied to any one screen). Tapping it opens a modal (`SOSScreen.js`) with a 15-second countdown; either the countdown expiring or tapping "SOS NOW" fires the alert. On trigger: a record is created server-side, and the phone's native SMS composer opens, prefilled with a live Google Maps link addressed to the user's emergency contact. "CANCEL & I'M SAFE" reverses it.

**Technology:**
- `POST /api/sos/trigger` / `PATCH /api/sos/{id}/cancel` (`backend/main.py`) — a new `SOSEvent` table (`backend/models.py`) tracks id, user name/phone, coordinates, status (`active`/`cancelled`), and timestamps.
- `GlobalContext.js` centralizes the API calls (`triggerSOS`, `cancelSOS`) and the shared user profile (including emergency contact) so any screen can read/dispatch SOS state.
- SMS is sent via `Linking.openURL('sms:...')` — a platform-aware URI (`?body=` on Android, `&body=` on iOS).

**Reality check — the most important caveat in this report:** the SMS is opened in the phone's compose screen, **not auto-sent**. If the person is incapacitated after tapping trigger, the message never actually leaves the device. `twilio` is already an installed-but-unused dependency with placeholder credentials in `.env.example` — finishing that wire-up for real server-side dispatch is the single highest-value gap to close (see §4).

### 2.5 Community SOS — planned, not built
The original project plan described a second feature: nearby users see a live banner/map marker when someone triggers SOS and can tap "I Can Help" to respond. A `CommunityMember` table (name/phone/area/location) already exists in `models.py` anticipating this, but no endpoint or UI for it exists. It was deliberately scoped out of this work — broadcasting a victim's live location and phone number to unvetted nearby users is a real privacy/abuse surface that needs its own design pass (rate-limiting, contact-info gating, member verification) before it should be built.

---

## 3. End-to-End Application Workflow

1. **App launch** → `App.js` mounts `GlobalProvider` (location permission request + continuous GPS/heading watch starts immediately) and `GlobalSOSButton` (floats over everything from this point forward, on every screen).
2. **Onboarding** → auto-advances to **Login** after ~3s.
3. **Login** → phone → OTP (mocked, unverified) → profile (name, area, emergency contact) → `setUserProfile()` populates `GlobalContext` → navigates to **Home**.
4. **Home** → live map with the user's position; toggle button fetches/shows the crime heatmap; "Plan Route" button opens Route Planning. The SOS button is available here and on every other screen.
5. **Route Planning** → search origin/destination via Nominatim → "Plan Routes" calls `GET /api/routes` → backend fetches OSRM alternatives, scores each with the ML model → routes render as colored polylines with safety-% badges → user taps one → "Start Navigation" passes the chosen route back to **Home** via navigation params.
6. **Home (navigating)** → map camera tilts and tracks the user's live heading/position along the selected route; an exit button clears navigation state.
7. **SOS, at any point** → tap the floating button → **SOS modal** opens over whatever screen was active → 15s countdown (or immediate "SOS NOW") → `POST /api/sos/trigger` creates an active DB record → native SMS composer opens with a live-location link to the emergency contact → "CANCEL & I'M SAFE" calls `PATCH /api/sos/{id}/cancel` and returns to the previous screen.

**Backend request lifecycle, for context:** on startup, `main.py` loads `safety_model.pkl` into memory once, then seeds `crime_incidents` from CSV if the table looks under-populated (`Base.metadata.create_all` also creates `sos_events`/`community_members` if they don't exist yet). Every request after that is stateless — no sessions, no auth, CORS wide open (`allow_origins=["*"]`).

---

## 4. Areas for Future Enhancement

Ranked roughly by how urgent/high-value they are, not just novelty:

1. **Finish real SOS dispatch (Twilio).** The single most important gap: the emergency SMS currently requires a manual "send" tap. Wiring the already-installed `twilio` dependency into `POST /api/sos/trigger` for deterministic, server-side sending — with the current client-side composer kept as a fallback, not a replacement — closes a real safety hole.
2. **Real authentication & persisted profile.** Login is currently a mocked, unverified OTP flow with the resulting profile held only in memory. A real `User` table, actual OTP verification, and device-side persistence (e.g. secure storage) would be needed before this is more than a demo.
3. **Community SOS**, once a privacy/abuse-prevention design exists for it (see §2.5).
4. **Production-grade backend deployment.** Currently `uvicorn --reload`, single process, default SQLAlchemy pool size, and a live dependency on the *public* OSRM instance for every route request. Multiple workers, a tuned/pooled DB connection strategy, and a self-hosted or cached OSRM would all be needed before this could handle real concurrent load.
5. **ML model improvements.** Today's model only knows latitude/longitude/severity. Adding time-of-day, crime type, and a proper train/test split with an evaluation gate (so a bad retrain can't silently replace a working model) would meaningfully improve both accuracy and trustworthiness.
6. **Data pipeline consolidation.** Two divergent, partially-broken CSV loaders (`main.py`'s vs. `load_db.py`'s hardcoded-path, 10k-row-capped version) should become one, with real upsert semantics and ideally a path to live/periodic data refresh instead of a single static CSV.
7. **Fix the duplicated backend-IP constant.** The dev-machine IP (`192.168.68.103`) is hardcoded independently in `frontend/src/config.js`, `HomeScreen.js`, and `RoutePlanningScreen.js` — a real maintenance footgun (already caused a debugging detour this session) that a single shared config already partially fixes but hasn't been rolled out everywhere.
8. **Security hardening.** No authentication on any endpoint, CORS fully open, no rate limiting anywhere — acceptable for local dev, not for anything public-facing.
9. **Testing & CI.** No automated test suite exists anywhere in the repo (backend or frontend) — even a thin layer around the SOS trigger/cancel logic and the route-scoring math would catch regressions early.
10. **AI/agent-assisted features**, once the above foundations are solid — e.g. a plain-language explanation of *why* a route is scored risky, or an MCP server exposing AEGIS's own route/heatmap/SOS-status data to other tools. (See the separate idea-menu discussion for a fuller breakdown with effort estimates.)
