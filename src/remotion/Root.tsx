import { Composition } from "remotion";
import { Main } from "./MyComp/Main";
import {
  COMP_NAME,
  defaultMyCompProps,
  DURATION_IN_FRAMES,
  VIDEO_FPS,
  VIDEO_HEIGHT,
  VIDEO_WIDTH,
  CHESS_GAME_COMP_NAME,
  CHESS_GAME_ANNOTATED_COMP_NAME,
  CHESS_GAME_HIGHLIGHTS_COMP_NAME,
  CHESS_GAME_PUZZLE_COMP_NAME,
  defaultChessGameProps,
  defaultChessGameAnnotatedProps,
  CHESS_VIDEO_WIDTH,
  CHESS_VIDEO_HEIGHT,
  CHESS_VIDEO_FPS,
  CHESS_SECONDS_PER_MOVE,
  ChessGameProps,
  ChessGameAnnotatedProps,
  TOURNAMENT_OVERVIEW_COMP_NAME,
  ROUND_OVERVIEW_COMP_NAME,
  PLAYER_OVERVIEW_COMP_NAME,
  defaultTournamentOverviewProps,
  defaultRoundOverviewProps,
  defaultPlayerOverviewProps,
} from "../../types/constants";
import { NextLogo } from "./MyComp/NextLogo";
import { ChessGameWalkthrough } from "./ChessGame/ChessGameWalkthrough";
import { ChessGameAnnotated } from "./ChessGame/ChessGameAnnotated";
import { ChessGameHighlights } from "./ChessGame/ChessGameHighlights";
import { ChessGamePuzzle } from "./ChessGame/ChessGamePuzzle";
import { TournamentOverview, TournamentOverviewProps } from "./TournamentVideo/TournamentOverview";
import { RoundOverview, RoundOverviewProps } from "./TournamentVideo/RoundOverview";
import { PlayerOverview, PlayerOverviewProps } from "./TournamentVideo/PlayerOverview";
import { Chess } from "chess.js";

// Calculate duration based on number of moves in PGN
const calculateChessDuration = (pgn: string, fps: number): number => {
  try {
    const game = new Chess();
    game.loadPgn(pgn);
    const moves = game.history();
    const INTRO_DURATION = 3; // 3 seconds intro
    const RESULT_DURATION = 4; // 4 seconds result screen
    const OUTRO_DURATION = 3; // 3 seconds outro
    const gameDuration = moves.length * CHESS_SECONDS_PER_MOVE;
    return (INTRO_DURATION + gameDuration + RESULT_DURATION + OUTRO_DURATION) * fps;
  } catch {
    return 70 * fps; // Default to 70 seconds if parsing fails (60 + 3 intro + 4 result + 3 outro)
  }
};

// Calculate duration for annotated composition (adds 4 seconds per annotation)
const calculateAnnotatedDuration = (
  pgn: string,
  annotations: Array<{ move_index: number }>,
  fps: number
): number => {
  try {
    const game = new Chess();
    game.loadPgn(pgn);
    const moves = game.history();
    const INTRO_DURATION = 3; // 3 seconds intro
    const RESULT_DURATION = 4; // 4 seconds result screen
    const OUTRO_DURATION = 3; // 3 seconds outro
    const baseDuration = moves.length * CHESS_SECONDS_PER_MOVE;
    const annotationDuration = annotations.length * 4; // 4 seconds per annotation
    return (INTRO_DURATION + baseDuration + annotationDuration + RESULT_DURATION + OUTRO_DURATION) * fps;
  } catch {
    return 70 * fps; // Default to 70 seconds if parsing fails (60 + 3 intro + 4 result + 3 outro)
  }
};

// Calculate duration for highlights composition (0.5s per move + 5s per critical moment)
const calculateHighlightsDuration = (
  pgn: string,
  analysisResults: any,
  fps: number
): number => {
  try {
    const game = new Chess();
    game.loadPgn(pgn);
    const moves = game.history();
    const INTRO_DURATION = 3;
    const RESULT_DURATION = 4;
    const OUTRO_DURATION = 3;

    // Detect critical moments (eval swings >= 200)
    let gameDuration = 0;
    if (analysisResults?.moves) {
      const evals = analysisResults.moves.map((m: any) => m.evaluation || 0);
      for (let i = 0; i <= moves.length; i++) {
        const isCritical = i > 0 && Math.abs(evals[i] - evals[i - 1]) >= 200;
        gameDuration += isCritical ? 5 : 0.5;
      }
    } else {
      gameDuration = moves.length * 0.5;
    }

    return (INTRO_DURATION + gameDuration + RESULT_DURATION + OUTRO_DURATION) * fps;
  } catch {
    return 40 * fps; // Default to 40 seconds for highlights
  }
};

// Calculate duration for puzzle composition (1s per move + 8s per puzzle moment)
const calculatePuzzleDuration = (
  pgn: string,
  annotations: Array<{ move_index: number }>,
  fps: number
): number => {
  try {
    const game = new Chess();
    game.loadPgn(pgn);
    const moves = game.history();
    const INTRO_DURATION = 3;
    const RESULT_DURATION = 4;
    const OUTRO_DURATION = 3;

    // Limit to first 4 annotations for puzzles
    const puzzleMoments = annotations.slice(0, 4).map((ann) => ann.move_index);
    const puzzleSet = new Set(puzzleMoments);

    let gameDuration = 0;
    for (let i = 0; i <= moves.length; i++) {
      gameDuration += puzzleSet.has(i) ? 8 : 1;
    }

    return (INTRO_DURATION + gameDuration + RESULT_DURATION + OUTRO_DURATION) * fps;
  } catch {
    return 90 * fps; // Default to 90 seconds for puzzle mode
  }
};

export const RemotionRoot: React.FC = () => {
  const chessDuration = calculateChessDuration(
    defaultChessGameProps.pgn,
    CHESS_VIDEO_FPS
  );

  const annotatedDuration = calculateAnnotatedDuration(
    defaultChessGameAnnotatedProps.pgn,
    defaultChessGameAnnotatedProps.annotations,
    CHESS_VIDEO_FPS
  );

  const highlightsDuration = calculateHighlightsDuration(
    defaultChessGameProps.pgn,
    defaultChessGameProps.analysisResults,
    CHESS_VIDEO_FPS
  );

  const puzzleDuration = calculatePuzzleDuration(
    defaultChessGameAnnotatedProps.pgn,
    defaultChessGameAnnotatedProps.annotations,
    CHESS_VIDEO_FPS
  );

  return (
    <>
      {/* Original demo compositions */}
      <Composition
        id={COMP_NAME}
        component={Main}
        durationInFrames={DURATION_IN_FRAMES}
        fps={VIDEO_FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
        defaultProps={defaultMyCompProps}
      />
      <Composition
        id="NextLogo"
        component={NextLogo}
        durationInFrames={300}
        fps={30}
        width={140}
        height={140}
        defaultProps={{
          outProgress: 0,
        }}
      />

      {/* Chess game walkthrough composition */}
      <Composition
        id={CHESS_GAME_COMP_NAME}
        component={ChessGameWalkthrough}
        durationInFrames={chessDuration}
        fps={CHESS_VIDEO_FPS}
        width={CHESS_VIDEO_WIDTH}
        height={CHESS_VIDEO_HEIGHT}
        defaultProps={defaultChessGameProps}
        schema={ChessGameProps}
        calculateMetadata={({ props }) => {
          const duration = calculateChessDuration(props.pgn, CHESS_VIDEO_FPS);
          return {
            durationInFrames: duration,
            props,
          };
        }}
      />

      {/* Chess game annotated composition */}
      <Composition
        id={CHESS_GAME_ANNOTATED_COMP_NAME}
        component={ChessGameAnnotated}
        durationInFrames={annotatedDuration}
        fps={CHESS_VIDEO_FPS}
        width={CHESS_VIDEO_WIDTH}
        height={CHESS_VIDEO_HEIGHT}
        defaultProps={defaultChessGameAnnotatedProps}
        schema={ChessGameAnnotatedProps}
        calculateMetadata={({ props }) => {
          const duration = calculateAnnotatedDuration(
            props.pgn,
            props.annotations,
            CHESS_VIDEO_FPS
          );
          return {
            durationInFrames: duration,
            props,
          };
        }}
      />

      {/* Chess game highlights composition */}
      <Composition
        id={CHESS_GAME_HIGHLIGHTS_COMP_NAME}
        component={ChessGameHighlights}
        durationInFrames={highlightsDuration}
        fps={CHESS_VIDEO_FPS}
        width={CHESS_VIDEO_WIDTH}
        height={CHESS_VIDEO_HEIGHT}
        defaultProps={defaultChessGameProps}
        schema={ChessGameProps}
        calculateMetadata={({ props }) => {
          const duration = calculateHighlightsDuration(
            props.pgn,
            props.analysisResults,
            CHESS_VIDEO_FPS
          );
          return {
            durationInFrames: duration,
            props,
          };
        }}
      />

      {/* Chess game puzzle composition */}
      <Composition
        id={CHESS_GAME_PUZZLE_COMP_NAME}
        component={ChessGamePuzzle}
        durationInFrames={puzzleDuration}
        fps={CHESS_VIDEO_FPS}
        width={CHESS_VIDEO_WIDTH}
        height={CHESS_VIDEO_HEIGHT}
        defaultProps={defaultChessGameAnnotatedProps}
        schema={ChessGameAnnotatedProps}
        calculateMetadata={({ props }) => {
          const duration = calculatePuzzleDuration(
            props.pgn,
            props.annotations,
            CHESS_VIDEO_FPS
          );
          return {
            durationInFrames: duration,
            props,
          };
        }}
      />

      {/* Tournament overview composition */}
      <Composition
        id={TOURNAMENT_OVERVIEW_COMP_NAME}
        component={TournamentOverview}
        durationInFrames={CHESS_VIDEO_FPS * 120} // Default 2 minutes
        fps={CHESS_VIDEO_FPS}
        width={CHESS_VIDEO_WIDTH}
        height={CHESS_VIDEO_HEIGHT}
        defaultProps={defaultTournamentOverviewProps}
        schema={TournamentOverviewProps}
      />

      {/* Round overview composition */}
      <Composition
        id={ROUND_OVERVIEW_COMP_NAME}
        component={RoundOverview}
        durationInFrames={CHESS_VIDEO_FPS * 90} // Default 1.5 minutes
        fps={CHESS_VIDEO_FPS}
        width={CHESS_VIDEO_WIDTH}
        height={CHESS_VIDEO_HEIGHT}
        defaultProps={defaultRoundOverviewProps}
        schema={RoundOverviewProps}
      />

      {/* Player overview composition */}
      <Composition
        id={PLAYER_OVERVIEW_COMP_NAME}
        component={PlayerOverview}
        durationInFrames={CHESS_VIDEO_FPS * 100} // Default ~1.7 minutes
        fps={CHESS_VIDEO_FPS}
        width={CHESS_VIDEO_WIDTH}
        height={CHESS_VIDEO_HEIGHT}
        defaultProps={defaultPlayerOverviewProps}
        schema={PlayerOverviewProps}
      />
    </>
  );
};
