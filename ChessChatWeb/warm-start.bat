@echo off
REM Quick launcher for Render warm-start script
REM Usage: warm-start.bat

echo.
echo Starting Render Stockfish warm-start script...
echo.

powershell.exe -ExecutionPolicy Bypass -File "%~dp0warm-start-render.ps1"

pause
