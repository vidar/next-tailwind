import { NextRequest, NextResponse } from 'next/server';
import { listTournaments } from '@/lib/db';

/**
 * GET /api/tournaments
 *
 * Lists all tournaments with optional filters
 *
 * Query params:
 * - type: Tournament type filter (round_robin, swiss, knockout, arena, other)
 * - year: Year filter (YYYY)
 * - limit: Number of results (default: 50)
 * - offset: Pagination offset (default: 0)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const type = searchParams.get('type') as 'round_robin' | 'swiss' | 'knockout' | 'arena' | 'other' | null;
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0;

    const tournaments = await listTournaments({
      type: type || undefined,
      year,
      limit,
      offset,
    });

    return NextResponse.json({
      success: true,
      tournaments,
      count: tournaments.length,
    });
  } catch (error) {
    console.error('Failed to list tournaments:', error);
    return NextResponse.json(
      {
        error: 'Failed to list tournaments',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
