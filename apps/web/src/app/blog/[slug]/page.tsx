import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container, CtaBand } from "@/components/sections";
import { formatDate } from "@/lib/format";
import { getPost, POSTS } from "@/lib/posts";

// Only the posts listed in POSTS exist; anything else is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return POSTS.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const post = getPost((await params).slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.summary,
    openGraph: { type: "article", publishedTime: post.date },
  };
}

export default async function BlogPostPage({ params }: PageProps<"/blog/[slug]">) {
  const post = getPost((await params).slug);
  if (!post) notFound();

  return (
    <>
      <Container className="pt-16 sm:pt-24">
        <article className="max-w-2xl">
          <p>
            <Link href="/blog" className="text-sm font-semibold text-ember hover:text-ember-strong">
              ← All articles
            </Link>
          </p>
          <time dateTime={post.date} className="mt-6 block text-sm text-ink-muted">
            {formatDate(post.date)}
          </time>
          <h1 className="mt-2 font-display text-4xl font-semibold leading-tight text-balance">
            {post.title}
          </h1>
          <div className="mt-8 space-y-5 text-lg leading-relaxed text-ink-muted">
            {post.body.map((block) =>
              block.startsWith("## ") ? (
                <h2 key={block} className="pt-4 font-display text-2xl font-semibold text-ink">
                  {block.slice(3)}
                </h2>
              ) : (
                <p key={block}>{block}</p>
              ),
            )}
          </div>
        </article>
      </Container>
      <CtaBand />
    </>
  );
}
