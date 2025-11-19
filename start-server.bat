@echo off
echo Starting WebKeys Server...
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0start-server.ps1"
pause

