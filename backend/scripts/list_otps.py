import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from database import SessionLocal
from models import UserOTP

s = SessionLocal()
rows = s.query(UserOTP).all()
if not rows:
    print('NO_OTPS')
else:
    for r in rows:
        print(r.id, r.phone, r.otp_code, r.expires_at)
s.close()
