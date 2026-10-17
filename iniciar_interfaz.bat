@echo off
title KittenTTS Studio
echo ========================================================
echo         Iniciando KittenTTS Studio Web UI
echo ========================================================
echo Abriendo servidor en http://127.0.0.1:7860 ...
echo.

start "" "http://127.0.0.1:7860"
.venv\Scripts\python.exe server.py

pause
