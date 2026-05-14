@echo off
REM Windows タスクスケジューラから呼ばれるラッパー。
REM プロジェクトフォルダに cd して npm run sync-order-stats を実行し、ログをファイルに残す。
REM
REM 起動時 (ONLOGON) に呼ばれる想定。前回成功から7日以内に同期済みなら自動でスキップする。

cd /d "%~dp0\.."

REM ログは scripts/sync-order-stats.log に追記
set LOG=%~dp0sync-order-stats.log

echo. >> "%LOG%"
echo ===== %date% %time% ===== >> "%LOG%"
call npm run sync-order-stats >> "%LOG%" 2>&1

exit /b %ERRORLEVEL%
