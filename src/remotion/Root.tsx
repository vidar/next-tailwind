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
  defaultChessGameProps,
  defaultChessGameAnnotatedProps,
  CHESS_VIDEO_WIDTH,
  CHESS_VIDEO_HEIGHT,
  CHESS_VIDEO_FPS,
  CHESS_SECONDS_PER_MOVE,
  ChessGameProps,
  ChessGameAnnotatedProps,
} from "../../types/constants";
import { NextLogo } from "./MyComp/NextLogo";
import { ChessGameWalkthrough } from "./ChessGame/ChessGameWalkthrough";
import { ChessGameAnnotated } from "./ChessGame/ChessGameAnnotated";
import { Chess } from "chess.js";

// Calculate duration based on number of moves in PGN
const calculateChessDuration = (pgn: string, fps: number): number => {
  try {
    const game = new Chess();
    game.loadPgn(pgn);
    const moves = game.history();
    const INTRO_DURATION = 3; // 3 seconds intro
    const OUTRO_DURATION = 3; // 3 seconds outro
    const gameDuration = moves.length * CHESS_SECONDS_PER_MOVE;
    return (INTRO_DURATION + gameDuration + OUTRO_DURATION) * fps;
  } catch {
    return 66 * fps; // Default to 66 seconds if parsing fails (60 + 3 intro + 3 outro)
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
    const OUTRO_DURATION = 3; // 3 seconds outro
    const baseDuration = moves.length * CHESS_SECONDS_PER_MOVE;
    const annotationDuration = annotations.length * 4; // 4 seconds per annotation
    return (INTRO_DURATION + baseDuration + annotationDuration + OUTRO_DURATION) * fps;
  } catch {
    return 66 * fps; // Default to 66 seconds if parsing fails
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
    </>
  );
};
