from auth_utils import normalize_phone_for_sms
from database import SessionLocal
from models import UserOTP

phone = '9999999999'
code = '3705'
np = normalize_phone_for_sms(phone)
print('normalized:', np)

s = SessionLocal()
rec = s.query(UserOTP).filter(UserOTP.phone == np, UserOTP.otp_code == code).first()
if rec:
    print('FOUND', rec.id, rec.phone, rec.otp_code, rec.expires_at)
else:
    print('NOT FOUND')
s.close()
