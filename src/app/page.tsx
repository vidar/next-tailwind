import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background">
      <h1 className="text-4xl font-bold mb-4">Welcome to Remotion App</h1>
      <p className="text-xl mb-8">A simple app demonstrating Remotion with Next.js</p>
      <div className="flex flex-col gap-4">
        <Link
          href="/app"
          className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 text-center"
        >
          Go to Remotion Demo
        </Link>
        <Link
          href="/import"
          className="bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600 text-center"
        >
          Import Chess Games
        </Link>
      </div>
    </div>
  );
}
