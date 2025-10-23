"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

interface ChessAnalysis {
  id: string;
  pgn: string;
  game_data: JsonValue;
  analysis_config: {
    depth: number;
    find_alternatives: boolean;
  };
  analysis_results: JsonValue;
  status: string;
  progress: number | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export default function AnalyzedGamesPage() {
  const router = useRouter();
  const [analyses, setAnalyses] = useState<ChessAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchAnalyses();
  }, []);

  const fetchAnalyses = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/analyses");

      if (!response.ok) {
        throw new Error("Failed to fetch analyses");
      }

      const data = await response.json();
      setAnalyses(data.analyses || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const extractGameInfo = (pgn: string) => {
    const whiteMatch = pgn.match(/\[White "([^"]+)"\]/);
    const blackMatch = pgn.match(/\[Black "([^"]+)"\]/);
    const resultMatch = pgn.match(/\[Result "([^"]+)"\]/);

    return {
      white: whiteMatch ? whiteMatch[1] : "Unknown",
      black: blackMatch ? blackMatch[1] : "Unknown",
      result: resultMatch ? resultMatch[1] : "*",
    };
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold">Analyzed Games</h1>
          <Link
            href="/"
            className="text-blue-500 hover:text-blue-600 underline"
          >
            Back to Home
          </Link>
        </div>

        {loading ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-12 text-center">
            <div className="text-xl text-gray-600 dark:text-gray-400">
              Loading analyses...
            </div>
          </div>
        ) : error ? (
          <div className="bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-2">Error</h2>
            <p>{error}</p>
          </div>
        ) : analyses.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-12 text-center">
            <div className="text-xl text-gray-600 dark:text-gray-400 mb-4">
              No completed analyses found
            </div>
            <Link
              href="/import"
              className="inline-block bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600"
            >
              Import and Analyze Games
            </Link>
          </div>
        ) : (
          <div className="grid gap-6">
            {analyses.map((analysis) => {
              const gameInfo = extractGameInfo(analysis.pgn);
              return (
                <div
                  key={analysis.id}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => router.push(`/analyzed_games/${analysis.id}`)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h2 className="text-2xl font-semibold mb-2">
                        {gameInfo.white} vs {gameInfo.black}
                      </h2>
                      <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                        <div>
                          <span className="font-medium">Result:</span>{" "}
                          {gameInfo.result}
                        </div>
                        <div>
                          <span className="font-medium">Analysis Depth:</span>{" "}
                          {analysis.analysis_config.depth}
                        </div>
                        <div>
                          <span className="font-medium">Find Alternatives:</span>{" "}
                          {analysis.analysis_config.find_alternatives ? "Yes" : "No"}
                        </div>
                        <div>
                          <span className="font-medium">Completed:</span>{" "}
                          {analysis.completed_at
                            ? formatDate(analysis.completed_at)
                            : "N/A"}
                        </div>
                      </div>
                    </div>
                    <div className="ml-4">
                      <span className="px-3 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full text-sm font-medium">
                        Completed
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
