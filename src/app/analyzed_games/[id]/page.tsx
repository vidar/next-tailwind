"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Chessground } from "chessground";
import { Chess } from "chess.js";
import type { Api } from "chessground/api";
import { useChessRendering } from "@/helpers/use-chess-rendering";
import { RenderOptionsModal, type RenderOptions } from "@/components/RenderOptionsModal";
import { EvaluationChart } from "@/components/EvaluationChart";

interface ChessAnalysis {
  id: string;
  pgn: string;
  game_data: Record<string, unknown>;
  analysis_config: {
    depth: number;
    find_alternatives: boolean;
  };
  analysis_results: {
    moves?: Array<{
      move?: string;
      evaluation?: number;
      eval?: number;
      score?: number;
      classification?: string;
      best_move?: string;
    }>;
  } | null;
  status: string;
  completed_at: string | null;
}

export default function AnalyzedGameDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const boardRef = useRef<HTMLDivElement>(null);
  const cgRef = useRef<Api | null>(null);
  const moveRefs = useRef<{ [key: number]: HTMLElement | null }>({});

  const [analysis, setAnalysis] = useState<ChessAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [chess, setChess] = useState<Chess | null>(null);
  const [moveIndex, setMoveIndex] = useState(0);
  const [moves, setMoves] = useState<string[]>([]);
  const [isGameInfoOpen, setIsGameInfoOpen] = useState(false);
  const [isPgnOpen, setIsPgnOpen] = useState(false);
  const [isAnalysisOpen, setIsAnalysisOpen] = useState(false);
  const [existingVideos, setExistingVideos] = useState<Array<{
    id: string;
    status: string;
    s3_url: string;
    composition_type: string;
    created_at: string;
    completed_at: string | null;
    metadata?: { youtubeUrl?: string } | null;
  }>>([]);
  const [watchingVideoId, setWatchingVideoId] = useState<string | null>(null);

  // Annotation state
  const [annotations, setAnnotations] = useState<Array<{ id: string; move_index: number; annotation_text: string }>>([]);
  const [showAnnotationPanel, setShowAnnotationPanel] = useState(false);
  const [annotationMoveIndex, setAnnotationMoveIndex] = useState<number | null>(null);
  const [annotationText, setAnnotationText] = useState("");
  const [annotationSaving, setAnnotationSaving] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [generatingMoves, setGeneratingMoves] = useState<Set<number>>(new Set());
  const annotationBoardRef = useRef<HTMLDivElement>(null);
  const annotationCgRef = useRef<Api | null>(null);

  // Key moments state
  const [keyMoments, setKeyMoments] = useState<number[]>([]);

  // Render options modal
  const [showRenderModal, setShowRenderModal] = useState(false);

  // Board orientation (for viewing only)
  const [boardOrientation, setBoardOrientation] = useState<"white" | "black">("white");

  // Chess rendering hook
  const { renderMedia, state: renderState, undo } = useChessRendering(id);

  useEffect(() => {
    fetchAnalysis();
    fetchVideos();
    fetchAnnotations();
  }, [id]);

  // Detect key moments when analysis is loaded
  useEffect(() => {
    if (analysis?.analysis_results?.moves && moves.length > 0) {
      detectKeyMoments();
    }
  }, [analysis, moves]);

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
        orientation: boardOrientation,
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

  // Update board orientation when it changes
  useEffect(() => {
    if (cgRef.current) {
      cgRef.current.set({ orientation: boardOrientation });
    }
  }, [boardOrientation]);

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
      setExistingVideos(data.videos.filter((v: { status: string }) => v.status === "completed"));
    } catch (err) {
      console.error("Failed to fetch videos:", err);
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

  const openAnnotationPanel = (moveIdx: number) => {
    const existing = annotations.find((a) => a.move_index === moveIdx);
    setAnnotationMoveIndex(moveIdx);
    setAnnotationText(existing?.annotation_text || "");
    setShowAnnotationPanel(true);
    // Jump to that move
    setMoveIndex(moveIdx);
  };

  const closeAnnotationPanel = () => {
    setShowAnnotationPanel(false);
    setAnnotationMoveIndex(null);
    setAnnotationText("");
    // Clean up annotation board
    if (annotationCgRef.current) {
      annotationCgRef.current.destroy();
      annotationCgRef.current = null;
    }
  };

  // Detect key moments based on analysis
  const detectKeyMoments = () => {
    if (!analysis?.analysis_results?.moves) return;

    const moments: number[] = [];
    const analysisMovesData = analysis.analysis_results.moves;

    analysisMovesData.forEach((moveData, index) => {
      const moveNum = index + 1;

      // Check for classification-based key moments
      const classification = moveData.classification?.toLowerCase();
      if (classification && ['blunder', 'mistake', 'brilliant', 'best'].includes(classification)) {
        moments.push(moveNum);
        return;
      }

      // Check for large evaluation swings (>200 centipawns)
      if (index > 0) {
        const currentEval = moveData.evaluation ?? moveData.eval ?? moveData.score ?? 0;
        const previousEval = analysisMovesData[index - 1]?.evaluation ??
                           analysisMovesData[index - 1]?.eval ??
                           analysisMovesData[index - 1]?.score ?? 0;
        const evalSwing = Math.abs(currentEval - previousEval);

        if (evalSwing > 200) {
          moments.push(moveNum);
          return;
        }
      }
    });

    // Always include first move and last move
    if (moves.length > 0) {
      if (!moments.includes(1)) moments.unshift(1);
      if (!moments.includes(moves.length) && moves.length > 1) moments.push(moves.length);
    }

    // Sort and deduplicate
    const uniqueMoments = Array.from(new Set(moments)).sort((a, b) => a - b);
    setKeyMoments(uniqueMoments);
  };

  // Navigate to next/previous key moment
  const goToNextKeyMoment = () => {
    const currentIndex = keyMoments.findIndex(m => m > annotationMoveIndex!);
    if (currentIndex !== -1) {
      openAnnotationPanel(keyMoments[currentIndex]);
    }
  };

  const goToPreviousKeyMoment = () => {
    const currentIndex = keyMoments.findIndex(m => m >= annotationMoveIndex!);
    if (currentIndex > 0) {
      openAnnotationPanel(keyMoments[currentIndex - 1]);
    }
  };

  const skipCurrentKeyMoment = () => {
    closeAnnotationPanel();
    const currentIndex = keyMoments.findIndex(m => m === annotationMoveIndex);
    if (currentIndex !== -1 && currentIndex < keyMoments.length - 1) {
      setTimeout(() => openAnnotationPanel(keyMoments[currentIndex + 1]), 100);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!showAnnotationPanel) return;

      // Ignore if typing in textarea
      if (e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'Escape') {
        closeAnnotationPanel();
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        goToNextKeyMoment();
      } else if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        goToPreviousKeyMoment();
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        skipCurrentKeyMoment();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showAnnotationPanel, annotationMoveIndex, keyMoments]);

  // Initialize annotation board when panel opens
  useEffect(() => {
    if (showAnnotationPanel && annotationMoveIndex !== null && annotationBoardRef.current && analysis) {
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
  }, [showAnnotationPanel, annotationMoveIndex, analysis]);

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
      closeAnnotationPanel();
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

  const getAnnotation = (moveIdx: number): string | null => {
    const annotation = annotations.find((a) => a.move_index === moveIdx);
    return annotation?.annotation_text || null;
  };

  const isKeyMoment = (moveIdx: number): boolean => {
    return keyMoments.includes(moveIdx);
  };

  const getKeyMomentReason = (moveIdx: number): string | null => {
    if (!analysis?.analysis_results?.moves) return null;

    const moveData = analysis.analysis_results.moves[moveIdx - 1];
    if (!moveData) return null;

    const classification = moveData.classification?.toLowerCase();
    if (classification && ['blunder', 'mistake', 'brilliant', 'best'].includes(classification)) {
      return classification.charAt(0).toUpperCase() + classification.slice(1);
    }

    // Check eval swing
    if (moveIdx > 1) {
      const currentEval = moveData.evaluation ?? moveData.eval ?? moveData.score ?? 0;
      const previousEval = analysis.analysis_results.moves[moveIdx - 2]?.evaluation ??
                          analysis.analysis_results.moves[moveIdx - 2]?.eval ??
                          analysis.analysis_results.moves[moveIdx - 2]?.score ?? 0;
      const evalSwing = Math.abs(currentEval - previousEval);

      if (evalSwing > 200) {
        return "Big swing";
      }
    }

    if (moveIdx === 1) return "Opening";
    if (moveIdx === moves.length) return "Final position";

    return null;
  };

  const getAnnotatedKeyMomentsCount = (): number => {
    return keyMoments.filter(m => hasAnnotation(m)).length;
  };

  const handleRenderVideo = (options: RenderOptions) => {
    renderMedia(
      options.compositionType,
      options.aspectRatio,
      options.orientation,
      options.musicGenre
    );
    setShowRenderModal(false);
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
            <button
              onClick={() => setShowRenderModal(true)}
              disabled={renderState.status === "invoking" || renderState.status === "rendering"}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Render Video
            </button>
            <Link
              href="/analyzed_games"
              className="text-blue-500 hover:text-blue-600 underline text-sm md:text-base"
            >
              Back to Analyzed Games
            </Link>
          </div>
        </div>

        {/* Render Progress */}
        {(renderState.status === "invoking" || renderState.status === "rendering") && (
          <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Rendering Video...</h2>
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
        {existingVideos.length > 0 && (
          <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Rendered Videos</h2>
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
                      <button
                        onClick={() => setWatchingVideoId(video.id)}
                        className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium transition-colors"
                      >
                        Watch
                      </button>
                      <a
                        href={video.s3_url}
                        download
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium transition-colors"
                      >
                        Download
                      </a>
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
            {/* Evaluation Chart */}
            {analysis.analysis_results?.moves && (
              <div className="mb-4 md:mb-6">
                <EvaluationChart
                  moves={analysis.analysis_results.moves}
                  currentMoveIndex={moveIndex}
                  height={180}
                />
              </div>
            )}

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
                <div className="flex-1 flex flex-col items-center gap-2">
                  <div
                    ref={boardRef}
                    className="w-full"
                    style={{
                      maxWidth: "600px",
                      aspectRatio: "1 / 1",
                    }}
                  ></div>
                  <button
                    onClick={() => setBoardOrientation(boardOrientation === "white" ? "black" : "white")}
                    className="px-3 py-1.5 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 text-sm font-medium transition-colors flex items-center gap-2"
                    title="Flip board"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                    </svg>
                    Flip Board
                  </button>
                </div>
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
            </div>
          </div>

          {/* Sidebar - Move List & Game Info */}
          <div className="space-y-4 md:space-y-6">
            {/* Move List with Annotations - Hidden on mobile */}
            <div className="hidden lg:block bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-base md:text-lg font-semibold">Moves</h3>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {annotations.length} annotation{annotations.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-3 max-h-[600px] overflow-y-auto">
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
                              className={`flex-1 text-left px-1.5 md:px-2 py-1 rounded text-xs md:text-sm font-mono relative group ${
                                moveIndex === whiteMoveNum
                                  ? "bg-blue-500 text-white"
                                  : isKeyMoment(whiteMoveNum)
                                  ? "bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700"
                                  : "hover:bg-gray-200 dark:hover:bg-gray-600"
                              }`}
                              title={whiteHasNote ? getAnnotation(whiteMoveNum) || undefined : undefined}
                            >
                              {isKeyMoment(whiteMoveNum) && <span className="mr-1">⭐</span>}
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
                              {/* Custom tooltip */}
                              {whiteHasNote && getAnnotation(whiteMoveNum) && (
                                <div className="invisible group-hover:visible absolute left-0 bottom-full mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg shadow-lg z-50 pointer-events-none">
                                  <div className="whitespace-normal break-words">
                                    {getAnnotation(whiteMoveNum)}
                                  </div>
                                  {/* Tooltip arrow */}
                                  <div className="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
                                </div>
                              )}
                            </button>
                            <button
                              onClick={(e) => {
                                if (e.shiftKey) {
                                  e.preventDefault();
                                  generateAIAnnotationQuick(whiteMoveNum);
                                } else {
                                  openAnnotationPanel(whiteMoveNum);
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
                                className={`flex-1 text-left px-1.5 md:px-2 py-1 rounded text-xs md:text-sm font-mono relative group ${
                                  moveIndex === blackMoveNum
                                    ? "bg-blue-500 text-white"
                                    : isKeyMoment(blackMoveNum)
                                    ? "bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700"
                                    : "hover:bg-gray-200 dark:hover:bg-gray-600"
                                }`}
                                title={blackHasNote ? getAnnotation(blackMoveNum) || undefined : undefined}
                              >
                                {isKeyMoment(blackMoveNum) && <span className="mr-1">⭐</span>}
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
                                {/* Custom tooltip */}
                                {blackHasNote && getAnnotation(blackMoveNum) && (
                                  <div className="invisible group-hover:visible absolute left-0 bottom-full mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg shadow-lg z-50 pointer-events-none">
                                    <div className="whitespace-normal break-words">
                                      {getAnnotation(blackMoveNum)}
                                    </div>
                                    {/* Tooltip arrow */}
                                    <div className="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
                                  </div>
                                )}
                              </button>
                              <button
                                onClick={(e) => {
                                  if (e.shiftKey) {
                                    e.preventDefault();
                                    generateAIAnnotationQuick(blackMoveNum);
                                  } else {
                                    openAnnotationPanel(blackMoveNum);
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

        {/* Render Options Modal */}
        <RenderOptionsModal
          isOpen={showRenderModal}
          onClose={() => setShowRenderModal(false)}
          onRender={handleRenderVideo}
          hasAnnotations={annotations.length > 0}
        />

        {/* Video Player Modal */}
        {watchingVideoId && (() => {
          const video = existingVideos.find(v => v.id === watchingVideoId);
          if (!video) return null;

          // Transform S3 URL to CDN proxy URL
          // Example: https://s3.amazonaws.com/bucket/renders/abc/out.mp4 -> https://cdn.chessmoments.com/s3-proxy/renders/abc/out.mp4
          const pathMatch = video.s3_url.match(/\/renders\/.+$/);
          const videoUrl = pathMatch
            ? `https://cdn.chessmoments.com/s3-proxy${pathMatch[0]}`
            : video.s3_url;

          return (
            <div
              className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
              onClick={() => setWatchingVideoId(null)}
            >
              <div
                className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl max-w-5xl w-full overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold">Video Player</h3>
                  <button
                    onClick={() => setWatchingVideoId(null)}
                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl leading-none"
                  >
                    ×
                  </button>
                </div>
                <div className="p-4 bg-black">
                  <video
                    src={videoUrl}
                    controls
                    autoPlay
                    className="w-full max-h-[70vh]"
                  >
                    Your browser does not support the video tag.
                  </video>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Annotation Modal */}
        {showAnnotationPanel && annotationMoveIndex !== null && (
          <div
            className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
            onClick={closeAnnotationPanel}
          >
            <div
              className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl max-w-2xl w-full overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold">
                    {hasAnnotation(annotationMoveIndex) ? "✏️ Edit" : "➕ Add"} Annotation
                  </span>
                  {annotationMoveIndex && moves[annotationMoveIndex - 1] && (
                    <span className="text-sm font-mono text-blue-500 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded">
                      {Math.floor((annotationMoveIndex - 1) / 2) + 1}
                      {annotationMoveIndex % 2 === 1 ? ". " : "... "}
                      {moves[annotationMoveIndex - 1]}
                    </span>
                  )}
                </div>
                <button
                  onClick={closeAnnotationPanel}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl leading-none"
                  title="Close (Esc)"
                >
                  ×
                </button>
              </div>

              {/* Content */}
              <div className="p-6">
                {/* Progress indicator for key moments */}
                {isKeyMoment(annotationMoveIndex) && (
                  <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-yellow-800 dark:text-yellow-200">
                        ⭐ Key moment {keyMoments.indexOf(annotationMoveIndex) + 1} of {keyMoments.length}
                        {getKeyMomentReason(annotationMoveIndex) && ` • ${getKeyMomentReason(annotationMoveIndex)}`}
                      </span>
                      <span className="text-yellow-700 dark:text-yellow-300 font-medium">
                        {getAnnotatedKeyMomentsCount()} / {keyMoments.length} annotated
                      </span>
                    </div>
                  </div>
                )}

                {/* Mini board preview */}
                <div className="mb-4">
                  <div
                    style={{
                      width: "240px",
                      height: "240px",
                      position: "relative",
                    }}
                    className="rounded-lg overflow-hidden shadow-md mx-auto"
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

                {/* Annotation textarea with AI button */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium">Your annotation:</label>
                    <button
                      onClick={generateAIAnnotation}
                      disabled={generatingAI}
                      className="px-3 py-1.5 bg-purple-500 text-white rounded text-sm font-medium transition-colors hover:bg-purple-600 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {generatingAI ? (
                        <>
                          <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                          <span>Generating...</span>
                        </>
                      ) : (
                        <>
                          <span>✨</span>
                          <span>AI Generate</span>
                        </>
                      )}
                    </button>
                  </div>
                  <textarea
                    value={annotationText}
                    onChange={(e) => setAnnotationText(e.target.value)}
                    placeholder="Enter your commentary for this position... (max 500 characters)"
                    className="w-full h-32 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 resize-none"
                    maxLength={500}
                    autoFocus
                  />
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-right">
                    {annotationText.length} / 500 characters
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    {hasAnnotation(annotationMoveIndex) && (
                      <button
                        onClick={() => {
                          const ann = annotations.find((a) => a.move_index === annotationMoveIndex);
                          if (ann) {
                            deleteAnnotationHandler(ann.id);
                            closeAnnotationPanel();
                          }
                        }}
                        className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm font-medium transition-colors"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={closeAnnotationPanel}
                      className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 text-sm font-medium transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveAnnotation}
                      disabled={annotationSaving || !annotationText.trim()}
                      className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm font-medium transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      {annotationSaving ? "Saving..." : "Save"}
                    </button>
                  </div>
                </div>

                {/* Keyboard shortcuts hint */}
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="text-xs text-gray-600 dark:text-gray-400 flex flex-wrap gap-x-4 gap-y-1">
                    <span><kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">N</kbd> Next key moment</span>
                    <span><kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">P</kbd> Previous</span>
                    <span><kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">S</kbd> Skip</span>
                    <span><kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">Esc</kbd> Close</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
