@echo off
REM デスクトップショートカット用「MDB 同期 (手動)」。
REM --force オプションで 24時間スキップを無視して必ず同期する。

cd /d "%~dp0\.."

set LOG=%~dp0sync-order-stats.log

echo. >> "%LOG%"
echo ===== [MANUAL] %date% %time% ===== >> "%LOG%"
call npm run sync-order-stats -- --force >> "%LOG%" 2>&1

if %ERRORLEVEL% EQU 0 (
  echo MDB 同期に成功しました。
) else (
  echo MDB 同期でエラーが発生しました。scripts\sync-order-stats.log を確認してください。
)
pause
exit /b %ERRORLEVEL%
