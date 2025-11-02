/**
 * Lichess API Client
 * Documentation: https://lichess.org/api
 */

// Rate limiter for Lichess (more generous than Chess.com)
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

// Create rate limiter (10 requests per second, conservative)
const rateLimiter = new RateLimiter(10);

// Types for Lichess API responses
export interface LichessProfile {
  id: string;
  username: string;
  title?: string;
  online?: boolean;
  playing?: boolean;
  streaming?: boolean;
  createdAt: number; // Unix timestamp in milliseconds
  seenAt?: number; // Unix timestamp in milliseconds
  profile?: {
    country?: string;
    location?: string;
    bio?: string;
    firstName?: string;
    lastName?: string;
    fideRating?: number;
    uscfRating?: number;
    ecfRating?: number;
    links?: string;
  };
  perfs: {
    [key: string]: LichessPerf;
  };
  patron?: boolean;
  verified?: boolean;
  playTime?: {
    total: number;
    tv: number;
  };
  url: string; // Profile URL
  count?: {
    all: number;
    rated: number;
    ai: number;
    draw: number;
    drawH: number;
    loss: number;
    lossH: number;
    win: number;
    winH: number;
    bookmark: number;
    playing: number;
    import: number;
    me: number;
  };
}

export interface LichessPerf {
  games: number;
  rating: number;
  rd: number; // Rating deviation
  prog: number; // Progress
  prov?: boolean; // Provisional
}

export interface LichessGame {
  id: string;
  rated: boolean;
  variant: string;
  speed: 'ultraBullet' | 'bullet' | 'blitz' | 'rapid' | 'classical' | 'correspondence';
  perf: string;
  createdAt: number; // Unix timestamp in milliseconds
  lastMoveAt: number; // Unix timestamp in milliseconds
  status: 'created' | 'started' | 'aborted' | 'mate' | 'resign' | 'stalemate' |
          'timeout' | 'draw' | 'outoftime' | 'cheat' | 'noStart' | 'unknownFinish' | 'variantEnd';
  players: {
    white: LichessPlayer;
    black: LichessPlayer;
  };
  winner?: 'white' | 'black';
  opening?: {
    eco: string;
    name: string;
    ply: number;
  };
  moves?: string; // Space-separated moves in UCI format
  pgn?: string; // Full PGN
  clock?: {
    initial: number; // Seconds
    increment: number; // Seconds
    totalTime: number; // Seconds
  };
  analysis?: LichessMove[];
}

export interface LichessPlayer {
  user?: {
    name: string;
    id: string;
    title?: string;
  };
  rating?: number;
  ratingDiff?: number;
  aiLevel?: number;
  analysis?: {
    inaccuracy: number;
    mistake: number;
    blunder: number;
    acpl: number; // Average centipawn loss
  };
}

export interface LichessMove {
  eval?: number; // Centipawn evaluation
  mate?: number; // Mate in X moves
  best?: string; // Best move in UCI format
  variation?: string; // Best variation
  judgment?: {
    name: string; // "Inaccuracy", "Mistake", "Blunder", etc.
    comment?: string;
  };
}

/**
 * Fetch player profile from Lichess
 */
export async function getPlayerProfile(username: string): Promise<LichessProfile> {
  await rateLimiter.throttle();

  const url = `https://lichess.org/api/user/${username}`;
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'ChessMoments/1.0',
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Player "${username}" not found on Lichess`);
    }
    throw new Error(`Lichess API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch player games from Lichess
 * Returns NDJSON (newline-delimited JSON), so we need to parse it line by line
 */
export async function getPlayerGames(
  username: string,
  options: {
    max?: number;
    rated?: boolean;
    pgnInJson?: boolean;
    clocks?: boolean;
    evals?: boolean;
    opening?: boolean;
    analysed?: boolean;
    since?: number; // Unix timestamp in milliseconds
    until?: number; // Unix timestamp in milliseconds
  } = {}
): Promise<LichessGame[]> {
  await rateLimiter.throttle();

  const params = new URLSearchParams();

  if (options.max) params.append('max', options.max.toString());
  if (options.rated !== undefined) params.append('rated', options.rated.toString());
  if (options.pgnInJson !== false) params.append('pgnInJson', 'true');
  if (options.clocks) params.append('clocks', 'true');
  if (options.evals) params.append('evals', 'true');
  if (options.opening !== false) params.append('opening', 'true');
  if (options.analysed) params.append('analysed', 'true');
  if (options.since) params.append('since', options.since.toString());
  if (options.until) params.append('until', options.until.toString());

  const url = `https://lichess.org/api/games/user/${username}?${params.toString()}`;
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/x-ndjson',
      'User-Agent': 'ChessMoments/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Lichess API error: ${response.status} ${response.statusText}`);
  }

  // Parse NDJSON response
  const text = await response.text();
  const lines = text.trim().split('\n');
  const games: LichessGame[] = [];

  for (const line of lines) {
    if (line.trim()) {
      try {
        games.push(JSON.parse(line));
      } catch (error) {
        console.error('Error parsing game:', error, line);
      }
    }
  }

  return games;
}

/**
 * Fetch recent games for a player
 */
export async function getRecentGames(
  username: string,
  maxGames: number = 100
): Promise<LichessGame[]> {
  return getPlayerGames(username, {
    max: maxGames,
    pgnInJson: true,
    opening: true,
  });
}

/**
 * Determine player's color in a game
 */
export function getPlayerColor(
  game: LichessGame,
  username: string
): 'white' | 'black' {
  const normalizedUsername = username.toLowerCase();
  const whiteUser = game.players.white.user?.id.toLowerCase();
  const blackUser = game.players.black.user?.id.toLowerCase();

  if (whiteUser === normalizedUsername) return 'white';
  if (blackUser === normalizedUsername) return 'black';

  // Fallback: check by name
  const whiteName = game.players.white.user?.name.toLowerCase();
  const blackName = game.players.black.user?.name.toLowerCase();

  if (whiteName === normalizedUsername) return 'white';
  if (blackName === normalizedUsername) return 'black';

  throw new Error(`Player ${username} not found in game ${game.id}`);
}

/**
 * Get player's rating from a game
 */
export function getPlayerRating(
  game: LichessGame,
  username: string
): number | null {
  const color = getPlayerColor(game, username);
  return game.players[color].rating || null;
}

/**
 * Get opponent's rating from a game
 */
export function getOpponentRating(
  game: LichessGame,
  username: string
): number | null {
  const color = getPlayerColor(game, username);
  const opponentColor = color === 'white' ? 'black' : 'white';
  return game.players[opponentColor].rating || null;
}

/**
 * Parse game result from player's perspective
 */
export function getGameResult(
  game: LichessGame,
  username: string
): '1-0' | '0-1' | '1/2-1/2' {
  if (!game.winner) {
    return '1/2-1/2'; // Draw
  }

  const playerColor = getPlayerColor(game, username);
  return game.winner === playerColor ?
    (playerColor === 'white' ? '1-0' : '0-1') :
    (playerColor === 'white' ? '0-1' : '1-0');
}

/**
 * Convert speed to time class
 */
export function speedToTimeClass(speed: LichessGame['speed']): string {
  const mapping: Record<LichessGame['speed'], string> = {
    'ultraBullet': 'bullet',
    'bullet': 'bullet',
    'blitz': 'blitz',
    'rapid': 'rapid',
    'classical': 'classical',
    'correspondence': 'classical',
  };
  return mapping[speed] || speed;
}

/**
 * Format time control string
 */
export function formatTimeControl(game: LichessGame): string {
  if (!game.clock) {
    return 'unlimited';
  }
  return `${game.clock.initial}+${game.clock.increment}`;
}

/**
 * Convert Unix timestamp (milliseconds) to ISO date string
 */
export function convertTimestamp(unixTimestamp: number): string {
  return new Date(unixTimestamp).toISOString();
}

/**
 * Extract player statistics from profile
 */
export function extractRatings(profile: LichessProfile): Record<string, { rating: number; games: number }> {
  const ratings: Record<string, { rating: number; games: number }> = {};

  const relevantPerfs = ['bullet', 'blitz', 'rapid', 'classical', 'correspondence'];

  for (const perfType of relevantPerfs) {
    const perf = profile.perfs[perfType];
    if (perf && perf.games > 0) {
      ratings[perfType] = {
        rating: perf.rating,
        games: perf.games,
      };
    }
  }

  return ratings;
}

/**
 * Get opponent username from game
 */
export function getOpponentUsername(
  game: LichessGame,
  username: string
): string {
  const playerColor = getPlayerColor(game, username);
  const opponentColor = playerColor === 'white' ? 'black' : 'white';
  return game.players[opponentColor].user?.name || game.players[opponentColor].user?.id || 'Unknown';
}

/**
 * Check if game has computer analysis
 */
export function hasAnalysis(game: LichessGame): boolean {
  return game.analysis !== undefined && game.analysis.length > 0;
}

/**
 * Get player's move accuracy stats from game (if analysed)
 */
export function getPlayerAccuracy(
  game: LichessGame,
  username: string
): { inaccuracy: number; mistake: number; blunder: number; acpl: number } | null {
  const playerColor = getPlayerColor(game, username);
  const analysis = game.players[playerColor].analysis;

  if (!analysis) {
    return null;
  }

  return {
    inaccuracy: analysis.inaccuracy || 0,
    mistake: analysis.mistake || 0,
    blunder: analysis.blunder || 0,
    acpl: analysis.acpl || 0,
  };
}
