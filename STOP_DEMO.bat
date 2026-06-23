@echo off
echo Stopping Xccelera demo servers...
taskkill /FI "WINDOWTITLE eq Xccelera Backend" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Xccelera Frontend" /F >nul 2>&1
echo Done.
