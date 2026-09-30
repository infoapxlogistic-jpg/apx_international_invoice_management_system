@echo off
title Invoice Manager
cd /d "%~dp0"

rem Start MySQL if it is not already running (it is not installed as a Windows service here).
powershell -NoProfile -Command "if (-not (Get-NetTCPConnection -LocalPort 3306 -State Listen -ErrorAction SilentlyContinue)) { Start-Process -WindowStyle Hidden 'C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqld.exe' '--defaults-file=\"C:\ProgramData\MySQL\MySQL Server 8.4\my.ini\"'; Start-Sleep 5 }"

start "Invoice API" cmd /k "cd /d backend && .venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000"
start "Invoice Web" cmd /k "cd /d frontend && npm run dev"

timeout /t 4 >nul
start http://localhost:5173
