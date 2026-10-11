@echo off
setlocal EnableExtensions DisableDelayedExpansion
title Breach - R6 Atlas
set "BREACH_HTML=%~dp0index.html"

for %%F in (index.html app.js data.js ui.js features.js advanced.js vendor\jspdf.umd.min.js vendor\fflate.js style.css maps\bank.js) do (
  if not exist "%~dp0%%F" goto :missing
)

rem Let Windows open the actual HTML file and resolve its file URL.
rem Do not construct a file URL from a Windows path or use Edge app flags.
start "" "%BREACH_HTML%"
if errorlevel 1 goto :failed
exit /b 0

:missing
echo.
echo No se encuentran los archivos de Breach junto a este lanzador.
echo.
echo 1. Cierra esta ventana.
echo 2. Haz clic derecho en el ZIP y elige Extraer todo.
echo 3. Entra a la carpeta extraida Breach-R6-Atlas.
echo 4. Abre index.html o ejecuta Abrir-Breach.bat desde esa carpeta.
echo.
echo El lanzador no puede ejecutarse solo ni desde dentro del ZIP.
echo.
pause
exit /b 1

:failed
echo.
echo Windows no pudo abrir el archivo HTML.
echo Haz clic derecho en index.html y elige Abrir con Microsoft Edge o Chrome.
echo.
pause
exit /b 1
