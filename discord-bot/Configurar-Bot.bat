@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Instala Node.js 24.17 o posterior desde https://nodejs.org/
  pause
  exit /b 1
)
node tools\runtime-check.mjs
if errorlevel 1 (
  pause
  exit /b 1
)
node tools\setup.mjs
if errorlevel 1 (
  echo No se completo. Revisa el mensaje anterior.
  pause
  exit /b 1
)
pause
