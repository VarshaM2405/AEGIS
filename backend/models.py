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

class CommunityMember(Base):
    __tablename__ = "community_members"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String)
    phone = Column(String)
    area = Column(String)
    latitude = Column(Float)
    longitude = Column(Float)
    registered_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    geom = Column(Geometry(geometry_type='POINT', srid=4326))
