import pandas as pd
import os
from database import SessionLocal
import models

db = SessionLocal()
print("Current count:", db.query(models.CrimeIncident).count())

db.query(models.CrimeIncident).delete()
db.commit()

data_dir = os.path.join(os.path.dirname('c:\\AEGIS\\backend\\main.py'), 'data')
csv_path = os.path.join(data_dir, 'bangalore_crime_data.csv')
print("Reading CSV:", csv_path)

df = pd.read_csv(csv_path)
rows = []
for _, row in df.head(10000).iterrows():
    lat = float(row['Latitude'])
    lon = float(row['Longitude'])
    geom_wkt = f"SRID=4326;POINT({lon} {lat})"
    incident = models.CrimeIncident(
        crime_type=str(row['Crime_Type']),
        severity=int(row['Severity']),
        latitude=lat,
        longitude=lon,
        geom=geom_wkt
    )
    rows.append(incident)

db.bulk_save_objects(rows)
db.commit()

print("New count:", db.query(models.CrimeIncident).count())
