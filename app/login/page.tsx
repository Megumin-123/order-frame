"use client";

import { useState } from "react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        window.location.href = "/";
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "ログインに失敗しました");
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <header className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            発注管理システム
          </h1>
          <p className="text-base text-gray-500">
            パスワードを入力してください
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex flex-col gap-4"
        >
          <label className="flex flex-col gap-2">
            <span className="text-base font-semibold text-gray-700">
              パスワード
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              required
              className="border border-gray-300 rounded-lg px-4 py-3 text-base min-h-[44px] focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="パスワード"
            />
          </label>

          {error && (
            <p
              role="alert"
              className="text-base text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold text-base rounded-lg px-4 py-3 min-h-[44px] transition-colors"
          >
            {loading ? "確認中..." : "ログインする"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-400">
          ※ 入力後、30日間このブラウザで利用できます
        </p>
      </div>
    </div>
  );
}
