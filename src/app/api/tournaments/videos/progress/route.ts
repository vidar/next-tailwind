import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  speculateFunctionName,
  AwsRegion,
  getRenderProgress,
} from '@remotion/lambda/client';
import { DISK, RAM, REGION, TIMEOUT } from '../../../../../../config.mjs';
import { getTournamentVideo, updateTournamentVideoStatus } from '@/lib/db';

/**
 * POST /api/tournaments/videos/progress
 *
 * Check rendering progress for a tournament video
 *
 * Body:
 * {
 *   videoId: string;
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { videoId } = body;

    if (!videoId) {
      return NextResponse.json(
        { error: 'videoId is required' },
        { status: 400 }
      );
    }

    // Fetch video record
    const video = await getTournamentVideo(videoId);
    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    // Check if user owns this video
    if (video.user_id !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Type guard for metadata
    const metadata = video.metadata as { renderId?: string; bucketName?: string } | null;

    if (!metadata?.renderId || !metadata?.bucketName) {
      return NextResponse.json(
        { error: 'Video render not started' },
        { status: 400 }
      );
    }

    const renderProgress = await getRenderProgress({
      bucketName: metadata.bucketName,
      functionName: speculateFunctionName({
        diskSizeInMb: DISK,
        memorySizeInMb: RAM,
        timeoutInSeconds: TIMEOUT,
      }),
      region: REGION as AwsRegion,
      renderId: metadata.renderId,
    });

    if (renderProgress.fatalErrorEncountered) {
      // Update database with error
      await updateTournamentVideoStatus(
        videoId,
        'failed',
        {
          error: renderProgress.errors[0]?.message || 'Unknown error',
        }
      );

      return NextResponse.json({
        type: 'error' as const,
        message: renderProgress.errors[0]?.message || 'Render failed',
      });
    }

    if (renderProgress.done) {
      // Update database with completed render
      await updateTournamentVideoStatus(
        videoId,
        'completed',
        {
          s3Url: renderProgress.outputFile as string,
        }
      );

      return NextResponse.json({
        type: 'done' as const,
        url: renderProgress.outputFile as string,
        size: renderProgress.outputSizeInBytes as number,
      });
    }

    // Update status to rendering if not already
    if (video.status === 'pending' || video.status === 'generating_script') {
      await updateTournamentVideoStatus(videoId, 'rendering');
    }

    return NextResponse.json({
      type: 'progress' as const,
      progress: Math.max(0.03, renderProgress.overallProgress),
    });
  } catch (error) {
    console.error('Error checking tournament video progress:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to check progress' },
      { status: 500 }
    );
  }
}
