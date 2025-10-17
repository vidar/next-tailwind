import { Pool } from "pg";

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
  game_data: any;
  analysis_config: {
    depth: number;
    find_alternatives: boolean;
  };
  analysis_results: any;
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
  metadata: any;
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
  const values: any[] = [videoId, status];
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
  metadata: any
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
