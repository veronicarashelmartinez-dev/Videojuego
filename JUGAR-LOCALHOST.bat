@echo off
title ZONA CERO - servidor local
chcp 65001 >nul
cd /d "%~dp0"

where python >nul 2>nul
if errorlevel 1 (
  echo.
  echo  No se encontro Python en el sistema.
  echo  Se abrira el juego directamente (funciona igual, sin servidor).
  echo.
  start "" "%~dp0index.html"
  pause
  exit /b
)

echo.
echo  ================================
echo   ZONA CERO - servidor local
echo   http://localhost:8080
echo  ================================
echo.
echo  Manteniendo esta ventana abierta mientras juegas.
echo  Cierra la ventana para detener el servidor.
echo.

start "ZONA CERO - servidor" /min cmd /c "python -m http.server 8080"
timeout /t 2 /nobreak >nul
start "" "http://localhost:8080/index.html"

pause
