@echo off
chcp 65001 >nul
echo ========================================
echo 智能安装Python依赖
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

REM 先安装基础依赖
echo [1/4] 安装基础工具...
%PYTHON_CMD% -m pip install --upgrade pip setuptools wheel --quiet

echo [2/4] 安装数据采集依赖...
echo 注意: 先安装app-store-scraper以解决依赖冲突...
%PYTHON_CMD% -m pip install app-store-scraper --quiet
if %errorlevel% neq 0 (
    echo 警告: app-store-scraper 安装失败
) else (
    echo app-store-scraper 安装成功
)
%PYTHON_CMD% -m pip install google-play-scraper --quiet
if %errorlevel% neq 0 (
    echo 警告: google-play-scraper 安装失败
)

echo [3/4] 安装数据处理依赖...
echo 注意: 跳过requests，因为已由app-store-scraper安装...
%PYTHON_CMD% -m pip install pyyaml pandas numpy beautifulsoup4 lxml tqdm python-dateutil --quiet

echo [4/4] 安装分析和可视化依赖...
%PYTHON_CMD% -m pip install jieba snownlp textblob nltk vaderSentiment matplotlib seaborn plotly wordcloud --quiet

echo.
echo ========================================
echo 步骤3: 验证安装
echo ========================================
%PYTHON_CMD% 检查依赖.py

echo.
echo ========================================
echo 安装完成！
echo ========================================
echo.
echo 现在可以运行测试了：
echo   双击 "运行测试.bat" 或运行: %PYTHON_CMD% test_scraper.py
echo.
pause

