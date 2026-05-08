# 自動提案用 MDB API サーバー セットアップ手順

発注書画面の「自動提案」ボタンは、Access の `sysdata.mdb` から昨年同時期の
受注実績を読み取って提案数量を計算します。Vercel などのクラウド環境からは
Windows ローカルの MDB ファイルを直接読めないため、**MDB を持っている PC で
小さな HTTP サーバー (`scripts/mdb-server.py`) を起動**し、
**Cloudflare Tunnel などで公開**して、Vercel 側からその URL を呼び出す構成にします。

```
[Vercel: order-frame]
   │ fetch + Bearer トークン
   ▼
[Cloudflare Tunnel] (固定 URL)
   ▼
[開発 PC] localhost:5050
   ├ Flask (scripts/mdb-server.py)
   └ pyodbc → sysdata.mdb
```

---

## 1. 開発 PC 側の準備

### 1-1. Python と依存パッケージ

すでに `python` コマンドが通る前提です。プロジェクト直下で:

```bat
cd C:\work\claude\order-frame
pip install -r scripts\requirements.txt
```

> `pyodbc` が `Microsoft Access Driver` を必要とします。Office 32bit/64bit の
> どちらが入っているかで Python 側の bit 数を合わせる必要があります。
> 32bit 版 Office なら **32bit Python** を使ってください。

### 1-2. トークンを生成

ランダムな 32 文字以上の文字列を作成します。例:

```bat
powershell -Command "[Guid]::NewGuid().ToString('N') + [Guid]::NewGuid().ToString('N')"
```

出力をコピーしておきます（例: `b2a1...`）。これを **共有シークレット**として、
開発 PC の Flask 起動時と Vercel 側の両方に同じ値で設定します。

### 1-3. `scripts/.env` を作成

`scripts` フォルダに `.env` を作り、以下を記載します（git 管理外）。

```
MDB_API_TOKEN=ここに 1-2 で作ったトークン
MDB_PATH=C:\Users\smili\Documents\system\sysdata.mdb
PORT=5050
```

### 1-4. サーバー起動

```bat
scripts\start-mdb-server.bat
```

別のコマンドプロンプトで動作確認:

```bat
curl -H "Authorization: Bearer <トークン>" "http://localhost:5050/order-stats?deliveryDate=2026-06-02"
```

`stats`, `period`, `totalOrders` を含む JSON が返れば成功です。

> Microsoft Access で `sysdata.mdb` を開いていると、排他ロックで pyodbc が
> 接続できないことがあります。Access 側を閉じてから試してください。

---

## 2. Cloudflare Tunnel で公開

ローカル `http://localhost:5050` を、外から到達できる固定 HTTPS URL にします。
ここでは Cloudflare Tunnel を使う例を示します（無料、固定 URL、ポート開放不要）。

### 2-1. cloudflared をインストール

[Cloudflare のドキュメント](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) から `cloudflared.exe` をダウンロード。

### 2-2. ログイン

```bat
cloudflared tunnel login
```

ブラウザが開くので、Cloudflare に登録済みのドメインを選択します。
（独自ドメインを所有していない場合は、後述の「お試しトンネル」を参照）

### 2-3. トンネル作成と DNS

```bat
cloudflared tunnel create mdb-dev
cloudflared tunnel route dns mdb-dev mdb-dev.example.com
```

`%USERPROFILE%\.cloudflared\config.yml` を作成:

```yaml
tunnel: mdb-dev
credentials-file: C:\Users\smili\.cloudflared\<TUNNEL_ID>.json

ingress:
  - hostname: mdb-dev.example.com
    service: http://localhost:5050
  - service: http_status:404
```

### 2-4. トンネル起動

```bat
cloudflared tunnel run mdb-dev
```

外部から `https://mdb-dev.example.com/healthz` にアクセスして
`{"ok": true, ...}` が返れば OK。

#### お試しトンネル（独自ドメインなし）

ドメインがない場合は、毎回 URL が変わってしまいますが
以下で簡易的に試せます。

```bat
cloudflared tunnel --url http://localhost:5050
```

---

## 3. Vercel 側の設定

Vercel ダッシュボード → 該当プロジェクト → Settings → Environment Variables で
以下を **すべての環境（Production / Preview / Development）** に追加します。

| 変数名 | 値 |
|---|---|
| `MDB_API_URL` | `https://mdb-dev.example.com`（Tunnel の URL） |
| `MDB_API_TOKEN` | 1-2 で生成した同じトークン |

設定後、対象環境を **再デプロイ**してください。

---

## 4. 動作確認

1. 開発 PC で `start-mdb-server.bat` 起動
2. `cloudflared tunnel run mdb-dev` 起動
3. テスト環境（Vercel）の発注書画面を開き、「自動提案」ボタンを押す
4. 昨年同時期の実績に基づく提案数量が反映されること

### よくある失敗

| 症状 | 原因と対処 |
|---|---|
| `自動提案サービスのURLが設定されていません` | Vercel 側の環境変数 `MDB_API_URL` / `MDB_API_TOKEN` が未設定。設定後に再デプロイ |
| `自動提案サービスに接続できません` | 開発 PC が起動していない / Tunnel が落ちている / `cloudflared` プロセスが終了している |
| `データベース読み取りエラー` | Access 側で `sysdata.mdb` を開いている、または `MDB_PATH` の場所が違う |
| 401 認証エラー | `MDB_API_TOKEN` が両環境で一致していない |

---

## 5. PC 起動時に自動でサービスを上げる（任意）

Windows のタスクスケジューラで以下 2 つを「ログオン時」起動に登録します。

1. `C:\work\claude\order-frame\scripts\start-mdb-server.bat`
2. `cloudflared tunnel run mdb-dev`

「最上位の特権で実行」「ユーザーがログオンしているときのみ」推奨。

---

## 6. 本番運用への切り替え（将来）

本番 PC で同じ `mdb-server.py` と Tunnel を立て、Vercel 本番環境の
`MDB_API_URL` を本番 PC のトンネル URL に差し替えるだけで切り替わります。
トークンは本番／開発で別の値にすることを推奨します。
