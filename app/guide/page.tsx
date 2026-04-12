'use client';

export default function GuidePage() {
  return (
    <div className="max-w-4xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">運用ガイド</h1>
        <button className="text-base h-10 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-md"
          onClick={() => window.print()}>印刷</button>
      </div>

      {/* 発注の仕組み */}
      <div className="bg-white rounded-lg border p-6 mb-6">
        <h2 className="text-xl font-bold mb-4 text-blue-800">📦 発注の仕組み（需要予測型）</h2>

        <div className="space-y-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <h3 className="font-bold text-lg mb-2">基本的な考え方</h3>
            <p>固定の補充数ではなく、<strong>昨年の同時期の注文数</strong>から必要な発注数を自動計算します。</p>
            <p className="mt-1">季節によって注文数が異なるため（3月は1.3倍、7月は0.8倍など）、時期に応じた適切な量を発注できます。</p>
          </div>

          <div>
            <h3 className="font-bold text-lg mb-2">計算方法</h3>
            <table className="w-full border-collapse">
              <tbody>
                <tr className="border-b">
                  <td className="py-2 pr-4 font-medium w-40">① 日需要</td>
                  <td className="py-2">昨年の同時期30日間の注文数 ÷ 30日<br/>
                    <span className="text-sm text-gray-500">例：昨年3月の30日注文が140個 → 1日あたり4.7個</span></td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 pr-4 font-medium">② 有効在庫</td>
                  <td className="py-2">現在の在庫 + 他の発注書の未納品数<br/>
                    <span className="text-sm text-gray-500">例：手元に50個 + 発注済み未納品80個 = 130個</span></td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 pr-4 font-medium">③ 残日数</td>
                  <td className="py-2">有効在庫 ÷ 日需要 = あと何日分の在庫があるか<br/>
                    <span className="text-sm text-gray-500">例：130個 ÷ 4.7個/日 = 約28日分</span></td>
                </tr>
                <tr className="border-b bg-yellow-50">
                  <td className="py-2 pr-4 font-medium">④ 発注判断</td>
                  <td className="py-2"><strong>残日数が28日以下</strong>なら発注推奨（⚠マーク）<br/>
                    <span className="text-sm text-gray-500">28日 = リードタイム3週間(21日) + 安全在庫1週間(7日)</span></td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 pr-4 font-medium">⑤ 発注数</td>
                  <td className="py-2">日需要 × 目標日数(35日) − 有効在庫<br/>
                    <span className="text-sm text-gray-500">例：4.7 × 35 − 130 = 35個 → 入数(25個/箱)に合わせて50個</span></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div>
            <h3 className="font-bold text-lg mb-2">制約の自動処理</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="font-medium">🔸 週150個制限</p>
                <p className="text-sm text-gray-600">全サイズ合計で週150個以内になるよう自動振り分け。超える場合は翌週に分割。</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="font-medium">🔸 月末支払い</p>
                <p className="text-sm text-gray-600">末締め翌月末払い。月末時点の在庫を適正に保つため、月をまたぐ場合は月初に一部を振り分け。</p>
              </div>
            </div>
          </div>

          <div className="bg-green-50 rounded-lg p-4">
            <h3 className="font-bold text-lg mb-2">計算例：2月10日に発注する場合</h3>
            <ol className="list-decimal ml-5 space-y-1">
              <li>リードタイム3週間 → <strong>3月3日頃に納品</strong></li>
              <li>昨年の<strong>3月3日〜4月2日</strong>の注文数を参照（納品後の需要を予測）</li>
              <li>その期間のSサイズ黄オーク注文数 = 140個 → 日需要 4.7個</li>
              <li>有効在庫80個 → 残日数17日 → <strong>28日以下なので発注推奨</strong></li>
              <li>目標在庫 = 4.7 × 35 = 165個</li>
              <li>発注提案数 = 165 − 80 = <strong>85個</strong>（入数25に合わせて100個）</li>
            </ol>
          </div>
        </div>
      </div>

      {/* 週次運用フロー */}
      <div className="bg-white rounded-lg border p-6 mb-6">
        <h2 className="text-xl font-bold mb-4 text-green-800">📅 週次の運用フロー</h2>

        <div className="space-y-3">
          <div className="flex gap-4 items-start">
            <span className="bg-green-500 text-white rounded-full w-8 h-8 flex items-center justify-center shrink-0 font-bold">1</span>
            <div>
              <p className="font-bold">在庫登録（パートさん）— 毎週月曜日</p>
              <p className="text-gray-600">棚の在庫を数えて「在庫登録」画面に入力。チェック表を印刷して使うと便利です。</p>
            </div>
          </div>
          <div className="flex gap-4 items-start">
            <span className="bg-green-500 text-white rounded-full w-8 h-8 flex items-center justify-center shrink-0 font-bold">2</span>
            <div>
              <p className="font-bold">発注書作成（発注担当者）</p>
              <p className="text-gray-600">発注書一覧 →「現在庫から発注書を作成」→「自動提案」ボタンで発注数を自動計算</p>
            </div>
          </div>
          <div className="flex gap-4 items-start">
            <span className="bg-green-500 text-white rounded-full w-8 h-8 flex items-center justify-center shrink-0 font-bold">3</span>
            <div>
              <p className="font-bold">確認・修正</p>
              <p className="text-gray-600">提案された数量と納品日を確認。必要に応じて手動で修正。週150個制限を確認。</p>
            </div>
          </div>
          <div className="flex gap-4 items-start">
            <span className="bg-green-500 text-white rounded-full w-8 h-8 flex items-center justify-center shrink-0 font-bold">4</span>
            <div>
              <p className="font-bold">発注確定・送信</p>
              <p className="text-gray-600">「発注確定」→「メール送信」or「承認依頼をLINEで送信」で発注先に送信。</p>
            </div>
          </div>
          <div className="flex gap-4 items-start">
            <span className="bg-green-500 text-white rounded-full w-8 h-8 flex items-center justify-center shrink-0 font-bold">5</span>
            <div>
              <p className="font-bold">納品確認</p>
              <p className="text-gray-600">額が届いたら「納品一覧」で納品登録。不足があれば納品数を入力。</p>
            </div>
          </div>
        </div>
      </div>

      {/* 画面の見方 */}
      <div className="bg-white rounded-lg border p-6 mb-6">
        <h2 className="text-xl font-bold mb-4 text-purple-800">🖥 発注書画面の見方</h2>

        <div className="space-y-3">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="text-left p-2 border">表示項目</th>
                <th className="text-left p-2 border">意味</th>
              </tr>
            </thead>
            <tbody>
              <tr><td className="p-2 border font-medium">数量計</td><td className="p-2 border">この発注書での発注合計数</td></tr>
              <tr><td className="p-2 border font-medium">有効在庫</td><td className="p-2 border">現在庫 + 他の発注の未納品数（マウスオーバーで内訳表示）</td></tr>
              <tr><td className="p-2 border font-medium text-red-600">30日注文</td><td className="p-2 border">昨年同時期の30日間の注文数</td></tr>
              <tr><td className="p-2 border font-medium text-red-600">当月予測</td><td className="p-2 border">30日注文から月末までの予測注文数</td></tr>
              <tr><td className="p-2 border font-medium">日需要</td><td className="p-2 border">1日あたりの予測需要（30日注文÷30）</td></tr>
              <tr><td className="p-2 border font-medium">残日数</td><td className="p-2 border">有効在庫÷日需要。28日以下で⚠表示</td></tr>
              <tr><td className="p-2 border font-medium">週別納品</td><td className="p-2 border">週ごとの納品合計。150個超で⚠超過表示</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 繁忙期の注意 */}
      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-xl font-bold mb-4 text-orange-800">⚠ 繁忙期の注意点</h2>

        <div className="space-y-2">
          <p>繁忙期（3月、12月等）は在庫登録を<strong>週2回（月曜・木曜）</strong>にすることをお勧めします。</p>
          <p>1週間以上在庫登録がない場合、ダッシュボードにリマインダーが表示されます。</p>
          <div className="bg-orange-50 rounded-lg p-3 mt-3">
            <p className="font-medium">月別の需要傾向（目安）</p>
            <div className="grid grid-cols-4 gap-2 mt-2 text-sm">
              <span>1月: 普通</span><span>2月: 普通</span><span className="text-red-600 font-bold">3月: 多い(1.3倍)</span><span>4月: 普通</span>
              <span>5月: やや少</span><span>6月: 普通</span><span className="text-blue-600">7月: 少ない(0.8倍)</span><span>8月: やや少</span>
              <span>9月: 普通</span><span>10月: 普通</span><span>11月: やや多</span><span className="text-red-600 font-bold">12月: 多い</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
