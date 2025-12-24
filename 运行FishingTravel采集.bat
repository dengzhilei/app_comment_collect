@echo off
chcp 65001 >nul
echo ========================================
echo Fishing Travel 评论采集
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
        echo 错误: 未找到Python，请先安装Python 3.8或更高版本
        pause
        exit /b 1
    )
)

echo 使用: %PYTHON_CMD%
echo.
echo 开始采集 Fishing Travel 的评论...
echo 这可能需要一些时间，请耐心等待...
echo.

%PYTHON_CMD% 采集FishingTravel.py

echo.
echo ========================================
echo 采集完成
echo ========================================
echo.
pause

