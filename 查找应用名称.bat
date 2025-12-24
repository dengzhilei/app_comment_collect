@echo off
chcp 65001 >nul
echo ========================================
echo 查找App Store应用名称
echo ========================================
echo.

python3 查找AppStore应用名称.py 2>nul
if %errorlevel% neq 0 (
    python 查找AppStore应用名称.py
)

pause

