@echo off
setlocal
title Breach - Actualizar mapas
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Actualizar-Mapas.ps1"
echo.
pause
