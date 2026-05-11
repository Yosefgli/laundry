import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  experimental: {
    serverActions: { allowedOrigins: ["*"] },
  },
};

export default nextConfig;
