/**
 * Analysis Progress API
 * GET /api/player-lookup/[profileId]/progress
 * Get analysis progress for a profile
 */

import { NextRequest, NextResponse } from 'next/server';
import { getProfileAnalysisProgress } from '@/lib/player-lookup/game-analyzer';

export async function GET(
  request: NextRequest,
  { params }: { params: { profileId: string } }
) {
  try {
    const profileId = params.profileId;

    const progress = await getProfileAnalysisProgress(profileId);

    return NextResponse.json({
      total: progress.total,
      pending: progress.pending,
      analyzing: progress.analyzing,
      completed: progress.completed,
      failed: progress.failed,
      percentComplete: progress.percentComplete,
    });
  } catch (error) {
    console.error('Progress fetch error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch progress' },
      { status: 500 }
    );
  }
}
