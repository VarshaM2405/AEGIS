import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, UniqueConstraint
from database import Base, get_geom_column

class CrimeIncident(Base):
    __tablename__ = "crime_incidents"
    id = Column(Integer, primary_key=True, autoincrement=True)
    crime_type = Column(String)
    severity = Column(Integer)
    latitude = Column(Float)
    longitude = Column(Float)

    # Geometry column that works with SQLite for local runs and PostGIS in production
    geom = Column(get_geom_column())

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
    # Auto-detection metadata (populated when source == "auto_wearable"), carried
    # through from the wearable's on-device DetectionEngine at trigger time —
    # no separate vitals-ingest table, this is the point-of-trigger snapshot.
    source = Column(String, default="manual")  # "manual" | "auto_wearable"
    detection_bpm = Column(Float, nullable=True)
    detection_motion_score = Column(Float, nullable=True)
    detection_confidence = Column(Float, nullable=True)
    detection_timestamp = Column(DateTime, nullable=True)

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=True)
    phone = Column(String, unique=True, index=True)
    area = Column(String, nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    is_verified = Column(Boolean, default=False)
    registered_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    geom = Column(get_geom_column(), nullable=True)

class Volunteer(Base):
    __tablename__ = "volunteers"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    phone = Column(String, unique=True, index=True, nullable=False)
    location_name = Column(String, nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    availability = Column(String, nullable=False)
    radius = Column(Float, default=2.0)
    language = Column(String, nullable=True)
    training = Column(Boolean, default=False)
    registered_at = Column(DateTime, default=datetime.datetime.utcnow)

class UserOTP(Base):
    __tablename__ = "user_otps"
    id = Column(Integer, primary_key=True, autoincrement=True)
    phone = Column(String, index=True)
    otp_code = Column(String)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    expires_at = Column(DateTime)

class IncidentReport(Base):
    __tablename__ = "incident_reports"
    id = Column(Integer, primary_key=True, autoincrement=True)
    type = Column(String)
    description = Column(String)
    latitude = Column(Float)
    longitude = Column(Float)
    user_id = Column(String, nullable=True)
    responder_id = Column(String, nullable=True)
    status = Column(String, default="pending")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    photos = Column(String, nullable=True)

    geom = Column(get_geom_column(), nullable=True)

class Trip(Base):
    """A "share my walk/ride" session — independent of SOS. owner posts location
    updates while active; recipient (an AEGIS user, no account/auth needed) looks it
    up by trip_code, texted to them via SMS at start (see StartTripScreen.js)."""
    __tablename__ = "trips"
    id = Column(Integer, primary_key=True, autoincrement=True)
    trip_code = Column(String, unique=True, index=True, nullable=False)
    owner_phone = Column(String, nullable=False)
    owner_name = Column(String, nullable=True)
    recipient_phone = Column(String, nullable=True)
    status = Column(String, default="active")  # active, ended
    start_latitude = Column(Float, nullable=True)
    start_longitude = Column(Float, nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    destination_label = Column(String, nullable=True)
    destination_latitude = Column(Float, nullable=True)
    destination_longitude = Column(Float, nullable=True)
    eta_minutes = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow)
    ended_at = Column(DateTime, nullable=True)

class Message(Base):
    """One chat message in a thread keyed by (thread_type, thread_id) — 'sos'+SOSEvent.id
    or 'report'+IncidentReport.id. Only meaningful once a responder is assigned to that
    thread (enforced at the endpoint, not here)."""
    __tablename__ = "messages"
    id = Column(Integer, primary_key=True, autoincrement=True)
    thread_type = Column(String, index=True, nullable=False)  # "sos" | "report"
    thread_id = Column(Integer, index=True, nullable=False)
    sender_phone = Column(String, nullable=False)
    sender_name = Column(String, nullable=True)
    body = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class ReportConfirmation(Base):
    """One row per (report, confirmer) — nearby users vouching a report is real.
    The UniqueConstraint is what actually enforces "one confirmation per user per
    report", atomically, rather than an app-level check-then-insert race."""
    __tablename__ = "report_confirmations"
    id = Column(Integer, primary_key=True, autoincrement=True)
    report_id = Column(Integer, index=True, nullable=False)
    confirmer_phone = Column(String, index=True, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    __table_args__ = (UniqueConstraint('report_id', 'confirmer_phone', name='uq_report_confirmer'),)
