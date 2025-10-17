import { z } from "zod";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  Img,
  staticFile,
  Sequence,
  spring,
  interpolate,
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
import { LogoOutro } from "./LogoOutro";

// Extend ChessGameProps to include annotations
export const ChessGameAnnotatedProps = ChessGameProps.extend({
  annotations: z.array(z.object({
    id: z.string(),
    game_id: z.string(),
    move_index: z.number(),
    annotation_text: z.string(),
    created_at: z.string(),
    updated_at: z.string(),
  })),
});

// Annotation Modal Component
const AnnotationModal = ({
  text,
  opacity,
}: {
  text: string;
  opacity: number;
}) => {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        opacity,
        zIndex: 9999,
      }}
    >
      {/* Semi-transparent backdrop */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          zIndex: 1,
        }}
      />

      {/* Modal content */}
      <div
        style={{
          position: 'relative',
          backgroundColor: 'rgba(30, 41, 59, 0.95)',
          borderRadius: '24px',
          padding: '48px',
          maxWidth: '900px',
          margin: '0 40px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
          border: '2px solid rgba(96, 165, 250, 0.3)',
          zIndex: 2,
        }}
      >
        <div
          style={{
            fontSize: '36px',
            lineHeight: '1.6',
            color: 'white',
            fontWeight: '500',
            textAlign: 'center',
            wordWrap: 'break-word',
          }}
        >
          {text}
        </div>
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
  introFrames,
}: z.infer<typeof ChessGameAnnotatedProps> & { introFrames: number }) => {
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

  // Create a map of move_index to annotation for quick lookup
  const annotationMap = useMemo(() => {
    const map = new Map<number, string>();
    annotations.forEach(ann => {
      map.set(ann.move_index, ann.annotation_text);
    });
    return map;
  }, [annotations]);

  // Calculate timing: each move is 1 second, plus 4 seconds for annotations
  // Build a timeline of frame ranges for each move
  const moveTimeline = useMemo(() => {
    const timeline: Array<{
      moveIndex: number;
      startFrame: number;
      endFrame: number;
      hasAnnotation: boolean;
    }> = [];

    let currentFrame = 0;
    for (let i = 0; i <= moves.length; i++) {
      const hasAnnotation = annotationMap.has(i);
      const duration = hasAnnotation ? fps * 5 : fps * 1; // 5 seconds (1s move + 4s annotation) or 1 second

      timeline.push({
        moveIndex: i,
        startFrame: currentFrame,
        endFrame: currentFrame + duration,
        hasAnnotation,
      });

      currentFrame += duration;
    }

    return timeline;
  }, [moves, annotationMap, fps]);

  // Determine current move index and annotation state based on frame
  const { currentMoveIndex, showAnnotation, annotationOpacity } = useMemo(() => {
    // Find which move segment we're in
    const segment = moveTimeline.find(
      seg => frame >= seg.startFrame && frame < seg.endFrame
    );

    if (!segment) {
      return {
        currentMoveIndex: moves.length,
        showAnnotation: false,
        annotationOpacity: 0,
      };
    }

    const frameInSegment = frame - segment.startFrame;

    if (segment.hasAnnotation) {
      // First 1 second: just show the move
      // Next 4 seconds: show annotation with fade in/out
      if (frameInSegment < fps) {
        return {
          currentMoveIndex: segment.moveIndex,
          showAnnotation: false,
          annotationOpacity: 0,
        };
      } else {
        // Annotation display period (4 seconds)
        const annotationFrame = frameInSegment - fps;
        const fadeDuration = fps * 0.3; // 0.3 seconds fade
        const annotationDuration = fps * 4;

        let opacity = 1;
        if (annotationFrame < fadeDuration) {
          // Fade in
          opacity = annotationFrame / fadeDuration;
        } else if (annotationFrame > annotationDuration - fadeDuration) {
          // Fade out
          opacity = (annotationDuration - annotationFrame) / fadeDuration;
        }

        return {
          currentMoveIndex: segment.moveIndex,
          showAnnotation: true,
          annotationOpacity: Math.max(0, Math.min(1, opacity)),
        };
      }
    } else {
      return {
        currentMoveIndex: segment.moveIndex,
        showAnnotation: false,
        annotationOpacity: 0,
      };
    }
  }, [frame, moveTimeline, moves.length, fps]);

  // Get current board state
  const currentFen = useMemo(() => {
    const game = new Chess();
    for (let i = 0; i < currentMoveIndex; i++) {
      try {
        game.move(moves[i]);
      } catch (error) {
        console.error(`Failed to make move ${moves[i]}:`, error);
        break;
      }
    }
    return game.fen();
  }, [currentMoveIndex, moves]);

  // Initialize chessground and update position
  useEffect(() => {
    if (!boardRef.current) return;

    // Initialize Chessground if not already initialized
    if (!cgRef.current) {
      cgRef.current = Chessground(boardRef.current, {
        viewOnly: true,
        coordinates: true,
        fen: currentFen,
        orientation: "white",
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
      // Update existing board
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

    // Always force a redraw to ensure consistency
    cgRef.current?.redrawAll();
  }, [currentFen]);

  const getCurrentEvaluation = (): number => {
    if (!analysisResults?.moves || currentMoveIndex === 0) {
      return 0;
    }
    const analysisMove = analysisResults.moves[currentMoveIndex - 1];
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
  const infoScale = interpolate(infoSpring, [0, 1], [0.95, 1]);

  const boardSize = 900;

  return (
    <AbsoluteFill>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          background: 'linear-gradient(to bottom, #111827, #1f2937, #111827)',
          padding: '60px 40px',
          position: 'relative',
        }}
      >
        {/* Game Info Header - Animated */}
        <div style={{
          textAlign: 'center',
          marginBottom: '40px',
          width: '100%',
          maxWidth: '1000px',
          opacity: infoOpacity,
          transform: `translateY(${infoTranslateY}px) scale(${infoScale})`,
        }}>
          <h1 style={{
            fontSize: '56px',
            fontWeight: 'bold',
            color: 'white',
            marginBottom: '16px',
            lineHeight: '1.2',
            wordWrap: 'break-word',
          }}>
            {gameInfo.white} vs {gameInfo.black}
          </h1>
          <p style={{
            fontSize: '32px',
            color: '#d1d5db',
            marginTop: '8px',
          }}>
            Move {currentMoveIndex} of {moves.length}
            {currentMoveIndex > 0 && moves[currentMoveIndex - 1] && (
              <span style={{
                marginLeft: '16px',
                color: '#60a5fa',
                fontFamily: 'monospace',
              }}>
                {Math.floor((currentMoveIndex - 1) / 2) + 1}
                {currentMoveIndex % 2 === 1 ? ". " : "... "}
                {moves[currentMoveIndex - 1]}
              </span>
            )}
          </p>
          {/* Result and Date info */}
          <p style={{
            fontSize: '28px',
            color: '#9ca3af',
            marginTop: '12px',
          }}>
            {gameInfo.result} • {gameInfo.date}
          </p>
        </div>

        {/* Chess Board with Evaluation */}
        <div style={{
          display: 'flex',
          gap: '24px',
          alignItems: 'flex-start',
          justifyContent: 'center',
        }}>
          {/* Evaluation Bar */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}>
            <div
              style={{
                width: '48px',
                height: `${boardSize}px`,
                borderRadius: '8px',
                overflow: 'hidden',
                border: '4px solid #4b5563',
                position: 'relative',
              }}
            >
              <div
                style={{
                  background: '#e5e7eb',
                  height: `${getEvaluationPercentage(getCurrentEvaluation())}%`,
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'center',
                  transition: 'height 0.3s',
                }}
              >
                <div style={{
                  color: '#1f2937',
                  fontSize: '24px',
                  fontWeight: 'bold',
                  paddingTop: '8px',
                }}>
                  {getCurrentEvaluation() > 0
                    ? `+${(getCurrentEvaluation() / 100).toFixed(1)}`
                    : (getCurrentEvaluation() / 100).toFixed(1)}
                </div>
              </div>
            </div>
            <div style={{
              fontSize: '18px',
              marginTop: '12px',
              color: '#9ca3af',
              fontWeight: '600',
            }}>
              EVAL
            </div>
          </div>

          {/* Chess Board - Chessground */}
          <div
            style={{
              width: `${boardSize}px`,
              height: `${boardSize}px`,
              position: 'relative',
              borderRadius: '8px',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            }}
          >
            <div
              ref={boardRef}
              style={{
                width: `${boardSize}px`,
                height: `${boardSize}px`,
                position: 'absolute',
                top: 0,
                left: 0,
              }}
            ></div>
          </div>
        </div>

        {/* Footer with branding - Animated */}
        <div style={{
          marginTop: '40px',
          textAlign: 'center',
          opacity: infoOpacity,
          transform: `translateY(${infoTranslateY}px)`,
        }}>
          <p style={{
            color: '#60a5fa',
            fontWeight: '600',
            fontSize: '28px',
          }}>
            chessmoments.com
          </p>
        </div>
      </div>

      {/* Annotation Modal Overlay */}
      {showAnnotation && annotationMap.has(currentMoveIndex) && (
        <AnnotationModal
          text={annotationMap.get(currentMoveIndex)!}
          opacity={annotationOpacity}
        />
      )}
    </AbsoluteFill>
  );
};

// Main composition with intro/outro
export const ChessGameAnnotated = ({
  pgn,
  analysisResults,
  gameInfo,
  annotations,
}: z.infer<typeof ChessGameAnnotatedProps>) => {
  const { fps } = useVideoConfig();

  // Calculate durations
  const INTRO_DURATION = fps * 3; // 3 seconds intro
  const OUTRO_DURATION = fps * 3; // 3 seconds outro

  // Calculate game duration including annotation pauses
  const game = new Chess();
  game.loadPgn(pgn);
  const moves = game.history();

  // Base: 1 second per move
  let gameDuration = moves.length * fps;

  // Add 4 seconds for each annotation
  const annotationMap = new Map<number, boolean>();
  annotations.forEach(ann => {
    annotationMap.set(ann.move_index, true);
  });

  for (let i = 0; i <= moves.length; i++) {
    if (annotationMap.has(i)) {
      gameDuration += fps * 4; // Add 4 seconds for annotation display
    }
  }

  const GAME_DURATION = gameDuration;

  return (
    <AbsoluteFill>
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
          introFrames={INTRO_DURATION}
        />
      </Sequence>

      {/* Outro */}
      <Sequence from={INTRO_DURATION + GAME_DURATION} durationInFrames={OUTRO_DURATION}>
        <LogoOutro />
      </Sequence>
    </AbsoluteFill>
  );
};
