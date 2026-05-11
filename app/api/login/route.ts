import { NextRequest, NextResponse } from "next/server";
import {
  AUTH_COOKIE_MAX_AGE,
  AUTH_COOKIE_NAME,
  computeAuthToken,
  getAuthCookieDomain,
} from "@/lib/auth";

export async function POST(request: NextRequest) {
  const expected = process.env.PORTAL_PASSWORD;

  if (!expected) {
    return NextResponse.json(
      { error: "サーバー側のパスワードが設定されていません" },
      { status: 500 },
    );
  }

  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "不正なリクエストです" }, { status: 400 });
  }

  if (!body.password || body.password !== expected) {
    return NextResponse.json(
      { error: "パスワードが違います" },
      { status: 401 },
    );
  }

  const token = await computeAuthToken(expected);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: AUTH_COOKIE_MAX_AGE,
    path: "/",
    domain: getAuthCookieDomain(),
  });
  return response;
}
