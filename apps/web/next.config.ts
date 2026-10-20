import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source; Next compiles them.
  transpilePackages: [
    "@wyrm/ai",
    "@wyrm/assessment",
    "@wyrm/guide",
    "@wyrm/receptionist",
    "@wyrm/ui",
  ],
  poweredByHeader: false,
};

export default nextConfig;
