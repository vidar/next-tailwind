"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type Platform = "chess.com" | "lichess" | "manual";
type AnalysisDepth = 20 | 30 | 40;

interface ChessGame {
  id: string;
  white: string;
  black: string;
  result: string;
  date: string;
  pgn?: string;
}

interface AnalysisConfig {
  depth: AnalysisDepth;
  find_alternatives: boolean;
}

interface SearchHistoryItem {
  username: string;
  platform: Platform;
}

export default function ImportPage() {
  const [platform, setPlatform] = useState<Platform>("chess.com");
  const [username, setUsername] = useState("");
  const [games, setGames] = useState<ChessGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pgnText, setPgnText] = useState("");
  const [selectedGames, setSelectedGames] = useState<Set<string>>(new Set());
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [analysisConfig, setAnalysisConfig] = useState<AnalysisConfig>({
    depth: 20,
    find_alternatives: true,
  });
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<string[]>([]);

  // Load search history from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("chess-search-history");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSearchHistory(parsed);
      } catch (err) {
        console.error("Failed to load search history:", err);
      }
    }
  }, []);

  // Save search history to localStorage whenever it changes
  useEffect(() => {
    if (searchHistory.length > 0) {
      localStorage.setItem(
        "chess-search-history",
        JSON.stringify(searchHistory)
      );
    }
  }, [searchHistory]);

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

      // Add to search history (keep last 4, avoid duplicates)
      setSearchHistory((prev) => {
        const newItem: SearchHistoryItem = { username, platform };
        const filtered = prev.filter(
          (item) =>
            item.username !== username || item.platform !== platform
        );
        return [newItem, ...filtered].slice(0, 4);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const quickSearch = (historyItem: SearchHistoryItem) => {
    setUsername(historyItem.username);
    setPlatform(historyItem.platform);
    // Trigger search after state is set
    setTimeout(() => {
      const response = fetch(
        `/api/chess/search?platform=${historyItem.platform}&username=${encodeURIComponent(historyItem.username)}`
      )
        .then((res) => {
          if (!res.ok) throw new Error("Failed to fetch games");
          return res.json();
        })
        .then((data) => {
          setGames(data.games || []);
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : "An error occurred");
        });
    }, 0);
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
    setShowModal(true);
  };

  const analyzeGames = async () => {
    const gamesToAnalyze = games.filter((game) =>
      selectedGames.has(game.id)
    );

    if (gamesToAnalyze.length === 0) {
      setError("No games selected for analysis");
      return;
    }

    setAnalyzing(true);
    setAnalysisProgress(["Starting analysis..."]);

    // Close modal after a brief delay
    setTimeout(() => {
      setShowModal(false);
    }, 800);

    for (const game of gamesToAnalyze) {
      if (!game.pgn) {
        setAnalysisProgress((prev) => [
          ...prev,
          `Skipping ${game.white} vs ${game.black} - No PGN data`,
        ]);
        continue;
      }

      try {
        setAnalysisProgress((prev) => [
          ...prev,
          `Analyzing ${game.white} vs ${game.black}...`,
        ]);

        const response = await fetch("/api/chess/analyze", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            pgn: game.pgn,
            depth: analysisConfig.depth,
            find_alternatives: analysisConfig.find_alternatives,
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to analyze game: ${response.statusText}`);
        }

        const result = await response.json();
        setAnalysisProgress((prev) => [
          ...prev,
          `✓ Completed ${game.white} vs ${game.black}`,
        ]);
        console.log("Analysis result:", result);
      } catch (err) {
        setAnalysisProgress((prev) => [
          ...prev,
          `✗ Error analyzing ${game.white} vs ${game.black}: ${
            err instanceof Error ? err.message : "Unknown error"
          }`,
        ]);
      }
    }

    setAnalyzing(false);
    setAnalysisProgress((prev) => [...prev, "All analyses complete!"]);
  };

  const closeModal = () => {
    setShowModal(false);
    setAnalysisProgress([]);
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

              {/* Search History */}
              {searchHistory.length > 0 && (
                <div className="mt-4">
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-2">
                    Recent Searches
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {searchHistory.map((item, idx) => (
                      <button
                        key={`${item.platform}-${item.username}-${idx}`}
                        onClick={() => quickSearch(item)}
                        className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      >
                        <span className="font-medium">{item.username}</span>
                        <span className="text-xs ml-1 text-gray-500 dark:text-gray-400">
                          ({item.platform})
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
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

        {/* Analysis Progress Display */}
        {!showModal && analysisProgress.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">
                {analyzing ? "Analysis in Progress..." : "Analysis Complete"}
              </h2>
              {!analyzing && (
                <button
                  onClick={() => setAnalysisProgress([])}
                  className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 max-h-64 overflow-y-auto">
              <div className="space-y-1 font-mono text-sm">
                {analysisProgress.map((msg, idx) => (
                  <div
                    key={idx}
                    className="text-gray-800 dark:text-gray-200"
                  >
                    {msg}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

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
                  Analyze {selectedGames.size} Selected
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

        {/* Analysis Configuration Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
              <h2 className="text-2xl font-bold mb-4">
                Configure Analysis
              </h2>

              {/* Depth Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-3">
                  Analysis Depth
                </label>
                <div className="flex gap-3">
                  {[20, 30, 40].map((depth) => (
                    <button
                      key={depth}
                      onClick={() =>
                        setAnalysisConfig((prev) => ({
                          ...prev,
                          depth: depth as AnalysisDepth,
                        }))
                      }
                      className={`flex-1 px-4 py-3 rounded-lg font-medium transition-colors ${
                        analysisConfig.depth === depth
                          ? "bg-blue-500 text-white"
                          : "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600"
                      }`}
                    >
                      {depth}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                  Higher depth = more accurate but slower
                </p>
              </div>

              {/* Find Alternatives Toggle */}
              <div className="mb-6">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={analysisConfig.find_alternatives}
                    onChange={(e) =>
                      setAnalysisConfig((prev) => ({
                        ...prev,
                        find_alternatives: e.target.checked,
                      }))
                    }
                    className="w-5 h-5 mr-3"
                  />
                  <div>
                    <span className="font-medium">Find Alternatives</span>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Search for better move alternatives
                    </p>
                  </div>
                </label>
              </div>

              {/* Progress Display */}
              {analysisProgress.length > 0 && (
                <div className="mb-6 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg max-h-48 overflow-y-auto">
                  <div className="space-y-1">
                    {analysisProgress.map((msg, idx) => (
                      <div
                        key={idx}
                        className="text-sm text-gray-800 dark:text-gray-200"
                      >
                        {msg}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={closeModal}
                  disabled={analyzing}
                  className="flex-1 px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={analyzeGames}
                  disabled={analyzing}
                  className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {analyzing ? "Analyzing..." : "Start Analysis"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
