/**
 * Player Search API
 * POST /api/player-lookup/search
 * Search for a player on Chess.com or Lichess
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkPlayerExists } from '@/lib/player-lookup/game-importer';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, platform } = body;

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

    // Check if player exists on the platform
    const exists = await checkPlayerExists(username, platform);

    if (!exists) {
      return NextResponse.json(
        { error: 'Player not found on platform', found: false },
        { status: 404 }
      );
    }

    return NextResponse.json({
      found: true,
      username,
      platform,
    });
  } catch (error) {
    console.error('Player search error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Search failed' },
      { status: 500 }
    );
  }
}
