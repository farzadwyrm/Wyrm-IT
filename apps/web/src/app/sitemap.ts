import { AGENTS } from "@wyrm/agents";
import { DEMO_PROFILE, PROFILES } from "@wyrm/receptionist";
import type { MetadataRoute } from "next";
import { POSTS } from "@/lib/posts";
import { SITE, STATIC_ROUTES } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...STATIC_ROUTES.map((path) => ({ url: new URL(path, SITE.url).toString() })),
    ...POSTS.map((post) => ({
      url: new URL(`/blog/${post.slug}`, SITE.url).toString(),
      lastModified: post.date,
    })),
    ...AGENTS.map((agent) => ({ url: new URL(`/agents/${agent.slug}`, SITE.url).toString() })),
    ...PROFILES.filter((p) => p.demo && p.id !== DEMO_PROFILE.id).map((p) => ({
      url: new URL(`/receptionist/${p.id}`, SITE.url).toString(),
    })),
  ];
}
