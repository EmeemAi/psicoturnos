@echo off
title PsicoTurnos - Consultorio de Psicologia
chcp 65001 >nul
cls

echo ==========================================================
echo       🌿 INICIANDO CONSULTORIO DIGITAL PSICOTURNOS
echo ==========================================================
echo.

where python >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Iniciando servidor local con Python...
    echo Abriendo navegador en http://localhost:3000
    python "%~dp0server.py"
) else (
    where py >nul 2>nul
    if %ERRORLEVEL% EQU 0 (
        echo Iniciando servidor local con Python Launcher...
        py "%~dp0server.py"
    ) else (
        echo Abriendo la aplicacion directamente en tu navegador web...
        start "" "%~dp0index.html"
    )
)
