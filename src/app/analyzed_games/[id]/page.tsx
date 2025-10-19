"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Chessground } from "chessground";
import { Chess } from "chess.js";
import type { Api } from "chessground/api";
import { useChessRendering } from "@/helpers/use-chess-rendering";

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
  const moveRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});

  const [analysis, setAnalysis] = useState<ChessAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [chess, setChess] = useState<Chess | null>(null);
  const [moveIndex, setMoveIndex] = useState(0);
  const [moves, setMoves] = useState<string[]>([]);
  const [isGameInfoOpen, setIsGameInfoOpen] = useState(false);
  const [isPgnOpen, setIsPgnOpen] = useState(false);
  const [isAnalysisOpen, setIsAnalysisOpen] = useState(false);
  const [existingVideos, setExistingVideos] = useState<any[]>([]);
  const [uploadingVideoId, setUploadingVideoId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Annotation state
  const [annotations, setAnnotations] = useState<any[]>([]);
  const [showAnnotationModal, setShowAnnotationModal] = useState(false);
  const [annotationMoveIndex, setAnnotationMoveIndex] = useState<number | null>(null);
  const [annotationText, setAnnotationText] = useState("");
  const [annotationSaving, setAnnotationSaving] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [generatingMoves, setGeneratingMoves] = useState<Set<number>>(new Set());
  const annotationBoardRef = useRef<HTMLDivElement>(null);
  const annotationCgRef = useRef<Api | null>(null);

  // Composition type selection
  const [compositionType, setCompositionType] = useState<"walkthrough" | "annotated">("walkthrough");

  // Aspect ratio selection
  const [aspectRatio, setAspectRatio] = useState<"landscape" | "portrait">("landscape");

  // Chess rendering hook
  const { renderMedia, state: renderState, undo } = useChessRendering(id);

  useEffect(() => {
    fetchAnalysis();
    fetchVideos();
    fetchAnnotations();
  }, [id]);

  useEffect(() => {
    // Refresh videos when render completes
    if (renderState.status === "done") {
      fetchVideos();
    }
  }, [renderState.status]);

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

      // Scroll the current move into view
      if (moveIndex > 0 && moveRefs.current[moveIndex]) {
        moveRefs.current[moveIndex]?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
      }
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
      // Debug: log analysis_results structure
      console.log('Analysis results structure:', data.analysis?.analysis_results);
      if (data.analysis?.analysis_results?.moves?.[0]) {
        console.log('First move data:', data.analysis.analysis_results.moves[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const fetchVideos = async () => {
    try {
      const response = await fetch(`/api/videos/${id}`);

      if (!response.ok) {
        throw new Error("Failed to fetch videos");
      }

      const data = await response.json();
      setExistingVideos(data.videos.filter((v: any) => v.status === "completed"));
    } catch (err) {
      console.error("Failed to fetch videos:", err);
    }
  };

  const uploadToYouTube = async (videoId: string) => {
    setUploadingVideoId(videoId);
    setUploadError(null);

    try {
      const response = await fetch("/api/youtube/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to upload to YouTube");
      }

      const data = await response.json();

      // Refresh videos to show YouTube URL
      await fetchVideos();

      // Open YouTube video in new tab
      if (data.youtubeUrl) {
        window.open(data.youtubeUrl, "_blank");
      }
    } catch (err) {
      console.error("YouTube upload error:", err);
      setUploadError(err instanceof Error ? err.message : "Failed to upload to YouTube");
    } finally {
      setUploadingVideoId(null);
    }
  };

  const fetchAnnotations = async () => {
    try {
      const response = await fetch(`/api/annotations/${id}`);
      if (!response.ok) throw new Error("Failed to fetch annotations");
      const data = await response.json();
      setAnnotations(data.annotations);
    } catch (err) {
      console.error("Failed to fetch annotations:", err);
    }
  };

  const openAnnotationModal = (moveIdx: number) => {
    const existing = annotations.find((a) => a.move_index === moveIdx);
    setAnnotationMoveIndex(moveIdx);
    setAnnotationText(existing?.annotation_text || "");
    setShowAnnotationModal(true);
  };

  const closeAnnotationModal = () => {
    setShowAnnotationModal(false);
    setAnnotationMoveIndex(null);
    setAnnotationText("");
    // Clean up annotation board
    if (annotationCgRef.current) {
      annotationCgRef.current.destroy();
      annotationCgRef.current = null;
    }
  };

  // Initialize annotation board when modal opens
  useEffect(() => {
    if (showAnnotationModal && annotationMoveIndex !== null && annotationBoardRef.current && analysis) {
      // Calculate FEN for the position after the move
      const game = new Chess();
      game.loadPgn(analysis.pgn);
      const history = game.history();

      // Reset and play moves up to annotationMoveIndex
      game.reset();
      for (let i = 0; i < annotationMoveIndex; i++) {
        if (history[i]) {
          game.move(history[i]);
        }
      }

      const fen = game.fen();

      // Initialize or update the annotation board
      if (!annotationCgRef.current) {
        annotationCgRef.current = Chessground(annotationBoardRef.current, {
          viewOnly: true,
          coordinates: false,
          fen,
          orientation: "white",
          drawable: { enabled: false },
          highlight: { lastMove: false },
          animation: { enabled: false },
        });
      } else {
        annotationCgRef.current.set({
          fen,
          turnColor: game.turn() === "w" ? "white" : "black",
        });
      }
    }
  }, [showAnnotationModal, annotationMoveIndex, analysis]);

  const saveAnnotation = async () => {
    if (annotationMoveIndex === null || !annotationText.trim()) return;

    setAnnotationSaving(true);
    try {
      const response = await fetch("/api/annotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId: id,
          moveIndex: annotationMoveIndex,
          annotationText: annotationText.trim(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save annotation");
      }

      await fetchAnnotations();
      closeAnnotationModal();
    } catch (err) {
      console.error("Failed to save annotation:", err);
      alert(err instanceof Error ? err.message : "Failed to save annotation");
    } finally {
      setAnnotationSaving(false);
    }
  };

  const deleteAnnotationHandler = async (annotationId: string) => {
    if (!confirm("Delete this annotation?")) return;

    try {
      const response = await fetch("/api/annotations/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ annotationId }),
      });

      if (!response.ok) throw new Error("Failed to delete annotation");

      await fetchAnnotations();
    } catch (err) {
      console.error("Failed to delete annotation:", err);
      alert("Failed to delete annotation");
    }
  };

  // Generate AI annotation for modal use case
  const generateAIAnnotation = async () => {
    if (annotationMoveIndex === null || !analysis) return;

    setGeneratingAI(true);
    try {
      // Calculate position before the move
      const game = new Chess();
      game.loadPgn(analysis.pgn);
      const history = game.history();

      // Reset and play moves up to just before annotationMoveIndex
      game.reset();
      for (let i = 0; i < annotationMoveIndex - 1; i++) {
        if (history[i]) {
          game.move(history[i]);
        }
      }

      const positionBeforeMove = game.fen();
      const move = history[annotationMoveIndex - 1];

      // Get evaluations if available
      const currentEval = analysis.analysis_results?.moves?.[annotationMoveIndex - 1]?.evaluation;
      const previousEval = analysis.analysis_results?.moves?.[annotationMoveIndex - 2]?.evaluation;

      const response = await fetch("/api/annotations/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          position: positionBeforeMove,
          move,
          evaluation: currentEval,
          previousEvaluation: previousEval,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate annotation");
      }

      const data = await response.json();
      setAnnotationText(data.annotation);
    } catch (err) {
      console.error("Failed to generate AI annotation:", err);
      alert(err instanceof Error ? err.message : "Failed to generate annotation");
    } finally {
      setGeneratingAI(false);
    }
  };

  // Generate and save AI annotation directly (quick click from move list)
  const generateAIAnnotationQuick = async (moveIdx: number) => {
    if (!analysis || generatingMoves.has(moveIdx)) return;

    // Add to generating set
    setGeneratingMoves(new Set(generatingMoves).add(moveIdx));

    try {
      // Calculate position before the move
      const game = new Chess();
      game.loadPgn(analysis.pgn);
      const history = game.history();

      // Reset and play moves up to just before moveIdx
      game.reset();
      for (let i = 0; i < moveIdx - 1; i++) {
        if (history[i]) {
          game.move(history[i]);
        }
      }

      const positionBeforeMove = game.fen();
      const move = history[moveIdx - 1];

      // Get evaluations if available
      const currentEval = analysis.analysis_results?.moves?.[moveIdx - 1]?.evaluation;
      const previousEval = analysis.analysis_results?.moves?.[moveIdx - 2]?.evaluation;

      // Generate annotation
      const generateResponse = await fetch("/api/annotations/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          position: positionBeforeMove,
          move,
          evaluation: currentEval,
          previousEvaluation: previousEval,
        }),
      });

      if (!generateResponse.ok) {
        const error = await generateResponse.json();
        throw new Error(error.error || "Failed to generate annotation");
      }

      const generateData = await generateResponse.json();

      // Save annotation
      const saveResponse = await fetch("/api/annotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId: id,
          moveIndex: moveIdx,
          annotationText: generateData.annotation,
        }),
      });

      if (!saveResponse.ok) {
        const error = await saveResponse.json();
        throw new Error(error.error || "Failed to save annotation");
      }

      await fetchAnnotations();
    } catch (err) {
      console.error("Failed to generate AI annotation:", err);
      alert(err instanceof Error ? err.message : "Failed to generate annotation");
    } finally {
      // Remove from generating set
      const newSet = new Set(generatingMoves);
      newSet.delete(moveIdx);
      setGeneratingMoves(newSet);
    }
  };

  const hasAnnotation = (moveIdx: number) => {
    return annotations.some((a) => a.move_index === moveIdx);
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
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 md:mb-8 gap-4">
          <div>
            <h1 className="text-2xl md:text-4xl font-bold">
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
          <div className="flex flex-wrap gap-2 md:gap-4 items-center">
            <Link
              href={`/preview/${id}`}
              className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 font-medium transition-colors"
            >
              Preview Video
            </Link>
            {renderState.status === "init" || renderState.status === "error" ? (
              <>
                <select
                  value={compositionType}
                  onChange={(e) => setCompositionType(e.target.value as "walkthrough" | "annotated")}
                  disabled={compositionType === "annotated" && annotations.length === 0}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-lg font-medium transition-colors disabled:bg-gray-200 disabled:cursor-not-allowed"
                  title={compositionType === "annotated" && annotations.length === 0 ? "Add annotations first" : ""}
                >
                  <option value="walkthrough">Walkthrough</option>
                  <option value="annotated" disabled={annotations.length === 0}>
                    Annotated {annotations.length === 0 ? "(no annotations)" : `(${annotations.length})`}
                  </option>
                </select>
                <select
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value as "landscape" | "portrait")}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-lg font-medium transition-colors"
                >
                  <option value="landscape">Landscape (16:9)</option>
                  <option value="portrait">Portrait (9:16)</option>
                </select>
                <button
                  onClick={() => renderMedia(compositionType, aspectRatio)}
                  disabled={renderState.status === "invoking" || (compositionType === "annotated" && annotations.length === 0)}
                  className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {renderState.status === "invoking" ? "Starting..." : "Render Video"}
                </button>
              </>
            ) : null}
            <Link
              href="/analyzed_games"
              className="text-blue-500 hover:text-blue-600 underline text-sm md:text-base"
            >
              Back to Analyzed Games
            </Link>
          </div>
        </div>

        {/* Render Progress */}
        {(renderState.status === "invoking" || renderState.status === "rendering" || renderState.status === "done") && (
          <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">
              {renderState.status === "done" ? "Render Complete" : "Rendering Video..."}
            </h2>
            {renderState.status === "rendering" && (
              <div className="mb-4">
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                  <div
                    className="bg-green-500 h-4 transition-all duration-300"
                    style={{ width: `${renderState.progress * 100}%` }}
                  ></div>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  Progress: {Math.round(renderState.progress * 100)}%
                </p>
              </div>
            )}
            {renderState.status === "done" && (
              <div>
                <p className="text-green-600 dark:text-green-400 mb-4">
                  Video rendered successfully! ({(renderState.size / 1024 / 1024).toFixed(2)} MB)
                </p>
                <div className="flex gap-4">
                  <a
                    href={renderState.url}
                    download
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium transition-colors"
                  >
                    Download Video
                  </a>
                  <button
                    onClick={undo}
                    className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 font-medium transition-colors"
                  >
                    Render Another
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Render Error */}
        {renderState.status === "error" && (
          <div className="mb-6 bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-2">Render Error</h2>
            <p>{renderState.error.message}</p>
            <button
              onClick={undo}
              className="mt-4 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 font-medium transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Existing Videos */}
        {existingVideos.length > 0 && renderState.status !== "done" && (
          <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Rendered Videos</h2>
            {uploadError && (
              <div className="mb-4 bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-200 rounded-lg p-4">
                <p className="font-medium">Upload Error</p>
                <p className="text-sm">{uploadError}</p>
              </div>
            )}
            <div className="space-y-4">
              {existingVideos.map((video) => (
                <div
                  key={video.id}
                  className="bg-gray-50 dark:bg-gray-700 rounded-lg overflow-hidden"
                >
                  <div className="flex items-center justify-between p-4">
                    <div className="flex-1">
                      <p className="font-medium">
                        {video.composition_type.charAt(0).toUpperCase() + video.composition_type.slice(1)} Video
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Rendered {new Date(video.completed_at || video.created_at).toLocaleString()}
                      </p>
                      {video.metadata?.youtubeUrl && (
                        <a
                          href={video.metadata.youtubeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-red-500 hover:text-red-600 underline mt-1 inline-block"
                        >
                          View on YouTube →
                        </a>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <a
                        href={video.s3_url}
                        download
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium transition-colors"
                      >
                        Download
                      </a>
                      {!video.metadata?.youtubeUrl && (
                        <button
                          onClick={() => uploadToYouTube(video.id)}
                          disabled={uploadingVideoId === video.id}
                          className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 font-medium transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          {uploadingVideoId === video.id ? (
                            <>
                              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                              Uploading...
                            </>
                          ) : (
                            "Upload to YouTube"
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Chess Board */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-3 md:p-6">
              <div className="flex gap-2 md:gap-4 items-start">
                {/* Evaluation Bar */}
                <div className="flex flex-col items-center">
                  <div
                    className="w-6 md:w-8 rounded-lg overflow-hidden border-2 border-gray-300 dark:border-gray-600"
                    style={{ height: "min(600px, calc(100vw - 4rem))" }}
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
                  className="flex-1"
                  style={{
                    width: "100%",
                    maxWidth: "600px",
                    aspectRatio: "1 / 1",
                  }}
                ></div>
              </div>

              {/* Navigation Controls */}
              <div className="flex items-center justify-center gap-2 md:gap-4 mt-4 md:mt-6">
                <button
                  onClick={goToStart}
                  disabled={moveIndex === 0}
                  className="px-3 md:px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm md:text-base"
                  title="First move"
                >
                  &lt;&lt;
                </button>
                <button
                  onClick={goToPrevious}
                  disabled={moveIndex === 0}
                  className="px-3 md:px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm md:text-base"
                  title="Previous move"
                >
                  &lt;
                </button>
                <div className="text-sm md:text-lg font-medium min-w-[80px] md:min-w-[100px] text-center">
                  Move {moveIndex} / {moves.length}
                </div>
                <button
                  onClick={goToNext}
                  disabled={moveIndex === moves.length}
                  className="px-3 md:px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm md:text-base"
                  title="Next move"
                >
                  &gt;
                </button>
                <button
                  onClick={goToEnd}
                  disabled={moveIndex === moves.length}
                  className="px-3 md:px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm md:text-base"
                  title="Last move"
                >
                  &gt;&gt;
                </button>
              </div>

              {/* Move List with Annotations */}
              <div className="mt-4 md:mt-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-base md:text-lg font-semibold">Moves</h3>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {annotations.length} annotation{annotations.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-3 md:p-4 max-h-48 md:max-h-64 overflow-y-auto">
                  <div className="space-y-1">
                    {/* Group moves by pairs (white and black) */}
                    {Array.from({ length: Math.ceil(moves.length / 2) }).map((_, pairIndex) => {
                      const whiteIdx = pairIndex * 2;
                      const blackIdx = pairIndex * 2 + 1;
                      const whiteMove = moves[whiteIdx];
                      const blackMove = moves[blackIdx];
                      const whiteMoveNum = whiteIdx + 1;
                      const blackMoveNum = blackIdx + 1;
                      const whiteHasNote = hasAnnotation(whiteMoveNum);
                      const blackHasNote = blackMove ? hasAnnotation(blackMoveNum) : false;

                      // Get evaluations - check multiple possible structures
                      let whiteEval: number | undefined;
                      let blackEval: number | undefined;

                      // Try different paths where evaluation might be stored
                      if (analysis?.analysis_results?.moves?.[whiteIdx]) {
                        const whiteMove = analysis.analysis_results.moves[whiteIdx];
                        whiteEval = whiteMove.evaluation ?? whiteMove.eval ?? whiteMove.score;
                      }

                      if (blackMove && analysis?.analysis_results?.moves?.[blackIdx]) {
                        const blackMoveData = analysis.analysis_results.moves[blackIdx];
                        blackEval = blackMoveData.evaluation ?? blackMoveData.eval ?? blackMoveData.score;
                      }

                      const formatEval = (evalScore: number | undefined) => {
                        if (evalScore === undefined) return '';
                        if (evalScore > 0) return `+${(evalScore / 100).toFixed(1)}`;
                        return (evalScore / 100).toFixed(1);
                      };

                      return (
                        <div key={pairIndex} className="flex items-center gap-1">
                          {/* Move number */}
                          <span className="text-xs font-medium text-gray-600 dark:text-gray-400 w-6 md:w-8">
                            {pairIndex + 1}.
                          </span>

                          {/* White's move */}
                          <div className="flex items-center gap-1 flex-1">
                            <button
                              onClick={() => setMoveIndex(whiteMoveNum)}
                              ref={(el) => {
                                moveRefs.current[whiteMoveNum] = el;
                              }}
                              className={`flex-1 text-left px-1.5 md:px-2 py-1 rounded text-xs md:text-sm font-mono ${
                                moveIndex === whiteMoveNum
                                  ? "bg-blue-500 text-white"
                                  : "hover:bg-gray-200 dark:hover:bg-gray-600"
                              }`}
                            >
                              {whiteMove}
                              {whiteHasNote && <span className="ml-1">💬</span>}
                              {whiteEval !== undefined && (
                                <span className={`ml-1 md:ml-2 text-xs ${
                                  moveIndex === whiteMoveNum
                                    ? "text-white opacity-80"
                                    : whiteEval > 0
                                    ? "text-green-700 dark:text-green-400"
                                    : whiteEval < 0
                                    ? "text-red-700 dark:text-red-400"
                                    : "text-gray-600 dark:text-gray-400"
                                }`}>
                                  {formatEval(whiteEval)}
                                </span>
                              )}
                            </button>
                            <button
                              onClick={(e) => {
                                if (e.shiftKey) {
                                  e.preventDefault();
                                  generateAIAnnotationQuick(whiteMoveNum);
                                } else {
                                  openAnnotationModal(whiteMoveNum);
                                }
                              }}
                              disabled={generatingMoves.has(whiteMoveNum)}
                              className={`px-1.5 md:px-2 py-1 rounded text-xs ${
                                generatingMoves.has(whiteMoveNum)
                                  ? "bg-yellow-400 cursor-wait"
                                  : whiteHasNote
                                  ? "bg-purple-500 text-white hover:bg-purple-600"
                                  : "bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500"
                              }`}
                              title={
                                generatingMoves.has(whiteMoveNum)
                                  ? "Generating annotation..."
                                  : whiteHasNote
                                  ? "Edit annotation (Shift+Click for AI)"
                                  : "Add annotation (Shift+Click for AI)"
                              }
                            >
                              {generatingMoves.has(whiteMoveNum) ? (
                                <span className="inline-block w-3 h-3 border-2 border-gray-700 border-t-transparent rounded-full animate-spin"></span>
                              ) : whiteHasNote ? (
                                "✏️"
                              ) : (
                                "+"
                              )}
                            </button>
                          </div>

                          {/* Black's move */}
                          {blackMove && (
                            <div className="flex items-center gap-1 flex-1">
                              <button
                                onClick={() => setMoveIndex(blackMoveNum)}
                                ref={(el) => {
                                  moveRefs.current[blackMoveNum] = el;
                                }}
                                className={`flex-1 text-left px-1.5 md:px-2 py-1 rounded text-xs md:text-sm font-mono ${
                                  moveIndex === blackMoveNum
                                    ? "bg-blue-500 text-white"
                                    : "hover:bg-gray-200 dark:hover:bg-gray-600"
                                }`}
                              >
                                {blackMove}
                                {blackHasNote && <span className="ml-1">💬</span>}
                                {blackEval !== undefined && (
                                  <span className={`ml-1 md:ml-2 text-xs ${
                                    moveIndex === blackMoveNum
                                      ? "text-white opacity-80"
                                      : blackEval > 0
                                      ? "text-green-700 dark:text-green-400"
                                      : blackEval < 0
                                      ? "text-red-700 dark:text-red-400"
                                      : "text-gray-600 dark:text-gray-400"
                                  }`}>
                                    {formatEval(blackEval)}
                                  </span>
                                )}
                              </button>
                              <button
                                onClick={(e) => {
                                  if (e.shiftKey) {
                                    e.preventDefault();
                                    generateAIAnnotationQuick(blackMoveNum);
                                  } else {
                                    openAnnotationModal(blackMoveNum);
                                  }
                                }}
                                disabled={generatingMoves.has(blackMoveNum)}
                                className={`px-1.5 md:px-2 py-1 rounded text-xs ${
                                  generatingMoves.has(blackMoveNum)
                                    ? "bg-yellow-400 cursor-wait"
                                    : blackHasNote
                                    ? "bg-purple-500 text-white hover:bg-purple-600"
                                    : "bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500"
                                }`}
                                title={
                                  generatingMoves.has(blackMoveNum)
                                    ? "Generating annotation..."
                                    : blackHasNote
                                    ? "Edit annotation (Shift+Click for AI)"
                                    : "Add annotation (Shift+Click for AI)"
                                }
                              >
                                {generatingMoves.has(blackMoveNum) ? (
                                  <span className="inline-block w-3 h-3 border-2 border-gray-700 border-t-transparent rounded-full animate-spin"></span>
                                ) : blackHasNote ? (
                                  "✏️"
                                ) : (
                                  "+"
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Game Info & Analysis */}
          <div className="space-y-4 md:space-y-6">
            {/* Game Info */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
              <button
                onClick={() => setIsGameInfoOpen(!isGameInfoOpen)}
                className="w-full p-4 md:p-6 text-left flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors rounded-lg"
              >
                <h2 className="text-lg md:text-xl font-semibold">Game Information</h2>
                <span className="text-xl md:text-2xl">{isGameInfoOpen ? "−" : "+"}</span>
              </button>
              {isGameInfoOpen && (
                <div className="px-4 md:px-6 pb-4 md:pb-6 space-y-2 text-xs md:text-sm">
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
                className="w-full p-4 md:p-6 text-left flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors rounded-lg"
              >
                <h2 className="text-lg md:text-xl font-semibold">PGN</h2>
                <span className="text-xl md:text-2xl">{isPgnOpen ? "−" : "+"}</span>
              </button>
              {isPgnOpen && (
                <div className="px-4 md:px-6 pb-4 md:pb-6">
                  <pre className="bg-gray-100 dark:bg-gray-700 p-3 md:p-4 rounded-lg text-xs font-mono whitespace-pre-wrap overflow-x-auto max-h-48 md:max-h-64">
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
                  className="w-full p-4 md:p-6 text-left flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors rounded-lg"
                >
                  <h2 className="text-lg md:text-xl font-semibold">Analysis Results</h2>
                  <span className="text-xl md:text-2xl">{isAnalysisOpen ? "−" : "+"}</span>
                </button>
                {isAnalysisOpen && (
                  <div className="px-4 md:px-6 pb-4 md:pb-6">
                    <pre className="bg-gray-100 dark:bg-gray-700 p-3 md:p-4 rounded-lg text-xs overflow-x-auto max-h-64 md:max-h-96">
                      {JSON.stringify(analysis.analysis_results, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Annotation Modal */}
        {showAnnotationModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold">
                  {hasAnnotation(annotationMoveIndex!) ? "Edit" : "Add"} Annotation
                </h2>
                <button
                  onClick={closeAnnotationModal}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="flex gap-6 mb-4">
                {/* Position Preview */}
                <div className="flex-shrink-0">
                  <div className="text-sm font-medium mb-2 text-center">
                    Position after move {annotationMoveIndex}:
                    {annotationMoveIndex && moves[annotationMoveIndex - 1] && (
                      <span className="ml-2 font-mono text-blue-500">
                        {Math.floor((annotationMoveIndex - 1) / 2) + 1}
                        {annotationMoveIndex % 2 === 1 ? ". " : "... "}
                        {moves[annotationMoveIndex - 1]}
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      width: "300px",
                      height: "300px",
                      position: "relative",
                    }}
                    className="rounded-lg overflow-hidden shadow-md"
                  >
                    <div
                      ref={annotationBoardRef}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: "100%",
                      }}
                    ></div>
                  </div>
                </div>

                {/* Annotation Text */}
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium">
                      Your annotation:
                    </label>
                    <button
                      onClick={generateAIAnnotation}
                      disabled={generatingAI}
                      className="px-3 py-1 bg-purple-500 text-white rounded-lg hover:bg-purple-600 text-xs font-medium transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                      {generatingAI ? (
                        <>
                          <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                          Generating...
                        </>
                      ) : (
                        <>
                          <span>✨</span>
                          Generate with AI
                        </>
                      )}
                    </button>
                  </div>
                  <textarea
                    value={annotationText}
                    onChange={(e) => setAnnotationText(e.target.value)}
                    placeholder="Enter your commentary or analysis for this position... (max 500 characters)"
                    className="w-full h-64 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 resize-none"
                    maxLength={500}
                  />
                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-1 text-right">
                    {annotationText.length} / 500 characters
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  {hasAnnotation(annotationMoveIndex!) && (
                    <button
                      onClick={() => {
                        const ann = annotations.find((a) => a.move_index === annotationMoveIndex);
                        if (ann) {
                          deleteAnnotationHandler(ann.id);
                          closeAnnotationModal();
                        }
                      }}
                      className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 font-medium transition-colors"
                    >
                      Delete
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={closeAnnotationModal}
                    className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveAnnotation}
                    disabled={annotationSaving || !annotationText.trim()}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {annotationSaving ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
