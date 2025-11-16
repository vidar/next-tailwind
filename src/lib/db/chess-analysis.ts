/**
 * Chess Analysis database operations
 */
import { getPool } from './connection';
import type { ChessAnalysis, JsonValue } from './types';

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
