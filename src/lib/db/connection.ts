/**
 * PostgreSQL connection pool management
 */
import { Pool } from 'pg';

// Create a singleton pool instance
let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    const isNeon = process.env.DB_HOST?.includes('neon.tech');
    pool = new Pool({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      ssl: isNeon ? { rejectUnauthorized: false } : false,
    });
  }
  return pool;
}
