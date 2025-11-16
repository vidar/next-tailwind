/**
 * Game Annotations database operations
 */
import { getPool } from './connection';
import type { GameAnnotation } from './types';

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
