import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PDF 生成で使うフォントなど、サーバーレス関数の実行時に必要なファイルを
  // バンドルに同梱するための設定。
  outputFileTracingIncludes: {
    'app/api/orders/[id]/export/route': ['./assets/fonts/**/*'],
  },
};

export default nextConfig;
