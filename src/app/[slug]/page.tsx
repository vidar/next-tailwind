import { notFound } from "next/navigation";
import Link from "next/link";
import { createReader } from "@keystatic/core/reader";
import { DocumentRenderer } from "@keystatic/core/renderer";
import keystaticConfig from "../../../keystatic.config";

const reader = createReader(process.cwd(), keystaticConfig);

export async function generateStaticParams() {
  const pages = await reader.collections.pages.all();
  return pages.map((page) => ({
    slug: page.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = await reader.collections.pages.read(slug);

  if (!page) {
    return {
      title: "Page Not Found",
    };
  }

  return {
    title: page.title,
    description: page.description,
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = await reader.collections.pages.read(slug);

  if (!page) {
    notFound();
  }

  const content = await page.content();

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <header className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            {page.title}
          </h1>
          {page.description && (
            <p className="text-xl text-gray-600 dark:text-gray-400">
              {page.description}
            </p>
          )}
        </header>

        <div className="prose prose-lg dark:prose-invert max-w-none">
          <div className="text-gray-800 dark:text-gray-300 space-y-4">
            <DocumentRenderer document={content} />
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
          <Link
            href="/"
            className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
          >
            ← Back to home
          </Link>
        </div>
      </article>
    </div>
  );
}
