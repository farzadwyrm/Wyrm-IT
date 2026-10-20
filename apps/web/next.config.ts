import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source; Next compiles them.
  transpilePackages: ["@wyrm/ai", "@wyrm/agents", "@wyrm/receptionist", "@wyrm/ui"],
  poweredByHeader: false,
  async redirects() {
    return [{ source: "/planner", destination: "/analyse", permanent: true }];
  },
};

export default nextConfig;
