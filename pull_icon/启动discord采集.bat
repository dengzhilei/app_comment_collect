@echo off
title Chrome 日常环境调试模式
color 0e

echo ======================================================
echo   正在尝试以调试模式启动【日常环境】...
echo   警告：请务必确保已手动关闭所有现有的 Chrome 窗口！
echo ======================================================

:: 使用环境变量定位默认路径
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="%LOCALAPPDATA%\Google\Chrome\User Data"

echo.
echo [检查] 如果 Chrome 没开启新窗口，请在任务管理器杀掉所有 Chrome 进程再试。
echo [成功] 开启后，直接打开 Discord 即可，无需重新登录。
echo.
pause