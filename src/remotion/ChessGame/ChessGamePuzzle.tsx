import { z } from "zod";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  Sequence,
  spring,
  interpolate,
  Audio,
  staticFile,
} from "remotion";
import { ChessGameProps } from "../../../types/constants";
import { Chess } from "chess.js";
import { useEffect, useRef, useMemo } from "react";
import { Chessground } from "chessground";
import type { Api } from "chessground/api";
import "chessground/assets/chessground.base.css";
import "chessground/assets/chessground.brown.css";
import "chessground/assets/chessground.cburnett.css";
import "./chessground-override.css";
import { LogoIntro } from "./LogoIntro";
import { LogoOutroWithCTA } from "./LogoOutroWithCTA";
import { ResultScreen } from "./ResultScreen";
import { getMusicTrack } from "../../lib/music-config";

// Extend ChessGameProps to include annotations
export const ChessGamePuzzleProps = ChessGameProps.extend({
  annotations: z.array(
    z.object({
      id: z.string(),
      game_id: z.string(),
      move_index: z.number(),
      annotation_text: z.string(),
      created_at: z.string(),
      updated_at: z.string(),
    })
  ),
});

// Puzzle Challenge Component
const PuzzleChallenge = ({
  opacity,
  phase,
}: {
  opacity: number;
  phase: "question" | "thinking" | "reveal";
}) => {
  return (
    <div
      style={{
        position: "absolute",
        top: "80px",
        left: "50%",
        transform: "translate(-50%, 0)",
        opacity,
        zIndex: 1000,
      }}
    >
      <div
        style={{
          backgroundColor: "rgba(30, 41, 59, 0.95)",
          border: "3px solid #f59e0b",
          borderRadius: "20px",
          padding: "20px 40px",
          boxShadow: "0 10px 40px rgba(0, 0, 0, 0.6)",
        }}
      >
        {phase === "question" && (
          <div
            style={{
              fontSize: "42px",
              fontWeight: "bold",
              color: "#f59e0b",
              textAlign: "center",
            }}
          >
            🤔 What would you play?
          </div>
        )}
        {phase === "thinking" && (
          <div
            style={{
              fontSize: "36px",
              fontWeight: "600",
              color: "#60a5fa",
              textAlign: "center",
            }}
          >
            ⏱️ Think about it...
          </div>
        )}
        {phase === "reveal" && (
          <div
            style={{
              fontSize: "42px",
              fontWeight: "bold",
              color: "#10b981",
              textAlign: "center",
            }}
          >
            ✓ Here's the move!
          </div>
        )}
      </div>
    </div>
  );
};

// Thinking Timer Component
const ThinkingTimer = ({
  secondsLeft,
  opacity,
}: {
  secondsLeft: number;
  opacity: number;
}) => {
  return (
    <div
      style={{
        position: "absolute",
        top: "180px",
        left: "50%",
        transform: "translate(-50%, 0)",
        opacity,
        zIndex: 1000,
      }}
    >
      <div
        style={{
          width: "120px",
          height: "120px",
          borderRadius: "50%",
          backgroundColor: "rgba(30, 41, 59, 0.95)",
          border: "4px solid #60a5fa",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 8px 30px rgba(0, 0, 0, 0.5)",
        }}
      >
        <span
          style={{
            fontSize: "56px",
            fontWeight: "bold",
            color: "#60a5fa",
          }}
        >
          {secondsLeft}
        </span>
      </div>
    </div>
  );
};

// Explanation Modal Component
const ExplanationModal = ({
  text,
  opacity,
}: {
  text: string;
  opacity: number;
}) => {
  return (
    <div
      style={{
        position: "absolute",
        bottom: "100px",
        left: "50%",
        transform: "translate(-50%, 0)",
        opacity,
        zIndex: 1000,
        maxWidth: "900px",
        width: "90%",
      }}
    >
      <div
        style={{
          backgroundColor: "rgba(30, 41, 59, 0.95)",
          border: "2px solid #10b981",
          borderRadius: "16px",
          padding: "24px 32px",
          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.5)",
        }}
      >
        <div
          style={{
            fontSize: "28px",
            lineHeight: "1.5",
            color: "white",
            textAlign: "center",
          }}
        >
          {text}
        </div>
      </div>
    </div>
  );
};

// Difficulty Badge
const DifficultyBadge = ({
  opacity,
}: {
  opacity: number;
}) => {
  return (
    <div
      style={{
        position: "absolute",
        top: "20px",
        right: "40px",
        opacity,
        zIndex: 1000,
      }}
    >
      <div
        style={{
          backgroundColor: "rgba(139, 92, 246, 0.9)",
          borderRadius: "12px",
          padding: "12px 20px",
          border: "2px solid #a78bfa",
        }}
      >
        <span
          style={{
            fontSize: "24px",
            fontWeight: "bold",
            color: "white",
          }}
        >
          🧩 Puzzle Challenge
        </span>
      </div>
    </div>
  );
};

// Main game content component
const GameContent = ({
  pgn,
  analysisResults,
  gameInfo,
  annotations,
  orientation = "white",
}: z.infer<typeof ChessGamePuzzleProps> & { introFrames?: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const boardRef = useRef<HTMLDivElement>(null);
  const cgRef = useRef<Api | null>(null);

  // Parse moves once
  const moves = useMemo(() => {
    const game = new Chess();
    try {
      game.loadPgn(pgn);
      return game.history();
    } catch (error) {
      console.error("Failed to load PGN:", error);
      return [];
    }
  }, [pgn]);

  // Create annotation map
  const annotationMap = useMemo(() => {
    const map = new Map<number, string>();
    annotations.forEach((ann) => {
      map.set(ann.move_index, ann.annotation_text);
    });
    return map;
  }, [annotations]);

  // Select puzzle moments (positions with annotations, limit to 3-4)
  const puzzleMoments = useMemo(() => {
    return annotations.slice(0, 4).map((ann) => ann.move_index);
  }, [annotations]);

  // Build timeline with puzzle sequences
  const moveTimeline = useMemo(() => {
    const timeline: Array<{
      moveIndex: number;
      startFrame: number;
      endFrame: number;
      isPuzzle: boolean;
    }> = [];

    const puzzleSet = new Set(puzzleMoments);
    let currentFrame = 0;

    for (let i = 0; i <= moves.length; i++) {
      const isPuzzle = puzzleSet.has(i);
      // Normal move: 1 second
      // Puzzle sequence: 8 seconds (1s pause + 1s question + 4s thinking + 2s reveal + explanation)
      const duration = isPuzzle ? fps * 8 : fps * 1;

      timeline.push({
        moveIndex: i,
        startFrame: currentFrame,
        endFrame: currentFrame + duration,
        isPuzzle,
      });

      currentFrame += duration;
    }

    return timeline;
  }, [moves, puzzleMoments, fps]);

  // Determine current state
  const currentState = useMemo(() => {
    const segment = moveTimeline.find(
      (seg) => frame >= seg.startFrame && frame < seg.endFrame
    );

    if (!segment) {
      return {
        moveIndex: moves.length,
        isPuzzle: false,
        puzzlePhase: null,
        challengeOpacity: 0,
        thinkingOpacity: 0,
        explanationOpacity: 0,
        difficultyOpacity: 0,
        secondsLeft: 0,
      };
    }

    const frameInSegment = frame - segment.startFrame;

    if (segment.isPuzzle) {
      // Puzzle timeline breakdown (8 seconds total):
      // 0-1s: Pause at position
      // 1-2s: Show "What would you play?" question
      // 2-6s: Thinking timer (4 seconds)
      // 6-8s: Reveal and explanation (2 seconds)

      const pauseEnd = fps * 1;
      const questionEnd = fps * 2;
      const thinkingEnd = fps * 6;
      const revealEnd = fps * 8;

      let puzzlePhase: "question" | "thinking" | "reveal" | null = null;
      let challengeOpacity = 0;
      let thinkingOpacity = 0;
      let explanationOpacity = 0;
      let difficultyOpacity = 0;
      let secondsLeft = 0;

      if (frameInSegment < pauseEnd) {
        // Pause phase - show difficulty badge
        difficultyOpacity = interpolate(
          frameInSegment,
          [0, fps * 0.3],
          [0, 1]
        );
      } else if (frameInSegment < questionEnd) {
        // Question phase
        puzzlePhase = "question";
        const questionFrame = frameInSegment - pauseEnd;
        challengeOpacity = interpolate(questionFrame, [0, fps * 0.3], [0, 1]);
        difficultyOpacity = 1;
      } else if (frameInSegment < thinkingEnd) {
        // Thinking phase with timer
        puzzlePhase = "thinking";
        const thinkingFrame = frameInSegment - questionEnd;
        challengeOpacity = 1;
        thinkingOpacity = interpolate(thinkingFrame, [0, fps * 0.3], [0, 1]);
        difficultyOpacity = 1;
        secondsLeft = Math.ceil((thinkingEnd - frameInSegment) / fps);
      } else {
        // Reveal and explanation phase
        puzzlePhase = "reveal";
        const revealFrame = frameInSegment - thinkingEnd;
        challengeOpacity = interpolate(revealFrame, [0, fps * 0.3], [1, 0]);
        explanationOpacity = interpolate(
          revealFrame,
          [fps * 0.3, fps * 0.6],
          [0, 1]
        );
        difficultyOpacity = interpolate(revealFrame, [0, fps * 0.3], [1, 0]);
      }

      return {
        moveIndex: segment.moveIndex,
        isPuzzle: true,
        puzzlePhase,
        challengeOpacity: Math.max(0, Math.min(1, challengeOpacity)),
        thinkingOpacity: Math.max(0, Math.min(1, thinkingOpacity)),
        explanationOpacity: Math.max(0, Math.min(1, explanationOpacity)),
        difficultyOpacity: Math.max(0, Math.min(1, difficultyOpacity)),
        secondsLeft,
      };
    }

    return {
      moveIndex: segment.moveIndex,
      isPuzzle: false,
      puzzlePhase: null,
      challengeOpacity: 0,
      thinkingOpacity: 0,
      explanationOpacity: 0,
      difficultyOpacity: 0,
      secondsLeft: 0,
    };
  }, [frame, moveTimeline, moves.length, fps]);

  // Get current board state
  const currentFen = useMemo(() => {
    const game = new Chess();
    for (let i = 0; i < currentState.moveIndex; i++) {
      try {
        game.move(moves[i]);
      } catch (error) {
        console.error(`Failed to make move ${moves[i]}:`, error);
        break;
      }
    }
    return game.fen();
  }, [currentState.moveIndex, moves]);

  // Initialize chessground and update position
  useEffect(() => {
    if (!boardRef.current) return;

    if (!cgRef.current) {
      cgRef.current = Chessground(boardRef.current, {
        viewOnly: true,
        coordinates: true,
        fen: currentFen,
        orientation: orientation,
        drawable: {
          enabled: false,
        },
        highlight: {
          lastMove: false,
        },
        animation: {
          enabled: false,
        },
      });
    } else {
      const game = new Chess(currentFen);
      cgRef.current.set({
        fen: currentFen,
        turnColor: game.turn() === "w" ? "white" : "black",
        movable: {
          color: undefined,
          free: false,
        },
        animation: {
          enabled: false,
        },
      });
    }

    cgRef.current?.redrawAll();
  }, [currentFen, orientation]);

  const getCurrentEvaluation = (): number => {
    if (!analysisResults?.moves || currentState.moveIndex === 0) {
      return 0;
    }
    const analysisMove = analysisResults.moves[currentState.moveIndex - 1];
    return analysisMove?.evaluation || 0;
  };

  const getEvaluationPercentage = (eval_score: number): number => {
    const clamped = Math.max(-1000, Math.min(1000, eval_score));
    return ((1000 - clamped) / 2000) * 100;
  };

  // Animation for game info fade-in
  const infoSpring = spring({
    frame,
    fps,
    config: {
      damping: 100,
      stiffness: 200,
      mass: 0.5,
    },
  });

  const infoOpacity = interpolate(infoSpring, [0, 1], [0, 1]);
  const infoTranslateY = interpolate(infoSpring, [0, 1], [30, 0]);

  const boardSize = 900;

  return (
    <AbsoluteFill>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          background: "linear-gradient(to bottom, #111827, #1f2937, #111827)",
          padding: "60px 40px",
          position: "relative",
        }}
      >
        {/* Game Info Header */}
        <div
          style={{
            textAlign: "center",
            marginBottom: "40px",
            width: "100%",
            maxWidth: "1000px",
            opacity: infoOpacity,
            transform: `translateY(${infoTranslateY}px)`,
          }}
        >
          <h1
            style={{
              fontSize: "56px",
              fontWeight: "bold",
              color: "white",
              marginBottom: "16px",
              lineHeight: "1.2",
              wordWrap: "break-word",
            }}
          >
            {gameInfo.white} vs {gameInfo.black}
          </h1>
          <p
            style={{
              fontSize: "32px",
              color: "#d1d5db",
              marginTop: "8px",
            }}
          >
            Move {currentState.moveIndex} of {moves.length}
            {currentState.moveIndex > 0 &&
              moves[currentState.moveIndex - 1] && (
                <span
                  style={{
                    marginLeft: "16px",
                    color: "#60a5fa",
                    fontFamily: "monospace",
                  }}
                >
                  {Math.floor((currentState.moveIndex - 1) / 2) + 1}
                  {currentState.moveIndex % 2 === 1 ? ". " : "... "}
                  {moves[currentState.moveIndex - 1]}
                </span>
              )}
          </p>
          <p
            style={{
              fontSize: "28px",
              color: "#9ca3af",
              marginTop: "12px",
            }}
          >
            {gameInfo.result} • {gameInfo.date}
          </p>
        </div>

        {/* Chess Board with Evaluation */}
        <div
          style={{
            display: "flex",
            gap: "24px",
            alignItems: "flex-start",
            justifyContent: "center",
          }}
        >
          {/* Evaluation Bar */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <div
              style={{
                width: "48px",
                height: `${boardSize}px`,
                borderRadius: "8px",
                overflow: "hidden",
                border: "4px solid #4b5563",
                position: "relative",
              }}
            >
              <div
                style={{
                  background: "#e5e7eb",
                  height: `${getEvaluationPercentage(getCurrentEvaluation())}%`,
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "center",
                  transition: "height 0.3s",
                }}
              >
                <div
                  style={{
                    color: "#1f2937",
                    fontSize: "24px",
                    fontWeight: "bold",
                    paddingTop: "8px",
                  }}
                >
                  {getCurrentEvaluation() > 0
                    ? `+${(getCurrentEvaluation() / 100).toFixed(1)}`
                    : (getCurrentEvaluation() / 100).toFixed(1)}
                </div>
              </div>
            </div>
            <div
              style={{
                fontSize: "18px",
                marginTop: "12px",
                color: "#9ca3af",
                fontWeight: "600",
              }}
            >
              EVAL
            </div>
          </div>

          {/* Chess Board */}
          <div
            style={{
              width: `${boardSize}px`,
              height: `${boardSize}px`,
              position: "relative",
              borderRadius: "8px",
              overflow: "hidden",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
            }}
          >
            <div
              ref={boardRef}
              style={{
                width: `${boardSize}px`,
                height: `${boardSize}px`,
                position: "absolute",
                top: 0,
                left: 0,
              }}
            ></div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            marginTop: "40px",
            textAlign: "center",
            opacity: infoOpacity,
            transform: `translateY(${infoTranslateY}px)`,
          }}
        >
          <p
            style={{
              color: "#60a5fa",
              fontWeight: "600",
              fontSize: "28px",
            }}
          >
            chessmoments.com
          </p>
        </div>
      </div>

      {/* Puzzle Overlays */}
      {currentState.isPuzzle && (
        <>
          <DifficultyBadge opacity={currentState.difficultyOpacity} />
          {currentState.puzzlePhase && (
            <PuzzleChallenge
              opacity={currentState.challengeOpacity}
              phase={currentState.puzzlePhase}
            />
          )}
          {currentState.thinkingOpacity > 0 && (
            <ThinkingTimer
              secondsLeft={currentState.secondsLeft}
              opacity={currentState.thinkingOpacity}
            />
          )}
          {currentState.explanationOpacity > 0 &&
            annotationMap.has(currentState.moveIndex) && (
              <ExplanationModal
                text={annotationMap.get(currentState.moveIndex)!}
                opacity={currentState.explanationOpacity}
              />
            )}
        </>
      )}
    </AbsoluteFill>
  );
};

// Main composition with intro/outro
export const ChessGamePuzzle = ({
  pgn,
  analysisResults,
  gameInfo,
  annotations,
  orientation = "white",
  musicGenre = "none",
}: z.infer<typeof ChessGamePuzzleProps>) => {
  const { fps } = useVideoConfig();

  // Calculate durations
  const INTRO_DURATION = fps * 3;
  const RESULT_DURATION = fps * 4;
  const OUTRO_DURATION = fps * 3;

  // Calculate game duration with puzzle sequences
  const game = new Chess();
  game.loadPgn(pgn);
  const moves = game.history();

  // Limit to first 4 annotations for puzzles
  const puzzleMoments = annotations.slice(0, 4).map((ann) => ann.move_index);
  const puzzleSet = new Set(puzzleMoments);

  // Calculate duration: 1s per normal move, 8s per puzzle moment
  let gameDuration = 0;
  for (let i = 0; i <= moves.length; i++) {
    gameDuration += puzzleSet.has(i) ? fps * 8 : fps * 1;
  }

  const GAME_DURATION = gameDuration;

  // Get music track
  const musicTrack = getMusicTrack(musicGenre);

  return (
    <AbsoluteFill>
      {/* Background Music */}
      {musicTrack && (
        <Audio
          src={staticFile(musicTrack.replace("/", ""))}
          volume={0.3}
          loop
        />
      )}

      {/* Intro */}
      <Sequence durationInFrames={INTRO_DURATION}>
        <LogoIntro />
      </Sequence>

      {/* Main Game Content */}
      <Sequence from={INTRO_DURATION} durationInFrames={GAME_DURATION}>
        <GameContent
          pgn={pgn}
          analysisResults={analysisResults}
          gameInfo={gameInfo}
          annotations={annotations}
          orientation={orientation}
          musicGenre={musicGenre}
          introFrames={INTRO_DURATION}
        />
      </Sequence>

      {/* Result Screen */}
      <Sequence
        from={INTRO_DURATION + GAME_DURATION}
        durationInFrames={RESULT_DURATION}
      >
        <ResultScreen
          white={gameInfo.white}
          black={gameInfo.black}
          result={gameInfo.result}
          termination={gameInfo.termination}
        />
      </Sequence>

      {/* Outro */}
      <Sequence
        from={INTRO_DURATION + GAME_DURATION + RESULT_DURATION}
        durationInFrames={OUTRO_DURATION}
      >
        <LogoOutroWithCTA />
      </Sequence>
    </AbsoluteFill>
  );
};
