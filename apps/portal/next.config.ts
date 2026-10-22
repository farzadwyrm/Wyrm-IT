import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source; Next compiles them.
  transpilePackages: [
    "@wyrm/ai",
    "@wyrm/auth",
    "@wyrm/brain",
    "@wyrm/core",
    "@wyrm/db",
    "@wyrm/receptionist",
    "@wyrm/ui",
  ],
  poweredByHeader: false,
  experimental: {
    // Document uploads for "Ask your documents" (Vercel caps a request at 4.5 MB).
    serverActions: { bodySizeLimit: "4mb" },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // The portal shows private client data: never let search engines index it.
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Referrer-Policy", value: "same-origin" },
        ],
      },
      {
        // Everything except the public chat page may never be embedded in another site.
        source: "/((?!chat/).*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        ],
      },
      {
        // The public chat page is what the website widget shows, on the business's own site.
        source: "/chat/:agentId",
        headers: [{ key: "Content-Security-Policy", value: "frame-ancestors https:" }],
      },
    ];
  },
};

export default nextConfig;
