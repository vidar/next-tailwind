#!/usr/bin/env node

import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import pg from "pg";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";
import cliProgress from "cli-progress";
import fetch from "node-fetch";

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
config({ path: path.join(__dirname, "..", ".env") });

// Get tournament ID from command line args
const tournamentId = process.argv[2];
const skipAI = process.argv.includes("--skip-ai");

if (!tournamentId) {
  console.error("Usage: node scripts/render-tournament.mjs <tournament-id> [--skip-ai]");
  console.error("\nOptions:");
  console.error("  --skip-ai    Use mock data instead of generating AI content");
  process.exit(1);
}

console.log(`🎬 Rendering tournament video for ID: ${tournamentId}`);
if (skipAI) {
  console.log("⚡ Using mock data (AI generation skipped)");
}

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || "5432"),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function fetchTournamentData(id) {
  // Fetch tournament
  const tournamentResult = await pool.query(
    `SELECT * FROM tournaments WHERE id = $1`,
    [id]
  );

  if (tournamentResult.rows.length === 0) {
    throw new Error(`Tournament not found: ${id}`);
  }

  const tournament = tournamentResult.rows[0];

  // Fetch players
  const playersResult = await pool.query(
    `SELECT tp.*, p.full_name, p.title, p.country_code
     FROM tournament_players tp
     JOIN players p ON tp.fide_id = p.fide_id
     WHERE tp.tournament_id = $1
     ORDER BY tp.final_rank ASC NULLS LAST, tp.final_score DESC NULLS LAST`,
    [id]
  );

  const players = playersResult.rows;

  // Fetch rounds
  const roundsResult = await pool.query(
    `SELECT * FROM tournament_rounds WHERE tournament_id = $1 ORDER BY round_number ASC`,
    [id]
  );

  const rounds = roundsResult.rows;

  // Fetch games
  const gamesResult = await pool.query(
    `SELECT * FROM tournament_games WHERE tournament_id = $1`,
    [id]
  );

  const games = gamesResult.rows;

  return { tournament, players, rounds, games };
}

async function generateAIScript(tournament, players, rounds, games) {
  console.log("🤖 Generating AI script with OpenRouter AI...");

  // Call OpenRouter API directly
  const openRouterApiKey = process.env.OPENROUTER_API_KEY;
  if (!openRouterApiKey) {
    throw new Error('OPENROUTER_API_KEY not found in environment variables');
  }

  // Prepare context for AI
  const topPlayers = players
    .sort((a, b) => (b.final_score || 0) - (a.final_score || 0))
    .slice(0, 5);

  const playerInfo = topPlayers.map(p =>
    `${p.title || ''} ${p.full_name} (${p.fide_id}): ${p.final_score} points, Rating: ${p.starting_rating}`
  ).join('\n');

  const prompt = `You are creating a compelling narrative for a chess tournament video overview.

Tournament: ${tournament.name}
Location: ${tournament.location || 'Unknown'}
Dates: ${tournament.start_date} to ${tournament.end_date || 'Ongoing'}
Type: ${tournament.tournament_type}
Total Rounds: ${tournament.total_rounds}

Top Players:
${playerInfo}

Based on this information, create a structured tournament overview:

1. A catchy title (5-8 words)
2. An opening summary (2-3 sentences introducing the tournament, its significance, and atmosphere)
3. 3-5 key highlights or memorable moments from the tournament
4. A brief summary for each round (1-2 sentences per round, focusing on key games and standings)
5. A powerful conclusion (1-2 sentences)

Format your response as JSON:
{
  "title": "...",
  "summary": "...",
  "highlights": ["...", "..."],
  "roundSummaries": ["Round 1: ...", "Round 2: ..."],
  "conclusion": "..."
}`;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openRouterApiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'X-Title': 'Chess Moments',
    },
    body: JSON.stringify({
      model: 'openai/gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a professional chess commentator creating engaging tournament narratives. Provide responses in valid JSON format only.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.8,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error: ${error}`);
  }

  const data = await response.json();
  const aiResponse = data.choices[0]?.message?.content || '';

  // Parse JSON response
  try {
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const aiScript = JSON.parse(jsonMatch[0]);
      console.log("✅ AI script generated successfully!");
      return aiScript;
    }
  } catch (e) {
    console.error('Error parsing AI response:', e);
  }

  // Fallback
  console.log("⚠️  Using fallback script (AI parsing failed)");
  return {
    title: `${tournament.name} Overview`,
    summary: `The ${tournament.name} brought together ${players.length} players in ${tournament.location || 'a prestigious venue'}.`,
    highlights: ['Exciting games throughout', 'Strong competition', 'Memorable moments'],
    roundSummaries: rounds.map((r) => `Round ${r.round_number}: Competitive games played`),
    conclusion: 'A tournament to remember!',
  };
}

function createMockAIScript(tournament, players) {
  console.log("📝 Using mock AI script data");

  return {
    title: `${tournament.name} Highlights`,
    summary: `The ${tournament.name} brought together ${players.length} players in ${tournament.location || 'a prestigious venue'} for an exciting chess competition.`,
    highlights: [
      "Intense battles on the top boards",
      "Several decisive games in crucial rounds",
      "Strong performances from top-rated players",
    ],
    roundSummaries: tournament.total_rounds >= 3 ? [
      "Round 1: Opening round saw expected results",
      "Round 2: The competition heated up",
      "Round 3: Key games shaped the standings",
    ] : ["Competitive rounds throughout the tournament"],
    conclusion: "A memorable tournament showcasing high-level chess!",
  };
}

function selectMostInterestingGame(games, players) {
  if (games.length === 0) return null;

  // Simple heuristic: prefer decisive games between high-rated players
  const scoredGames = games.map(game => {
    const white = players.find(p => p.fide_id === game.white_fide_id);
    const black = players.find(p => p.fide_id === game.black_fide_id);

    let score = 0;

    // Prefer decisive games
    if (game.result !== '1/2-1/2' && game.result !== '*') score += 10;

    // Prefer games with higher-rated players
    if (white?.starting_rating) score += white.starting_rating / 1000;
    if (black?.starting_rating) score += black.starting_rating / 1000;

    // Prefer earlier board numbers (usually stronger players)
    if (game.board_number) score += (20 - game.board_number);

    return { game, score };
  });

  scoredGames.sort((a, b) => b.score - a.score);
  return scoredGames[0]?.game.game_id || null;
}

async function main() {
  try {
    // Fetch tournament data
    console.log("📊 Fetching tournament data...");
    const { tournament, players, rounds, games } = await fetchTournamentData(tournamentId);
    console.log(`✅ Tournament: ${tournament.name}`);
    console.log(`   Players: ${players.length}`);
    console.log(`   Rounds: ${rounds.length}`);
    console.log(`   Games: ${games.length}`);

    // Generate or use mock AI script
    let aiScript;
    let selectedGameId = null;

    if (skipAI) {
      aiScript = createMockAIScript(tournament, players);
    } else {
      aiScript = await generateAIScript(tournament, players, rounds, games);
    }

    // Select most interesting game for featured showcase
    if (games.length > 0) {
      selectedGameId = selectMostInterestingGame(games, players);
      console.log("🎯 Selected featured game ID:", selectedGameId);
    }

    // Prepare top players for standings
    const topPlayers = players.slice(0, 8).map(p => ({
      rank: p.final_rank || 0,
      name: `${p.title || ''} ${p.full_name}`.trim(),
      score: p.final_score || 0,
      rating: p.starting_rating || undefined,
    }));

    // Prepare featured game (if available)
    let featuredGame = undefined;
    if (selectedGameId) {
      console.log("🎮 Fetching featured game...");
      const gameResult = await pool.query(
        `SELECT * FROM chess_analyses WHERE id = $1`,
        [selectedGameId]
      );

      if (gameResult.rows.length > 0) {
        const game = gameResult.rows[0];
        const whiteMatch = game.pgn.match(/\[White "([^"]+)"\]/);
        const blackMatch = game.pgn.match(/\[Black "([^"]+)"\]/);
        const resultMatch = game.pgn.match(/\[Result "([^"]+)"\]/);
        const dateMatch = game.pgn.match(/\[Date "([^"]+)"\]/);

        featuredGame = {
          pgn: game.pgn,
          analysisResults: game.analysis_results,
          gameInfo: {
            white: whiteMatch ? whiteMatch[1] : "Unknown",
            black: blackMatch ? blackMatch[1] : "Unknown",
            result: resultMatch ? resultMatch[1] : "*",
            date: dateMatch ? dateMatch[1] : "Unknown",
          },
          orientation: "white",
          musicGenre: "none",
        };
        console.log(`✅ Featured game: ${featuredGame.gameInfo.white} vs ${featuredGame.gameInfo.black}`);
      }
    }

    // Prepare input props
    const inputProps = {
      ...aiScript,
      tournamentName: tournament.name,
      location: tournament.location || undefined,
      dates: tournament.start_date && tournament.end_date
        ? `${tournament.start_date} - ${tournament.end_date}`
        : tournament.start_date || undefined,
      topPlayers,
      featuredGame,
    };

    console.log("\n🎨 Input props prepared:");
    console.log(`   Title: ${inputProps.title}`);
    console.log(`   Highlights: ${inputProps.highlights.length}`);
    console.log(`   Round summaries: ${inputProps.roundSummaries.length}`);
    console.log(`   Top players: ${inputProps.topPlayers.length}`);
    console.log(`   Featured game: ${featuredGame ? 'Yes' : 'No'}`);

    // Bundle the Remotion project
    console.log("\n📦 Bundling Remotion project...");
    const bundleLocation = await bundle({
      entryPoint: path.join(__dirname, "..", "src", "remotion", "index.ts"),
      webpackOverride: (config) => config,
    });
    console.log("✅ Bundle created");

    // Select the composition
    const compositionId = "TournamentOverview";
    console.log(`\n🎬 Selecting composition: ${compositionId}`);
    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: compositionId,
      inputProps,
    });
    console.log(`✅ Composition selected: ${composition.id}`);
    console.log(`   Duration: ${composition.durationInFrames / composition.fps} seconds`);
    console.log(`   Size: ${composition.width}x${composition.height}`);

    // Output path
    const outputPath = path.join(
      __dirname,
      "..",
      "out",
      `tournament-${tournament.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${Date.now()}.mp4`
    );

    // Create progress bar
    console.log("\n🎥 Starting render...\n");
    const progressBar = new cliProgress.SingleBar({
      format: 'Rendering |{bar}| {percentage}% | Frames: {renderedFrames}/{totalFrames} | Encoded: {encodedFrames} | ETA: {eta}s',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true
    }, cliProgress.Presets.shades_classic);

    // Start progress bar
    progressBar.start(composition.durationInFrames, 0, {
      renderedFrames: 0,
      encodedFrames: 0,
      totalFrames: composition.durationInFrames
    });

    // Render the video
    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: "h264",
      outputLocation: outputPath,
      inputProps,
      onProgress: ({ renderedFrames, encodedFrames }) => {
        progressBar.update(renderedFrames, {
          renderedFrames,
          encodedFrames,
          totalFrames: composition.durationInFrames
        });
      },
    });

    // Stop progress bar
    progressBar.stop();

    console.log(`\n✅ Tournament video rendered successfully! 🎉`);
    console.log(`📁 Output: ${outputPath}`);
    console.log(`⏱️  Duration: ${composition.durationInFrames / composition.fps} seconds`);

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error rendering tournament video:", error);
    await pool.end();
    process.exit(1);
  }
}

main();
