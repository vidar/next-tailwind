/**
 * Database module - Refactored from monolithic db.ts
 *
 * This module is organized by domain:
 * - types: All TypeScript interfaces
 * - connection: PostgreSQL pool management
 * - chess-analysis: Game analysis operations
 * - videos: Video rendering operations
 * - annotations: Game move annotations
 * - (Additional modules to be created: tournaments, player-lookup, tournament-videos, queue)
 *
 * For backwards compatibility, we re-export everything from the original db.ts
 * until all modules are fully migrated.
 */

// Export all types
export * from './types';

// Export connection pool
export { getPool } from './connection';

// Export refactored modules
export * from './chess-analysis';
export * from './videos';
export * from './annotations';

// Re-export remaining functions from original db.ts for backwards compatibility
// TODO: Complete refactoring by migrating these to domain-specific modules
export {
  // Tournament operations
  createTournament,
  getTournamentById,
  listTournaments,
  deleteTournament,

  // Player operations
  upsertPlayer,
  getPlayerById,
  searchPlayers,

  // Tournament-Player operations
  addPlayerToTournament,
  getTournamentPlayers,
  updateTournamentPlayerScore,

  // Tournament Round operations
  createTournamentRound,
  getTournamentRounds,
  getTournamentRoundByNumber,

  // Tournament Game operations
  linkGameToTournament,
  getTournamentGames,
  getRoundGames,
  getPlayerTournamentGames,
  calculateTournamentStandings,

  // Player Lookup operations
  upsertPlayerProfile,
  getPlayerProfile,
  getPlayerProfileById,
  updatePlayerProfileAnalysisStatus,
  createPlayerGame,
  getPlayerGames,
  getPlayerGameById,
  updatePlayerGameAnalysisStatus,
  createPlayerGameInsight,
  getPlayerGameInsight,
  upsertPlayerOpeningStat,
  getPlayerOpeningStats,

  // Analysis Queue operations
  queueGameForAnalysis,
  getNextQueueItems,
  updateQueueItemStatus,

  // Tournament Videos
  createTournamentVideo,
  getTournamentVideo,
  getTournamentVideos,
  updateTournamentVideoStatus,
} from '../db';
