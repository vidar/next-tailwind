import { NextRequest, NextResponse } from 'next/server';
import {
  getTournamentById,
  getTournamentPlayers,
  getTournamentRounds,
  getTournamentGames,
  deleteTournament,
} from '@/lib/db';

/**
 * GET /api/tournaments/[id]
 *
 * Gets complete tournament data including players, rounds, and games
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch tournament
    const tournament = await getTournamentById(id);
    if (!tournament) {
      return NextResponse.json(
        { error: 'Tournament not found' },
        { status: 404 }
      );
    }

    // Fetch related data in parallel
    const [players, rounds, games] = await Promise.all([
      getTournamentPlayers(id),
      getTournamentRounds(id),
      getTournamentGames(id),
    ]);

    // Build crosstable data
    const crosstable = buildCrosstable(players, games);

    return NextResponse.json({
      success: true,
      tournament,
      players,
      rounds,
      games,
      crosstable,
    });
  } catch (error) {
    console.error('Failed to fetch tournament:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch tournament',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Helper function to build crosstable data
 * Returns { result: string, gameId: string | null } for each matchup
 */
function buildCrosstable(players: any[], games: any[]) {
  const crosstable: { [key: string]: { [key: string]: { result: string; gameId: string | null } } } = {};

  // Initialize crosstable
  for (const player of players) {
    crosstable[player.fide_id] = {};
    for (const opponent of players) {
      if (player.fide_id !== opponent.fide_id) {
        crosstable[player.fide_id][opponent.fide_id] = { result: '-', gameId: null };
      }
    }
  }

  // Fill in results and game IDs
  for (const game of games) {
    const { white_fide_id, black_fide_id, result, game_id } = game;

    if (result === '1-0') {
      crosstable[white_fide_id][black_fide_id] = { result: '1', gameId: game_id };
      crosstable[black_fide_id][white_fide_id] = { result: '0', gameId: game_id };
    } else if (result === '0-1') {
      crosstable[white_fide_id][black_fide_id] = { result: '0', gameId: game_id };
      crosstable[black_fide_id][white_fide_id] = { result: '1', gameId: game_id };
    } else if (result === '1/2-1/2') {
      crosstable[white_fide_id][black_fide_id] = { result: '½', gameId: game_id };
      crosstable[black_fide_id][white_fide_id] = { result: '½', gameId: game_id };
    } else {
      crosstable[white_fide_id][black_fide_id] = { result: '*', gameId: game_id };
      crosstable[black_fide_id][white_fide_id] = { result: '*', gameId: game_id };
    }
  }

  return crosstable;
}

/**
 * DELETE /api/tournaments/[id]
 *
 * Deletes a tournament and all associated data
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if tournament exists
    const tournament = await getTournamentById(id);
    if (!tournament) {
      return NextResponse.json(
        { error: 'Tournament not found' },
        { status: 404 }
      );
    }

    // Delete tournament (CASCADE will delete all related data)
    await deleteTournament(id);

    return NextResponse.json({
      success: true,
      message: 'Tournament deleted successfully',
    });
  } catch (error) {
    console.error('Failed to delete tournament:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete tournament',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
