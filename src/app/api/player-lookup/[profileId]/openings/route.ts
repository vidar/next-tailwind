/**
 * Opening Stats API
 * GET /api/player-lookup/[profileId]/openings
 * Get opening statistics for a profile
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getPlayerOpeningStats,
  getBestOpenings,
  getWorstOpenings,
  getOpeningRepertoire,
  aggregateOpeningStats,
} from '@/lib/player-lookup/opening-stats';

export async function GET(
  request: NextRequest,
  { params }: { params: { profileId: string } }
) {
  try {
    const profileId = params.profileId;
    const { searchParams } = new URL(request.url);

    const view = searchParams.get('view') || 'summary';
    const color = searchParams.get('color') as 'white' | 'black' | null;
    const timeClass = searchParams.get('timeClass');
    const minGames = parseInt(searchParams.get('minGames') || '3');

    // Aggregate stats first (idempotent operation)
    await aggregateOpeningStats(profileId);

    switch (view) {
      case 'best':
        const best = await getBestOpenings(profileId, {
          color: color || undefined,
          timeClass: timeClass || undefined,
          minGames,
          limit: 20,
          sortBy: 'winRate',
        });
        return NextResponse.json({ openings: best });

      case 'worst':
        const worst = await getWorstOpenings(profileId, {
          color: color || undefined,
          timeClass: timeClass || undefined,
          minGames,
          limit: 20,
        });
        return NextResponse.json({ openings: worst });

      case 'repertoire':
        if (!color) {
          return NextResponse.json(
            { error: 'Color parameter required for repertoire view' },
            { status: 400 }
          );
        }
        const repertoire = await getOpeningRepertoire(profileId, color);
        return NextResponse.json(repertoire);

      case 'all':
        const all = await getPlayerOpeningStats(profileId, {
          color: color || undefined,
          timeClass: timeClass || undefined,
          minGames,
        });
        return NextResponse.json({ openings: all });

      case 'summary':
      default:
        // Get summary stats
        const whiteRepertoire = await getOpeningRepertoire(profileId, 'white');
        const blackRepertoire = await getOpeningRepertoire(profileId, 'black');
        const topPerformers = await getBestOpenings(profileId, { minGames, limit: 5 });

        return NextResponse.json({
          white: {
            totalOpenings: whiteRepertoire.totalOpenings,
            totalGames: whiteRepertoire.totalGames,
            topOpenings: whiteRepertoire.mostPlayed.slice(0, 3),
          },
          black: {
            totalOpenings: blackRepertoire.totalOpenings,
            totalGames: blackRepertoire.totalGames,
            topOpenings: blackRepertoire.mostPlayed.slice(0, 3),
          },
          topPerformers,
        });
    }
  } catch (error) {
    console.error('Opening stats error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch opening stats' },
      { status: 500 }
    );
  }
}
