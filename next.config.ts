import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Only used by Docker image builds; Vercel fails with standalone nft tracing.
  ...(process.env.DOCKER_BUILD === "1" ? { output: "standalone" as const } : {}),
};

export default nextConfig;
