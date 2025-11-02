#!/usr/bin/env node

/**
 * Test Player Lookup Services
 * Run with: node scripts/test-player-lookup.mjs
 *
 * This script tests the complete player lookup workflow:
 * 1. Import player profile and games
 * 2. Queue games for analysis
 * 3. Calculate insights
 * 4. Aggregate opening stats
 */

import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🧪 Testing Player Lookup Services\n');
console.log('═══════════════════════════════════════════════════════════\n');

// Test 1: Check if database tables exist
console.log('📦 Test 1: Verifying database tables...');

try {
  const { getPool } = await import('../src/lib/db.ts');
  const pool = getPool();

  const tableCheck = await pool.query(`
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

  const foundTables = tableCheck.rows.map(r => r.table_name);
  const requiredTables = [
    'player_profiles',
    'player_games',
    'player_game_insights',
    'player_opening_stats',
    'analysis_queue',
  ];

  console.log(`   Found ${foundTables.length}/${requiredTables.length} required tables:`);
  for (const table of requiredTables) {
    const exists = foundTables.includes(table);
    console.log(`   ${exists ? '✅' : '❌'} ${table}`);
  }

  if (foundTables.length !== requiredTables.length) {
    throw new Error('Not all required tables exist');
  }

  console.log('   ✅ All database tables verified\n');
} catch (error) {
  console.error('   ❌ Database verification failed:', error.message);
  process.exit(1);
}

// Test 2: Import player profile (without games for speed)
console.log('📦 Test 2: Importing player profile...');

try {
  const { getOrCreateProfile } = await import(
    '../src/lib/player-lookup/game-importer.ts'
  );

  console.log('   Testing Chess.com profile import...');
  const chessComProfile = await getOrCreateProfile('hikaru', 'chess_com');
  console.log(`   ✅ Chess.com profile: ${chessComProfile.username} (ID: ${chessComProfile.id})`);
  console.log(`      Ratings: ${JSON.stringify(chessComProfile.ratings)}`);

  console.log('   Testing Lichess profile import...');
  const lichessProfile = await getOrCreateProfile('DrNykterstein', 'lichess');
  console.log(`   ✅ Lichess profile: ${lichessProfile.username} (ID: ${lichessProfile.id})`);
  console.log(`      Ratings: ${JSON.stringify(lichessProfile.ratings)}`);

  console.log('   ✅ Profile import test passed\n');
} catch (error) {
  console.error('   ❌ Profile import failed:', error.message);
  process.exit(1);
}

// Test 3: Test CRUD operations
console.log('📦 Test 3: Testing database CRUD operations...');

try {
  const {
    getPlayerProfile,
    createPlayerGame,
    getPlayerGames,
    createPlayerGameInsight,
    getPlayerGameInsight,
    upsertPlayerOpeningStat,
    getPlayerOpeningStats,
  } = await import('../src/lib/db.ts');

  // Get the profile we just created
  const profile = await getPlayerProfile('hikaru', 'chess_com');
  console.log(`   Using profile: ${profile.username}`);

  // Test game creation
  const testGame = await createPlayerGame({
    player_profile_id: profile.id,
    platform_game_id: 'test_game_12345',
    platform: 'chess_com',
    pgn: '[Event "Test"]\n\n1. e4 e5',
    white_username: 'hikaru',
    black_username: 'opponent',
    player_color: 'white',
    played_at: new Date().toISOString(),
  });

  if (testGame) {
    console.log(`   ✅ Created test game: ${testGame.id}`);

    // Test insights creation
    const testInsight = await createPlayerGameInsight({
      player_game_id: testGame.id,
      accuracy_percentage: 95.5,
      average_centipawn_loss: 15,
      blunders_count: 0,
      mistakes_count: 1,
      inaccuracies_count: 2,
      brilliant_moves_count: 1,
      best_moves_count: 15,
    });

    console.log(`   ✅ Created test insight for game`);

    // Test opening stats
    const testOpeningStat = await upsertPlayerOpeningStat({
      player_profile_id: profile.id,
      opening_eco: 'C50',
      opening_name: 'Italian Game',
      player_color: 'white',
      time_class: 'blitz',
      total_games: 10,
      wins: 7,
      draws: 2,
      losses: 1,
      win_rate: 70,
    });

    console.log(`   ✅ Created test opening stat`);
  } else {
    console.log(`   ⚠️  Test game already exists (duplicate key)`);
  }

  console.log('   ✅ CRUD operations test passed\n');
} catch (error) {
  console.error('   ❌ CRUD operations failed:', error.message);
  console.error(error.stack);
  process.exit(1);
}

// Test 4: Test game importer (limited to 5 games for speed)
console.log('📦 Test 4: Testing game importer (5 games)...');

try {
  const { importFromChessCom } = await import(
    '../src/lib/player-lookup/game-importer.ts'
  );

  console.log('   Importing 5 games from Chess.com...');
  const importResult = await importFromChessCom('hikaru', 5);

  console.log(`   ✅ Import completed:`);
  console.log(`      Profile: ${importResult.profile.username}`);
  console.log(`      Games imported: ${importResult.gamesImported}`);
  console.log(`      Games duplicate: ${importResult.gamesDuplicate}`);
  console.log(`      Errors: ${importResult.errors.length}`);

  if (importResult.errors.length > 0) {
    console.log(`      Error details: ${importResult.errors.slice(0, 3).join(', ')}`);
  }

  console.log('   ✅ Game importer test passed\n');
} catch (error) {
  console.error('   ❌ Game importer failed:', error.message);
  process.exit(1);
}

// Test 5: Test queue operations
console.log('📦 Test 5: Testing analysis queue...');

try {
  const { queueGameForAnalysis, getNextQueueItems } = await import(
    '../src/lib/db.ts'
  );
  const { getPlayerGames } = await import('../src/lib/db.ts');
  const { getPlayerProfile } = await import('../src/lib/db.ts');

  const profile = await getPlayerProfile('hikaru', 'chess_com');
  const games = await getPlayerGames(profile.id, { limit: 3 });

  console.log(`   Queueing ${games.length} games for analysis...`);

  for (const game of games) {
    await queueGameForAnalysis(game.id, 5);
  }

  console.log(`   ✅ Queued ${games.length} games`);

  const queueItems = await getNextQueueItems(5);
  console.log(`   ✅ Queue has ${queueItems.length} pending items`);

  console.log('   ✅ Analysis queue test passed\n');
} catch (error) {
  console.error('   ❌ Analysis queue failed:', error.message);
  process.exit(1);
}

// Test 6: Test opening stats aggregation
console.log('📦 Test 6: Testing opening stats aggregation...');

try {
  const { getPlayerProfile } = await import('../src/lib/db.ts');
  const { aggregateOpeningStats, getBestOpenings } = await import(
    '../src/lib/player-lookup/opening-stats.ts'
  );

  const profile = await getPlayerProfile('hikaru', 'chess_com');

  console.log('   Aggregating opening stats...');
  const aggregateResult = await aggregateOpeningStats(profile.id);

  console.log(`   ✅ Aggregated ${aggregateResult.updated} openings`);
  if (aggregateResult.errors > 0) {
    console.log(`   ⚠️  ${aggregateResult.errors} errors during aggregation`);
  }

  // Get best openings
  if (aggregateResult.updated > 0) {
    const bestOpenings = await getBestOpenings(profile.id, {
      minGames: 1,
      limit: 3,
    });

    console.log(`   Best openings (top 3):`);
    for (const opening of bestOpenings) {
      console.log(
        `      ${opening.eco} ${opening.name} (${opening.color}): ` +
        `${opening.winRate.toFixed(1)}% (${opening.totalGames} games)`
      );
    }
  }

  console.log('   ✅ Opening stats aggregation test passed\n');
} catch (error) {
  console.error('   ❌ Opening stats aggregation failed:', error.message);
  console.error(error.stack);
  process.exit(1);
}

// Final summary
console.log('═══════════════════════════════════════════════════════════');
console.log('\n📊 Test Summary:\n');
console.log('   ✅ Database tables verified');
console.log('   ✅ Profile import working');
console.log('   ✅ CRUD operations working');
console.log('   ✅ Game importer working');
console.log('   ✅ Analysis queue working');
console.log('   ✅ Opening stats working');
console.log('\n🎉 All tests passed! Player lookup services are ready.\n');

console.log('📝 Next steps:');
console.log('   1. Create API endpoints for player lookup');
console.log('   2. Create frontend UI for player search');
console.log('   3. Implement background worker for analysis queue');
console.log('   4. Create dashboard for displaying insights');
console.log('');

process.exit(0);
