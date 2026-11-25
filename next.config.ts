import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["web-push", "@electric-sql/pglite"],
  poweredByHeader: false,
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
};

export default nextConfig;
