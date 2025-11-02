/**
 * Player Profile API
 * GET /api/player-lookup/[profileId]
 * Get player profile data
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPlayerProfileById, getPlayerGames } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { profileId: string } }
) {
  try {
    const profileId = params.profileId;

    const profile = await getPlayerProfileById(profileId);

    if (!profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    // Get game counts by status
    const allGames = await getPlayerGames(profileId);
    const statusCounts = {
      total: allGames.length,
      pending: allGames.filter(g => g.analysis_status === 'pending').length,
      analyzing: allGames.filter(g => g.analysis_status === 'analyzing').length,
      completed: allGames.filter(g => g.analysis_status === 'completed').length,
      failed: allGames.filter(g => g.analysis_status === 'failed').length,
    };

    return NextResponse.json({
      profile: {
        id: profile.id,
        username: profile.username,
        platform: profile.platform,
        displayName: profile.display_name,
        country: profile.country,
        avatarUrl: profile.avatar_url,
        profileUrl: profile.profile_url,
        ratings: profile.ratings,
        totalGamesAnalyzed: profile.total_games_analyzed,
        lastAnalysisDate: profile.last_analysis_date,
        analysisInProgress: profile.analysis_in_progress,
        createdAt: profile.created_at,
      },
      games: statusCounts,
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch profile' },
      { status: 500 }
    );
  }
}
