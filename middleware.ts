import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, computeAuthToken } from "@/lib/auth";

/** 認証なしでアクセスできるパス */
const PUBLIC_PATHS = ["/login", "/api/login"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ログイン画面・ログインAPIは認証不要
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const password = process.env.PORTAL_PASSWORD;

  // 環境変数が未設定の場合は認証を無効化（設定ミスで締め出されないように）
  if (!password) {
    return NextResponse.next();
  }

  const authCookie = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const expected = await computeAuthToken(password);

  if (authCookie === expected) {
    return NextResponse.next();
  }

  // 未認証 → ログイン画面へリダイレクト
  const loginUrl = new URL("/login", request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // 静的ファイル・画像・public 配下のフォントなどは認証対象外
  // (フォントは PDF 生成時にサーバー内部から fetch するため、認証で弾かれると
  //  ログイン画面の HTML が返り「Unknown font format」エラーになる)
  matcher: ["/((?!_next/static|_next/image|favicon.ico|fonts/).*)"],
};
