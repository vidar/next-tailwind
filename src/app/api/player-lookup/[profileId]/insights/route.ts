/**
 * Game Insights API
 * GET /api/player-lookup/[profileId]/insights
 * Get insights for analyzed games
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPlayerGames, getPlayerGameInsight } from '@/lib/db';
import { calculateProfileInsights } from '@/lib/player-lookup/insights';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ profileId: string }> }
) {
  try {
    const { profileId } = await params;
    const { searchParams } = new URL(request.url);

    const recalculate = searchParams.get('recalculate') === 'true';

    // Optionally recalculate insights
    if (recalculate) {
      await calculateProfileInsights(profileId);
    }

    // Get all completed games with insights
    const games = await getPlayerGames(profileId, {
      analysisStatus: 'completed',
      limit: 100,
    });

    // Fetch insights for each game
    const gamesWithInsights = await Promise.all(
      games.map(async (game) => {
        const insight = await getPlayerGameInsight(game.id);
        return {
          gameId: game.id,
          playedAt: game.played_at,
          timeClass: game.time_class,
          result: game.result,
          whiteUsername: game.white_username,
          whiteRating: game.white_rating,
          blackUsername: game.black_username,
          blackRating: game.black_rating,
          playerColor: game.player_color,
          openingEco: game.opening_eco,
          openingName: game.opening_name,
          gameUrl: game.game_url,
          insight: insight ? {
            accuracy: insight.accuracy_percentage,
            averageCPL: insight.average_centipawn_loss,
            blunders: insight.blunders_count,
            mistakes: insight.mistakes_count,
            inaccuracies: insight.inaccuracies_count,
            brilliantMoves: insight.brilliant_moves_count,
            expectedResult: insight.expected_result,
            actualResult: insight.actual_result,
            resultSurprise: insight.result_surprise,
            openingAdvantage: insight.opening_advantage,
          } : null,
        };
      })
    );

    // Calculate aggregate statistics
    const withInsights = gamesWithInsights.filter(g => g.insight !== null);
    const avgAccuracy = withInsights.length > 0
      ? withInsights.reduce((sum, g) => sum + (g.insight?.accuracy || 0), 0) / withInsights.length
      : null;

    const avgCPL = withInsights.length > 0
      ? withInsights.reduce((sum, g) => sum + (g.insight?.averageCPL || 0), 0) / withInsights.length
      : null;

    const totalBlunders = withInsights.reduce((sum, g) => sum + (g.insight?.blunders || 0), 0);
    const totalMistakes = withInsights.reduce((sum, g) => sum + (g.insight?.mistakes || 0), 0);

    // Get most surprising games
    const surprising = [...gamesWithInsights]
      .filter(g => g.insight?.resultSurprise !== null && g.insight?.resultSurprise !== undefined)
      .sort((a, b) => Math.abs(b.insight!.resultSurprise!) - Math.abs(a.insight!.resultSurprise!))
      .slice(0, 10);

    return NextResponse.json({
      summary: {
        totalGamesAnalyzed: withInsights.length,
        averageAccuracy: avgAccuracy,
        averageCPL: avgCPL,
        totalBlunders,
        totalMistakes,
      },
      surprisingGames: surprising,
      recentGames: gamesWithInsights.slice(0, 20),
    });
  } catch (error) {
    console.error('Insights fetch error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch insights' },
      { status: 500 }
    );
  }
}
