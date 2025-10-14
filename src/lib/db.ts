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
