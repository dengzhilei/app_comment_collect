@echo off
chcp 65001 >nul
echo ========================================
echo 游戏评论翻译工具（DeepSeek 并发版）
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
echo 将从 output/reports/读取待翻译的TXT文件
echo 翻译结果保存到 output/reports_chs/
echo.

%PYTHON_CMD% -m src.translate_reviews

echo.
echo ========================================
echo 翻译流程结束
echo ========================================
echo.
echo 中文报告位置:output/reports_chs
echo.
pause
