@echo off
title Rithka Billing & Outward Delivery Challan ERP
color 0A
echo ========================================================
echo   Rithka Billing, Inward Stock & Outward Challan ERP
echo   Shri.Bharathi & Co., Coimbatore
echo ========================================================
echo.

set PATH=C:\Users\laksh\nodejs;%PATH%

echo Checking Node.js runtime...
node -v
if %errorlevel% neq 0 (
  echo Error: Node.js is not found in PATH or C:\Users\laksh\nodejs.
  pause
  exit /b 1
)

echo Starting ERP Production Server on http://localhost:5000 ...
echo.
echo Log in with:
echo   Owner / Admin:  admin   / admin123
echo   Worker Account: worker1 / worker123
echo.
start http://localhost:5000
node server/server.js
pause
