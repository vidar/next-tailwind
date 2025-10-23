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

// Chess game compositions
export const CHESS_GAME_COMP_NAME = "ChessGameWalkthrough";
export const CHESS_GAME_ANNOTATED_COMP_NAME = "ChessGameAnnotated";

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
  orientation: z.enum(["white", "black"]).optional().default("white"),
  musicGenre: z.string().optional().default("none"),
});

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
  orientation: "white",
  musicGenre: "none",
};

export const defaultChessGameAnnotatedProps: z.infer<typeof ChessGameAnnotatedProps> = {
  ...defaultChessGameProps,
  annotations: [
    {
      id: "demo-annotation-1",
      game_id: "demo-game",
      move_index: 2,
      annotation_text: "This is a sample annotation explaining the position after this move.",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ],
};

// Chess video settings
export const CHESS_VIDEO_FPS = 30;
export const CHESS_SECONDS_PER_MOVE = 1;

// Aspect ratio presets
export const ASPECT_RATIOS = {
  landscape: { width: 1920, height: 1080, label: "Landscape (16:9)" },
  portrait: { width: 1080, height: 1920, label: "Portrait (9:16)" },
} as const;

// Default dimensions (landscape for YouTube chapters support)
export const CHESS_VIDEO_WIDTH = ASPECT_RATIOS.landscape.width;
export const CHESS_VIDEO_HEIGHT = ASPECT_RATIOS.landscape.height;
