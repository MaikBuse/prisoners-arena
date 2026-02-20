import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ['better-sqlite3'],
  turbopack: {},
  webpack(config) {
    // Allow importing .wasm files as static assets
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'asset/resource',
    });
    return config;
  },
};

export default nextConfig;
