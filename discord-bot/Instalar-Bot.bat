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
call npm ci --no-fund
if errorlevel 1 (
  echo No se completo. Revisa el mensaje anterior.
  pause
  exit /b 1
)
echo Preparando las imagenes de los 29 mapas. Puede tardar unos minutos.
node tools\build-images.mjs
if errorlevel 1 (
  echo No se pudieron generar las imagenes. Revisa el error anterior.
  pause
  exit /b 1
)
echo Instalacion completa. Ahora ejecuta Configurar-Bot.bat.
pause
