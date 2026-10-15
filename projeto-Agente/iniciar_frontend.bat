@echo off
title Microsoft AI Foundry - Agent Studio
echo ========================================================
echo   Iniciando o Front-end do Agente (Microsoft Foundry)
echo ========================================================
echo.

if exist .venv\Scripts\python.exe (
    .venv\Scripts\python.exe run_app.py
) else (
    python run_app.py
)

pause
