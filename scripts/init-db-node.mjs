#!/usr/bin/env node

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { Pool } = pg;

async function initDatabase() {
  console.log('🚀 Chess Moments Database Initialization (Node.js)');
  console.log('==================================================\n');

  // Database configuration
  const config = {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_HOST?.includes('neon.tech') ? { rejectUnauthorized: false } : false,
  };

  console.log('Database Configuration:');
  console.log(`  Host: ${config.host}`);
  console.log(`  Port: ${config.port}`);
  console.log(`  Database: ${config.database}`);
  console.log(`  User: ${config.user}`);
  console.log(`  SSL: ${config.ssl ? 'enabled' : 'disabled'}\n`);

  const pool = new Pool(config);

  try {
    // Test connection
    console.log('🔌 Testing database connection...');
    const client = await pool.connect();
    console.log('✅ Database connection successful!\n');

    // Read the migration file
    console.log('📝 Reading schema migration file...');
    const migrationPath = path.join(__dirname, '..', 'migrations', '000_init_complete_schema.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    console.log('✅ Migration file loaded\n');

    // Execute the migration
    console.log('🔨 Executing schema migration...');
    await client.query(migrationSQL);
    console.log('✅ Schema migration completed!\n');

    // Verify tables were created
    console.log('🔍 Verifying tables...');
    const result = await client.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);

    console.log(`\n✅ Database initialization complete!`);
    console.log(`\nTables created (${result.rows.length}):`);
    result.rows.forEach(row => {
      console.log(`  - ${row.tablename}`);
    });

    client.release();
    await pool.end();

    console.log('\n🎉 Your database is ready to use!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error initializing database:', error.message);
    console.error('\nFull error:', error);
    await pool.end();
    process.exit(1);
  }
}

initDatabase();
