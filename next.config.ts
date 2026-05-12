import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 旧 Vercel URL (order-frame.vercel.app) でアクセスされた場合は
  // 新しいポータル (portal.happy-vision.jp) に永続リダイレクトする。
  // カスタムドメイン (order.happy-vision.jp) では動作しない。
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "order-frame.vercel.app" }],
        destination: "https://portal.happy-vision.jp/",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
