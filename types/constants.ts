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
    termination: z.string().optional(),
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

// Tournament video compositions
export const TOURNAMENT_OVERVIEW_COMP_NAME = 'TournamentOverview';
export const ROUND_OVERVIEW_COMP_NAME = 'RoundOverview';
export const PLAYER_OVERVIEW_COMP_NAME = 'PlayerOverview';

export const defaultTournamentOverviewProps = {
  title: "An Epic Chess Battle",
  summary: "This tournament brought together some of the world's best players for an exciting competition.",
  highlights: [
    "Dramatic upsets on the top boards",
    "Brilliant tactical combinations",
    "Nail-biting endgames",
  ],
  roundSummaries: [
    "Round 1: Opening battles set the tone",
    "Round 2: The favorites strike back",
    "Round 3: Unexpected draws shake up the standings",
  ],
  conclusion: "A tournament that will be remembered for years to come!",
  tournamentName: "Sample Chess Tournament 2025",
  location: "New York, USA",
  dates: "Jan 10-15, 2025",
  topPlayers: [
    { rank: 1, name: "Magnus Carlsen", score: 7.5, rating: 2830 },
    { rank: 2, name: "Fabiano Caruana", score: 7.0, rating: 2800 },
    { rank: 3, name: "Hikaru Nakamura", score: 6.5, rating: 2790 },
  ],
};

export const defaultRoundOverviewProps = {
  title: "Round 5: The Turning Point",
  summary: "Round 5 proved to be decisive with several top contenders facing off in critical matches.",
  gameHighlights: [
    { gameId: "demo-game-1", description: "Board 1 saw a dramatic tactical battle" },
    { gameId: "demo-game-2", description: "An upset on Board 2 shook up the standings" },
  ],
  standingsNarrative: "After this round, the leaders pulled ahead while several players fell behind.",
  tournamentName: "Sample Chess Tournament 2025",
  roundNumber: 5,
  roundDate: "Jan 14, 2025",
  location: "New York, USA",
  topPlayers: [
    { rank: 1, name: "Magnus Carlsen", score: 4.5, rating: 2830 },
    { rank: 2, name: "Fabiano Caruana", score: 4.0, rating: 2800 },
    { rank: 3, name: "Hikaru Nakamura", score: 3.5, rating: 2790 },
  ],
};

export const defaultPlayerOverviewProps = {
  title: "Magnus Carlsen's Dominant Performance",
  introduction: "The World Champion entered the tournament as the top seed and demonstrated why he holds that position.",
  performanceSummary: "With a score of 7.5/9, Carlsen showed consistent play throughout, mixing solid positional understanding with tactical precision.",
  bestGame: {
    gameId: "demo-game-1",
    description: "Round 7 against Caruana showcased brilliant endgame technique",
  },
  disappointingGames: [
    { gameId: "demo-game-2", description: "Round 3 draw in a better position" },
  ],
  conclusion: "Another strong tournament result cementing his status as the world's best.",
  playerName: "Magnus Carlsen",
  playerTitle: "GM",
  playerRating: 2830,
  tournamentName: "Sample Chess Tournament 2025",
  finalScore: 7.5,
  finalRank: 1,
};
