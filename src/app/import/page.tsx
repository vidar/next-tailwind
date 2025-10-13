"use client";

import { useState } from "react";
import Link from "next/link";

type Platform = "chess.com" | "lichess" | "manual";

interface ChessGame {
  id: string;
  white: string;
  black: string;
  result: string;
  date: string;
  pgn?: string;
}

export default function ImportPage() {
  const [platform, setPlatform] = useState<Platform>("chess.com");
  const [username, setUsername] = useState("");
  const [games, setGames] = useState<ChessGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pgnText, setPgnText] = useState("");
  const [selectedGames, setSelectedGames] = useState<Set<string>>(new Set());

  const searchGames = async () => {
    if (!username.trim() && platform !== "manual") {
      setError("Please enter a username");
      return;
    }

    setLoading(true);
    setError("");
    setGames([]);

    try {
      const response = await fetch(
        `/api/chess/search?platform=${platform}&username=${encodeURIComponent(username)}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch games");
      }

      const data = await response.json();
      setGames(data.games || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleManualImport = () => {
    if (!pgnText.trim()) {
      setError("Please enter PGN data");
      return;
    }

    // Parse the PGN text and create a game object
    const game: ChessGame = {
      id: `manual-${Date.now()}`,
      white: "Unknown",
      black: "Unknown",
      result: "*",
      date: new Date().toISOString().split("T")[0],
      pgn: pgnText,
    };

    setGames([game]);
    setError("");
  };

  const toggleGameSelection = (gameId: string) => {
    const newSelection = new Set(selectedGames);
    if (newSelection.has(gameId)) {
      newSelection.delete(gameId);
    } else {
      newSelection.add(gameId);
    }
    setSelectedGames(newSelection);
  };

  const importSelectedGames = () => {
    // TODO: Implement import functionality
    console.log("Importing games:", Array.from(selectedGames));
    alert(`Importing ${selectedGames.size} game(s)`);
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold">Import Chess Games</h1>
          <Link
            href="/"
            className="text-blue-500 hover:text-blue-600 underline"
          >
            Back to Home
          </Link>
        </div>

        {/* Platform Selection */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
          <label className="block text-sm font-medium mb-4">
            Select Platform
          </label>
          <div className="flex gap-4">
            <button
              onClick={() => setPlatform("chess.com")}
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                platform === "chess.com"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600"
              }`}
            >
              Chess.com
            </button>
            <button
              onClick={() => setPlatform("lichess")}
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                platform === "lichess"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600"
              }`}
            >
              Lichess
            </button>
            <button
              onClick={() => setPlatform("manual")}
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                platform === "manual"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600"
              }`}
            >
              Manual PGN
            </button>
          </div>
        </div>

        {/* Search/Import Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
          {platform !== "manual" ? (
            <>
              <label className="block text-sm font-medium mb-2">
                Username
              </label>
              <div className="flex gap-4">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && searchGames()}
                  placeholder={`Enter ${platform} username`}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
                <button
                  onClick={searchGames}
                  disabled={loading}
                  className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
                >
                  {loading ? "Searching..." : "Search"}
                </button>
              </div>
            </>
          ) : (
            <>
              <label className="block text-sm font-medium mb-2">
                Paste PGN Data
              </label>
              <textarea
                value={pgnText}
                onChange={(e) => setPgnText(e.target.value)}
                placeholder="Paste your PGN data here..."
                className="w-full h-48 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
              <button
                onClick={handleManualImport}
                className="mt-4 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium"
              >
                Parse PGN
              </button>
            </>
          )}

          {error && (
            <div className="mt-4 p-4 bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-200 rounded-lg">
              {error}
            </div>
          )}
        </div>

        {/* Games List */}
        {games.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-semibold">
                Found {games.length} game(s)
              </h2>
              {selectedGames.size > 0 && (
                <button
                  onClick={importSelectedGames}
                  className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium"
                >
                  Import {selectedGames.size} Selected
                </button>
              )}
            </div>

            <div className="space-y-3">
              {games.map((game) => (
                <div
                  key={game.id}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedGames.has(game.id)
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                      : "border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                  }`}
                  onClick={() => toggleGameSelection(game.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium">
                        {game.white} vs {game.black}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Result: {game.result} | Date: {game.date}
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={selectedGames.has(game.id)}
                      onChange={() => toggleGameSelection(game.id)}
                      className="w-5 h-5"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
