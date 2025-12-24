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

REM 如果提供了命令行参数，直接使用
if not "%1"=="" (
    echo 开始采集: %1
    echo 这可能需要一些时间，请耐心等待...
    echo.
    %PYTHON_CMD% 采集评论.py %*
    goto :end
)

REM 交互式输入
echo ========================================
echo 可用游戏列表:
echo ========================================
echo   1. Carnival Tycoon
echo   2. TopTycoon
echo   3. Animals ^& Coins
echo   4. Fish of Fortune
echo   5. Fishing Travel
echo   6. Fishing Master
echo   7. Cash Club
echo   8. Sunday City: Life RolePlay
echo   9. 手动输入游戏名称
echo ========================================
echo.

set /p GAME_CHOICE="请选择游戏 (1-9): "

if "%GAME_CHOICE%"=="1" set GAME_NAME=Carnival Tycoon
if "%GAME_CHOICE%"=="2" set GAME_NAME=TopTycoon
if "%GAME_CHOICE%"=="3" set GAME_NAME=Animals & Coins
if "%GAME_CHOICE%"=="4" set GAME_NAME=Fish of Fortune
if "%GAME_CHOICE%"=="5" set GAME_NAME=Fishing Travel
if "%GAME_CHOICE%"=="6" set GAME_NAME=Fishing Master
if "%GAME_CHOICE%"=="7" set GAME_NAME=Cash Club
if "%GAME_CHOICE%"=="8" set GAME_NAME=Sunday City: Life RolePlay
if "%GAME_CHOICE%"=="9" (
    set /p GAME_NAME="请输入游戏名称: "
)

if "%GAME_NAME%"=="" (
    echo 错误: 未选择游戏
    pause
    exit /b 1
)

echo.
echo 已选择游戏: %GAME_NAME%
echo.

REM 询问时间范围
echo ========================================
echo 时间范围设置
echo ========================================
echo   1. 最近一年 (默认)
echo   2. 自定义时间范围
echo ========================================
echo.

set /p TIME_CHOICE="请选择时间范围 (1-2): "

if "%TIME_CHOICE%"=="2" (
    echo.
    set /p START_DATE="请输入开始日期 (格式: YYYY-MM-DD, 例如: 2025-09-01): "
    set /p END_DATE="请输入结束日期 (格式: YYYY-MM-DD, 例如: 2025-12-31): "
    
    if "%START_DATE%"=="" (
        echo 错误: 开始日期不能为空
        pause
        exit /b 1
    )
    if "%END_DATE%"=="" (
        echo 错误: 结束日期不能为空
        pause
        exit /b 1
    )
    
    echo.
    echo 开始采集: %GAME_NAME%
    echo 时间范围: %START_DATE% 至 %END_DATE%
    echo 这可能需要一些时间，请耐心等待...
    echo.
    
    %PYTHON_CMD% 采集评论.py "%GAME_NAME%" %START_DATE% %END_DATE%
) else (
    echo.
    echo 开始采集: %GAME_NAME%
    echo 时间范围: 最近一年 (默认)
    echo 这可能需要一些时间，请耐心等待...
    echo.
    
    %PYTHON_CMD% 采集评论.py "%GAME_NAME%"
)

:end
echo.
echo ========================================
echo 采集完成
echo ========================================
echo.
pause
