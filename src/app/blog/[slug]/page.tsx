import { notFound } from "next/navigation";
import Link from "next/link";
import { createReader } from "@keystatic/core/reader";
import { DocumentRenderer } from "@keystatic/core/renderer";
import keystaticConfig from "../../../../keystatic.config";

const reader = createReader(process.cwd(), keystaticConfig);

export async function generateStaticParams() {
  const posts = await reader.collections.posts.all();
  return posts.map((post) => ({
    slug: post.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await reader.collections.posts.read(slug);

  if (!post) {
    return {
      title: "Post Not Found",
    };
  }

  return {
    title: post.title,
    description: post.excerpt,
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await reader.collections.posts.read(slug);

  if (!post) {
    notFound();
  }

  const content = await post.content();

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900">
      <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <Link
          href="/blog"
          className="text-blue-400 hover:text-blue-300 mb-8 inline-block"
        >
          ← Back to Blog
        </Link>

        <header className="mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            {post.title}
          </h1>
          <div className="flex items-center gap-4 text-gray-400">
            <span>{post.author}</span>
            <span>•</span>
            <time>
              {new Date(post.publishedDate || "").toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </time>
          </div>
        </header>

        <div className="prose prose-invert prose-lg max-w-none">
          <div className="text-gray-300 space-y-4">
            <DocumentRenderer document={content} />
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-700">
          <Link
            href="/blog"
            className="text-blue-400 hover:text-blue-300 font-medium"
          >
            ← Back to all posts
          </Link>
        </div>
      </article>
    </div>
  );
}
