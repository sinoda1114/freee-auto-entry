import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // TypeScript 7 は JS Compiler API がないため CLI 経由で型チェックする
    useTypeScriptCli: true,
    optimizePackageImports: ["@heroui/react"],
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
    // 領収書写真の Server Action アップロード用（Vercel 上限は約 4.5MB）
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
