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

// Type for critical moments
interface CriticalMoment {
  moveIndex: number;
  type: "brilliant" | "blunder" | "swing";
  evalBefore: number;
  evalAfter: number;
  move: string;
}

// Badge Component for move quality
const MoveBadge = ({
  type,
  opacity,
  scale,
}: {
  type: "brilliant" | "blunder" | "swing";
  opacity: number;
  scale: number;
}) => {
  const config = {
    brilliant: {
      text: "BRILLIANT!",
      color: "#10b981",
      bgColor: "rgba(16, 185, 129, 0.2)",
      icon: "✨",
    },
    blunder: {
      text: "BLUNDER!",
      color: "#ef4444",
      bgColor: "rgba(239, 68, 68, 0.2)",
      icon: "⚠️",
    },
    swing: {
      text: "CRITICAL MOMENT",
      color: "#f59e0b",
      bgColor: "rgba(245, 158, 11, 0.2)",
      icon: "⚡",
    },
  };

  const style = config[type];

  return (
    <div
      style={{
        position: "absolute",
        top: "80px",
        left: "50%",
        transform: `translate(-50%, 0) scale(${scale})`,
        opacity,
        zIndex: 1000,
      }}
    >
      <div
        style={{
          backgroundColor: style.bgColor,
          border: `3px solid ${style.color}`,
          borderRadius: "16px",
          padding: "16px 32px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.5)",
        }}
      >
        <span style={{ fontSize: "40px" }}>{style.icon}</span>
        <span
          style={{
            fontSize: "36px",
            fontWeight: "bold",
            color: style.color,
            textShadow: "0 2px 4px rgba(0, 0, 0, 0.5)",
          }}
        >
          {style.text}
        </span>
      </div>
    </div>
  );
};

// Evaluation Swing Indicator
const EvalSwingIndicator = ({
  evalBefore,
  evalAfter,
  opacity,
}: {
  evalBefore: number;
  evalAfter: number;
  opacity: number;
}) => {
  const swing = evalAfter - evalBefore;
  const isPositive = swing > 0;

  return (
    <div
      style={{
        position: "absolute",
        bottom: "120px",
        left: "50%",
        transform: "translate(-50%, 0)",
        opacity,
        zIndex: 1000,
      }}
    >
      <div
        style={{
          backgroundColor: "rgba(30, 41, 59, 0.95)",
          border: "2px solid #60a5fa",
          borderRadius: "12px",
          padding: "12px 24px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <span style={{ fontSize: "28px", color: "#9ca3af" }}>Eval Swing:</span>
        <span
          style={{
            fontSize: "32px",
            fontWeight: "bold",
            color: isPositive ? "#10b981" : "#ef4444",
          }}
        >
          {isPositive ? "+" : ""}
          {(swing / 100).toFixed(1)}
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
  orientation = "white",
}: z.infer<typeof ChessGameProps> & { introFrames?: number }) => {
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

  // Detect critical moments based on evaluation swings
  const criticalMoments = useMemo(() => {
    if (!analysisResults?.moves) return [];

    const moments: CriticalMoment[] = [];
    const evals = analysisResults.moves.map((m) => m.evaluation || 0);

    for (let i = 1; i < evals.length; i++) {
      const evalBefore = evals[i - 1];
      const evalAfter = evals[i];
      const swing = Math.abs(evalAfter - evalBefore);

      // Detect blunders (eval drops by 200+ centipawns)
      if (evalAfter - evalBefore < -200) {
        moments.push({
          moveIndex: i,
          type: "blunder",
          evalBefore,
          evalAfter,
          move: moves[i],
        });
      }
      // Detect brilliant moves (eval improves by 200+ centipawns)
      else if (evalAfter - evalBefore > 200) {
        moments.push({
          moveIndex: i,
          type: "brilliant",
          evalBefore,
          evalAfter,
          move: moves[i],
        });
      }
      // Detect significant swings (200+ centipawns)
      else if (swing >= 200) {
        moments.push({
          moveIndex: i,
          type: "swing",
          evalBefore,
          evalAfter,
          move: moves[i],
        });
      }
    }

    // Limit to top 5 most significant moments
    return moments
      .sort((a, b) => {
        const swingA = Math.abs(a.evalAfter - a.evalBefore);
        const swingB = Math.abs(b.evalAfter - b.evalBefore);
        return swingB - swingA;
      })
      .slice(0, 5);
  }, [analysisResults, moves]);

  // Build timeline with variable speed
  const moveTimeline = useMemo(() => {
    const timeline: Array<{
      moveIndex: number;
      startFrame: number;
      endFrame: number;
      isCritical: boolean;
      criticalType?: "brilliant" | "blunder" | "swing";
      evalBefore?: number;
      evalAfter?: number;
    }> = [];

    const criticalMap = new Map(
      criticalMoments.map((m) => [
        m.moveIndex,
        { type: m.type, evalBefore: m.evalBefore, evalAfter: m.evalAfter },
      ])
    );

    let currentFrame = 0;
    for (let i = 0; i <= moves.length; i++) {
      const critical = criticalMap.get(i);
      const isCritical = !!critical;
      // 0.5s for normal moves, 5s for critical moments
      const duration = isCritical ? fps * 5 : fps * 0.5;

      timeline.push({
        moveIndex: i,
        startFrame: currentFrame,
        endFrame: currentFrame + duration,
        isCritical,
        criticalType: critical?.type,
        evalBefore: critical?.evalBefore,
        evalAfter: critical?.evalAfter,
      });

      currentFrame += duration;
    }

    return timeline;
  }, [moves, criticalMoments, fps]);

  // Determine current state based on frame
  const currentState = useMemo(() => {
    const segment = moveTimeline.find(
      (seg) => frame >= seg.startFrame && frame < seg.endFrame
    );

    if (!segment) {
      return {
        moveIndex: moves.length,
        isCritical: false,
        badgeOpacity: 0,
        badgeScale: 1,
        evalSwingOpacity: 0,
        boardScale: 1,
      };
    }

    const frameInSegment = frame - segment.startFrame;

    if (segment.isCritical) {
      const segmentDuration = segment.endFrame - segment.startFrame;
      const fadeDuration = fps * 0.3;

      // Badge animation
      let badgeOpacity = 0;
      let badgeScale = 1;
      if (frameInSegment < fadeDuration) {
        badgeOpacity = frameInSegment / fadeDuration;
        badgeScale = interpolate(frameInSegment, [0, fadeDuration], [0.8, 1]);
      } else if (frameInSegment < segmentDuration - fadeDuration) {
        badgeOpacity = 1;
        badgeScale = 1;
      } else {
        badgeOpacity =
          (segmentDuration - frameInSegment) / fadeDuration;
        badgeScale = 1;
      }

      // Eval swing indicator
      let evalSwingOpacity = 0;
      if (
        frameInSegment > fadeDuration &&
        frameInSegment < segmentDuration - fadeDuration
      ) {
        evalSwingOpacity = 1;
      }

      // Board scale (slight zoom for dramatic effect)
      const boardScale = interpolate(
        frameInSegment,
        [0, fadeDuration, segmentDuration],
        [1, 1.05, 1.05]
      );

      return {
        moveIndex: segment.moveIndex,
        isCritical: true,
        criticalType: segment.criticalType,
        evalBefore: segment.evalBefore,
        evalAfter: segment.evalAfter,
        badgeOpacity: Math.max(0, Math.min(1, badgeOpacity)),
        badgeScale,
        evalSwingOpacity: Math.max(0, Math.min(1, evalSwingOpacity)),
        boardScale,
      };
    }

    return {
      moveIndex: segment.moveIndex,
      isCritical: false,
      badgeOpacity: 0,
      badgeScale: 1,
      evalSwingOpacity: 0,
      boardScale: 1,
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
            transform: `scale(${currentState.boardScale})`,
            transition: "transform 0.3s ease-out",
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
              boxShadow: currentState.isCritical
                ? "0 0 60px rgba(96, 165, 250, 0.6)"
                : "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
              transition: "box-shadow 0.3s ease-out",
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

      {/* Critical Moment Overlays */}
      {currentState.isCritical && currentState.criticalType && (
        <>
          <MoveBadge
            type={currentState.criticalType}
            opacity={currentState.badgeOpacity}
            scale={currentState.badgeScale}
          />
          {currentState.evalBefore !== undefined &&
            currentState.evalAfter !== undefined && (
              <EvalSwingIndicator
                evalBefore={currentState.evalBefore}
                evalAfter={currentState.evalAfter}
                opacity={currentState.evalSwingOpacity}
              />
            )}
        </>
      )}
    </AbsoluteFill>
  );
};

// Main composition with intro/outro
export const ChessGameHighlights = ({
  pgn,
  analysisResults,
  gameInfo,
  orientation = "white",
  musicGenre = "none",
}: z.infer<typeof ChessGameProps>) => {
  const { fps } = useVideoConfig();

  // Calculate durations
  const INTRO_DURATION = fps * 3;
  const RESULT_DURATION = fps * 4;
  const OUTRO_DURATION = fps * 3;

  // Calculate game duration with variable speed
  const game = new Chess();
  game.loadPgn(pgn);
  const moves = game.history();

  // Detect critical moments
  const criticalMomentIndices = new Set<number>();
  if (analysisResults?.moves) {
    const evals = analysisResults.moves.map((m) => m.evaluation || 0);
    for (let i = 1; i < evals.length; i++) {
      const swing = Math.abs(evals[i] - evals[i - 1]);
      if (swing >= 200) {
        criticalMomentIndices.add(i);
      }
    }
  }

  // Calculate duration: 0.5s per normal move, 5s per critical moment
  let gameDuration = 0;
  for (let i = 0; i <= moves.length; i++) {
    gameDuration += criticalMomentIndices.has(i) ? fps * 5 : fps * 0.5;
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
          volume={0.4}
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
