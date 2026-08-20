@echo off
chcp 65001 >nul
set PYTHONUTF8=1
cd /d "%~dp0"

if "%~1"=="" (
  "C:\Python\python.exe" update_gold_data.py
) else (
  "C:\Python\python.exe" update_gold_data.py "%~1"
)

if errorlevel 1 (
  echo.
  echo 更新失败，请检查上面的错误提示。
)

echo.
pause
