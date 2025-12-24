@echo off
chcp 65001 >nul
echo ========================================
echo TopTycoon iOS 采集测试 (Playwright方法)
echo ========================================
echo.
echo 注意：此方法会打开浏览器窗口
echo 这是正常的，用于模拟真实用户访问
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

REM 检查是否安装了playwright
%PYTHON_CMD% -c "import playwright" >nul 2>&1
if %errorlevel% neq 0 (
    echo 警告: playwright 未安装
    echo.
    echo 正在安装 playwright...
    %PYTHON_CMD% -m pip install playwright
    echo.
    echo 正在安装浏览器驱动...
    %PYTHON_CMD% -m playwright install chromium
    echo.
)

echo 开始测试...
echo.

%PYTHON_CMD% test_ios_playwright.py

echo.
echo ========================================
echo 测试完成
echo ========================================
echo.
pause

