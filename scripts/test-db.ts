import { getPool } from '../src/lib/db';

async function testDatabaseConnection() {
  console.log('🔄 Testing database connection...\n');

  const pool = getPool();

  try {
    // Test basic connection
    const client = await pool.connect();
    console.log('✅ Successfully connected to database!\n');

    // Get database info
    const versionResult = await client.query('SELECT version(), current_database(), current_user');
    const version = versionResult.rows[0];
    console.log('📊 Database Information:');
    console.log(`   Database: ${version.current_database}`);
    console.log(`   User: ${version.current_user}`);
    console.log(`   PostgreSQL: ${version.version.split(',')[0]}\n`);

    // List all tables
    const tablesResult = await client.query(`
      SELECT
        schemaname,
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);

    console.log('📋 Database Tables:');
    if (tablesResult.rows.length === 0) {
      console.log('   No tables found. Database may need initialization.\n');
    } else {
      tablesResult.rows.forEach(row => {
        console.log(`   • ${row.tablename} (${row.size})`);
      });
      console.log('');
    }

    // Test a simple query on chess_analyses if it exists
    if (tablesResult.rows.some(r => r.tablename === 'chess_analyses')) {
      const countResult = await client.query('SELECT COUNT(*) FROM chess_analyses');
      console.log(`📈 Statistics:`);
      console.log(`   Chess Analyses: ${countResult.rows[0].count}\n`);
    }

    client.release();

    console.log('✅ Database connection test completed successfully!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Database connection failed:');
    console.error(`   Error: ${error instanceof Error ? error.message : String(error)}\n`);

    if (error instanceof Error && 'code' in error) {
      const pgError = error as any;
      console.error('   Details:');
      console.error(`   - Code: ${pgError.code}`);
      console.error(`   - Detail: ${pgError.detail || 'N/A'}`);
      console.error(`   - Hint: ${pgError.hint || 'N/A'}`);
    }

    process.exit(1);
  } finally {
    await pool.end();
  }
}

testDatabaseConnection();
