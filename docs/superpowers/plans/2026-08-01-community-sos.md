# Community SOS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a nearby community member see an active SOS, tap to respond, and have the victim's app show that responder's name/phone in real time — building directly on the already-shipped manual SOS trigger/cancel flow.

**Architecture:** Extend the existing `SOSEvent` model/endpoints (no new tables). Backend adds a radius query (plain haversine, no PostGIS), a claim/respond endpoint copying the proven single-responder-claim logic already used by `IncidentReport`, and a status endpoint for the victim to poll. Frontend polls both endpoints every 3s from `GlobalContext` (same cadence/pattern as the existing `fetchReports` polling in `HomeScreen.js`), and `HomeScreen`/`SOSScreen` render off that shared state.

**Tech Stack:** FastAPI + SQLAlchemy + Postgres (backend, unchanged), React Native + Expo + `GlobalContext` (frontend, unchanged). No new dependencies.

## Global Constraints

- No automated test framework exists in this repo (backend or frontend) — the project's own verification convention (see `implementation_plan.md`'s "Verification Plan") is a running dev server exercised via `curl`/Swagger, plus manual Expo app walkthroughs. This plan follows that same convention rather than introducing new pytest/Jest infra. Each backend step still follows a verify-absence → implement → verify-presence cycle using `curl`.
- Radius query parameter is named `radius` (not `radius_km`), matching `implementation_plan.md`'s exact endpoint shape `GET /api/sos/active?lat={lat}&lon={lon}&radius=5`. Default `5.0`, unit is kilometers.
- `responder_id` on `SOSEvent` stores the responder's phone number, consistent with how `IncidentReport.responder_id` already stores phone (see `get_user_info` in `backend/main.py`).
- Banner copy must include distance + victim name + phone directly in the banner text (not just a modal), per `implementation_plan.md`: `"SOS 350m away! User: Ananya (Phone: +91 9876543210)"`.
- Victim-side copy on responder assignment must read exactly: `"Community Responder {name} ({phone}) is en route!"`, per `implementation_plan.md`.
- Poll interval is 3 seconds everywhere (nearby-SOS polling, victim status polling), matching the existing `fetchReports` cadence in `frontend/src/screens/HomeScreen.js:31`.
- New `sos_events` columns must be added via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` in an `@app.on_event("startup")` hook (matching the existing `ensure_report_columns()` pattern in `backend/main.py:90-100`), not a bare `Base.metadata.create_all`, since the table may already exist with data.
- Manual SOS (trigger/cancel, SMS deep-link) is already fully implemented (`backend/main.py:145-189`, `frontend/src/contexts/GlobalContext.js:63-102`, `frontend/src/screens/SOSScreen.js`) — do not modify that trigger/cancel logic, only extend around it.

---

### Task 1: Backend — extend `SOSEvent` model with responder fields

**Files:**
- Modify: `backend/models.py:17-26` (the `SOSEvent` class)
- Modify: `backend/main.py` (add a startup hook near `ensure_report_columns()` at `backend/main.py:90-100`)

**Interfaces:**
- Produces: `SOSEvent.responder_id: str | None`, `SOSEvent.responder_name: str | None`, `SOSEvent.responder_phone: str | None` — consumed by Tasks 2, 3, 4.
- Produces: `ensure_sos_columns()` startup hook — no other task depends on its name, just its effect (columns exist on server start).

- [ ] **Step 1: Confirm the columns don't exist yet**

Run: `docker exec -it aegis_db psql -U aegis_user -d aegis -c "\d sos_events"` (uses the Docker Postgres from `docker-compose.yml`; if connecting to a local Postgres instead, use `psql -h localhost -U aegis_user -d aegis -c "\d sos_events"` with the credentials from your local `.env`)

Expected: the column list shows only `id, user_name, user_phone, latitude, longitude, status, created_at, cancelled_at` — no `responder_*` columns.

- [ ] **Step 2: Add the columns to the model**

In `backend/models.py`, update the `SOSEvent` class:

```python
class SOSEvent(Base):
    __tablename__ = "sos_events"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_name = Column(String)
    user_phone = Column(String)
    latitude = Column(Float)
    longitude = Column(Float)
    status = Column(String, default="active")  # active, responding, cancelled
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    cancelled_at = Column(DateTime, nullable=True)
    responder_id = Column(String, nullable=True)
    responder_name = Column(String, nullable=True)
    responder_phone = Column(String, nullable=True)
```

- [ ] **Step 3: Add the column-migration startup hook**

In `backend/main.py`, immediately after the existing `ensure_report_columns()` function (`backend/main.py:90-100`), add:

```python
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
```

- [ ] **Step 4: Verify the columns now exist**

Run: `cd backend && source venv/bin/activate && uvicorn main:app --host 0.0.0.0 --port 8000 --reload` then in another terminal, re-run the `psql`/`docker exec` command from Step 1.

Expected: column list now includes `responder_id`, `responder_name`, `responder_phone`.

- [ ] **Step 5: Commit**

```bash
git add backend/models.py backend/main.py
git commit -m "feat: add responder fields to SOSEvent"
```

---

### Task 2: Backend — `GET /api/sos/active` (nearby SOS query)

**Files:**
- Modify: `backend/main.py` (add `import math` near the top imports, a `haversine_km` helper near the top-level functions, and the new endpoint near the existing SOS endpoints at `backend/main.py:145-189`)

**Interfaces:**
- Consumes: `models.SOSEvent` with `responder_id/name/phone` from Task 1.
- Produces: `haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float` (kilometers) — consumed by Task 2 itself only, but kept as a standalone function in case Task 3/4 need distance later (they don't, but naming is fixed here for the codebase).
- Produces: `GET /api/sos/active?lat={float}&lon={float}&radius={float=5.0}&exclude_phone={str|None}` returning `{"sos_events": [{id, user_name, user_phone, latitude, longitude, status, created_at, responder_id, responder_name, responder_phone, distance_km}, ...]}` sorted by `distance_km` ascending, filtered to `status in ("active", "responding")` — consumed by Task 5 (`GlobalContext.fetchNearbySOS`).

- [ ] **Step 1: Confirm the endpoint doesn't exist yet**

With the server running (`uvicorn main:app --reload` from `backend/`), run:

```bash
curl -s "http://localhost:8000/api/sos/active?lat=12.9716&lon=77.5946&radius=5"
```

Expected: `{"detail":"Not Found"}`.

- [ ] **Step 2: Add the haversine helper**

In `backend/main.py`, add `import math` to the top import block, then add this function near `get_user_info` (around `backend/main.py:76-85`):

```python
def haversine_km(lat1, lon1, lat2, lon2):
    """Great-circle distance between two lat/lon points, in kilometers."""
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))
```

- [ ] **Step 3: Add the `GET /api/sos/active` endpoint**

In `backend/main.py`, add this after `cancel_sos` (`backend/main.py:179-189`):

```python
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
```

- [ ] **Step 4: Verify it works — no events, then one nearby, then one out of radius**

```bash
curl -s "http://localhost:8000/api/sos/active?lat=12.9716&lon=77.5946&radius=5"
```
Expected: `{"sos_events":[]}` (assuming no other active SOS exists — if Task 1's manual SOS testing left one active, cancel it first via `curl -X PATCH http://localhost:8000/api/sos/{id}/cancel`).

```bash
curl -s -X POST http://localhost:8000/api/sos/trigger -H "Content-Type: application/json" \
  -d '{"user_name":"Ananya","user_phone":"+919876543210","latitude":12.9716,"longitude":77.5946}'
```
Note the returned `id`, call it `SOS_ID`.

```bash
curl -s "http://localhost:8000/api/sos/active?lat=12.9720&lon=77.5950&radius=5"
```
Expected: `{"sos_events":[{"id": SOS_ID, "user_name": "Ananya", ..., "distance_km": <small number like 0.05>}]}`.

```bash
curl -s "http://localhost:8000/api/sos/active?lat=13.5000&lon=78.5000&radius=5"
```
Expected: `{"sos_events":[]}` (out of radius).

```bash
curl -s "http://localhost:8000/api/sos/active?lat=12.9720&lon=77.5950&radius=5&exclude_phone=%2B919876543210"
```
Expected: `{"sos_events":[]}` (excluded by phone).

Clean up: `curl -X PATCH http://localhost:8000/api/sos/$SOS_ID/cancel`

- [ ] **Step 5: Commit**

```bash
git add backend/main.py
git commit -m "feat: add GET /api/sos/active endpoint"
```

---

### Task 3: Backend — `POST /api/sos/{sos_id}/respond` (claim logic)

**Files:**
- Modify: `backend/main.py` (add `SOSRespondRequest` schema near the existing `SOSTriggerRequest`/`SOSResponse` schemas at `backend/main.py:145-162`, update `SOSResponse` to include responder fields, and add the endpoint after Task 2's `get_active_sos`)

**Interfaces:**
- Consumes: `models.SOSEvent` from Task 1.
- Produces: updated `SOSResponse` schema with `responder_id: str | None`, `responder_name: str | None`, `responder_phone: str | None` fields — consumed by Task 4 and by the frontend in Task 5/6.
- Produces: `POST /api/sos/{sos_id}/respond` with body `{responder_phone: str, responder_name: str}` returning the updated `SOSResponse` (status `"responding"`) — consumed by Task 5 (`GlobalContext.respondToSOS`). Errors: `404` if not found, `400` "This SOS is no longer active" if cancelled, `400` "Cannot respond to your own SOS" if `responder_phone == user_phone`, `400` "This SOS is already being handled by another responder" if claimed by someone else.

- [ ] **Step 1: Confirm the endpoint doesn't exist yet**

```bash
curl -s -X POST http://localhost:8000/api/sos/1/respond -H "Content-Type: application/json" \
  -d '{"responder_phone":"+911111111111","responder_name":"Rahul"}'
```
Expected: `{"detail":"Not Found"}` (405/404 depending on whether `1` exists as a path — either way, not the new behavior).

- [ ] **Step 2: Update `SOSResponse` and add `SOSRespondRequest`**

In `backend/main.py`, replace the existing `SOSResponse` class (`backend/main.py:151-162`) with:

```python
class SOSResponse(BaseModel):
    id: int
    user_name: str
    user_phone: str
    latitude: float
    longitude: float
    status: str
    created_at: datetime.datetime
    cancelled_at: datetime.datetime | None = None
    responder_id: str | None = None
    responder_name: str | None = None
    responder_phone: str | None = None

    class Config:
        from_attributes = True

class SOSRespondRequest(BaseModel):
    responder_phone: str
    responder_name: str
```

- [ ] **Step 3: Add the respond endpoint**

In `backend/main.py`, add this after `get_active_sos` (from Task 2):

```python
@app.post("/api/sos/{sos_id}/respond", response_model=SOSResponse)
def respond_to_sos(sos_id: int, payload: SOSRespondRequest, db = Depends(get_db)):
    """Claim an active SOS as a community responder."""
    sos = db.query(models.SOSEvent).filter(models.SOSEvent.id == sos_id).first()
    if not sos:
        raise HTTPException(status_code=404, detail="SOS event not found")
    if sos.status == "cancelled":
        raise HTTPException(status_code=400, detail="This SOS is no longer active")
    if sos.user_phone == payload.responder_phone:
        raise HTTPException(status_code=400, detail="Cannot respond to your own SOS")
    if sos.responder_id and sos.responder_id != payload.responder_phone:
        raise HTTPException(status_code=400, detail="This SOS is already being handled by another responder")

    sos.status = "responding"
    sos.responder_id = payload.responder_phone
    sos.responder_name = payload.responder_name
    sos.responder_phone = payload.responder_phone
    db.commit()
    db.refresh(sos)
    return sos
```

- [ ] **Step 4: Verify success and all three rejection cases**

```bash
SOS_ID=$(curl -s -X POST http://localhost:8000/api/sos/trigger -H "Content-Type: application/json" \
  -d '{"user_name":"Ananya","user_phone":"+919876543210","latitude":12.9716,"longitude":77.5946}' | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")

# self-response rejection
curl -s -X POST http://localhost:8000/api/sos/$SOS_ID/respond -H "Content-Type: application/json" \
  -d '{"responder_phone":"+919876543210","responder_name":"Ananya"}'
```
Expected: `{"detail":"Cannot respond to your own SOS"}`

```bash
# successful respond
curl -s -X POST http://localhost:8000/api/sos/$SOS_ID/respond -H "Content-Type: application/json" \
  -d '{"responder_phone":"+911111111111","responder_name":"Rahul"}'
```
Expected: `{"id":SOS_ID,...,"status":"responding","responder_id":"+911111111111","responder_name":"Rahul","responder_phone":"+911111111111"}`

```bash
# already-claimed-by-someone-else rejection
curl -s -X POST http://localhost:8000/api/sos/$SOS_ID/respond -H "Content-Type: application/json" \
  -d '{"responder_phone":"+912222222222","responder_name":"Priya"}'
```
Expected: `{"detail":"This SOS is already being handled by another responder"}`

```bash
# cancelled rejection
curl -X PATCH http://localhost:8000/api/sos/$SOS_ID/cancel
curl -s -X POST http://localhost:8000/api/sos/$SOS_ID/respond -H "Content-Type: application/json" \
  -d '{"responder_phone":"+911111111111","responder_name":"Rahul"}'
```
Expected: `{"detail":"This SOS is no longer active"}`

- [ ] **Step 5: Commit**

```bash
git add backend/main.py
git commit -m "feat: add POST /api/sos/{id}/respond endpoint"
```

---

### Task 4: Backend — `GET /api/sos/{sos_id}/status` (victim polling)

**Files:**
- Modify: `backend/main.py` (add endpoint after Task 3's `respond_to_sos`)

**Interfaces:**
- Consumes: `SOSResponse` schema from Task 3.
- Produces: `GET /api/sos/{sos_id}/status` returning `SOSResponse` (404 if not found) — consumed by Task 5 (`GlobalContext`'s `activeSOS` status-polling effect).

- [ ] **Step 1: Confirm the endpoint doesn't exist yet**

```bash
curl -s http://localhost:8000/api/sos/1/status
```
Expected: `{"detail":"Not Found"}`.

- [ ] **Step 2: Add the endpoint**

In `backend/main.py`, add after `respond_to_sos`:

```python
@app.get("/api/sos/{sos_id}/status", response_model=SOSResponse)
def get_sos_status(sos_id: int, db = Depends(get_db)):
    """Poll the current state of an SOS event (for the victim's screen)."""
    sos = db.query(models.SOSEvent).filter(models.SOSEvent.id == sos_id).first()
    if not sos:
        raise HTTPException(status_code=404, detail="SOS event not found")
    return sos
```

- [ ] **Step 3: Verify it reflects live state changes**

```bash
SOS_ID=$(curl -s -X POST http://localhost:8000/api/sos/trigger -H "Content-Type: application/json" \
  -d '{"user_name":"Ananya","user_phone":"+919876543210","latitude":12.9716,"longitude":77.5946}' | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")

curl -s http://localhost:8000/api/sos/$SOS_ID/status
```
Expected: `{"id":SOS_ID,...,"status":"active","responder_id":null,...}`

```bash
curl -s -X POST http://localhost:8000/api/sos/$SOS_ID/respond -H "Content-Type: application/json" \
  -d '{"responder_phone":"+911111111111","responder_name":"Rahul"}'
curl -s http://localhost:8000/api/sos/$SOS_ID/status
```
Expected: second call now shows `"status":"responding","responder_name":"Rahul","responder_phone":"+911111111111"`.

Clean up: `curl -X PATCH http://localhost:8000/api/sos/$SOS_ID/cancel`

- [ ] **Step 4: Commit**

```bash
git add backend/main.py
git commit -m "feat: add GET /api/sos/{id}/status endpoint"
```

---

### Task 5: Frontend — `GlobalContext`: nearby-SOS polling, respond action, victim status polling

**Files:**
- Modify: `frontend/src/contexts/GlobalContext.js`

**Interfaces:**
- Consumes: `GET /api/sos/active`, `POST /api/sos/{id}/respond`, `GET /api/sos/{id}/status` from Tasks 2-4. Consumes existing `location`, `userProfile`, `activeSOS`, `setActiveSOS` already in this file (`frontend/src/contexts/GlobalContext.js:10,18,26`).
- Produces: context value `nearbySOS: Array<{id, user_name, user_phone, latitude, longitude, status, created_at, responder_id, responder_name, responder_phone, distance_km}>` — consumed by Task 7 (`HomeScreen.js`).
- Produces: context value `respondToSOS(sosId: number) => Promise<{success: true, sos: object} | {success: false, error: string}>` — consumed by Task 7.
- Produces: `activeSOS` (already exists) now also gets live-updated with `responder_id/name/phone` and `status: "responding"` via background polling — consumed by Task 6 (`SOSScreen.js`).

- [ ] **Step 1: Confirm current behavior (no nearby-SOS state exists)**

Run: `grep -n "nearbySOS\|respondToSOS" frontend/src/contexts/GlobalContext.js`

Expected: no matches (confirms these don't exist yet).

- [ ] **Step 2: Add `nearbySOS` state, `fetchNearbySOS`, and its polling effect**

In `frontend/src/contexts/GlobalContext.js`, add state near the existing `activeSOS`/`sosError` declarations (`frontend/src/contexts/GlobalContext.js:26-27`):

```js
const [nearbySOS, setNearbySOS] = useState([]);
```

Add this function near `cancelSOS` (`frontend/src/contexts/GlobalContext.js:91-102`):

```js
const fetchNearbySOS = async () => {
  if (!location || !userProfile.phone) return;
  try {
    const params = new URLSearchParams({
      lat: location.coords.latitude,
      lon: location.coords.longitude,
      radius: 5,
      exclude_phone: userProfile.phone,
    });
    const resp = await fetch(`${API_BASE_URL}/api/sos/active?${params}`);
    if (!resp.ok) return;
    const data = await resp.json();
    setNearbySOS(data.sos_events || []);
  } catch (err) {
    console.error('Nearby SOS fetch failed:', err);
  }
};

const respondToSOS = async (sosId) => {
  try {
    const resp = await fetch(`${API_BASE_URL}/api/sos/${sosId}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        responder_phone: userProfile.phone,
        responder_name: userProfile.name || 'A community member',
      }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      return { success: false, error: data.detail || 'Could not respond to this SOS.' };
    }
    await fetchNearbySOS();
    return { success: true, sos: data };
  } catch (err) {
    console.error('Respond to SOS failed:', err);
    return { success: false, error: 'Could not reach AEGIS servers.' };
  }
};
```

Add this polling effect near the existing location-tracking effect (`frontend/src/contexts/GlobalContext.js:104-134`):

```js
useEffect(() => {
  if (!location || !userProfile.phone) return;
  fetchNearbySOS();
  const interval = setInterval(fetchNearbySOS, 3000);
  return () => clearInterval(interval);
}, [location?.coords?.latitude, location?.coords?.longitude, userProfile.phone]);
```

- [ ] **Step 3: Add victim-side status polling for `activeSOS`**

Add this effect right after the one from Step 2:

```js
useEffect(() => {
  if (!activeSOS || activeSOS.status === 'cancelled') return;
  const interval = setInterval(async () => {
    try {
      const resp = await fetch(`${API_BASE_URL}/api/sos/${activeSOS.id}/status`);
      if (!resp.ok) return;
      const data = await resp.json();
      setActiveSOS(data);
    } catch (err) {
      console.error('SOS status poll failed:', err);
    }
  }, 3000);
  return () => clearInterval(interval);
}, [activeSOS?.id, activeSOS?.status]);
```

- [ ] **Step 4: Expose the new values in the context provider**

In the `GlobalContext.Provider value={{...}}` block (`frontend/src/contexts/GlobalContext.js:137-160`), add `nearbySOS` and `respondToSOS` alongside the existing `activeSOS, triggerSOS, cancelSOS, sosError`:

```js
        activeSOS,
        triggerSOS,
        cancelSOS,
        sosError,
        nearbySOS,
        respondToSOS,
```

- [ ] **Step 5: Verify by running the app against a manually-triggered SOS**

Run: `cd backend && uvicorn main:app --host 0.0.0.0 --port 8000 --reload` and `cd frontend && npx expo start`.

Log into the app as User A on a device/simulator with location permissions granted. In a terminal, trigger a nearby SOS as a different user:

```bash
curl -s -X POST http://localhost:8000/api/sos/trigger -H "Content-Type: application/json" \
  -d '{"user_name":"Ananya","user_phone":"+919876543210","latitude":<same lat as User A>,"longitude":<same lon as User A>}'
```

Add a temporary `console.log('nearbySOS', nearbySOS)` inside the polling effect from Step 2, reload the app, and confirm within ~3s the log shows one entry with `distance_km` close to 0. Remove the temporary log afterward.

Clean up: cancel the triggered SOS via `curl -X PATCH http://localhost:8000/api/sos/{id}/cancel`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/contexts/GlobalContext.js
git commit -m "feat: poll nearby SOS events and add respondToSOS to GlobalContext"
```

---

### Task 6: Frontend — `SOSScreen`: show responder info to the victim

**Files:**
- Modify: `frontend/src/screens/SOSScreen.js`

**Interfaces:**
- Consumes: `activeSOS` (now live-updated with `status: "responding"`, `responder_name`, `responder_phone`) from Task 5.

- [ ] **Step 1: Confirm current behavior (no responder text renders)**

Run: `grep -n "responder" frontend/src/screens/SOSScreen.js`

Expected: no matches.

- [ ] **Step 2: Add the responder banner**

In `frontend/src/screens/SOSScreen.js`, add this block right after the existing `sosError` block (`frontend/src/screens/SOSScreen.js:121-125`):

```jsx
{activeSOS?.status === 'responding' && (
  <Text className="text-white bg-black/25 text-sm text-center px-4 py-3 rounded-xl mb-4 max-w-[85%] font-bold">
    Community Responder {activeSOS.responder_name} ({activeSOS.responder_phone}) is en route!
  </Text>
)}
```

- [ ] **Step 3: Verify in the running app**

With the backend running and the app open on the SOS screen, trigger SOS ("SOS Now" or let the countdown finish), then in a terminal claim it as a responder:

```bash
curl -s -X POST http://localhost:8000/api/sos/{the id shown in app or backend logs}/respond \
  -H "Content-Type: application/json" -d '{"responder_phone":"+911111111111","responder_name":"Rahul"}'
```

Expected: within ~3s, the SOS screen shows "Community Responder Rahul (+911111111111) is en route!" without any manual refresh.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/screens/SOSScreen.js
git commit -m "feat: show community responder info on SOSScreen"
```

---

### Task 7: Frontend — `HomeScreen`: distinct Community SOS banner, marker, and respond modal

**Files:**
- Modify: `frontend/src/screens/HomeScreen.js`

**Interfaces:**
- Consumes: `nearbySOS`, `respondToSOS` from Task 5.

- [ ] **Step 1: Confirm current behavior (no SOS-specific UI exists)**

Run: `grep -n "nearbySOS\|selectedSOS\|Community Emergency" frontend/src/screens/HomeScreen.js`

Expected: no matches.

- [ ] **Step 2: Pull in `nearbySOS`/`respondToSOS` and add local state**

In `frontend/src/screens/HomeScreen.js`, update the imports at the top to include `Animated` (`frontend/src/screens/HomeScreen.js:2`):

```js
import { View, Text, TouchableOpacity, ScrollView, Dimensions, ActivityIndicator, Alert, Modal, Switch, Animated } from 'react-native';
```

Update the `useContext(GlobalContext)` destructure (`frontend/src/screens/HomeScreen.js:14`) to also pull `nearbySOS` and `respondToSOS`:

```js
const { location, user, notifications, removeNotification, clearNotifications, nearbySOS, respondToSOS } = useContext(GlobalContext);
```

Add new local state near `selectedReport`/`responding` (`frontend/src/screens/HomeScreen.js:21-22`):

```js
const [selectedSOS, setSelectedSOS] = useState(null);
const [respondingSOS, setRespondingSOS] = useState(false);
```

- [ ] **Step 3: Add a `formatDistance` helper and `handleRespondToSOS`**

Add near the existing `formatDateTime` helper (`frontend/src/screens/HomeScreen.js:197-203`):

```js
const formatDistance = (km) => (km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`);

const handleRespondToSOS = async () => {
  if (!selectedSOS) return;
  setRespondingSOS(true);
  const result = await respondToSOS(selectedSOS.id);
  setRespondingSOS(false);
  if (result.success) {
    setSelectedSOS(result.sos);
  } else {
    Alert.alert('Unable to respond', result.error);
  }
};
```

- [ ] **Step 4: Add a pulsing SOS marker component**

Add this component above the `HomeScreen` function definition (`frontend/src/screens/HomeScreen.js:13`):

```jsx
function PulsingSOSMarker() {
  const pulseAnim = React.useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.4, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View style={{ transform: [{ scale: pulseAnim }], backgroundColor: '#FF1744', padding: 8, borderRadius: 20, borderWidth: 3, borderColor: 'white' }}>
      <Text style={{ fontSize: 16 }}>🚨</Text>
    </Animated.View>
  );
}
```

- [ ] **Step 5: Render the banner above the Live Safety Map card**

In `frontend/src/screens/HomeScreen.js`, add this immediately before the `{renderSelectedReport()}` line (`frontend/src/screens/HomeScreen.js:376`):

```jsx
{nearbySOS.length > 0 && (
  <TouchableOpacity
    onPress={() => setSelectedSOS(nearbySOS[0])}
    activeOpacity={0.85}
    style={{ backgroundColor: '#D81B60', borderRadius: 24, padding: 16, marginBottom: 16, borderWidth: 2, borderColor: '#FF1744' }}
  >
    <Text style={{ color: 'white', fontWeight: '900', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 }}>
      🚨 Community Emergency Alert
    </Text>
    <Text style={{ color: 'white', fontWeight: '700', marginTop: 4 }}>
      SOS {formatDistance(nearbySOS[0].distance_km)} away! User: {nearbySOS[0].user_name} (Phone: {nearbySOS[0].user_phone})
    </Text>
  </TouchableOpacity>
)}
```

- [ ] **Step 6: Render SOS markers on the map**

In `frontend/src/screens/HomeScreen.js`, add this inside the `<MapView>` block, right after the existing `mergedAlerts.map(...)` markers block (`frontend/src/screens/HomeScreen.js:416-423`):

```jsx
{nearbySOS.map((sos) => (
  <Marker
    key={`sos-${sos.id}`}
    coordinate={{ latitude: sos.latitude, longitude: sos.longitude }}
    onPress={() => setSelectedSOS(sos)}
    tracksViewChanges={true}
  >
    <PulsingSOSMarker />
  </Marker>
))}
```

- [ ] **Step 7: Add the respond modal**

In `frontend/src/screens/HomeScreen.js`, add this after the existing notification `<Modal>` block (`frontend/src/screens/HomeScreen.js:331-374`):

```jsx
<Modal visible={!!selectedSOS} animationType="slide" transparent>
  <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 }}>
    <View style={{ backgroundColor: '#fff', borderRadius: 30, padding: 24, borderWidth: 2, borderColor: '#FF1744' }}>
      <Text style={{ fontSize: 20, fontWeight: '900', color: '#D81B60', marginBottom: 8 }}>🚨 Emergency SOS</Text>
      {selectedSOS && (
        <>
          <Text style={{ color: '#4A2E35', fontSize: 15, marginBottom: 4 }}>User: {selectedSOS.user_name}</Text>
          <Text style={{ color: '#4A2E35', fontSize: 15, marginBottom: 4 }}>Phone: {selectedSOS.user_phone}</Text>
          <Text style={{ color: '#9E7A80', fontSize: 13, marginBottom: 16 }}>{formatDistance(selectedSOS.distance_km)} away</Text>

          {selectedSOS.responder_id ? (
            <Text style={{ color: '#1F7A4E', fontWeight: '700', marginBottom: 16 }}>
              {selectedSOS.responder_id === user?.phone ? 'You are responding to this SOS.' : `${selectedSOS.responder_name} is already responding.`}
            </Text>
          ) : (
            <TouchableOpacity
              onPress={handleRespondToSOS}
              disabled={respondingSOS}
              style={{ backgroundColor: '#D81B60', borderRadius: 20, paddingVertical: 14, alignItems: 'center', marginBottom: 12 }}
            >
              <Text style={{ color: 'white', fontWeight: '900' }}>{respondingSOS ? 'Responding...' : 'I Can Help / Respond'}</Text>
            </TouchableOpacity>
          )}
        </>
      )}
      <TouchableOpacity onPress={() => setSelectedSOS(null)}>
        <Text style={{ color: '#9E7A80', textAlign: 'center', fontWeight: '700' }}>Close</Text>
      </TouchableOpacity>
    </View>
  </View>
</Modal>
```

- [ ] **Step 8: Verify the full community loop in the running app**

With backend and Expo running, and User A logged into the app:

```bash
curl -s -X POST http://localhost:8000/api/sos/trigger -H "Content-Type: application/json" \
  -d '{"user_name":"Ananya","user_phone":"+919876543210","latitude":<User A lat>,"longitude":<User A lon>}'
```

Expected: within ~3s, the red "Community Emergency Alert" banner appears on `HomeScreen` with distance/name/phone text, and a pulsing red marker appears on the map at that location.

Tap the banner → modal opens showing the same details and an "I Can Help / Respond" button. Tap it.

Expected: modal updates to "You are responding to this SOS." Re-open the modal by tapping the marker again to confirm it persists.

Separately, verify the claimed state is visible to other users:

```bash
curl -s "http://localhost:8000/api/sos/active?lat=<User A lat>&lon=<User A lon>&radius=5"
```

Expected: the event now shows `"status":"responding"` with the responder's phone/name populated.

Clean up: `curl -X PATCH http://localhost:8000/api/sos/{id}/cancel`.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/screens/HomeScreen.js
git commit -m "feat: add Community SOS banner, marker, and respond modal to HomeScreen"
```
