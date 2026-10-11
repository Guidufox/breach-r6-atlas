@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Instala Node.js 24.17 o posterior desde https://nodejs.org/
  pause
  exit /b 1
)
if not exist node_modules\discord.js\package.json (
  echo Ejecuta Instalar-Bot.bat primero.
  pause
  exit /b 1
)
node tools\runtime-check.mjs
if errorlevel 1 (
  pause
  exit /b 1
)
if not exist .env (
  echo Ejecuta Configurar-Bot.bat primero.
  pause
  exit /b 1
)
node --env-file=.env src\start.mjs
if errorlevel 1 (
  echo No se completo. Revisa el mensaje anterior.
  pause
  exit /b 1
)
pause
