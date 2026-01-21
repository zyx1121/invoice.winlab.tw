import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Handle pdfjs-dist worker file issues in server-side
  serverExternalPackages: ["pdf-to-img", "pdfjs-dist", "canvas"],
};

export default nextConfig;
