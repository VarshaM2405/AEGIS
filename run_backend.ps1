cd C:\AEGIS_FINAL\AEGIS\backend
if (Test-Path .\.venv\Scripts\Activate.ps1) {
    . .\.venv\Scripts\Activate.ps1
}
else {
    py -3 -m venv .venv
    . .\.venv\Scripts\Activate.ps1
    python -m pip install --upgrade pip
    python -m pip install -r requirements.txt
}
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
