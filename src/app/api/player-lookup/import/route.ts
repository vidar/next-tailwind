/**
 * Player Import API
 * POST /api/player-lookup/import
 * Import player profile and games
 */

import { NextRequest, NextResponse } from 'next/server';
import { importFromChessCom, importFromLichess } from '@/lib/player-lookup/game-importer';
import { startProfileAnalysis } from '@/lib/player-lookup/game-analyzer';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, platform, maxGames = 100, startAnalysis = true } = body;

    if (!username || !platform) {
      return NextResponse.json(
        { error: 'Username and platform are required' },
        { status: 400 }
      );
    }

    if (platform !== 'chess_com' && platform !== 'lichess') {
      return NextResponse.json(
        { error: 'Platform must be chess_com or lichess' },
        { status: 400 }
      );
    }

    // Import games
    console.log(`Importing ${maxGames} games for ${username} from ${platform}...`);

    const importResult = platform === 'chess_com'
      ? await importFromChessCom(username, maxGames)
      : await importFromLichess(username, maxGames);

    // Optionally start analysis
    let analysisStats = null;
    if (startAnalysis && importResult.gamesImported > 0) {
      analysisStats = await startProfileAnalysis(importResult.profile.id, 7);
    }

    return NextResponse.json({
      success: true,
      profile: {
        id: importResult.profile.id,
        username: importResult.profile.username,
        platform: importResult.profile.platform,
        ratings: importResult.profile.ratings,
      },
      import: {
        gamesImported: importResult.gamesImported,
        gamesDuplicate: importResult.gamesDuplicate,
        errors: importResult.errors.length,
      },
      analysis: analysisStats ? {
        queued: analysisStats.queued,
        total: analysisStats.totalGames,
      } : null,
    });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Import failed' },
      { status: 500 }
    );
  }
}
