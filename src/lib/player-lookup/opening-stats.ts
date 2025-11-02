/**
 * Opening Stats Aggregator Service
 * Aggregates game statistics by opening for a player profile
 */

import {
  getPlayerGames,
  getPlayerGameInsight,
  upsertPlayerOpeningStat,
  getPlayerOpeningStats,
  PlayerGame,
  PlayerGameInsight,
} from '@/lib/db';

interface OpeningGroup {
  eco: string;
  name: string;
  color: 'white' | 'black';
  timeClass: string;
  games: Array<{
    game: PlayerGame;
    insight: PlayerGameInsight | null;
  }>;
}

interface OpeningAggregateStats {
  totalGames: number;
  wins: number;
  draws: number;
  losses: number;
  winRate: number;
  averageAccuracy: number | null;
  averageCPL: number | null;
  averageOpponentRating: number | null;
  ratingPerformance: number | null;
  lastPlayedAt: string;
  firstPlayedAt: string;
}

/**
 * Group games by opening
 */
function groupGamesByOpening(
  games: PlayerGame[]
): Map<string, OpeningGroup> {
  const groups = new Map<string, OpeningGroup>();

  for (const game of games) {
    if (!game.opening_eco || !game.opening_name) {
      continue; // Skip games without opening data
    }

    // Create unique key: eco_color_timeClass
    const key = `${game.opening_eco}_${game.player_color}_${game.time_class || 'unknown'}`;

    if (!groups.has(key)) {
      groups.set(key, {
        eco: game.opening_eco,
        name: game.opening_name,
        color: game.player_color,
        timeClass: game.time_class || 'unknown',
        games: [],
      });
    }

    groups.get(key)!.games.push({
      game,
      insight: null, // Will be populated later
    });
  }

  return groups;
}

/**
 * Calculate aggregate statistics for an opening group
 */
function calculateOpeningStats(
  group: OpeningGroup
): OpeningAggregateStats {
  let wins = 0;
  let draws = 0;
  let losses = 0;
  let totalAccuracy = 0;
  let accuracyCount = 0;
  let totalCPL = 0;
  let cplCount = 0;
  let totalOpponentRating = 0;
  let opponentRatingCount = 0;
  let earliestGame: string | null = null;
  let latestGame: string | null = null;

  for (const { game, insight } of group.games) {
    // Count results
    if (game.result) {
      const playerWon =
        (game.player_color === 'white' && game.result === '1-0') ||
        (game.player_color === 'black' && game.result === '0-1');
      const isDraw = game.result === '1/2-1/2';

      if (playerWon) {
        wins++;
      } else if (isDraw) {
        draws++;
      } else {
        losses++;
      }
    }

    // Aggregate accuracy
    if (insight?.accuracy_percentage) {
      totalAccuracy += insight.accuracy_percentage;
      accuracyCount++;
    }

    // Aggregate CPL
    if (insight?.average_centipawn_loss) {
      totalCPL += insight.average_centipawn_loss;
      cplCount++;
    }

    // Aggregate opponent rating
    const opponentRating =
      game.player_color === 'white' ? game.black_rating : game.white_rating;
    if (opponentRating) {
      totalOpponentRating += opponentRating;
      opponentRatingCount++;
    }

    // Track date range
    if (!earliestGame || game.played_at < earliestGame) {
      earliestGame = game.played_at;
    }
    if (!latestGame || game.played_at > latestGame) {
      latestGame = game.played_at;
    }
  }

  const totalGames = group.games.length;
  const winRate = totalGames > 0 ? (wins / totalGames) * 100 : 0;
  const averageAccuracy = accuracyCount > 0 ? totalAccuracy / accuracyCount : null;
  const averageCPL = cplCount > 0 ? totalCPL / cplCount : null;
  const averageOpponentRating =
    opponentRatingCount > 0 ? totalOpponentRating / opponentRatingCount : null;

  // Calculate rating performance (simplified)
  // Performance rating ≈ opponent rating + 400 * (score - 0.5)
  let ratingPerformance: number | null = null;
  if (averageOpponentRating) {
    const score = wins + draws * 0.5;
    const expectedScore = totalGames * 0.5;
    const scoreDiff = score - expectedScore;
    ratingPerformance = averageOpponentRating + 400 * (scoreDiff / totalGames);
  }

  return {
    totalGames,
    wins,
    draws,
    losses,
    winRate,
    averageAccuracy,
    averageCPL,
    averageOpponentRating,
    ratingPerformance,
    lastPlayedAt: latestGame!,
    firstPlayedAt: earliestGame!,
  };
}

/**
 * Aggregate opening statistics for a player profile
 */
export async function aggregateOpeningStats(
  profileId: string
): Promise<{ updated: number; errors: number }> {
  console.log(`Aggregating opening stats for profile ${profileId}...`);

  // Get all completed games
  const games = await getPlayerGames(profileId, {
    analysisStatus: 'completed',
  });

  console.log(`Found ${games.length} completed games`);

  // Group by opening
  const openingGroups = groupGamesByOpening(games);
  console.log(`Grouped into ${openingGroups.size} opening categories`);

  let updated = 0;
  let errors = 0;

  // Process each opening group
  for (const [key, group] of openingGroups) {
    try {
      // Fetch insights for all games in this group
      for (const item of group.games) {
        item.insight = await getPlayerGameInsight(item.game.id);
      }

      // Calculate aggregate stats
      const stats = calculateOpeningStats(group);

      // Upsert to database
      await upsertPlayerOpeningStat({
        player_profile_id: profileId,
        opening_eco: group.eco,
        opening_name: group.name,
        player_color: group.color,
        time_class: group.timeClass === 'unknown' ? undefined : group.timeClass,
        total_games: stats.totalGames,
        wins: stats.wins,
        draws: stats.draws,
        losses: stats.losses,
        win_rate: stats.winRate,
        average_accuracy: stats.averageAccuracy,
        average_centipawn_loss: stats.averageCPL,
        average_opponent_rating: stats.averageOpponentRating,
        rating_performance: stats.ratingPerformance,
        last_played_at: stats.lastPlayedAt,
        first_played_at: stats.firstPlayedAt,
      });

      updated++;
    } catch (error) {
      console.error(`Error aggregating stats for ${key}:`, error);
      errors++;
    }
  }

  console.log(`Updated ${updated} opening stats (${errors} errors)`);

  return { updated, errors };
}

/**
 * Get best performing openings for a player
 */
export async function getBestOpenings(
  profileId: string,
  options: {
    color?: 'white' | 'black';
    timeClass?: string;
    minGames?: number;
    sortBy?: 'winRate' | 'totalGames' | 'performance';
    limit?: number;
  } = {}
): Promise<Array<{
  eco: string;
  name: string;
  color: 'white' | 'black';
  winRate: number;
  totalGames: number;
  performance: number | null;
}>> {
  const stats = await getPlayerOpeningStats(profileId, {
    color: options.color,
    timeClass: options.timeClass,
    minGames: options.minGames || 3,
  });

  // Convert to simplified format
  const openings = stats.map(stat => ({
    eco: stat.opening_eco,
    name: stat.opening_name,
    color: stat.player_color,
    winRate: stat.win_rate || 0,
    totalGames: stat.total_games,
    performance: stat.rating_performance,
  }));

  // Sort based on criteria
  const sortBy = options.sortBy || 'winRate';
  openings.sort((a, b) => {
    if (sortBy === 'winRate') {
      return b.winRate - a.winRate;
    } else if (sortBy === 'totalGames') {
      return b.totalGames - a.totalGames;
    } else if (sortBy === 'performance') {
      return (b.performance || 0) - (a.performance || 0);
    }
    return 0;
  });

  return openings.slice(0, options.limit || 10);
}

/**
 * Get worst performing openings for a player
 */
export async function getWorstOpenings(
  profileId: string,
  options: {
    color?: 'white' | 'black';
    timeClass?: string;
    minGames?: number;
    limit?: number;
  } = {}
): Promise<Array<{
  eco: string;
  name: string;
  color: 'white' | 'black';
  winRate: number;
  totalGames: number;
  performance: number | null;
}>> {
  const stats = await getPlayerOpeningStats(profileId, {
    color: options.color,
    timeClass: options.timeClass,
    minGames: options.minGames || 3,
  });

  const openings = stats.map(stat => ({
    eco: stat.opening_eco,
    name: stat.opening_name,
    color: stat.player_color,
    winRate: stat.win_rate || 0,
    totalGames: stat.total_games,
    performance: stat.rating_performance,
  }));

  // Sort by win rate ascending (worst first)
  openings.sort((a, b) => a.winRate - b.winRate);

  return openings.slice(0, options.limit || 10);
}

/**
 * Get opening repertoire summary
 */
export async function getOpeningRepertoire(
  profileId: string,
  color: 'white' | 'black'
): Promise<{
  totalOpenings: number;
  totalGames: number;
  mostPlayed: Array<{ eco: string; name: string; games: number }>;
  bestPerforming: Array<{ eco: string; name: string; winRate: number }>;
  needsWork: Array<{ eco: string; name: string; winRate: number }>;
}> {
  const stats = await getPlayerOpeningStats(profileId, {
    color,
    minGames: 1,
  });

  const totalOpenings = stats.length;
  const totalGames = stats.reduce((sum, stat) => sum + stat.total_games, 0);

  // Most played
  const sortedByGames = [...stats].sort((a, b) => b.total_games - a.total_games);
  const mostPlayed = sortedByGames.slice(0, 5).map(stat => ({
    eco: stat.opening_eco,
    name: stat.opening_name,
    games: stat.total_games,
  }));

  // Best performing (min 3 games)
  const withEnoughGames = stats.filter(s => s.total_games >= 3);
  const sortedByWinRate = [...withEnoughGames].sort(
    (a, b) => (b.win_rate || 0) - (a.win_rate || 0)
  );
  const bestPerforming = sortedByWinRate.slice(0, 5).map(stat => ({
    eco: stat.opening_eco,
    name: stat.opening_name,
    winRate: stat.win_rate || 0,
  }));

  // Needs work (min 3 games, lowest win rate)
  const needsWork = [...withEnoughGames]
    .sort((a, b) => (a.win_rate || 0) - (b.win_rate || 0))
    .slice(0, 5)
    .map(stat => ({
      eco: stat.opening_eco,
      name: stat.opening_name,
      winRate: stat.win_rate || 0,
    }));

  return {
    totalOpenings,
    totalGames,
    mostPlayed,
    bestPerforming,
    needsWork,
  };
}
