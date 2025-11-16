/**
 * Video database operations
 */
import { getPool } from './connection';
import type { Video, JsonValue } from './types';

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
