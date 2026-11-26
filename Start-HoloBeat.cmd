@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-local.ps1" %*
if errorlevel 1 (
  echo.
  echo Launch failed. See the message above.
  if "%~1"=="" pause
  exit /b 1
)
exit /b 0
