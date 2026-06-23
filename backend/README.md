# Xccelera Platform — Demo Backend

## Quick Start
```bat
cd D:\ProjectManagerAI\backend

# First time only — create & activate venv
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt

# Every time
venv\Scripts\activate
set ANTHROPIC_API_KEY=your_key_here  # optional — AI features mock gracefully without it
python -m uvicorn main:app --reload --port 8000
```

## API Documentation
Visit http://localhost:8000/docs

## Default Login
- Email: demo@xccelera.ai
- Password: demo123

## Architecture
This unified demo backend implements all 13 microservices in one application.
All endpoints are prefixed with /api/v1/
