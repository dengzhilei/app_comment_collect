@echo off
chcp 65001 >nul
echo ========================================
echo TopTycoon 数据采集
echo 时间范围: 2025年9月-12月
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
echo 开始采集TopTycoon的评论数据...
echo.

%PYTHON_CMD% 采集TopTycoon.py

echo.
echo ========================================
echo 采集完成
echo ========================================
echo.
echo 下一步：运行 "运行粗筛.bat" 进行评论筛选
echo.
pause

