@echo off
chcp 65001 >nul
echo ========================================
echo GitHub上传助手
echo ========================================
echo.

REM 检查Git是否安装
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo 错误: 未找到Git
    echo.
    echo 请先安装Git: https://git-scm.com/downloads
    echo.
    pause
    exit /b 1
)

echo Git已安装
git --version
echo.

echo ========================================
echo 步骤1: 检查Git仓库状态
echo ========================================
echo.

REM 检查是否已初始化
if exist .git (
    echo Git仓库已初始化
    git status
) else (
    echo Git仓库未初始化，开始初始化...
    git init
    echo.
    echo 添加文件到暂存区...
    git add .
    echo.
    echo 创建首次提交...
    git commit -m "Initial commit: 游戏评论采集和筛选工具"
    echo.
    echo ✓ 初始化完成
    echo.
    echo 下一步：请手动添加远程仓库并推送
    echo.
    echo 命令：
    echo   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
    echo   git branch -M main
    echo   git push -u origin main
    echo.
    pause
    exit /b 0
)

echo.
echo ========================================
echo 步骤2: 查看当前状态
echo ========================================
echo.

git status

echo.
echo ========================================
echo 提示
echo ========================================
echo.
echo 如果有未提交的更改，请运行：
echo   git add .
echo   git commit -m "更新说明"
echo   git push
echo.
echo 详细说明请查看: GitHub上传指南.md
echo.
pause

