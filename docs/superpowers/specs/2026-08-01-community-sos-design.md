# Community SOS — Design Spec

Date: 2026-08-01

## Context

Manual SOS is already implemented on `main` (commits `90dcaba`, `81ade09`):
- `SOSEvent` model (`backend/models.py`): id, user_name, user_phone, latitude, longitude, status (`active`/`cancelled`), created_at, cancelled_at.
- `POST /api/sos/trigger`, `PATCH /api/sos/{id}/cancel` (`backend/main.py`).
- `GlobalContext.js`: `activeSOS`, `triggerSOS()`, `cancelSOS()`, `sosError`.
- `SOSScreen.js`: 15s countdown, trigger, SMS deep-link to emergency contact, cancel.

This spec covers **Community SOS**: broadcasting an active SOS to nearby users and letting one of them respond, mirroring the existing `IncidentReport` respond flow (`/api/reports/{id}/respond`) which already solves single-responder claiming and self-response prevention.

No mocking is required — Community SOS is built directly on the real, already-shipped manual SOS trigger/cancel flow and `SOSEvent` data. There are no external dependencies for this feature to stub.

## Backend

### `models.py` — extend `SOSEvent`
Add columns:
- `responder_id` (String, nullable) — responder's phone, used as unique identifier (same convention as `IncidentReport.responder_id`)
- `responder_name` (String, nullable)
- `responder_phone` (String, nullable)

`status` gains a third value: `"responding"` (alongside existing `"active"`, `"cancelled"`).

### `main.py` — new endpoints

**`GET /api/sos/active`**
- Query params: `lat: float`, `lon: float`, `radius_km: float = 5`, `exclude_phone: str | None = None`
- Returns all `SOSEvent` rows with `status in ("active", "responding")` within `radius_km` of `(lat, lon)`, each annotated with `distance_km`.
- Distance computed with a plain Python haversine helper (consistent with the rest of the codebase, which does not use PostGIS for querying — `geom` columns exist but queries use raw lat/lon).
- `exclude_phone` filters out the caller's own SOS event (a victim's own signal shouldn't show up as "nearby" to themselves).
- Sorted by distance ascending.

**`POST /api/sos/{sos_id}/respond`**
- Body: `{responder_phone: str, responder_name: str}`
- 404 if SOS not found.
- 400 if `status == "cancelled"` ("This SOS is no longer active").
- 400 if `responder_phone == sos.user_phone` ("Cannot respond to your own SOS").
- 400 if `sos.responder_id` is set and differs from `responder_phone` ("Already being handled by another responder").
- Otherwise sets `status = "responding"`, `responder_id/name/phone`, commits, returns updated `SOSEvent`.
- Idempotent if the same responder calls again (no-op, returns current state).

**`GET /api/sos/{sos_id}/status`**
- Returns the current `SOSEvent` row (id, status, responder_name, responder_phone, etc.) so the victim's screen can poll for updates.
- 404 if not found.

## Frontend

### `GlobalContext.js`
- New state: `nearbySOS` (array, excludes own active SOS).
- New effect: while `isLoggedIn && location` and no *own* active SOS in `"active"`/`"responding"` state blocking self-view, poll `GET /api/sos/active?lat=&lon=&radius_km=5&exclude_phone={userProfile.phone}` every 3s (matches existing report-polling cadence in `HomeScreen.js`). Store into `nearbySOS`.
- New function `respondToSOS(sosId)` — calls `POST /api/sos/{sosId}/respond` with `{responder_phone: userProfile.phone, responder_name: userProfile.name}`, refreshes `nearbySOS` on success, surfaces errors (e.g. already claimed) via return value for the UI to alert.
- Poll cleared on unmount / logout.

### `SOSScreen.js` (victim side)
- While `activeSOS && activeSOS.status !== 'cancelled'`, poll `GET /api/sos/{activeSOS.id}/status` every 3s.
- When polled status flips to `"responding"`, update local state and render: *"Community Responder {responder_name} ({responder_phone}) is on the way!"* replacing/augmenting the existing status text.
- Stop polling on cancel or unmount.

### `HomeScreen.js` (community/responder side)
Distinct, higher-priority treatment from regular incident reports (per user decision):
- New flashing red banner component, visually separate from the existing report/notification banner — "🚨 COMMUNITY EMERGENCY ALERT — SOS {distance_km}m/km away" for the nearest item in `nearbySOS` (only rendered when `nearbySOS.length > 0`).
- Distinct pulsing map marker style for SOS events (different color/animation from `IncidentReport` pins) rendered alongside existing heatmap/report markers.
- Tapping the banner or marker opens a dedicated respond modal (separate from `selectedReport` modal) showing victim name, phone, distance, and an "I Can Help / Respond" button wired to `respondToSOS`.
- On successful respond, modal updates to show "You are responding" state; other users' polls will show `status: "responding"` and the responder's info instead of the raw alert (still visible/trackable, not hidden, since multiple community members might want situational awareness — but the CTA changes to reflect it's claimed).

## Data Flow Summary

1. Victim triggers SOS (existing flow) → `SOSEvent(status="active")`.
2. Nearby users' `HomeScreen` polling picks it up via `/api/sos/active` → red banner + marker.
3. A responder taps "I Can Help" → `POST /api/sos/{id}/respond` → `status="responding"`.
4. Victim's `SOSScreen` polling picks up the status change → shows responder's name/phone.
5. Victim cancels (existing flow) → `status="cancelled"` → drops out of `/api/sos/active` results for everyone.

## Error Handling

- Respond race condition (two people tap "I Can Help" simultaneously): second request gets 400 "already being handled," frontend shows an alert and refreshes `nearbySOS`.
- Location unavailable: `nearbySOS` polling simply doesn't start (mirrors existing `triggerSOS` guard on missing `location`).
- Network failure on poll: silently retried next interval (same pattern as existing `fetchReports`/`fetchHeatmap` — logs to console, no user-facing error for background polls).

## Testing / Verification

- Backend: manually exercise `GET /api/sos/active`, `POST /api/sos/{id}/respond` (including self-response and double-claim rejection) via `/docs` or `curl`.
- Manual two-device/simulator test: User A triggers SOS, User B sees banner within 3s on `HomeScreen`, User B responds, User A's `SOSScreen` reflects responder info within 3s.

## Out of Scope

- WebSockets / push notifications (polling only, matches existing pattern and 2-day-plan rationale).
- Multi-responder coordination beyond single-claim.
- PostGIS-based radius queries (plain haversine is sufficient and consistent with existing code).
