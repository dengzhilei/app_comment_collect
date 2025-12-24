@echo off
chcp 65001 >nul
echo ========================================
echo Sunday City: Life RolePlay 评论粗筛工具
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
echo 开始筛选 Sunday City: Life RolePlay 评论...
echo.

%PYTHON_CMD% main_simple_filter.py "Sunday City: Life RolePlay"

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

