@echo off
chcp 65001 >nul
echo ========================================
echo 安装Python依赖
echo ========================================
echo.

REM 检查Python版本
python3 --version >nul 2>&1
if %errorlevel% == 0 (
    set PYTHON_CMD=python3
    for /f "tokens=2" %%i in ('python3 --version 2^>^&1') do set PYTHON_VERSION=%%i
) else (
    python --version >nul 2>&1
    if %errorlevel% == 0 (
        set PYTHON_CMD=python
        for /f "tokens=2" %%i in ('python --version 2^>^&1') do set PYTHON_VERSION=%%i
    ) else (
        echo 错误: 未找到Python，请先安装Python 3.8或更高版本
        pause
        exit /b 1
    )
)

echo Python版本: %PYTHON_VERSION%
echo.

REM 检查Python版本是否 >= 3.8
echo %PYTHON_VERSION% | findstr /R "^3\.[8-9]\|^3\.1[0-9]\|^[4-9]\." >nul
if %errorlevel% neq 0 (
    echo 警告: 建议使用Python 3.8或更高版本
    echo 当前版本可能不兼容某些依赖包
    echo.
    set /p CONTINUE="是否继续安装? (Y/N): "
    if /i not "%CONTINUE%"=="Y" exit /b 1
)

echo.
echo ========================================
echo 步骤1: 升级pip
echo ========================================
%PYTHON_CMD% -m pip install --upgrade pip --quiet

echo.
echo ========================================
echo 步骤2: 安装依赖包
echo ========================================
echo 这可能需要几分钟，请耐心等待...
echo.

%PYTHON_CMD% -m pip install -r requirements.txt

echo.
echo ========================================
echo 安装完成！
echo ========================================
echo.
echo 现在可以开始使用了：
echo   运行采集: 运行采集.bat "游戏名称"
echo   运行筛选: 运行筛选.bat "游戏名称"
echo.
pause

