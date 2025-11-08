import { readFileSync } from 'fs';
import { join } from 'path';
import { getPool } from '../src/lib/db';

async function initializeDatabase() {
  console.log('🚀 Initializing database schema...\n');

  const pool = getPool();

  try {
    // Read the SQL migration file
    const migrationPath = join(__dirname, '..', 'migrations', '000_init_complete_schema.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    console.log('📄 Running migration: 000_init_complete_schema.sql');
    console.log('⏳ This may take a moment...\n');

    // Execute the migration
    await pool.query(migrationSQL);

    console.log('✅ Database schema initialized successfully!');
    console.log('');

    // Verify tables were created
    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log('📋 Created tables:');
    result.rows.forEach(row => {
      console.log(`   • ${row.table_name}`);
    });

    console.log('\n✅ Database initialization completed!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Database initialization failed:');
    console.error(`   ${error instanceof Error ? error.message : String(error)}\n`);

    if (error instanceof Error && 'position' in error) {
      const pgError = error as any;
      console.error('   SQL Error Details:');
      console.error(`   - Position: ${pgError.position}`);
      console.error(`   - Detail: ${pgError.detail || 'N/A'}`);
      console.error(`   - Hint: ${pgError.hint || 'N/A'}`);
    }

    process.exit(1);
  } finally {
    await pool.end();
  }
}

initializeDatabase();
