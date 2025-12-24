@echo off
chcp 65001 >nul
echo ========================================
echo TopTycoon iOS 采集测试
echo ========================================
echo.

REM 检查Python版本
python3 --version >nul 2>&1
if %errorlevel% == 0 (
    set PYTHON_CMD=python3
) else (
    python --version >nul 2>&1
    if %errorlevel% == 0 (
        set PYTHON_CMD=python
    ) else (
        echo 错误: 未找到Python
        pause
        exit /b 1
    )
)

echo 使用: %PYTHON_CMD%
echo.
echo 开始测试iOS数据采集...
echo 测试配置: 最近30天，最多50条评论
echo.

%PYTHON_CMD% test_ios_scraper.py

echo.
echo ========================================
echo 测试完成
echo ========================================
echo.
pause

