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
