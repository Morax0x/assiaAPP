import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["web-push", "@electric-sql/pglite", "pg", "pg-native"],
  poweredByHeader: false,
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
};

export default nextConfig;
