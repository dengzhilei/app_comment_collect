@echo off
chcp 65001 >nul
echo ========================================
echo 评论采集工具
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
echo 使用方法: 运行采集.bat "游戏名称" [开始日期] [结束日期]
echo 示例: 运行采集.bat "TopTycoon" 2025-09-01 2025-12-31
echo 示例: 运行采集.bat "Sunday City: Life RolePlay"
echo.

if "%1"=="" (
    echo 错误: 请提供游戏名称
    echo.
    echo 可用游戏列表（请查看 config.yaml）:
    echo.
    pause
    exit /b 1
)

echo 开始采集: %1
echo 这可能需要一些时间，请耐心等待...
echo.

%PYTHON_CMD% 采集评论.py %*

echo.
echo ========================================
echo 采集完成
echo ========================================
echo.
pause

