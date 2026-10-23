import type { Metadata } from "next";
import Link from "next/link";
import { Container, CtaBand, PageHeader } from "@/components/sections";
import { formatDate } from "@/lib/format";
import { sortedPosts } from "@/lib/posts";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Practical articles on AI agents and workflow automation for small and medium businesses.",
};

export default function BlogIndexPage() {
  const posts = sortedPosts();
  return (
    <>
      <PageHeader
        title="Notes on building AI agents"
        intro="Short, practical notes on using AI in a small business."
      />
      <Container className="pb-8">
        <ul className="divide-y divide-line border-y border-line">
          {posts.map((post) => (
            <li key={post.slug} className="py-8">
              <time dateTime={post.date} className="text-sm text-ink-muted">
                {formatDate(post.date)}
              </time>
              <h2 className="mt-2 font-display text-2xl font-semibold">
                <Link href={`/blog/${post.slug}`} className="hover:text-ember">
                  {post.title}
                </Link>
              </h2>
              <p className="mt-2 max-w-2xl text-ink-muted">{post.summary}</p>
            </li>
          ))}
        </ul>
      </Container>
      <CtaBand />
    </>
  );
}
