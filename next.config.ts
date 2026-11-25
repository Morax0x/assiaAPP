import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["web-push"],
  poweredByHeader: false,
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
};

export default nextConfig;
