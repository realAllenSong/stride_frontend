import type { NextConfig } from "next";

const config: NextConfig = {
  output: process.env.STRIDE_STANDALONE === "1" ? "standalone" : undefined,
  poweredByHeader: false,
  devIndicators: false,
  experimental: { optimizePackageImports: ["@phosphor-icons/react"] },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};
export default config;
