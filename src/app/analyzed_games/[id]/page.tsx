"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Chessground } from "chessground";
import { Chess } from "chess.js";
import type { Api } from "chessground/api";

interface ChessAnalysis {
  id: string;
  pgn: string;
  game_data: any;
  analysis_config: {
    depth: number;
    find_alternatives: boolean;
  };
  analysis_results: any;
  status: string;
  completed_at: string | null;
}

export default function AnalyzedGameDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const boardRef = useRef<HTMLDivElement>(null);
  const cgRef = useRef<Api | null>(null);

  const [analysis, setAnalysis] = useState<ChessAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [chess, setChess] = useState<Chess | null>(null);
  const [moveIndex, setMoveIndex] = useState(0);
  const [moves, setMoves] = useState<string[]>([]);
  const [isGameInfoOpen, setIsGameInfoOpen] = useState(false);
  const [isPgnOpen, setIsPgnOpen] = useState(false);
  const [isAnalysisOpen, setIsAnalysisOpen] = useState(false);

  useEffect(() => {
    fetchAnalysis();
  }, [id]);

  useEffect(() => {
    if (analysis && boardRef.current && !cgRef.current) {
      // Initialize chessground
      cgRef.current = Chessground(boardRef.current, {
        viewOnly: true,
        coordinates: true,
        fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      });

      // Load the game
      const game = new Chess();
      game.loadPgn(analysis.pgn);
      const history = game.history();
      setMoves(history);
      setChess(game);

      // Reset to starting position
      game.reset();
      updateBoard(game);
    }
  }, [analysis]);

  useEffect(() => {
    if (chess && moves.length > 0) {
      const game = new Chess();
      for (let i = 0; i < moveIndex; i++) {
        game.move(moves[i]);
      }
      updateBoard(game);
    }
  }, [moveIndex]);

  const fetchAnalysis = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/analyses/${id}`);

      if (!response.ok) {
        throw new Error("Failed to fetch analysis");
      }

      const data = await response.json();
      setAnalysis(data.analysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const updateBoard = (game: Chess) => {
    if (cgRef.current) {
      const fen = game.fen();
      cgRef.current.set({
        fen,
        turnColor: game.turn() === "w" ? "white" : "black",
        movable: {
          color: undefined,
          free: false,
        },
      });
    }
  };

  const goToStart = () => {
    setMoveIndex(0);
  };

  const goToPrevious = () => {
    if (moveIndex > 0) {
      setMoveIndex(moveIndex - 1);
    }
  };

  const goToNext = () => {
    if (moveIndex < moves.length) {
      setMoveIndex(moveIndex + 1);
    }
  };

  const goToEnd = () => {
    setMoveIndex(moves.length);
  };

  const getCurrentEvaluation = (): number => {
    if (!analysis?.analysis_results?.moves || moveIndex === 0) {
      return 0;
    }

    const analysisMove = analysis.analysis_results.moves[moveIndex - 1];
    if (!analysisMove) return 0;

    return analysisMove.evaluation || 0;
  };

  const getEvaluationPercentage = (eval_score: number): number => {
    // Convert centipawn evaluation to percentage for visual display
    // Clamp between -1000 and 1000, then convert to 0-100%
    const clamped = Math.max(-1000, Math.min(1000, eval_score));
    // 0 eval = 50%, +1000 = 0% (top - black advantage), -1000 = 100% (bottom - white advantage)
    return ((1000 - clamped) / 2000) * 100;
  };

  const extractGameInfo = (pgn: string) => {
    const whiteMatch = pgn.match(/\[White "([^"]+)"\]/);
    const blackMatch = pgn.match(/\[Black "([^"]+)"\]/);
    const resultMatch = pgn.match(/\[Result "([^"]+)"\]/);
    const dateMatch = pgn.match(/\[Date "([^"]+)"\]/);
    const linkMatch = pgn.match(/\[Link "([^"]+)"\]/);

    return {
      white: whiteMatch ? whiteMatch[1] : "Unknown",
      black: blackMatch ? blackMatch[1] : "Unknown",
      result: resultMatch ? resultMatch[1] : "*",
      date: dateMatch ? dateMatch[1] : "Unknown",
      link: linkMatch ? linkMatch[1] : null,
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-12 text-center">
            <div className="text-xl text-gray-600 dark:text-gray-400">
              Loading analysis...
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-2">Error</h2>
            <p>{error || "Analysis not found"}</p>
            <Link
              href="/analyzed_games"
              className="inline-block mt-4 text-blue-500 hover:text-blue-600 underline"
            >
              Back to Analyzed Games
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const gameInfo = extractGameInfo(analysis.pgn);

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold">
              {gameInfo.white} vs {gameInfo.black}
            </h1>
            {gameInfo.link && (
              <a
                href={gameInfo.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:text-blue-600 underline text-sm mt-2 inline-block"
              >
                View original game →
              </a>
            )}
          </div>
          <Link
            href="/analyzed_games"
            className="text-blue-500 hover:text-blue-600 underline"
          >
            Back to Analyzed Games
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chess Board */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <div className="flex gap-4 items-start">
                {/* Evaluation Bar */}
                <div className="flex flex-col items-center">
                  <div
                    className="w-8 rounded-lg overflow-hidden border-2 border-gray-300 dark:border-gray-600"
                    style={{ height: "600px" }}
                  >
                    <div
                      className="bg-gray-800 dark:bg-white transition-all duration-300 flex items-start justify-center"
                      style={{
                        height: `${getEvaluationPercentage(getCurrentEvaluation())}%`,
                      }}
                    >
                      <div className="text-white dark:text-gray-800 text-xs font-bold pt-1">
                        {getCurrentEvaluation() > 0 ? `+${(getCurrentEvaluation() / 100).toFixed(1)}` : (getCurrentEvaluation() / 100).toFixed(1)}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs mt-2 text-gray-600 dark:text-gray-400">Eval</div>
                </div>

                {/* Chess Board */}
                <div
                  ref={boardRef}
                  style={{
                    width: "600px",
                    height: "600px",
                    maxWidth: "100%",
                  }}
                ></div>
              </div>

              {/* Navigation Controls */}
              <div className="flex items-center justify-center gap-4 mt-6">
                <button
                  onClick={goToStart}
                  disabled={moveIndex === 0}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  title="First move"
                >
                  &lt;&lt;
                </button>
                <button
                  onClick={goToPrevious}
                  disabled={moveIndex === 0}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  title="Previous move"
                >
                  &lt;
                </button>
                <div className="text-lg font-medium min-w-[100px] text-center">
                  Move {moveIndex} / {moves.length}
                </div>
                <button
                  onClick={goToNext}
                  disabled={moveIndex === moves.length}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  title="Next move"
                >
                  &gt;
                </button>
                <button
                  onClick={goToEnd}
                  disabled={moveIndex === moves.length}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  title="Last move"
                >
                  &gt;&gt;
                </button>
              </div>

              {/* Move List */}
              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-2">Moves</h3>
                <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 max-h-48 overflow-y-auto">
                  <div className="grid grid-cols-2 gap-2 text-sm font-mono">
                    {moves.map((move, idx) => (
                      <button
                        key={idx}
                        onClick={() => setMoveIndex(idx + 1)}
                        className={`text-left px-2 py-1 rounded ${
                          moveIndex === idx + 1
                            ? "bg-blue-500 text-white"
                            : "hover:bg-gray-200 dark:hover:bg-gray-600"
                        }`}
                      >
                        {Math.floor(idx / 2) + 1}
                        {idx % 2 === 0 ? ". " : "... "}
                        {move}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Game Info & Analysis */}
          <div className="space-y-6">
            {/* Game Info */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
              <button
                onClick={() => setIsGameInfoOpen(!isGameInfoOpen)}
                className="w-full p-6 text-left flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors rounded-lg"
              >
                <h2 className="text-xl font-semibold">Game Information</h2>
                <span className="text-2xl">{isGameInfoOpen ? "−" : "+"}</span>
              </button>
              {isGameInfoOpen && (
                <div className="px-6 pb-6 space-y-2 text-sm">
                  <div>
                    <span className="font-medium">White:</span> {gameInfo.white}
                  </div>
                  <div>
                    <span className="font-medium">Black:</span> {gameInfo.black}
                  </div>
                  <div>
                    <span className="font-medium">Result:</span> {gameInfo.result}
                  </div>
                  <div>
                    <span className="font-medium">Date:</span> {gameInfo.date}
                  </div>
                  <div>
                    <span className="font-medium">Analysis Depth:</span>{" "}
                    {analysis.analysis_config.depth}
                  </div>
                  <div>
                    <span className="font-medium">Find Alternatives:</span>{" "}
                    {analysis.analysis_config.find_alternatives ? "Yes" : "No"}
                  </div>
                </div>
              )}
            </div>

            {/* PGN */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
              <button
                onClick={() => setIsPgnOpen(!isPgnOpen)}
                className="w-full p-6 text-left flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors rounded-lg"
              >
                <h2 className="text-xl font-semibold">PGN</h2>
                <span className="text-2xl">{isPgnOpen ? "−" : "+"}</span>
              </button>
              {isPgnOpen && (
                <div className="px-6 pb-6">
                  <pre className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg text-xs font-mono whitespace-pre-wrap overflow-x-auto max-h-64">
                    {analysis.pgn}
                  </pre>
                </div>
              )}
            </div>

            {/* Analysis Results */}
            {analysis.analysis_results && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
                <button
                  onClick={() => setIsAnalysisOpen(!isAnalysisOpen)}
                  className="w-full p-6 text-left flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors rounded-lg"
                >
                  <h2 className="text-xl font-semibold">Analysis Results</h2>
                  <span className="text-2xl">{isAnalysisOpen ? "−" : "+"}</span>
                </button>
                {isAnalysisOpen && (
                  <div className="px-6 pb-6">
                    <pre className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg text-xs overflow-x-auto max-h-96">
                      {JSON.stringify(analysis.analysis_results, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
