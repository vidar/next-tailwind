/**
 * Chess.com API Client
 * Documentation: https://www.chess.com/news/view/published-data-api
 */

// Rate limiter to respect Chess.com API limits
class RateLimiter {
  private lastRequest = 0;
  private minInterval: number;

  constructor(requestsPerSecond: number) {
    this.minInterval = 1000 / requestsPerSecond;
  }

  async throttle() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequest;
    if (timeSinceLastRequest < this.minInterval) {
      await new Promise(resolve =>
        setTimeout(resolve, this.minInterval - timeSinceLastRequest)
      );
    }
    this.lastRequest = Date.now();
  }
}

// Create rate limiter (1 request per second)
const rateLimiter = new RateLimiter(1);

// Types for Chess.com API responses
export interface ChessComProfile {
  player_id: number;
  '@id': string;
  url: string;
  username: string;
  title?: string;
  name?: string;
  avatar?: string;
  location?: string;
  country: string; // URL to country endpoint
  joined: number; // Unix timestamp
  last_online: number; // Unix timestamp
  followers: number;
  is_streamer: boolean;
  verified: boolean;
  league?: string;
}

export interface ChessComStats {
  chess_daily?: ChessComGameTypeStats;
  chess_rapid?: ChessComGameTypeStats;
  chess_bullet?: ChessComGameTypeStats;
  chess_blitz?: ChessComGameTypeStats;
  chess960_daily?: ChessComGameTypeStats;
  tactics?: ChessComTacticsStats;
  lessons?: ChessComLessonsStats;
  puzzle_rush?: ChessComPuzzleRushStats;
}

export interface ChessComGameTypeStats {
  last: {
    rating: number;
    date: number; // Unix timestamp
    rd: number; // Rating deviation
  };
  best?: {
    rating: number;
    date: number;
    game: string; // URL to game
  };
  record: {
    win: number;
    loss: number;
    draw: number;
    time_per_move?: number;
    timeout_percent?: number;
  };
  tournament?: {
    count: number;
    withdraw: number;
    points: number;
    highest_finish: number;
  };
}

export interface ChessComTacticsStats {
  highest: { rating: number; date: number };
  lowest: { rating: number; date: number };
}

export interface ChessComLessonsStats {
  highest: { rating: number; date: number };
  lowest: { rating: number; date: number };
}

export interface ChessComPuzzleRushStats {
  best: { total_attempts: number; score: number };
  daily?: { total_attempts: number; score: number };
}

export interface ChessComArchive {
  archives: string[]; // Array of URLs like "https://api.chess.com/pub/player/username/games/2024/10"
}

export interface ChessComMonthlyGames {
  games: ChessComGame[];
}

export interface ChessComGame {
  url: string;
  pgn: string;
  time_control: string;
  end_time: number; // Unix timestamp
  rated: boolean;
  tcn?: string; // Compressed move format
  uuid: string;
  initial_setup?: string;
  fen?: string;
  time_class: 'daily' | 'rapid' | 'blitz' | 'bullet';
  rules: 'chess' | 'chess960' | 'bughouse' | 'kingofthehill' | 'threecheck' | 'crazyhouse';
  white: ChessComPlayer;
  black: ChessComPlayer;
  eco?: string; // URL to opening page
  tournament?: string;
  match?: string;
}

export interface ChessComPlayer {
  rating: number;
  result: 'win' | 'checkmated' | 'agreed' | 'repetition' | 'timeout' | 'resigned' |
          'stalemate' | 'lose' | 'insufficient' | 'timevsinsufficient' | 'abandoned';
  '@id': string; // URL to player profile
  username: string;
  uuid: string;
}

/**
 * Fetch player profile from Chess.com
 */
export async function getPlayerProfile(username: string): Promise<ChessComProfile> {
  await rateLimiter.throttle();

  const url = `https://api.chess.com/pub/player/${username}`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'ChessMoments/1.0',
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Player "${username}" not found on Chess.com`);
    }
    throw new Error(`Chess.com API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch player stats from Chess.com
 */
export async function getPlayerStats(username: string): Promise<ChessComStats> {
  await rateLimiter.throttle();

  const url = `https://api.chess.com/pub/player/${username}/stats`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'ChessMoments/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Chess.com API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch list of game archives for a player
 */
export async function getGameArchives(username: string): Promise<string[]> {
  await rateLimiter.throttle();

  const url = `https://api.chess.com/pub/player/${username}/games/archives`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'ChessMoments/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Chess.com API error: ${response.status} ${response.statusText}`);
  }

  const data: ChessComArchive = await response.json();
  return data.archives;
}

/**
 * Fetch games for a specific month
 */
export async function getMonthlyGames(archiveUrl: string): Promise<ChessComGame[]> {
  await rateLimiter.throttle();

  const response = await fetch(archiveUrl, {
    headers: {
      'User-Agent': 'ChessMoments/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Chess.com API error: ${response.status} ${response.statusText}`);
  }

  const data: ChessComMonthlyGames = await response.json();
  return data.games;
}

/**
 * Fetch last N games for a player (fetches from most recent archives)
 */
export async function getRecentGames(
  username: string,
  maxGames: number = 100
): Promise<ChessComGame[]> {
  const archives = await getGameArchives(username);

  if (archives.length === 0) {
    return [];
  }

  // Sort archives to get most recent first
  const sortedArchives = archives.sort().reverse();

  const games: ChessComGame[] = [];

  // Fetch games from most recent archives until we have enough
  for (const archiveUrl of sortedArchives) {
    if (games.length >= maxGames) {
      break;
    }

    const monthGames = await getMonthlyGames(archiveUrl);

    // Sort games by end_time, most recent first
    monthGames.sort((a, b) => b.end_time - a.end_time);

    games.push(...monthGames);
  }

  // Return only the requested number of games
  return games.slice(0, maxGames);
}

/**
 * Extract country code from Chess.com country URL
 */
export function extractCountryCode(countryUrl: string): string | null {
  const match = countryUrl.match(/\/country\/([A-Z]{2})$/);
  return match ? match[1] : null;
}

/**
 * Parse ECO code from Chess.com opening URL
 */
export function extractEcoCode(ecoUrl: string): string | null {
  const match = ecoUrl.match(/\/openings\/([A-E]\d{2})/);
  return match ? match[1] : null;
}

/**
 * Determine player's color in a game
 */
export function getPlayerColor(
  game: ChessComGame,
  username: string
): 'white' | 'black' {
  return game.white.username.toLowerCase() === username.toLowerCase() ? 'white' : 'black';
}

/**
 * Get player's rating from a game
 */
export function getPlayerRating(
  game: ChessComGame,
  username: string
): number {
  const color = getPlayerColor(game, username);
  return color === 'white' ? game.white.rating : game.black.rating;
}

/**
 * Get opponent's rating from a game
 */
export function getOpponentRating(
  game: ChessComGame,
  username: string
): number {
  const color = getPlayerColor(game, username);
  return color === 'white' ? game.black.rating : game.white.rating;
}

/**
 * Parse game result from player's perspective
 */
export function getGameResult(
  game: ChessComGame,
  username: string
): '1-0' | '0-1' | '1/2-1/2' {
  const color = getPlayerColor(game, username);
  const playerResult = color === 'white' ? game.white.result : game.black.result;

  // Map Chess.com result to standard PGN result
  if (['win', 'checkmated'].includes(playerResult)) {
    return color === 'white' ? '1-0' : '0-1';
  }

  if (['lose', 'resigned', 'timeout', 'abandoned'].includes(playerResult)) {
    return color === 'white' ? '0-1' : '1-0';
  }

  // Draw results
  return '1/2-1/2';
}

/**
 * Convert Unix timestamp to ISO date string
 */
export function convertTimestamp(unixTimestamp: number): string {
  return new Date(unixTimestamp * 1000).toISOString();
}
