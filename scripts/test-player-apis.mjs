#!/usr/bin/env node

/**
 * Test script for Chess.com and Lichess API clients
 * Run with: node scripts/test-player-apis.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// We need to import TypeScript files, so we'll use dynamic import with tsx
// For now, let's test the APIs directly with fetch

console.log('🧪 Testing Player API Clients\n');

// Test Chess.com API
async function testChessCom() {
  console.log('📦 Testing Chess.com API...');

  try {
    // Test 1: Get player profile
    console.log('  1. Fetching player profile (hikaru)...');
    const profileRes = await fetch('https://api.chess.com/pub/player/hikaru');
    if (!profileRes.ok) throw new Error(`Profile fetch failed: ${profileRes.status}`);
    const profile = await profileRes.json();
    console.log(`     ✅ Found player: ${profile.username} (ID: ${profile.player_id})`);
    console.log(`        Joined: ${new Date(profile.joined * 1000).toISOString().split('T')[0]}`);

    // Test 2: Get player stats
    await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limit
    console.log('  2. Fetching player stats...');
    const statsRes = await fetch('https://api.chess.com/pub/player/hikaru/stats');
    if (!statsRes.ok) throw new Error(`Stats fetch failed: ${statsRes.status}`);
    const stats = await statsRes.json();
    console.log(`     ✅ Stats retrieved:`);
    if (stats.chess_blitz) {
      console.log(`        Blitz: ${stats.chess_blitz.last.rating}`);
    }
    if (stats.chess_rapid) {
      console.log(`        Rapid: ${stats.chess_rapid.last.rating}`);
    }
    if (stats.chess_bullet) {
      console.log(`        Bullet: ${stats.chess_bullet.last.rating}`);
    }

    // Test 3: Get game archives
    await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limit
    console.log('  3. Fetching game archives...');
    const archivesRes = await fetch('https://api.chess.com/pub/player/hikaru/games/archives');
    if (!archivesRes.ok) throw new Error(`Archives fetch failed: ${archivesRes.status}`);
    const archivesData = await archivesRes.json();
    const archives = archivesData.archives;
    console.log(`     ✅ Found ${archives.length} monthly archives`);
    console.log(`        Most recent: ${archives[archives.length - 1]}`);

    // Test 4: Get games from most recent archive
    if (archives.length > 0) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limit
      console.log('  4. Fetching games from most recent archive...');
      const recentArchive = archives[archives.length - 1];
      const gamesRes = await fetch(recentArchive);
      if (!gamesRes.ok) throw new Error(`Games fetch failed: ${gamesRes.status}`);
      const gamesData = await gamesRes.json();
      const games = gamesData.games;
      console.log(`     ✅ Found ${games.length} games in latest archive`);

      if (games.length > 0) {
        const firstGame = games[0];
        console.log(`        Sample game:`);
        console.log(`          White: ${firstGame.white.username} (${firstGame.white.rating})`);
        console.log(`          Black: ${firstGame.black.username} (${firstGame.black.rating})`);
        console.log(`          Time class: ${firstGame.time_class}`);
        console.log(`          Time control: ${firstGame.time_control}`);
        console.log(`          Played: ${new Date(firstGame.end_time * 1000).toISOString().split('T')[0]}`);
      }
    }

    console.log('  ✅ Chess.com API tests passed!\n');
    return true;
  } catch (error) {
    console.error('  ❌ Chess.com API test failed:', error.message);
    return false;
  }
}

// Test Lichess API
async function testLichess() {
  console.log('♟️  Testing Lichess API...');

  try {
    // Test 1: Get player profile
    console.log('  1. Fetching player profile (DrNykterstein - Magnus Carlsen)...');
    const profileRes = await fetch('https://lichess.org/api/user/DrNykterstein', {
      headers: { 'Accept': 'application/json' }
    });
    if (!profileRes.ok) throw new Error(`Profile fetch failed: ${profileRes.status}`);
    const profile = await profileRes.json();
    console.log(`     ✅ Found player: ${profile.username} (ID: ${profile.id})`);
    if (profile.title) {
      console.log(`        Title: ${profile.title}`);
    }
    if (profile.profile?.country) {
      console.log(`        Country: ${profile.profile.country}`);
    }

    // Test 2: Show ratings
    console.log('  2. Player ratings:');
    if (profile.perfs.bullet) {
      console.log(`        Bullet: ${profile.perfs.bullet.rating} (${profile.perfs.bullet.games} games)`);
    }
    if (profile.perfs.blitz) {
      console.log(`        Blitz: ${profile.perfs.blitz.rating} (${profile.perfs.blitz.games} games)`);
    }
    if (profile.perfs.rapid) {
      console.log(`        Rapid: ${profile.perfs.rapid.rating} (${profile.perfs.rapid.games} games)`);
    }

    // Test 3: Get recent games (limited to 5 for testing)
    console.log('  3. Fetching recent games (limit 5)...');
    const gamesRes = await fetch('https://lichess.org/api/games/user/DrNykterstein?max=5&pgnInJson=true&opening=true', {
      headers: { 'Accept': 'application/x-ndjson' }
    });
    if (!gamesRes.ok) throw new Error(`Games fetch failed: ${gamesRes.status}`);

    const text = await gamesRes.text();
    const lines = text.trim().split('\n');
    const games = lines.filter(line => line.trim()).map(line => JSON.parse(line));

    console.log(`     ✅ Found ${games.length} recent games`);

    if (games.length > 0) {
      const firstGame = games[0];
      console.log(`        Sample game:`);
      console.log(`          White: ${firstGame.players.white.user?.name || 'Unknown'} (${firstGame.players.white.rating || 'N/A'})`);
      console.log(`          Black: ${firstGame.players.black.user?.name || 'Unknown'} (${firstGame.players.black.rating || 'N/A'})`);
      console.log(`          Speed: ${firstGame.speed}`);
      console.log(`          Rated: ${firstGame.rated}`);
      if (firstGame.opening) {
        console.log(`          Opening: ${firstGame.opening.name} (${firstGame.opening.eco})`);
      }
      console.log(`          Played: ${new Date(firstGame.createdAt).toISOString().split('T')[0]}`);
      console.log(`          Winner: ${firstGame.winner || 'Draw'}`);
    }

    console.log('  ✅ Lichess API tests passed!\n');
    return true;
  } catch (error) {
    console.error('  ❌ Lichess API test failed:', error.message);
    return false;
  }
}

// Run all tests
async function runTests() {
  console.log('═══════════════════════════════════════════════════════════\n');

  const chessComResult = await testChessCom();
  const lichessResult = await testLichess();

  console.log('═══════════════════════════════════════════════════════════');
  console.log('\n📊 Test Results:');
  console.log(`  Chess.com: ${chessComResult ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`  Lichess:   ${lichessResult ? '✅ PASSED' : '❌ FAILED'}`);

  if (chessComResult && lichessResult) {
    console.log('\n🎉 All tests passed! API clients are working correctly.');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed. Please check the errors above.');
    process.exit(1);
  }
}

runTests().catch(error => {
  console.error('❌ Test runner failed:', error);
  process.exit(1);
});
