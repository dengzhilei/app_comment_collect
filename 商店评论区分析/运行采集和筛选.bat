@echo off
chcp 65001 >nul
echo ========================================
echo 评论采集与筛选工具
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
    %PYTHON_CMD% -m src.scrape %*
    
    REM 采集完成后自动筛选
    if %errorlevel% == 0 (
        echo.
        echo ========================================
        echo 采集完成，开始自动筛选...
        echo ========================================
        echo.
        %PYTHON_CMD% -m src.filter "%1"
    )
    goto :end
)

REM 交互式输入 - 使用Python脚本从config.yaml动态读取配置
echo ========================================
echo 正在加载配置...
echo ========================================
echo.

%PYTHON_CMD% -m src.interactive.scrape_and_filter

:end
echo.
echo ========================================
echo 全部完成
echo ========================================
echo.
echo 查看结果:
echo   精选评论: output\reports\ (TXT格式,可直接复制给AI)
echo.
pause

