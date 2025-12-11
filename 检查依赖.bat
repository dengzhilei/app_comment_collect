@echo off
chcp 65001 >nul
echo ========================================
echo 检查Python依赖
echo ========================================
echo.

python3 检查依赖.py 2>nul
if errorlevel 1 (
    python 检查依赖.py
)

pause

