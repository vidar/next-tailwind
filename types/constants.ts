import { z } from "zod";

// Original demo composition
export const COMP_NAME = "MyComp";

export const CompositionProps = z.object({
  title: z.string(),
});

export const defaultMyCompProps: z.infer<typeof CompositionProps> = {
  title: "Next.js and Remotion",
};

export const DURATION_IN_FRAMES = 200;
export const VIDEO_WIDTH = 1280;
export const VIDEO_HEIGHT = 720;
export const VIDEO_FPS = 30;

// Chess game composition
export const CHESS_GAME_COMP_NAME = "ChessGameWalkthrough";

export const ChessGameProps = z.object({
  pgn: z.string(),
  analysisResults: z.object({
    moves: z.array(z.object({
      move: z.string().optional(),
      evaluation: z.number().optional(),
      best_move: z.string().optional(),
    })).optional(),
  }).optional(),
  gameInfo: z.object({
    white: z.string(),
    black: z.string(),
    result: z.string(),
    date: z.string(),
  }),
});

export const defaultChessGameProps: z.infer<typeof ChessGameProps> = {
  pgn: '[Event "Live Chess"]\n[Site "Chess.com"]\n[Date "2025.10.09"]\n[White "Player1"]\n[Black "Player2"]\n[Result "1-0"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6',
  analysisResults: {
    moves: [
      { move: "e4", evaluation: 34 },
      { move: "e5", evaluation: -28 },
    ],
  },
  gameInfo: {
    white: "Player1",
    black: "Player2",
    result: "1-0",
    date: "2025.10.09",
  },
};

// Chess video settings (portrait for social media)
export const CHESS_VIDEO_WIDTH = 1080;
export const CHESS_VIDEO_HEIGHT = 1920;
export const CHESS_VIDEO_FPS = 30;
export const CHESS_SECONDS_PER_MOVE = 1;
