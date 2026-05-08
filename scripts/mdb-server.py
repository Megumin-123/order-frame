# -*- coding: utf-8 -*-
"""自動提案機能用 MDB クエリ HTTP サーバー。

Vercel 上の order-frame からこのサーバーへ Bearer トークン付きで
HTTP GET し、Access MDB に対する集計結果を JSON で返す。

起動例:
    set MDB_API_TOKEN=your-secret-token
    set MDB_PATH=C:\\Users\\smili\\Documents\\system\\sysdata.mdb
    python scripts/mdb-server.py
"""

import os
import re
import logging
from flask import Flask, request, jsonify

from importlib import import_module

# query-mdb.py はハイフン入りなので importlib 経由で読み込む
_query_mdb = import_module('query-mdb') if False else None
try:
    import sys as _sys
    _here = os.path.dirname(os.path.abspath(__file__))
    if _here not in _sys.path:
        _sys.path.insert(0, _here)
    import importlib.util as _ilu
    _spec = _ilu.spec_from_file_location('query_mdb_module', os.path.join(_here, 'query-mdb.py'))
    _query_mdb = _ilu.module_from_spec(_spec)
    _spec.loader.exec_module(_query_mdb)
except Exception as exc:  # pragma: no cover
    raise RuntimeError(f'query-mdb.py の読み込みに失敗しました: {exc}')


PORT = int(os.environ.get('PORT', '5050'))
TOKEN = os.environ.get('MDB_API_TOKEN', '')
DEFAULT_MDB_PATH = os.environ.get(
    'MDB_PATH', r'C:\Users\smili\Documents\system\sysdata.mdb'
)

DATE_RE = re.compile(r'^\d{4}-\d{2}-\d{2}$')

app = Flask(__name__)
logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger('mdb-server')


def _check_auth(req) -> bool:
    if not TOKEN:
        # トークン未設定時は安全側で拒否
        return False
    header = req.headers.get('Authorization', '')
    if not header.startswith('Bearer '):
        return False
    return header[len('Bearer '):].strip() == TOKEN


@app.get('/healthz')
def healthz():
    return jsonify({'ok': True, 'mdbPath': DEFAULT_MDB_PATH})


@app.get('/order-stats')
def order_stats():
    if not _check_auth(request):
        return jsonify({'error': '認証に失敗しました'}), 401

    delivery_date = request.args.get('deliveryDate', '')
    if not DATE_RE.match(delivery_date):
        return jsonify({'error': '納品予定日が不正です (YYYY-MM-DD)'}), 400

    mdb_path = request.args.get('mdbPath') or DEFAULT_MDB_PATH

    try:
        result = _query_mdb.query_mdb_stats(delivery_date, mdb_path)
        return jsonify(result)
    except Exception as exc:  # pyodbc.Error など
        logger.exception('MDB 読み込みでエラー')
        return jsonify({'error': f'データベース読み取りエラー: {exc}'}), 500


def main():
    if not TOKEN:
        logger.warning('環境変数 MDB_API_TOKEN が未設定です。すべてのリクエストが 401 になります。')
    logger.info('MDB API server starting on port %s (mdb=%s)', PORT, DEFAULT_MDB_PATH)
    # 開発用サーバー。本格運用するなら waitress 等への切替を検討。
    app.run(host='0.0.0.0', port=PORT)


if __name__ == '__main__':
    main()
