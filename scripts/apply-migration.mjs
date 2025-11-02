#!/usr/bin/env node

/**
 * Apply database migration
 * Run with: node scripts/apply-migration.mjs migrations/002_player_lookup.sql
 */

import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get migration file from command line
const migrationFile = process.argv[2];

if (!migrationFile) {
  console.error('Usage: node scripts/apply-migration.mjs <migration-file>');
  console.error('Example: node scripts/apply-migration.mjs migrations/002_player_lookup.sql');
  process.exit(1);
}

// Database configuration from environment
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'postgres',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
};

async function applyMigration() {
  console.log('📦 Database Migration Tool\n');
  console.log('Configuration:');
  console.log(`  Host: ${dbConfig.host}:${dbConfig.port}`);
  console.log(`  Database: ${dbConfig.database}`);
  console.log(`  User: ${dbConfig.user}`);
  console.log(`  Migration: ${migrationFile}\n`);

  // Read migration file
  const migrationPath = join(process.cwd(), migrationFile);
  let sql;
  try {
    sql = readFileSync(migrationPath, 'utf8');
    console.log(`✅ Read migration file (${sql.length} characters)\n`);
  } catch (error) {
    console.error(`❌ Failed to read migration file: ${error.message}`);
    process.exit(1);
  }

  // Connect to database
  const client = new pg.Client(dbConfig);

  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected\n');

    console.log('🚀 Executing migration...');
    const startTime = Date.now();

    await client.query(sql);

    const duration = Date.now() - startTime;
    console.log(`✅ Migration completed in ${duration}ms\n`);

    // Verify tables were created
    console.log('🔍 Verifying created tables...');
    const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (
          'player_profiles',
          'player_games',
          'player_game_insights',
          'player_opening_stats',
          'analysis_queue'
        )
      ORDER BY table_name
    `);

    if (result.rows.length > 0) {
      console.log('✅ Verified tables:');
      result.rows.forEach(row => {
        console.log(`   - ${row.table_name}`);
      });
    } else {
      console.log('⚠️  No tables found (migration may have been idempotent)');
    }

    console.log('\n🎉 Migration applied successfully!\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    if (error.detail) {
      console.error('   Detail:', error.detail);
    }
    if (error.hint) {
      console.error('   Hint:', error.hint);
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration().catch(error => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
