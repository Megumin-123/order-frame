/**
 * ポータル + 各システム共通の簡易パスワード認証ユーティリティ
 *
 * Cookie に保存するトークンは、パスワードを SHA-256 でハッシュしたもの。
 * パスワードが変わればハッシュも変わるので、Vercel の環境変数を
 * 更新するだけで既存のログインセッションを全て無効化できる。
 *
 * このファイルは portal / order-frame / zaiko_brass / sales-dashboard の
 * 全プロジェクトで同一内容でコピーされる前提。
 */

/** Cookie 名（他のシステムと衝突しないよう portal- プレフィックス） */
export const AUTH_COOKIE_NAME = "portal-auth";

/** Cookie の有効期間（30 日） */
export const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

/**
 * Cookie の Domain 属性。
 *
 * 環境変数 AUTH_COOKIE_DOMAIN が設定されていれば、その値を使う。
 * 例: ".happy-vision.jp" を指定すると、
 *     portal.happy-vision.jp / order.happy-vision.jp / zaiko.happy-vision.jp
 *     の全サブドメインで同じ Cookie が共有される。
 *
 * 未設定なら現在のホスト（例: portal.vercel.app）のみで有効。
 */
export function getAuthCookieDomain(): string | undefined {
  return process.env.AUTH_COOKIE_DOMAIN || undefined;
}

/**
 * パスワードから Cookie に保存するトークン（ハッシュ）を生成する。
 * Edge Runtime（middleware）と Node Runtime（API）の両方で動くよう
 * Web Crypto API を使う。
 *
 * 全プロジェクトで同じ salt を使うため、同じ PORTAL_PASSWORD なら
 * 同じトークンが生成され、Cookie 共有が成立する。
 */
export async function computeAuthToken(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`portal-salt:${password}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const bytes = Array.from(new Uint8Array(hashBuffer));
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}
