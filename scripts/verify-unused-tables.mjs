import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  host: '100.77.179.122',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'postgres',
});

async function verifyUnusedTables() {
  try {
    const unusedTables = ['analysis_requests', 'user_sessions', 'users', 'video_generation_requests', 'schema_migrations'];

    console.log('=== UNUSED TABLES ANALYSIS ===\n');

    // Check for foreign key dependencies
    const fkCheck = await pool.query(`
      SELECT
          tc.table_name,
          tc.constraint_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
      AND (
        ccu.table_name = ANY($1::text[])
        OR tc.table_name = ANY($1::text[])
      )
    `, [unusedTables]);

    if (fkCheck.rows.length > 0) {
      console.log('⚠️  WARNING: Foreign key dependencies found:');
      console.log(fkCheck.rows);
      console.log('\nThese must be handled before dropping tables.\n');
    } else {
      console.log('✅ No foreign key dependencies found.\n');
    }

    // Show summary
    console.log('=== TABLES TO DROP ===\n');
    for (const table of unusedTables) {
      const countResult = await pool.query(`SELECT COUNT(*) FROM ${table}`);
      const count = countResult.rows[0].count;
      console.log(`${table}: ${count} rows`);
    }

    console.log('\n=== SQL TO EXECUTE ===\n');
    for (const table of unusedTables) {
      console.log(`DROP TABLE IF EXISTS ${table} CASCADE;`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

verifyUnusedTables();
