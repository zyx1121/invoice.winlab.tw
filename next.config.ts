import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Handle unpdf in server-side environment
  serverExternalPackages: ["unpdf"],
};

export default nextConfig;
