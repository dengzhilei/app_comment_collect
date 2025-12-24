@echo off
chcp 65001 >nul
echo ========================================
echo 验证App Store ID
echo ========================================
echo.

python3 验证AppStore_ID.py 2>nul
if %errorlevel% neq 0 (
    python 验证AppStore_ID.py
)

pause

