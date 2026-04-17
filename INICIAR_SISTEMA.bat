@echo off
TITLE SoluVentas - Control de Servidor
COLOR 0B
echo ==========================================
echo       SISTEMA DE CONTROL SOLUVENTAS
echo ==========================================
echo.
echo [1] Iniciar Sistema (Solo Local)
echo [2] Iniciar Sistema + Compartir por Internet (HTTPS)
echo.
set /p opt="Seleccione una opcion [1-2]: "

if "%opt%"=="2" (
    echo.
    echo Iniciando Servidor y Tunel...
    echo IMPORTANTE: Copia la URL que aparezca abajo.
    echo.
    start cmd /k "npm start"
    npm run share
) else (
    echo.
    echo Iniciando Servidor Local...
    npm start
)

pause
