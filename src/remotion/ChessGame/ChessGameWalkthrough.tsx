import { z } from "zod";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
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
import { LogoOutroWithCTA } from "./LogoOutroWithCTA";

// Main game content component
const GameContent = ({
  pgn,
  analysisResults,
  gameInfo,
  introFrames,
}: z.infer<typeof ChessGameProps> & { introFrames: number }) => {
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

  // Calculate current move index (1 second per move)
  // Adjust for intro by using frame within this sequence
  const currentMoveIndex = Math.min(
    Math.floor(frame / fps),
    moves.length
  );

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
        fen: currentFen, // Start with the current FEN, not the starting position
        orientation: "white",
        drawable: {
          enabled: false,
        },
        highlight: {
          lastMove: false,
        },
        animation: {
          enabled: false, // Disable animations for consistent rendering
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
  }, [currentFen]); // Run whenever currentFen changes (which depends on frame)

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

  const boardSize = 900; // Optimized for portrait video

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
          {/* Result and Date info - below player names */}
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
    </AbsoluteFill>
  );
};

// Main composition with intro/outro
export const ChessGameWalkthrough = ({
  pgn,
  analysisResults,
  gameInfo,
}: z.infer<typeof ChessGameProps>) => {
  const { fps } = useVideoConfig();

  // Calculate durations
  const INTRO_DURATION = fps * 3; // 3 seconds intro
  const OUTRO_DURATION = fps * 3; // 3 seconds outro

  // Calculate game duration
  const game = new Chess();
  game.loadPgn(pgn);
  const moves = game.history();
  const GAME_DURATION = moves.length * fps; // 1 second per move

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
          introFrames={INTRO_DURATION}
        />
      </Sequence>

      {/* Outro with CTA */}
      <Sequence from={INTRO_DURATION + GAME_DURATION} durationInFrames={OUTRO_DURATION}>
        <LogoOutroWithCTA />
      </Sequence>
    </AbsoluteFill>
  );
};
