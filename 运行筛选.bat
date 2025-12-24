@echo off
chcp 65001 >nul
echo ========================================
echo 评论筛选工具
echo 筛选有意义的评论，输出到文档
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
echo 使用方法: 运行筛选.bat "游戏名称"
echo 示例: 运行筛选.bat "TopTycoon"
echo 示例: 运行筛选.bat "Sunday City: Life RolePlay"
echo 如果不提供游戏名称，将自动使用最新的数据文件
echo.

if "%1"=="" (
    echo 未指定游戏名称，将自动查找最新的数据文件...
    echo.
    %PYTHON_CMD% main_simple_filter.py
) else (
    echo 开始筛选: %1
    echo.
    %PYTHON_CMD% main_simple_filter.py "%1"
)

echo.
echo ========================================
echo 筛选完成
echo ========================================
echo.
echo 查看结果：
echo   详细版: output\reports\ (Markdown格式)
echo   简化版: output\reports\ (TXT格式，可直接复制给AI)
echo.
pause

