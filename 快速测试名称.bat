@echo off
chcp 65001 >nul
echo ========================================
echo 快速测试App Store应用名称
echo ========================================
echo.

python3 快速测试AppStore名称.py 2>nul
if %errorlevel% neq 0 (
    python 快速测试AppStore名称.py
)

pause

