import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

export async function GET() {
  try {
    const pool = getPool();

    // Test connection
    const client = await pool.connect();

    // Check if tables exist
    const result = await client.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);

    client.release();

    return NextResponse.json({
      success: true,
      message: 'Database connection successful',
      tables: result.rows.map(r => r.tablename),
      tableCount: result.rows.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : undefined;

    return NextResponse.json({
      success: false,
      error: message,
      code,
    }, { status: 500 });
  }
}
