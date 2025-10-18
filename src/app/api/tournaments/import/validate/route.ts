import { NextRequest, NextResponse } from 'next/server';
import { parseTournamentFromPGN, validateTournamentData } from '@/lib/pgn-parser';

/**
 * POST /api/tournaments/import/validate
 *
 * Validates PGN without importing
 *
 * Body:
 * {
 *   pgnText: string;
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pgnText } = body;

    if (!pgnText || typeof pgnText !== 'string') {
      return NextResponse.json(
        { error: 'PGN text is required' },
        { status: 400 }
      );
    }

    try {
      const tournamentInfo = parseTournamentFromPGN(pgnText);
      const validation = validateTournamentData(tournamentInfo);

      return NextResponse.json({
        valid: validation.isValid,
        tournament: {
          name: tournamentInfo.name,
          type: tournamentInfo.type,
          players: tournamentInfo.players.length,
          games: tournamentInfo.games.length,
          rounds: tournamentInfo.totalRounds,
        },
        validation,
      });
    } catch (error) {
      return NextResponse.json(
        {
          valid: false,
          error: error instanceof Error ? error.message : 'Failed to parse PGN',
        },
        { status: 400 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      {
        valid: false,
        error: 'Invalid request format',
      },
      { status: 400 }
    );
  }
}
