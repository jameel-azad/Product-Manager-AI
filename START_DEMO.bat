@echo off
echo ==========================================
echo   Xccelera AI-SDLC Platform - Demo Start
echo ==========================================
echo.

echo Clearing ports 8000 and 3000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000 "') do (
    if not "%%a"=="0" taskkill /F /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000 "') do (
    if not "%%a"=="0" taskkill /F /PID %%a >nul 2>&1
)
timeout /t 2 /nobreak >nul

echo [1/2] Starting backend on port 8000...
start "Xccelera Backend" cmd /k "cd /d D:\ProjectManagerAI\backend && venv\Scripts\activate && python -m uvicorn main:app --reload --port 8000"

echo Waiting for backend to boot...
timeout /t 6 /nobreak >nul

echo [2/2] Starting frontend on port 3000...
start "Xccelera Frontend" cmd /k "cd /d D:\ProjectManagerAI\frontend\web-app && npx next dev --port 3000"

echo.
echo ==========================================
echo  Frontend:  http://localhost:3000
echo  API Docs:  http://localhost:8000/docs
echo  Login:     demo@xccelera.ai / demo123
echo ==========================================
echo.
echo Opening browser in 12 seconds...
timeout /t 12 /nobreak >nul
start http://localhost:3000
