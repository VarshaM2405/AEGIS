import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

load_dotenv()


def _get_database_url():
    configured_url = os.getenv("DATABASE_URL") or os.getenv("AEGIS_DATABASE_URL")
    if configured_url:
        return configured_url
    return "sqlite:///./aegis.db"


DATABASE_URL = _get_database_url()
IS_SQLITE = DATABASE_URL.startswith("sqlite")

engine_kwargs = {}
if IS_SQLITE:
    engine_kwargs["connect_args"] = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, **engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_geom_column():
    if IS_SQLITE:
        from sqlalchemy import String
        return String

    from geoalchemy2 import Geometry
    return Geometry(geometry_type="POINT", srid=4326)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
