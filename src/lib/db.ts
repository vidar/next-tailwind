import { Pool } from "pg";

// Type for JSONB fields in PostgreSQL
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

// Create a singleton pool instance
let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || "5432"),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }
  return pool;
}

export interface ChessAnalysis {
  id: string;
  pgn: string;
  game_data: JsonValue;
  analysis_config: {
    depth: number;
    find_alternatives: boolean;
  };
  analysis_results: JsonValue;
  status: string;
  progress: number | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export async function getCompletedAnalyses(): Promise<ChessAnalysis[]> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT * FROM chess_analyses
     WHERE status = 'completed'
     ORDER BY completed_at DESC`,
  );
  return result.rows;
}

export async function getAnalysisById(id: string): Promise<ChessAnalysis | null> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT * FROM chess_analyses WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

export async function createPendingAnalysis(
  pgn: string,
  depth: number,
  findAlternatives: boolean
): Promise<ChessAnalysis> {
  const pool = getPool();
  const result = await pool.query(
    `INSERT INTO chess_analyses (id, pgn, game_data, analysis_config, status, progress, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, $2, $3, 'pending', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     RETURNING *`,
    [
      pgn,
      JSON.stringify({}), // Empty game data initially
      JSON.stringify({ depth, find_alternatives: findAlternatives })
    ]
  );
  return result.rows[0];
}

export async function updateAnalysisResults(
  id: string,
  gameData: JsonValue,
  analysisResults: JsonValue,
  status: 'completed' | 'failed',
  errorMessage?: string
): Promise<ChessAnalysis> {
  const pool = getPool();

  const updates: string[] = [
    'game_data = $2',
    'analysis_results = $3',
    'status = $4',
    'progress = 100',
    'updated_at = CURRENT_TIMESTAMP'
  ];
  const values: (string | JsonValue)[] = [id, JSON.stringify(gameData), JSON.stringify(analysisResults), status];
  let paramCount = 4;

  if (status === 'completed') {
    updates.push('completed_at = CURRENT_TIMESTAMP');
  }

  if (errorMessage) {
    paramCount++;
    updates.push(`error_message = $${paramCount}`);
    values.push(errorMessage);
  }

  const result = await pool.query(
    `UPDATE chess_analyses SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
    values
  );
  return result.rows[0];
}

export interface Video {
  id: string;
  user_id: string;
  game_id: string;
  composition_type: string;
  s3_url: string | null;
  status: 'pending' | 'rendering' | 'completed' | 'failed';
  start_time: string;
  end_time: string | null;
  error: string | null;
  metadata: JsonValue;
  created_at: string;
  updated_at: string;
}

export async function createVideo(
  userId: string,
  gameId: string,
  compositionType: string = 'walkthrough',
  renderMetadata?: { renderId: string; bucketName: string }
): Promise<Video> {
  const pool = getPool();
  const result = await pool.query(
    `INSERT INTO videos (user_id, game_id, composition_type, status, metadata)
     VALUES ($1, $2, $3, 'pending', $4)
     RETURNING *`,
    [userId, gameId, compositionType, renderMetadata ? JSON.stringify(renderMetadata) : null]
  );
  return result.rows[0];
}

export async function updateVideoStatus(
  videoId: string,
  status: Video['status'],
  s3Url?: string,
  error?: string
): Promise<Video> {
  const pool = getPool();
  const updates: string[] = ['status = $2', 'updated_at = CURRENT_TIMESTAMP'];
  const values: (string | Video['status'])[] = [videoId, status];
  let paramCount = 2;

  if (status === 'completed' || status === 'failed') {
    updates.push(`end_time = CURRENT_TIMESTAMP`);
  }

  if (s3Url) {
    paramCount++;
    updates.push(`s3_url = $${paramCount}`);
    values.push(s3Url);
  }

  if (error) {
    paramCount++;
    updates.push(`error = $${paramCount}`);
    values.push(error);
  }

  const result = await pool.query(
    `UPDATE videos SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
    values
  );
  return result.rows[0];
}

export async function getVideosByGameId(gameId: string): Promise<Video[]> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT * FROM videos WHERE game_id = $1 ORDER BY created_at DESC`,
    [gameId]
  );
  return result.rows;
}

export async function getVideoById(videoId: string): Promise<Video | null> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT * FROM videos WHERE id = $1`,
    [videoId]
  );
  return result.rows[0] || null;
}

export async function getVideosByUserId(userId: string): Promise<Video[]> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT v.*, c.pgn, c.game_data
     FROM videos v
     JOIN chess_analyses c ON v.game_id = c.id
     WHERE v.user_id = $1
     ORDER BY v.created_at DESC`,
    [userId]
  );
  return result.rows;
}

export async function updateVideoMetadata(
  videoId: string,
  metadata: JsonValue
): Promise<Video> {
  const pool = getPool();
  const result = await pool.query(
    `UPDATE videos SET metadata = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
    [videoId, JSON.stringify(metadata)]
  );
  return result.rows[0];
}

// ===== Game Annotations =====

export interface GameAnnotation {
  id: string;
  game_id: string;
  move_index: number;
  annotation_text: string;
  created_at: string;
  updated_at: string;
}

export async function getAnnotationsByGameId(gameId: string): Promise<GameAnnotation[]> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT * FROM game_annotations WHERE game_id = $1 ORDER BY move_index ASC`,
    [gameId]
  );
  return result.rows;
}

export async function upsertAnnotation(
  gameId: string,
  moveIndex: number,
  annotationText: string
): Promise<GameAnnotation> {
  const pool = getPool();
  const result = await pool.query(
    `INSERT INTO game_annotations (game_id, move_index, annotation_text)
     VALUES ($1, $2, $3)
     ON CONFLICT (game_id, move_index)
     DO UPDATE SET annotation_text = $3, updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [gameId, moveIndex, annotationText]
  );
  return result.rows[0];
}

export async function deleteAnnotation(annotationId: string): Promise<void> {
  const pool = getPool();
  await pool.query(
    `DELETE FROM game_annotations WHERE id = $1`,
    [annotationId]
  );
}

export async function getAnnotationByGameAndMove(
  gameId: string,
  moveIndex: number
): Promise<GameAnnotation | null> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT * FROM game_annotations WHERE game_id = $1 AND move_index = $2`,
    [gameId, moveIndex]
  );
  return result.rows[0] || null;
}

// ===== Tournaments =====

export interface Tournament {
  id: string;
  name: string;
  location: string | null;
  start_date: string;
  end_date: string | null;
  tournament_type: 'round_robin' | 'swiss' | 'knockout' | 'arena' | 'other';
  total_rounds: number;
  time_control: string | null;
  country_code: string | null;
  organizer: string | null;
  description: string | null;
  metadata: JsonValue;
  created_at: string;
  updated_at: string;
}

export interface Player {
  fide_id: string;
  full_name: string;
  country_code: string | null;
  title: string | null;
  birth_year: number | null;
  profile_photo_url: string | null;
  fide_profile_url: string | null;
  metadata: JsonValue;
  created_at: string;
  updated_at: string;
}

export interface TournamentPlayer {
  id: string;
  tournament_id: string;
  fide_id: string;
  starting_rating: number | null;
  seed_number: number | null;
  final_score: number | null;
  final_rank: number | null;
  metadata: JsonValue;
  created_at: string;
  updated_at: string;
}

export interface TournamentRound {
  id: string;
  tournament_id: string;
  round_number: number;
  round_date: string | null;
  round_name: string | null;
  created_at: string;
}

export interface TournamentGame {
  id: string;
  tournament_id: string;
  round_id: string;
  game_id: string;
  white_fide_id: string;
  black_fide_id: string;
  board_number: number | null;
  result: '1-0' | '0-1' | '1/2-1/2' | '*';
  game_date: string | null;
  metadata: JsonValue;
  created_at: string;
  updated_at: string;
}

// Tournament CRUD operations
export async function createTournament(data: {
  name: string;
  location?: string;
  start_date: string;
  end_date?: string;
  tournament_type: Tournament['tournament_type'];
  total_rounds: number;
  time_control?: string;
  country_code?: string;
  organizer?: string;
  description?: string;
  metadata?: JsonValue;
}): Promise<Tournament> {
  const pool = getPool();
  const result = await pool.query(
    `INSERT INTO tournaments (name, location, start_date, end_date, tournament_type, total_rounds, time_control, country_code, organizer, description, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [
      data.name,
      data.location || null,
      data.start_date,
      data.end_date || null,
      data.tournament_type,
      data.total_rounds,
      data.time_control || null,
      data.country_code || null,
      data.organizer || null,
      data.description || null,
      data.metadata ? JSON.stringify(data.metadata) : '{}'
    ]
  );
  return result.rows[0];
}

export async function getTournamentById(tournamentId: string): Promise<Tournament | null> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT * FROM tournaments WHERE id = $1`,
    [tournamentId]
  );
  return result.rows[0] || null;
}

export async function listTournaments(params?: {
  type?: Tournament['tournament_type'];
  year?: number;
  limit?: number;
  offset?: number;
}): Promise<Tournament[]> {
  const pool = getPool();
  let query = 'SELECT * FROM tournaments WHERE 1=1';
  const values: (string | number)[] = [];
  let paramCount = 0;

  if (params?.type) {
    paramCount++;
    query += ` AND tournament_type = $${paramCount}`;
    values.push(params.type);
  }

  if (params?.year) {
    paramCount++;
    query += ` AND EXTRACT(YEAR FROM start_date) = $${paramCount}`;
    values.push(params.year);
  }

  query += ' ORDER BY start_date DESC';

  if (params?.limit) {
    paramCount++;
    query += ` LIMIT $${paramCount}`;
    values.push(params.limit);
  }

  if (params?.offset) {
    paramCount++;
    query += ` OFFSET $${paramCount}`;
    values.push(params.offset);
  }

  const result = await pool.query(query, values);
  return result.rows;
}

export async function deleteTournament(tournamentId: string): Promise<void> {
  const pool = getPool();
  // The CASCADE in the foreign key constraints will automatically delete:
  // - tournament_players
  // - tournament_rounds
  // - tournament_games
  await pool.query(
    `DELETE FROM tournaments WHERE id = $1`,
    [tournamentId]
  );
}

// Player operations
export async function upsertPlayer(data: {
  fide_id: string;
  full_name: string;
  country_code?: string;
  title?: string;
  birth_year?: number;
  profile_photo_url?: string;
  fide_profile_url?: string;
  metadata?: JsonValue;
}): Promise<Player> {
  const pool = getPool();
  const result = await pool.query(
    `INSERT INTO players (fide_id, full_name, country_code, title, birth_year, profile_photo_url, fide_profile_url, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (fide_id)
     DO UPDATE SET
       full_name = EXCLUDED.full_name,
       country_code = COALESCE(EXCLUDED.country_code, players.country_code),
       title = COALESCE(EXCLUDED.title, players.title),
       birth_year = COALESCE(EXCLUDED.birth_year, players.birth_year),
       profile_photo_url = COALESCE(EXCLUDED.profile_photo_url, players.profile_photo_url),
       fide_profile_url = COALESCE(EXCLUDED.fide_profile_url, players.fide_profile_url),
       metadata = COALESCE(EXCLUDED.metadata, players.metadata),
       updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [
      data.fide_id,
      data.full_name,
      data.country_code || null,
      data.title || null,
      data.birth_year || null,
      data.profile_photo_url || null,
      data.fide_profile_url || null,
      data.metadata ? JSON.stringify(data.metadata) : '{}'
    ]
  );
  return result.rows[0];
}

export async function getPlayerById(fideId: string): Promise<Player | null> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT * FROM players WHERE fide_id = $1`,
    [fideId]
  );
  return result.rows[0] || null;
}

export async function searchPlayers(searchTerm: string, limit: number = 20): Promise<Player[]> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT * FROM players
     WHERE full_name ILIKE $1
     ORDER BY full_name
     LIMIT $2`,
    [`%${searchTerm}%`, limit]
  );
  return result.rows;
}

// Tournament-Player operations
export async function addPlayerToTournament(
  tournamentId: string,
  fideId: string,
  startingRating?: number,
  seedNumber?: number
): Promise<TournamentPlayer> {
  const pool = getPool();
  const result = await pool.query(
    `INSERT INTO tournament_players (tournament_id, fide_id, starting_rating, seed_number)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (tournament_id, fide_id) DO NOTHING
     RETURNING *`,
    [tournamentId, fideId, startingRating || null, seedNumber || null]
  );
  return result.rows[0];
}

export async function getTournamentPlayers(tournamentId: string): Promise<(TournamentPlayer & Player)[]> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT tp.*, p.full_name, p.country_code, p.title
     FROM tournament_players tp
     JOIN players p ON tp.fide_id = p.fide_id
     WHERE tp.tournament_id = $1
     ORDER BY tp.final_rank ASC NULLS LAST, tp.final_score DESC NULLS LAST`,
    [tournamentId]
  );
  return result.rows;
}

export async function updateTournamentPlayerScore(
  tournamentId: string,
  fideId: string,
  finalScore: number,
  finalRank?: number,
  metadata?: JsonValue
): Promise<TournamentPlayer> {
  const pool = getPool();
  const result = await pool.query(
    `UPDATE tournament_players
     SET final_score = $3, final_rank = $4, metadata = $5, updated_at = CURRENT_TIMESTAMP
     WHERE tournament_id = $1 AND fide_id = $2
     RETURNING *`,
    [
      tournamentId,
      fideId,
      finalScore,
      finalRank || null,
      metadata ? JSON.stringify(metadata) : '{}'
    ]
  );
  return result.rows[0];
}

// Tournament Round operations
export async function createTournamentRound(
  tournamentId: string,
  roundNumber: number,
  roundDate?: string,
  roundName?: string
): Promise<TournamentRound> {
  const pool = getPool();
  const result = await pool.query(
    `INSERT INTO tournament_rounds (tournament_id, round_number, round_date, round_name)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [tournamentId, roundNumber, roundDate || null, roundName || null]
  );
  return result.rows[0];
}

export async function getTournamentRounds(tournamentId: string): Promise<TournamentRound[]> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT * FROM tournament_rounds WHERE tournament_id = $1 ORDER BY round_number ASC`,
    [tournamentId]
  );
  return result.rows;
}

export async function getTournamentRoundByNumber(
  tournamentId: string,
  roundNumber: number
): Promise<TournamentRound | null> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT * FROM tournament_rounds WHERE tournament_id = $1 AND round_number = $2`,
    [tournamentId, roundNumber]
  );
  return result.rows[0] || null;
}

// Tournament Game operations
export async function linkGameToTournament(
  tournamentId: string,
  roundId: string,
  gameId: string,
  whiteFideId: string,
  blackFideId: string,
  result: TournamentGame['result'],
  boardNumber?: number,
  gameDate?: string,
  metadata?: JsonValue
): Promise<TournamentGame> {
  const pool = getPool();
  const resultData = await pool.query(
    `INSERT INTO tournament_games (tournament_id, round_id, game_id, white_fide_id, black_fide_id, result, board_number, game_date, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      tournamentId,
      roundId,
      gameId,
      whiteFideId,
      blackFideId,
      result,
      boardNumber || null,
      gameDate || null,
      metadata ? JSON.stringify(metadata) : '{}'
    ]
  );
  return resultData.rows[0];
}

export async function getTournamentGames(tournamentId: string): Promise<TournamentGame[]> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT tg.*, tr.round_number
     FROM tournament_games tg
     JOIN tournament_rounds tr ON tg.round_id = tr.id
     WHERE tg.tournament_id = $1
     ORDER BY tr.round_number ASC, tg.board_number ASC NULLS LAST`,
    [tournamentId]
  );
  return result.rows;
}

export async function getRoundGames(roundId: string): Promise<TournamentGame[]> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT * FROM tournament_games WHERE round_id = $1 ORDER BY board_number ASC NULLS LAST`,
    [roundId]
  );
  return result.rows;
}

export async function getPlayerTournamentGames(
  tournamentId: string,
  fideId: string
): Promise<TournamentGame[]> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT tg.*, tr.round_number
     FROM tournament_games tg
     JOIN tournament_rounds tr ON tg.round_id = tr.id
     WHERE tg.tournament_id = $1 AND (tg.white_fide_id = $2 OR tg.black_fide_id = $2)
     ORDER BY tr.round_number ASC`,
    [tournamentId, fideId]
  );
  return result.rows;
}

// Calculate tournament standings
export async function calculateTournamentStandings(tournamentId: string): Promise<void> {
  const pool = getPool();

  // Calculate scores for each player
  await pool.query(
    `UPDATE tournament_players tp
     SET final_score = (
       SELECT COALESCE(SUM(
         CASE
           WHEN tg.white_fide_id = tp.fide_id AND tg.result = '1-0' THEN 1
           WHEN tg.black_fide_id = tp.fide_id AND tg.result = '0-1' THEN 1
           WHEN tg.result = '1/2-1/2' THEN 0.5
           ELSE 0
         END
       ), 0)
       FROM tournament_games tg
       WHERE tg.tournament_id = tp.tournament_id
       AND (tg.white_fide_id = tp.fide_id OR tg.black_fide_id = tp.fide_id)
     )
     WHERE tp.tournament_id = $1`,
    [tournamentId]
  );

  // Calculate ranks based on scores
  await pool.query(
    `UPDATE tournament_players tp
     SET final_rank = rankings.rank
     FROM (
       SELECT fide_id, RANK() OVER (ORDER BY final_score DESC, starting_rating DESC NULLS LAST) as rank
       FROM tournament_players
       WHERE tournament_id = $1
     ) rankings
     WHERE tp.fide_id = rankings.fide_id AND tp.tournament_id = $1`,
    [tournamentId]
  );
}

// ===== Tournament Videos =====

export interface TournamentVideo {
  id: string;
  user_id: string;
  tournament_id: string;
  video_type: 'tournament_overview' | 'round_overview' | 'player_overview';
  round_id: string | null;
  player_fide_id: string | null;
  composition_type: string;
  status: 'pending' | 'generating_script' | 'rendering' | 'completed' | 'failed';
  s3_url: string | null;
  ai_script: JsonValue;
  selected_game_id: string | null;
  start_time: string;
  end_time: string | null;
  error: string | null;
  metadata: JsonValue;
  created_at: string;
  updated_at: string;
}

// Player Lookup Interfaces
export interface PlayerProfile {
  id: string;
  username: string;
  platform: 'chess_com' | 'lichess';
  platform_user_id: string | null;
  display_name: string | null;
  country: string | null;
  joined_date: string | null;
  avatar_url: string | null;
  profile_url: string | null;
  ratings: JsonValue;
  last_analysis_date: string | null;
  total_games_analyzed: number;
  analysis_in_progress: boolean;
  fide_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlayerGame {
  id: string;
  player_profile_id: string;
  chess_analysis_id: string | null;
  platform_game_id: string;
  platform: 'chess_com' | 'lichess';
  game_url: string | null;
  pgn: string;
  time_control: string | null;
  time_class: string | null;
  rated: boolean | null;
  variant: string;
  white_username: string;
  white_rating: number | null;
  black_username: string;
  black_rating: number | null;
  player_color: 'white' | 'black';
  result: string | null;
  termination: string | null;
  opening_eco: string | null;
  opening_name: string | null;
  opening_variation: string | null;
  played_at: string;
  moves_count: number | null;
  analysis_status: 'pending' | 'analyzing' | 'completed' | 'failed' | 'skipped';
  analysis_queued_at: string | null;
  analysis_completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlayerGameInsight {
  id: string;
  player_game_id: string;
  chess_analysis_id: string | null;
  average_centipawn_loss: number | null;
  accuracy_percentage: number | null;
  blunders_count: number;
  mistakes_count: number;
  inaccuracies_count: number;
  brilliant_moves_count: number;
  best_moves_count: number;
  game_changing_blunder: JsonValue;
  missed_wins: JsonValue;
  brilliant_moment: JsonValue;
  expected_result: number | null;
  actual_result: number | null;
  result_surprise: number | null;
  opening_phase_eval: number | null;
  opening_advantage: boolean | null;
  created_at: string;
}

export interface PlayerOpeningStat {
  id: string;
  player_profile_id: string;
  opening_eco: string;
  opening_name: string;
  player_color: 'white' | 'black';
  time_class: string | null;
  total_games: number;
  wins: number;
  draws: number;
  losses: number;
  win_rate: number | null;
  average_accuracy: number | null;
  average_centipawn_loss: number | null;
  average_opponent_rating: number | null;
  rating_performance: number | null;
  last_played_at: string | null;
  first_played_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AnalysisQueueItem {
  id: string;
  player_game_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'retry';
  priority: number;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  queued_at: string;
  started_at: string | null;
  completed_at: string | null;
}

// ===========================
// Player Lookup CRUD Functions
// ===========================

/**
 * Create or update a player profile
 */
export async function upsertPlayerProfile(data: {
  username: string;
  platform: 'chess_com' | 'lichess';
  platform_user_id?: string;
  display_name?: string;
  country?: string;
  joined_date?: string;
  avatar_url?: string;
  profile_url?: string;
  ratings?: JsonValue;
  fide_id?: string;
}): Promise<PlayerProfile> {
  const pool = getPool();
  const result = await pool.query(
    `INSERT INTO player_profiles (
       username, platform, platform_user_id, display_name, country,
       joined_date, avatar_url, profile_url, ratings, fide_id
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (username, platform)
     DO UPDATE SET
       platform_user_id = COALESCE(EXCLUDED.platform_user_id, player_profiles.platform_user_id),
       display_name = COALESCE(EXCLUDED.display_name, player_profiles.display_name),
       country = COALESCE(EXCLUDED.country, player_profiles.country),
       joined_date = COALESCE(EXCLUDED.joined_date, player_profiles.joined_date),
       avatar_url = COALESCE(EXCLUDED.avatar_url, player_profiles.avatar_url),
       profile_url = COALESCE(EXCLUDED.profile_url, player_profiles.profile_url),
       ratings = COALESCE(EXCLUDED.ratings, player_profiles.ratings),
       fide_id = COALESCE(EXCLUDED.fide_id, player_profiles.fide_id),
       updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [
      data.username,
      data.platform,
      data.platform_user_id || null,
      data.display_name || null,
      data.country || null,
      data.joined_date || null,
      data.avatar_url || null,
      data.profile_url || null,
      data.ratings ? JSON.stringify(data.ratings) : null,
      data.fide_id || null,
    ]
  );
  return result.rows[0];
}

/**
 * Get player profile by username and platform
 */
export async function getPlayerProfile(
  username: string,
  platform: 'chess_com' | 'lichess'
): Promise<PlayerProfile | null> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT * FROM player_profiles WHERE username = $1 AND platform = $2`,
    [username, platform]
  );
  return result.rows[0] || null;
}

/**
 * Get player profile by ID
 */
export async function getPlayerProfileById(id: string): Promise<PlayerProfile | null> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT * FROM player_profiles WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

/**
 * Update player profile analysis status
 */
export async function updatePlayerProfileAnalysisStatus(
  profileId: string,
  updates: {
    analysis_in_progress?: boolean;
    last_analysis_date?: string;
    total_games_analyzed?: number;
  }
): Promise<PlayerProfile> {
  const pool = getPool();
  const setClauses: string[] = ['updated_at = CURRENT_TIMESTAMP'];
  const values: (string | boolean | number)[] = [profileId];
  let paramIndex = 2;

  if (updates.analysis_in_progress !== undefined) {
    setClauses.push(`analysis_in_progress = $${paramIndex++}`);
    values.push(updates.analysis_in_progress);
  }
  if (updates.last_analysis_date !== undefined) {
    setClauses.push(`last_analysis_date = $${paramIndex++}`);
    values.push(updates.last_analysis_date);
  }
  if (updates.total_games_analyzed !== undefined) {
    setClauses.push(`total_games_analyzed = $${paramIndex++}`);
    values.push(updates.total_games_analyzed);
  }

  const result = await pool.query(
    `UPDATE player_profiles SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
    values
  );
  return result.rows[0];
}

/**
 * Create a player game record
 */
export async function createPlayerGame(data: {
  player_profile_id: string;
  platform_game_id: string;
  platform: 'chess_com' | 'lichess';
  game_url?: string;
  pgn: string;
  time_control?: string;
  time_class?: string;
  rated?: boolean;
  variant?: string;
  white_username: string;
  white_rating?: number;
  black_username: string;
  black_rating?: number;
  player_color: 'white' | 'black';
  result?: string;
  termination?: string;
  opening_eco?: string;
  opening_name?: string;
  opening_variation?: string;
  played_at: string;
  moves_count?: number;
}): Promise<PlayerGame> {
  const pool = getPool();
  const result = await pool.query(
    `INSERT INTO player_games (
       player_profile_id, platform_game_id, platform, game_url, pgn,
       time_control, time_class, rated, variant,
       white_username, white_rating, black_username, black_rating,
       player_color, result, termination,
       opening_eco, opening_name, opening_variation,
       played_at, moves_count, analysis_status
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, 'pending')
     ON CONFLICT (platform, platform_game_id) DO NOTHING
     RETURNING *`,
    [
      data.player_profile_id,
      data.platform_game_id,
      data.platform,
      data.game_url || null,
      data.pgn,
      data.time_control || null,
      data.time_class || null,
      data.rated ?? null,
      data.variant || 'standard',
      data.white_username,
      data.white_rating || null,
      data.black_username,
      data.black_rating || null,
      data.player_color,
      data.result || null,
      data.termination || null,
      data.opening_eco || null,
      data.opening_name || null,
      data.opening_variation || null,
      data.played_at,
      data.moves_count || null,
    ]
  );
  return result.rows[0];
}

/**
 * Get player games by profile ID
 */
export async function getPlayerGames(
  profileId: string,
  options?: {
    limit?: number;
    offset?: number;
    analysisStatus?: PlayerGame['analysis_status'];
  }
): Promise<PlayerGame[]> {
  const pool = getPool();
  let query = `SELECT * FROM player_games WHERE player_profile_id = $1`;
  const values: (string | number)[] = [profileId];
  let paramIndex = 2;

  if (options?.analysisStatus) {
    query += ` AND analysis_status = $${paramIndex++}`;
    values.push(options.analysisStatus);
  }

  query += ` ORDER BY played_at DESC`;

  if (options?.limit) {
    query += ` LIMIT $${paramIndex++}`;
    values.push(options.limit);
  }

  if (options?.offset) {
    query += ` OFFSET $${paramIndex++}`;
    values.push(options.offset);
  }

  const result = await pool.query(query, values);
  return result.rows;
}

/**
 * Get a single player game by ID
 */
export async function getPlayerGameById(gameId: string): Promise<PlayerGame | null> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT * FROM player_games WHERE id = $1`,
    [gameId]
  );
  return result.rows[0] || null;
}

/**
 * Update player game analysis status
 */
export async function updatePlayerGameAnalysisStatus(
  gameId: string,
  status: PlayerGame['analysis_status'],
  updates?: {
    chess_analysis_id?: string;
    analysis_queued_at?: string;
    analysis_completed_at?: string;
  }
): Promise<PlayerGame> {
  const pool = getPool();
  const setClauses: string[] = ['analysis_status = $2', 'updated_at = CURRENT_TIMESTAMP'];
  const values: (string | PlayerGame['analysis_status'])[] = [gameId, status];
  let paramIndex = 3;

  if (updates?.chess_analysis_id) {
    setClauses.push(`chess_analysis_id = $${paramIndex++}`);
    values.push(updates.chess_analysis_id);
  }
  if (updates?.analysis_queued_at) {
    setClauses.push(`analysis_queued_at = $${paramIndex++}`);
    values.push(updates.analysis_queued_at);
  }
  if (updates?.analysis_completed_at) {
    setClauses.push(`analysis_completed_at = $${paramIndex++}`);
    values.push(updates.analysis_completed_at);
  }

  const result = await pool.query(
    `UPDATE player_games SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
    values
  );
  return result.rows[0];
}

/**
 * Create player game insights
 */
export async function createPlayerGameInsight(data: {
  player_game_id: string;
  chess_analysis_id?: string;
  average_centipawn_loss?: number;
  accuracy_percentage?: number;
  blunders_count?: number;
  mistakes_count?: number;
  inaccuracies_count?: number;
  brilliant_moves_count?: number;
  best_moves_count?: number;
  game_changing_blunder?: JsonValue;
  missed_wins?: JsonValue;
  brilliant_moment?: JsonValue;
  expected_result?: number;
  actual_result?: number;
  result_surprise?: number;
  opening_phase_eval?: number;
  opening_advantage?: boolean;
}): Promise<PlayerGameInsight> {
  const pool = getPool();
  const result = await pool.query(
    `INSERT INTO player_game_insights (
       player_game_id, chess_analysis_id,
       average_centipawn_loss, accuracy_percentage,
       blunders_count, mistakes_count, inaccuracies_count,
       brilliant_moves_count, best_moves_count,
       game_changing_blunder, missed_wins, brilliant_moment,
       expected_result, actual_result, result_surprise,
       opening_phase_eval, opening_advantage
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
     ON CONFLICT (player_game_id) DO UPDATE SET
       chess_analysis_id = COALESCE(EXCLUDED.chess_analysis_id, player_game_insights.chess_analysis_id),
       average_centipawn_loss = COALESCE(EXCLUDED.average_centipawn_loss, player_game_insights.average_centipawn_loss),
       accuracy_percentage = COALESCE(EXCLUDED.accuracy_percentage, player_game_insights.accuracy_percentage),
       blunders_count = EXCLUDED.blunders_count,
       mistakes_count = EXCLUDED.mistakes_count,
       inaccuracies_count = EXCLUDED.inaccuracies_count,
       brilliant_moves_count = EXCLUDED.brilliant_moves_count,
       best_moves_count = EXCLUDED.best_moves_count,
       game_changing_blunder = COALESCE(EXCLUDED.game_changing_blunder, player_game_insights.game_changing_blunder),
       missed_wins = COALESCE(EXCLUDED.missed_wins, player_game_insights.missed_wins),
       brilliant_moment = COALESCE(EXCLUDED.brilliant_moment, player_game_insights.brilliant_moment),
       expected_result = COALESCE(EXCLUDED.expected_result, player_game_insights.expected_result),
       actual_result = COALESCE(EXCLUDED.actual_result, player_game_insights.actual_result),
       result_surprise = COALESCE(EXCLUDED.result_surprise, player_game_insights.result_surprise),
       opening_phase_eval = COALESCE(EXCLUDED.opening_phase_eval, player_game_insights.opening_phase_eval),
       opening_advantage = COALESCE(EXCLUDED.opening_advantage, player_game_insights.opening_advantage)
     RETURNING *`,
    [
      data.player_game_id,
      data.chess_analysis_id || null,
      data.average_centipawn_loss || null,
      data.accuracy_percentage || null,
      data.blunders_count || 0,
      data.mistakes_count || 0,
      data.inaccuracies_count || 0,
      data.brilliant_moves_count || 0,
      data.best_moves_count || 0,
      data.game_changing_blunder ? JSON.stringify(data.game_changing_blunder) : null,
      data.missed_wins ? JSON.stringify(data.missed_wins) : null,
      data.brilliant_moment ? JSON.stringify(data.brilliant_moment) : null,
      data.expected_result || null,
      data.actual_result || null,
      data.result_surprise || null,
      data.opening_phase_eval || null,
      data.opening_advantage || null,
    ]
  );
  return result.rows[0];
}

/**
 * Get insights for a player game
 */
export async function getPlayerGameInsight(gameId: string): Promise<PlayerGameInsight | null> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT * FROM player_game_insights WHERE player_game_id = $1`,
    [gameId]
  );
  return result.rows[0] || null;
}

/**
 * Upsert opening stats (aggregate statistics per opening)
 */
export async function upsertPlayerOpeningStat(data: {
  player_profile_id: string;
  opening_eco: string;
  opening_name: string;
  player_color: 'white' | 'black';
  time_class?: string;
  total_games: number;
  wins: number;
  draws: number;
  losses: number;
  win_rate?: number;
  average_accuracy?: number;
  average_centipawn_loss?: number;
  average_opponent_rating?: number;
  rating_performance?: number;
  last_played_at?: string;
  first_played_at?: string;
}): Promise<PlayerOpeningStat> {
  const pool = getPool();
  const result = await pool.query(
    `INSERT INTO player_opening_stats (
       player_profile_id, opening_eco, opening_name, player_color, time_class,
       total_games, wins, draws, losses, win_rate,
       average_accuracy, average_centipawn_loss, average_opponent_rating,
       rating_performance, last_played_at, first_played_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
     ON CONFLICT (player_profile_id, opening_eco, player_color, time_class)
     DO UPDATE SET
       opening_name = EXCLUDED.opening_name,
       total_games = EXCLUDED.total_games,
       wins = EXCLUDED.wins,
       draws = EXCLUDED.draws,
       losses = EXCLUDED.losses,
       win_rate = EXCLUDED.win_rate,
       average_accuracy = EXCLUDED.average_accuracy,
       average_centipawn_loss = EXCLUDED.average_centipawn_loss,
       average_opponent_rating = EXCLUDED.average_opponent_rating,
       rating_performance = EXCLUDED.rating_performance,
       last_played_at = EXCLUDED.last_played_at,
       first_played_at = LEAST(player_opening_stats.first_played_at, EXCLUDED.first_played_at),
       updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [
      data.player_profile_id,
      data.opening_eco,
      data.opening_name,
      data.player_color,
      data.time_class || null,
      data.total_games,
      data.wins,
      data.draws,
      data.losses,
      data.win_rate || null,
      data.average_accuracy || null,
      data.average_centipawn_loss || null,
      data.average_opponent_rating || null,
      data.rating_performance || null,
      data.last_played_at || null,
      data.first_played_at || null,
    ]
  );
  return result.rows[0];
}

/**
 * Get opening stats for a player profile
 */
export async function getPlayerOpeningStats(
  profileId: string,
  options?: {
    color?: 'white' | 'black';
    timeClass?: string;
    minGames?: number;
  }
): Promise<PlayerOpeningStat[]> {
  const pool = getPool();
  let query = `SELECT * FROM player_opening_stats WHERE player_profile_id = $1`;
  const values: (string | number)[] = [profileId];
  let paramIndex = 2;

  if (options?.color) {
    query += ` AND player_color = $${paramIndex++}`;
    values.push(options.color);
  }

  if (options?.timeClass) {
    query += ` AND time_class = $${paramIndex++}`;
    values.push(options.timeClass);
  }

  if (options?.minGames) {
    query += ` AND total_games >= $${paramIndex++}`;
    values.push(options.minGames);
  }

  query += ` ORDER BY total_games DESC, win_rate DESC`;

  const result = await pool.query(query, values);
  return result.rows;
}

/**
 * Add item to analysis queue
 */
export async function queueGameForAnalysis(
  playerGameId: string,
  priority: number = 5
): Promise<AnalysisQueueItem> {
  const pool = getPool();
  const result = await pool.query(
    `INSERT INTO analysis_queue (player_game_id, status, priority, attempts, max_attempts)
     VALUES ($1, 'pending', $2, 0, 3)
     ON CONFLICT (player_game_id) DO NOTHING
     RETURNING *`,
    [playerGameId, priority]
  );
  return result.rows[0];
}

/**
 * Get next pending items from analysis queue
 */
export async function getNextQueueItems(limit: number = 10): Promise<AnalysisQueueItem[]> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT * FROM analysis_queue
     WHERE status IN ('pending', 'retry')
       AND attempts < max_attempts
     ORDER BY priority DESC, queued_at ASC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}

/**
 * Update analysis queue item status
 */
export async function updateQueueItemStatus(
  queueItemId: string,
  status: AnalysisQueueItem['status'],
  updates?: {
    last_error?: string;
    started_at?: string;
    completed_at?: string;
  }
): Promise<AnalysisQueueItem> {
  const pool = getPool();
  const setClauses: string[] = ['status = $2'];
  const values: (string | AnalysisQueueItem['status'])[] = [queueItemId, status];
  let paramIndex = 3;

  if (status === 'processing') {
    setClauses.push('attempts = attempts + 1');
  }

  if (updates?.last_error) {
    setClauses.push(`last_error = $${paramIndex++}`);
    values.push(updates.last_error);
  }
  if (updates?.started_at) {
    setClauses.push(`started_at = $${paramIndex++}`);
    values.push(updates.started_at);
  }
  if (updates?.completed_at) {
    setClauses.push(`completed_at = $${paramIndex++}`);
    values.push(updates.completed_at);
  }

  const result = await pool.query(
    `UPDATE analysis_queue SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
    values
  );
  return result.rows[0];
}

export async function createTournamentVideo(
  userId: string,
  tournamentId: string,
  videoType: TournamentVideo['video_type'],
  options?: {
    roundId?: string;
    playerFideId?: string;
    compositionType?: string;
  }
): Promise<TournamentVideo> {
  const pool = getPool();
  const result = await pool.query(
    `INSERT INTO tournament_videos (user_id, tournament_id, video_type, round_id, player_fide_id, composition_type, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'pending')
     RETURNING *`,
    [
      userId,
      tournamentId,
      videoType,
      options?.roundId || null,
      options?.playerFideId || null,
      options?.compositionType || videoType,
    ]
  );
  return result.rows[0];
}

export async function getTournamentVideo(videoId: string): Promise<TournamentVideo | null> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT * FROM tournament_videos WHERE id = $1`,
    [videoId]
  );
  return result.rows[0] || null;
}

export async function getTournamentVideos(tournamentId: string): Promise<TournamentVideo[]> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT * FROM tournament_videos WHERE tournament_id = $1 ORDER BY created_at DESC`,
    [tournamentId]
  );
  return result.rows;
}

export async function updateTournamentVideoStatus(
  videoId: string,
  status: TournamentVideo['status'],
  updates?: {
    s3Url?: string;
    error?: string;
    aiScript?: JsonValue;
    selectedGameId?: string;
    metadata?: JsonValue;
  }
): Promise<TournamentVideo> {
  const pool = getPool();
  const updateFields: string[] = ['status = $2', 'updated_at = CURRENT_TIMESTAMP'];
  const values: unknown[] = [videoId, status];
  let paramCount = 2;

  if (status === 'completed' || status === 'failed') {
    updateFields.push('end_time = CURRENT_TIMESTAMP');
  }

  if (updates?.s3Url) {
    paramCount++;
    updateFields.push(`s3_url = $${paramCount}`);
    values.push(updates.s3Url);
  }

  if (updates?.error) {
    paramCount++;
    updateFields.push(`error = $${paramCount}`);
    values.push(updates.error);
  }

  if (updates?.aiScript) {
    paramCount++;
    updateFields.push(`ai_script = $${paramCount}`);
    values.push(JSON.stringify(updates.aiScript));
  }

  if (updates?.selectedGameId) {
    paramCount++;
    updateFields.push(`selected_game_id = $${paramCount}`);
    values.push(updates.selectedGameId);
  }

  if (updates?.metadata) {
    paramCount++;
    updateFields.push(`metadata = $${paramCount}`);
    values.push(JSON.stringify(updates.metadata));
  }

  const result = await pool.query(
    `UPDATE tournament_videos SET ${updateFields.join(', ')} WHERE id = $1 RETURNING *`,
    values
  );
  return result.rows[0];
}
