@echo off
rem ===== 自動提案用 MDB API サーバー起動バッチ =====
rem 事前準備:
rem   1) pip install -r requirements.txt
rem   2) 同じフォルダに .env を置き、MDB_API_TOKEN=... を記載
rem   3) Cloudflare Tunnel など別途トンネルを起動

setlocal

cd /d "%~dp0"

if exist ".env" (
  for /f "usebackq tokens=1,* delims==" %%A in (".env") do (
    if not "%%A"=="" if not "%%A:~0,1%"=="#" set "%%A=%%B"
  )
)

if "%MDB_API_TOKEN%"=="" (
  echo [ERROR] MDB_API_TOKEN が設定されていません。scripts\.env に MDB_API_TOKEN=xxx を記載してください。
  pause
  exit /b 1
)

if "%PORT%"=="" set PORT=5050
if "%MDB_PATH%"=="" set MDB_PATH=C:\Users\smili\Documents\system\sysdata.mdb

echo MDB_PATH = %MDB_PATH%
echo PORT     = %PORT%
echo.
echo MDB API サーバーを起動します。停止するときはこのウィンドウを閉じてください。

python "%~dp0mdb-server.py"

endlocal
