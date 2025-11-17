import Link from "next/link";
import { createReader } from "@keystatic/core/reader";
import keystaticConfig from "../../../keystatic.config";

const reader = createReader(process.cwd(), keystaticConfig);

export default async function BlogPage() {
  const posts = await reader.collections.posts.all();

  // Sort posts by date (newest first)
  const sortedPosts = posts.sort((a, b) => {
    const dateA = new Date(a.entry.publishedDate || "");
    const dateB = new Date(b.entry.publishedDate || "");
    return dateB.getTime() - dateA.getTime();
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <h1 className="text-5xl font-bold text-white mb-4">Blog</h1>
        <p className="text-xl text-gray-300 mb-12">
          Tips, tutorials, and updates about Chess Moments
        </p>

        <div className="space-y-8">
          {sortedPosts.map((post) => (
            <article
              key={post.slug}
              className="bg-gray-800 rounded-xl p-8 border border-gray-700 hover:border-blue-500 transition-colors"
            >
              <Link href={`/blog/${post.slug}`}>
                <h2 className="text-2xl font-bold text-white mb-3 hover:text-blue-400 transition-colors">
                  {post.entry.title}
                </h2>
              </Link>
              <div className="flex items-center gap-4 text-sm text-gray-400 mb-4">
                <span>{post.entry.author}</span>
                <span>•</span>
                <time>
                  {new Date(post.entry.publishedDate || "").toLocaleDateString(
                    "en-US",
                    {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    }
                  )}
                </time>
              </div>
              {post.entry.excerpt && (
                <p className="text-gray-300 mb-4">{post.entry.excerpt}</p>
              )}
              <Link
                href={`/blog/${post.slug}`}
                className="text-blue-400 hover:text-blue-300 font-medium"
              >
                Read more →
              </Link>
            </article>
          ))}

          {sortedPosts.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-400 text-lg">
                No blog posts yet. Check back soon!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
