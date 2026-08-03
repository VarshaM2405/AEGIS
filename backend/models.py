import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime
from geoalchemy2 import Geometry
from database import Base

class CrimeIncident(Base):
    __tablename__ = "crime_incidents"
    id = Column(Integer, primary_key=True, autoincrement=True)
    crime_type = Column(String)
    severity = Column(Integer)
    latitude = Column(Float)
    longitude = Column(Float)

    # PostGIS Geometry
    geom = Column(Geometry(geometry_type='POINT', srid=4326))

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
    
    geom = Column(Geometry(geometry_type='POINT', srid=4326), nullable=True)

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
    
    geom = Column(Geometry(geometry_type='POINT', srid=4326), nullable=True)
