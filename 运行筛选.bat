@echo off
chcp 65001 >nul
echo ========================================
echo 评论筛选工具
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

REM 如果提供了命令行参数，直接使用
if not "%1"=="" (
    echo 开始筛选: %1
    echo.
    %PYTHON_CMD% main_simple_filter.py "%1"
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
echo   9. 自动使用最新的数据文件
echo  10. 手动输入游戏名称
echo ========================================
echo.

set /p GAME_CHOICE="请选择游戏 (1-10): "

if "%GAME_CHOICE%"=="1" set GAME_NAME=Carnival Tycoon
if "%GAME_CHOICE%"=="2" set GAME_NAME=TopTycoon
if "%GAME_CHOICE%"=="3" set GAME_NAME=Animals & Coins
if "%GAME_CHOICE%"=="4" set GAME_NAME=Fish of Fortune
if "%GAME_CHOICE%"=="5" set GAME_NAME=Fishing Travel
if "%GAME_CHOICE%"=="6" set GAME_NAME=Fishing Master
if "%GAME_CHOICE%"=="7" set GAME_NAME=Cash Club
if "%GAME_CHOICE%"=="8" set GAME_NAME=Sunday City: Life RolePlay
if "%GAME_CHOICE%"=="9" set GAME_NAME=
if "%GAME_CHOICE%"=="10" (
    set /p GAME_NAME="请输入游戏名称: "
)

echo.
if "%GAME_NAME%"=="" (
    echo 将自动查找最新的数据文件...
    echo.
    %PYTHON_CMD% main_simple_filter.py
) else (
    echo 开始筛选: %GAME_NAME%
    echo.
    %PYTHON_CMD% main_simple_filter.py "%GAME_NAME%"
)

:end
echo.
echo ========================================
echo 筛选完成
echo ========================================
echo.
echo 查看结果:
echo   精选评论: output\reports\ (TXT格式,可直接复制给AI)
echo.
pause
