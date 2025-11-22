import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  host: '100.77.179.122',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'postgres',
});

async function checkTables() {
  try {
    // List all tables
    const tablesResult = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

    console.log('\n=== All Tables ===');
    console.log(tablesResult.rows.map(r => r.table_name).join('\n'));

    // For each table, get row count
    console.log('\n=== Table Row Counts ===');
    for (const row of tablesResult.rows) {
      const tableName = row.table_name;
      try {
        const countResult = await pool.query(`SELECT COUNT(*) FROM ${tableName}`);
        console.log(`${tableName}: ${countResult.rows[0].count} rows`);
      } catch (err) {
        console.log(`${tableName}: Error counting - ${err.message}`);
      }
    }

    // Check table columns for user_id to see which tables track users
    console.log('\n=== Tables with user_id column ===');
    const userIdTables = await pool.query(`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND column_name = 'user_id'
      ORDER BY table_name;
    `);
    console.log(userIdTables.rows.map(r => r.table_name).join('\n'));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkTables();
