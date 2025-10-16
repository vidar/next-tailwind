#!/usr/bin/env node

import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { Chess } from "chess.js";
import pg from "pg";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
config({ path: path.join(__dirname, "..", ".env") });

// Get game ID from command line args
const gameId = process.argv[2];

if (!gameId) {
  console.error("Usage: node scripts/render-game.mjs <game-id>");
  process.exit(1);
}

console.log(`Fetching game data for ID: ${gameId}`);

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || "5432"),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function fetchGameData(id) {
  const result = await pool.query(
    `SELECT * FROM chess_analyses WHERE id = $1`,
    [id]
  );

  if (result.rows.length === 0) {
    throw new Error(`Game not found: ${id}`);
  }

  return result.rows[0];
}

function extractGameInfo(pgn) {
  const whiteMatch = pgn.match(/\[White "([^"]+)"\]/);
  const blackMatch = pgn.match(/\[Black "([^"]+)"\]/);
  const resultMatch = pgn.match(/\[Result "([^"]+)"\]/);
  const dateMatch = pgn.match(/\[Date "([^"]+)"\]/);

  return {
    white: whiteMatch ? whiteMatch[1] : "Unknown",
    black: blackMatch ? blackMatch[1] : "Unknown",
    result: resultMatch ? resultMatch[1] : "*",
    date: dateMatch ? dateMatch[1] : "Unknown",
  };
}

function calculateDuration(pgn, fps = 30) {
  try {
    const game = new Chess();
    game.loadPgn(pgn);
    const moves = game.history();
    return moves.length * fps; // 1 second per move
  } catch {
    return 60 * fps; // Default to 60 seconds
  }
}

async function main() {
  try {
    // Fetch game data
    const analysis = await fetchGameData(gameId);
    console.log("Game data fetched successfully");

    // Extract game info
    const gameInfo = extractGameInfo(analysis.pgn);
    console.log(`Rendering: ${gameInfo.white} vs ${gameInfo.black}`);

    // Prepare input props
    const inputProps = {
      pgn: analysis.pgn,
      analysisResults: analysis.analysis_results,
      gameInfo,
    };

    // Calculate video duration
    const durationInFrames = calculateDuration(analysis.pgn, 30);
    console.log(`Video duration: ${durationInFrames / 30} seconds`);

    // Bundle the Remotion project
    console.log("Bundling Remotion project...");
    const bundleLocation = await bundle({
      entryPoint: path.join(__dirname, "..", "src", "remotion", "index.ts"),
      webpackOverride: (config) => config,
    });
    console.log("Bundle created at:", bundleLocation);

    // Select the composition
    const compositionId = "ChessGameWalkthrough";
    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: compositionId,
      inputProps,
    });
    console.log("Composition selected:", composition.id);

    // Output path
    const outputPath = path.join(
      __dirname,
      "..",
      "out",
      `chess-${gameId}-${Date.now()}.mp4`
    );

    // Render the video
    console.log("Starting render...");
    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: "h264",
      outputLocation: outputPath,
      inputProps,
      onProgress: ({ progress, renderedFrames, encodedFrames }) => {
        console.log(
          `Progress: ${(progress * 100).toFixed(1)}% | Rendered: ${renderedFrames} | Encoded: ${encodedFrames}`
        );
      },
    });

    console.log(`\n✅ Video rendered successfully!`);
    console.log(`Output: ${outputPath}`);

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error("Error rendering video:", error);
    await pool.end();
    process.exit(1);
  }
}

main();
