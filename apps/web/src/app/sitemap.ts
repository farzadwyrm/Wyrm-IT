import { AREAS } from "@wyrm/guide";
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
    ...AREAS.map((area) => ({ url: new URL(`/guide/${area.slug}`, SITE.url).toString() })),
  ];
}
