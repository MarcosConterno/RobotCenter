import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone", // Gera a build standalone para Docker
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
