import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900">
      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
        <div className="text-center">
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
            Turn Your Chess Games Into
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
              Shareable Videos
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 mb-8 max-w-3xl mx-auto">
            Deep analysis powered by Stockfish. Beautiful visualizations.
            Instant YouTube uploads. Share your best games with the world.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              href="/import"
              className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-8 py-4 rounded-lg hover:from-blue-600 hover:to-purple-700 text-lg font-semibold transition-all transform hover:scale-105 shadow-lg"
            >
              Get Started
            </Link>
            <Link
              href="/analyzed_games"
              className="bg-gray-700 text-white px-8 py-4 rounded-lg hover:bg-gray-600 text-lg font-semibold transition-all border border-gray-600"
            >
              View Examples
            </Link>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Feature 1 */}
          <div className="bg-gray-800 rounded-xl p-8 border border-gray-700 hover:border-blue-500 transition-colors">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Deep Analysis</h3>
            <p className="text-gray-400">
              Stockfish-powered engine analysis reveals the strongest moves, missed tactics, and alternative lines in every position.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="bg-gray-800 rounded-xl p-8 border border-gray-700 hover:border-purple-500 transition-colors">
            <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-600 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Video Generation</h3>
            <p className="text-gray-400">
              Automatically generate stunning walkthrough videos of your games, perfect for social media and content creation.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="bg-gray-800 rounded-xl p-8 border border-gray-700 hover:border-pink-500 transition-colors">
            <div className="w-12 h-12 bg-gradient-to-r from-pink-500 to-red-600 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-white mb-3">YouTube Ready</h3>
            <p className="text-gray-400">
              One-click upload to YouTube. Share your brilliancies, blunders, and everything in between with your audience.
            </p>
          </div>
        </div>
      </div>

      {/* How It Works Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-4xl font-bold text-white text-center mb-12">How It Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center text-2xl font-bold text-white mx-auto mb-4">
              1
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Import Your Game</h3>
            <p className="text-gray-400">
              Import from Chess.com, Lichess, or paste PGN directly
            </p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-purple-500 rounded-full flex items-center justify-center text-2xl font-bold text-white mx-auto mb-4">
              2
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Analyze</h3>
            <p className="text-gray-400">
              Let Stockfish crunch the numbers and find the best moves
            </p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-pink-500 rounded-full flex items-center justify-center text-2xl font-bold text-white mx-auto mb-4">
              3
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Generate Video</h3>
            <p className="text-gray-400">
              Create a beautiful walkthrough video in minutes
            </p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center text-2xl font-bold text-white mx-auto mb-4">
              4
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Share</h3>
            <p className="text-gray-400">
              Upload to YouTube or download for any platform
            </p>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-12 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Create Your First Video?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Import a game and see the magic happen in minutes
          </p>
          <Link
            href="/import"
            className="bg-white text-purple-600 px-8 py-4 rounded-lg hover:bg-gray-100 text-lg font-semibold transition-all inline-block shadow-lg"
          >
            Start Analyzing
          </Link>
        </div>
      </div>
    </div>
  );
}
