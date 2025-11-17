/**
 * Index existing database content into Meilisearch
 * Run with: npm run search:index
 */

import { config } from 'dotenv';
import { getPool } from '../src/lib/db';
import {
  initializeIndexes,
  indexGames,
  indexVideos,
  indexTournaments,
  indexPlayers,
} from '../src/lib/meilisearch';

config();

async function main() {
  console.log('🚀 Starting Meilisearch indexing...\n');

  // Step 1: Initialize indexes
  console.log('📝 Initializing Meilisearch indexes...');
  try {
    await initializeIndexes();
    console.log('✅ Indexes initialized successfully\n');
  } catch (error) {
    console.error('❌ Failed to initialize indexes:', error);
    throw error;
  }

  const pool = getPool();

  // Step 2: Index chess games
  console.log('♟️  Indexing chess games...');
  try {
    const gamesResult = await pool.query(`
      SELECT
        ca.id,
        ca.pgn,
        ca.game_data,
        ca.status,
        ca.created_at,
        (
          SELECT json_agg(json_build_object('annotation_text', ga.annotation_text))
          FROM game_annotations ga
          WHERE ga.game_id = ca.id
        ) as annotations,
        CASE
          WHEN tg.tournament_id IS NOT NULL THEN
            json_build_object('id', t.id, 'name', t.name)
          ELSE NULL
        END as tournament
      FROM chess_analyses ca
      LEFT JOIN tournament_games tg ON tg.game_id = ca.id
      LEFT JOIN tournaments t ON t.id = tg.tournament_id
      WHERE ca.status = 'completed'
      ORDER BY ca.created_at DESC
    `);

    await indexGames(gamesResult.rows);
    console.log(`✅ Indexed ${gamesResult.rows.length} chess games\n`);
  } catch (error) {
    console.error('❌ Failed to index games:', error);
  }

  // Step 3: Index videos
  console.log('🎥 Indexing videos...');
  try {
    const videosResult = await pool.query(`
      SELECT
        v.*,
        json_build_object('pgn', ca.pgn, 'game_data', ca.game_data) as game
      FROM videos v
      LEFT JOIN chess_analyses ca ON ca.id = v.game_id
      ORDER BY v.created_at DESC
    `);

    await indexVideos(videosResult.rows);
    console.log(`✅ Indexed ${videosResult.rows.length} videos\n`);
  } catch (error) {
    console.error('❌ Failed to index videos:', error);
  }

  // Step 4: Index tournaments
  console.log('🏆 Indexing tournaments...');
  try {
    const tournamentsResult = await pool.query(`
      SELECT
        t.*,
        (
          SELECT json_agg(json_build_object('full_name', p.full_name))
          FROM tournament_players tp
          JOIN players p ON p.fide_id = tp.fide_id
          WHERE tp.tournament_id = t.id
        ) as players,
        (
          SELECT json_agg(tg.*)
          FROM tournament_games tg
          WHERE tg.tournament_id = t.id
        ) as games
      FROM tournaments t
      ORDER BY t.start_date DESC
    `);

    await indexTournaments(tournamentsResult.rows);
    console.log(`✅ Indexed ${tournamentsResult.rows.length} tournaments\n`);
  } catch (error) {
    console.error('❌ Failed to index tournaments:', error);
  }

  // Step 5: Index players
  console.log('👤 Indexing players...');
  try {
    const fidePlayers = await pool.query(`
      SELECT * FROM players ORDER BY full_name ASC
    `);

    const platformPlayers = await pool.query(`
      SELECT * FROM player_profiles ORDER BY username ASC
    `);

    await indexPlayers(fidePlayers.rows, platformPlayers.rows);
    console.log(
      `✅ Indexed ${fidePlayers.rows.length} FIDE players and ${platformPlayers.rows.length} platform players\n`
    );
  } catch (error) {
    console.error('❌ Failed to index players:', error);
  }

  console.log('🎉 Meilisearch indexing completed!');
  await pool.end();
  process.exit(0);
}

main().catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
