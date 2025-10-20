/**
 * PGN Parser for Tournament Data
 *
 * Extracts tournament information from PGN files including:
 * - Tournament metadata (name, location, dates)
 * - Player information (names, FIDE IDs, ratings)
 * - Game results and rounds
 * - Infers tournament structure (round-robin, swiss, etc.)
 */

export interface PGNHeaders {
  Event?: string;
  Site?: string;
  Date?: string;
  Round?: string;
  White?: string;
  Black?: string;
  Result?: string;
  WhiteElo?: string;
  BlackElo?: string;
  WhiteFideId?: string;
  BlackFideId?: string;
  WhiteTitle?: string;
  BlackTitle?: string;
  EventDate?: string;
  EventType?: string;
  EventRounds?: string;
  EventCountry?: string;
  TimeControl?: string;
  [key: string]: string | undefined;
}

export interface ParsedGame {
  headers: PGNHeaders;
  pgn: string;
  round: number;
  whiteFideId: string | null;
  blackFideId: string | null;
  whiteName: string;
  blackName: string;
  whiteRating: number | null;
  blackRating: number | null;
  result: '1-0' | '0-1' | '1/2-1/2' | '*';
  date: string | null;
}

export interface PlayerInfo {
  fideId: string;
  name: string;
  rating: number | null;
  title: string | null;
  country?: string;
}

export interface TournamentInfo {
  name: string;
  location: string | null;
  startDate: string | null;
  endDate: string | null;
  totalRounds: number;
  type: 'round_robin' | 'swiss' | 'knockout' | 'other';
  timeControl: string | null;
  countryCode: string | null;
  players: PlayerInfo[];
  games: ParsedGame[];
}

/**
 * Parse a single PGN string and extract headers
 */
export function parsePGNHeaders(pgn: string): PGNHeaders {
  const headers: PGNHeaders = {};
  const headerRegex = /\[(\w+)\s+"([^"]*)"\]/g;
  let match;

  while ((match = headerRegex.exec(pgn)) !== null) {
    headers[match[1]] = match[2];
  }

  return headers;
}

/**
 * Parse multiple PGN games from a single string
 */
export function splitPGNGames(pgnText: string): string[] {
  // Split by empty line followed by [Event header
  const games: string[] = [];
  const gamePattern = /\[Event\s+"[^"]*"\]/g;
  const matches = Array.from(pgnText.matchAll(gamePattern));

  if (matches.length === 0) {
    // Single game or no games
    return pgnText.trim() ? [pgnText.trim()] : [];
  }

  for (let i = 0; i < matches.length; i++) {
    const startIndex = matches[i].index!;
    const endIndex = i < matches.length - 1 ? matches[i + 1].index! : pgnText.length;
    games.push(pgnText.substring(startIndex, endIndex).trim());
  }

  return games;
}

/**
 * Parse a single game into structured format
 */
export function parseGame(pgn: string): ParsedGame {
  const headers = parsePGNHeaders(pgn);

  // Extract round number (handle formats like "1", "1.1", "Round 1", etc.)
  let roundNumber = 1;
  if (headers.Round) {
    const roundMatch = headers.Round.match(/(\d+)/);
    if (roundMatch) {
      roundNumber = parseInt(roundMatch[1], 10);
    }
  }

  // Parse result
  let result: ParsedGame['result'] = '*';
  if (headers.Result) {
    const res = headers.Result;
    if (res === '1-0' || res === '0-1' || res === '1/2-1/2' || res === '*') {
      result = res;
    }
  }

  return {
    headers,
    pgn,
    round: roundNumber,
    whiteFideId: headers.WhiteFideId || null,
    blackFideId: headers.BlackFideId || null,
    whiteName: headers.White || 'Unknown',
    blackName: headers.Black || 'Unknown',
    whiteRating: headers.WhiteElo ? parseInt(headers.WhiteElo, 10) : null,
    blackRating: headers.BlackElo ? parseInt(headers.BlackElo, 10) : null,
    result,
    date: headers.Date || headers.EventDate || null,
  };
}

/**
 * Extract unique players from games
 */
export function extractPlayers(games: ParsedGame[]): PlayerInfo[] {
  const playersMap = new Map<string, PlayerInfo>();

  for (const game of games) {
    // Add white player
    if (game.whiteFideId) {
      if (!playersMap.has(game.whiteFideId)) {
        playersMap.set(game.whiteFideId, {
          fideId: game.whiteFideId,
          name: game.whiteName,
          rating: game.whiteRating,
          title: game.headers.WhiteTitle || null,
        });
      }
    }

    // Add black player
    if (game.blackFideId) {
      if (!playersMap.has(game.blackFideId)) {
        playersMap.set(game.blackFideId, {
          fideId: game.blackFideId,
          name: game.blackName,
          rating: game.blackRating,
          title: game.headers.BlackTitle || null,
        });
      }
    }
  }

  return Array.from(playersMap.values());
}

/**
 * Infer tournament type from games
 */
export function inferTournamentType(games: ParsedGame[], playerCount: number): TournamentInfo['type'] {
  if (games.length === 0 || playerCount === 0) {
    return 'other';
  }

  // Check if explicitly specified
  const firstGame = games[0];
  if (firstGame.headers.EventType) {
    const eventType = firstGame.headers.EventType.toLowerCase();
    if (eventType.includes('round') || eventType.includes('robin')) {
      return 'round_robin';
    }
    if (eventType.includes('swiss')) {
      return 'swiss';
    }
    if (eventType.includes('knockout') || eventType.includes('elimination')) {
      return 'knockout';
    }
  }

  // Calculate expected games for round-robin
  const singleRRGames = (playerCount * (playerCount - 1)) / 2;
  const doubleRRGames = playerCount * (playerCount - 1);

  // Check if game count matches round-robin pattern
  if (games.length === singleRRGames || games.length === doubleRRGames) {
    return 'round_robin';
  }

  // Check game distribution per player (round-robin: all equal, swiss: mostly equal)
  const gamesPerPlayer = new Map<string, number>();
  for (const game of games) {
    if (game.whiteFideId) {
      gamesPerPlayer.set(game.whiteFideId, (gamesPerPlayer.get(game.whiteFideId) || 0) + 1);
    }
    if (game.blackFideId) {
      gamesPerPlayer.set(game.blackFideId, (gamesPerPlayer.get(game.blackFideId) || 0) + 1);
    }
  }

  const gameCounts = Array.from(gamesPerPlayer.values());
  const minGames = Math.min(...gameCounts);
  const maxGames = Math.max(...gameCounts);

  // Round-robin: all players have same number of games (or n-1)
  if (maxGames - minGames <= 1 && maxGames === playerCount - 1) {
    return 'round_robin';
  }

  // Swiss: game counts are similar but not identical
  if (maxGames - minGames <= 2) {
    return 'swiss';
  }

  // Knockout: game counts vary significantly
  if (maxGames - minGames > 2) {
    return 'knockout';
  }

  return 'other';
}

/**
 * Extract tournament metadata from first game
 */
function extractTournamentMetadata(firstGame: ParsedGame, totalRounds: number): Omit<TournamentInfo, 'players' | 'games' | 'type'> {
  const headers = firstGame.headers;

  return {
    name: headers.Event || 'Unknown Tournament',
    location: headers.Site || null,
    startDate: headers.EventDate || headers.Date || null,
    endDate: null, // Will be calculated from latest game date
    totalRounds,
    timeControl: headers.TimeControl || null,
    countryCode: headers.EventCountry || null,
  };
}

/**
 * Calculate tournament end date from games
 */
function calculateEndDate(games: ParsedGame[]): string | null {
  const dates = games
    .map(g => g.date)
    .filter((d): d is string => d !== null)
    .sort()
    .reverse();

  return dates.length > 0 ? dates[0] : null;
}

/**
 * Main function: Parse multiple PGN games and extract tournament information
 */
export function parseTournamentFromPGN(pgnText: string): TournamentInfo {
  // Split into individual games
  const pgnGames = splitPGNGames(pgnText);

  if (pgnGames.length === 0) {
    throw new Error('No valid PGN games found');
  }

  // Parse all games
  const parsedGames = pgnGames.map(parseGame);

  // Extract unique players
  const players = extractPlayers(parsedGames);

  if (players.length === 0) {
    throw new Error('No players with FIDE IDs found. Tournament import requires FIDE identifiers.');
  }

  // Determine total rounds
  const maxRound = Math.max(...parsedGames.map(g => g.round));
  const totalRounds = parsedGames[0].headers.EventRounds
    ? parseInt(parsedGames[0].headers.EventRounds, 10)
    : maxRound;

  // Infer tournament type
  const tournamentType = inferTournamentType(parsedGames, players.length);

  // Extract metadata
  const metadata = extractTournamentMetadata(parsedGames[0], totalRounds);

  // Calculate end date
  const endDate = calculateEndDate(parsedGames);

  return {
    ...metadata,
    endDate,
    type: tournamentType,
    players,
    games: parsedGames,
  };
}

/**
 * Validate tournament data before import
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

export function validateTournamentData(tournamentInfo: TournamentInfo): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    suggestions: [],
  };

  // Check minimum requirements
  if (!tournamentInfo.name || tournamentInfo.name === 'Unknown Tournament') {
    result.warnings.push('Tournament name is missing or generic');
  }

  if (tournamentInfo.players.length < 2) {
    result.errors.push('Tournament must have at least 2 players');
    result.isValid = false;
  }

  if (tournamentInfo.games.length === 0) {
    result.errors.push('Tournament must have at least 1 game');
    result.isValid = false;
  }

  // Check for missing FIDE IDs
  const gamesWithoutFideIds = tournamentInfo.games.filter(
    g => !g.whiteFideId || !g.blackFideId
  );
  if (gamesWithoutFideIds.length > 0) {
    result.errors.push(
      `${gamesWithoutFideIds.length} game(s) missing FIDE IDs for one or both players`
    );
    result.isValid = false;
  }

  // Check for duplicate games (same players, same round)
  const gameKeys = new Set<string>();
  const duplicates: string[] = [];
  for (const game of tournamentInfo.games) {
    const key1 = `${game.round}-${game.whiteFideId}-${game.blackFideId}`;
    const key2 = `${game.round}-${game.blackFideId}-${game.whiteFideId}`;
    if (gameKeys.has(key1) || gameKeys.has(key2)) {
      duplicates.push(`Round ${game.round}: ${game.whiteName} vs ${game.blackName}`);
    }
    gameKeys.add(key1);
  }
  if (duplicates.length > 0) {
    result.warnings.push(`Possible duplicate games: ${duplicates.join(', ')}`);
  }

  // Check round continuity
  const rounds = tournamentInfo.games.map(g => g.round).sort((a, b) => a - b);
  const uniqueRounds = Array.from(new Set(rounds));
  if (uniqueRounds.length !== tournamentInfo.totalRounds) {
    result.warnings.push(
      `Expected ${tournamentInfo.totalRounds} rounds but found ${uniqueRounds.length} unique rounds in games`
    );
  }

  // Check for missing results
  const unfinishedGames = tournamentInfo.games.filter(g => g.result === '*');
  if (unfinishedGames.length > 0) {
    result.warnings.push(`${unfinishedGames.length} game(s) with unfinished results (*)`);
  }

  // Suggestions based on tournament type
  if (tournamentInfo.type === 'round_robin') {
    const expectedGames = (tournamentInfo.players.length * (tournamentInfo.players.length - 1)) / 2;
    if (tournamentInfo.games.length !== expectedGames && tournamentInfo.games.length !== expectedGames * 2) {
      result.suggestions.push(
        `Round-robin with ${tournamentInfo.players.length} players should have ${expectedGames} (single) or ${expectedGames * 2} (double) games. Found ${tournamentInfo.games.length} games.`
      );
    }
  }

  // Check for location and dates
  if (!tournamentInfo.location) {
    result.suggestions.push('Consider adding tournament location information');
  }

  if (!tournamentInfo.startDate) {
    result.suggestions.push('Consider adding tournament start date');
  }

  return result;
}

/**
 * Generate a summary of parsed tournament data
 */
export function generateTournamentSummary(tournamentInfo: TournamentInfo): string {
  const lines: string[] = [];

  lines.push(`Tournament: ${tournamentInfo.name}`);
  if (tournamentInfo.location) {
    lines.push(`Location: ${tournamentInfo.location}`);
  }
  if (tournamentInfo.startDate) {
    lines.push(`Date: ${tournamentInfo.startDate}${tournamentInfo.endDate ? ` to ${tournamentInfo.endDate}` : ''}`);
  }
  lines.push(`Type: ${tournamentInfo.type}`);
  lines.push(`Rounds: ${tournamentInfo.totalRounds}`);
  lines.push(`Players: ${tournamentInfo.players.length}`);
  lines.push(`Games: ${tournamentInfo.games.length}`);

  if (tournamentInfo.timeControl) {
    lines.push(`Time Control: ${tournamentInfo.timeControl}`);
  }

  return lines.join('\n');
}
