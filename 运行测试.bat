@echo off
chcp 65001 >nul
echo ========================================
echo 开始测试数据采集功能
echo ========================================
echo.

REM 尝试使用python3，如果不存在则使用python
python3 test_scraper.py 2>nul
if errorlevel 1 (
    echo 尝试使用python3失败，改用python...
    python test_scraper.py
)

echo.
echo ========================================
echo 测试完成
echo ========================================
pause

