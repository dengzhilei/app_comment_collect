@echo off
chcp 65001 >nul
echo ========================================
echo 安装 Python 3
echo ========================================
echo.

REM 检查是否已安装 Python
python --version >nul 2>&1
if %errorlevel% == 0 (
    echo Python 已安装！
    python --version
    echo.
    echo 是否要重新安装或升级 Python?
    set /p REINSTALL="输入 Y 继续安装，其他键退出: "
    if /i not "%REINSTALL%"=="Y" (
        echo 已取消安装
        pause
        exit /b 0
    )
)

python3 --version >nul 2>&1
if %errorlevel% == 0 (
    echo Python3 已安装！
    python3 --version
    echo.
    echo 是否要重新安装或升级 Python?
    set /p REINSTALL="输入 Y 继续安装，其他键退出: "
    if /i not "%REINSTALL%"=="Y" (
        echo 已取消安装
        pause
        exit /b 0
    )
)

echo.
echo 正在使用 winget 安装 Python 3...
echo 这可能需要几分钟，请耐心等待...
echo.

REM 使用 winget 安装 Python 3
winget install Python.Python.3.12 --silent --accept-package-agreements --accept-source-agreements

if %errorlevel% == 0 (
    echo.
    echo ========================================
    echo 安装成功！
    echo ========================================
    echo.
    echo 请关闭并重新打开命令行窗口，然后运行以下命令验证安装：
    echo   python --version
    echo.
    echo 如果命令不工作，可能需要手动添加到 PATH 环境变量
    echo 或者使用完整路径：C:\Users\%USERNAME%\AppData\Local\Programs\Python\Python312\python.exe
    echo.
) else (
    echo.
    echo ========================================
    echo 安装失败
    echo ========================================
    echo.
    echo 如果 winget 安装失败，您可以：
    echo 1. 手动从 https://www.python.org/downloads/ 下载安装
    echo 2. 确保在安装时勾选 "Add Python to PATH" 选项
    echo.
)

pause

