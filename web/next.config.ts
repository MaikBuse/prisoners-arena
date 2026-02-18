import type { NextConfig } from "next";
import { resolve } from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    root: resolve(__dirname, ".."),
  },
  serverExternalPackages: ['better-sqlite3'],
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
