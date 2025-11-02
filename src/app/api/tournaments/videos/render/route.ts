import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { AwsRegion } from '@remotion/lambda/client';
import {
  renderMediaOnLambda,
  speculateFunctionName,
} from '@remotion/lambda/client';
import {
  DISK,
  RAM,
  REGION,
  SITE_NAME,
  TIMEOUT,
} from '../../../../../../config.mjs';
import {
  getTournamentVideo,
  updateTournamentVideoStatus,
  getTournamentById,
  getTournamentPlayers,
  getAnalysisById,
} from '@/lib/db';
import { TOURNAMENT_OVERVIEW_COMP_NAME, ASPECT_RATIOS } from '../../../../../../types/constants';

/**
 * POST /api/tournaments/videos/render
 *
 * Trigger Lambda rendering for a tournament video
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

    // Check AWS credentials
    if (
      !process.env.AWS_ACCESS_KEY_ID &&
      !process.env.REMOTION_AWS_ACCESS_KEY_ID
    ) {
      return NextResponse.json(
        { error: 'AWS credentials not configured. See README for setup.' },
        { status: 500 }
      );
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

    // Check if AI script is ready
    if (!video.ai_script) {
      return NextResponse.json(
        { error: 'AI script not generated yet. Wait for script generation to complete.' },
        { status: 400 }
      );
    }

    // Parse AI script
    const aiScript = video.ai_script as {
      title: string;
      summary: string;
      highlights: string[];
      roundSummaries: string[];
      conclusion: string;
    };

    // Get tournament data
    const tournament = await getTournamentById(video.tournament_id);
    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    const players = await getTournamentPlayers(video.tournament_id);

    // Prepare top players for standings
    const topPlayers = players.slice(0, 8).map(p => ({
      rank: p.final_rank || 0,
      name: `${p.title || ''} ${p.full_name}`.trim(),
      score: p.final_score || 0,
      rating: p.starting_rating || undefined,
    }));

    // Prepare featured game (if available)
    let featuredGame;
    if (video.selected_game_id) {
      const game = await getAnalysisById(video.selected_game_id);
      if (game) {
        const whiteMatch = game.pgn.match(/\[White "([^"]+)"\]/);
        const blackMatch = game.pgn.match(/\[Black "([^"]+)"\]/);
        const resultMatch = game.pgn.match(/\[Result "([^"]+)"\]/);
        const dateMatch = game.pgn.match(/\[Date "([^"]+)"\]/);

        featuredGame = {
          pgn: game.pgn,
          analysisResults: game.analysis_results,
          gameInfo: {
            white: whiteMatch ? whiteMatch[1] : 'Unknown',
            black: blackMatch ? blackMatch[1] : 'Unknown',
            result: resultMatch ? resultMatch[1] : '*',
            date: dateMatch ? dateMatch[1] : 'Unknown',
          },
          orientation: 'white' as const,
          musicGenre: 'none',
        };
      }
    }

    // Prepare input props for Remotion
    const inputProps = {
      ...aiScript,
      tournamentName: tournament.name,
      location: tournament.location || undefined,
      dates: tournament.start_date && tournament.end_date
        ? `${tournament.start_date} - ${tournament.end_date}`
        : tournament.start_date || undefined,
      topPlayers,
      featuredGame,
    };

    // Get dimensions (always landscape for now)
    const dimensions = ASPECT_RATIOS.landscape;

    console.log('Starting Lambda render for tournament video:', videoId);

    // Start Lambda render
    const result = await renderMediaOnLambda({
      codec: 'h264',
      functionName: speculateFunctionName({
        diskSizeInMb: DISK,
        memorySizeInMb: RAM,
        timeoutInSeconds: TIMEOUT,
      }),
      region: REGION as AwsRegion,
      serveUrl: SITE_NAME,
      composition: TOURNAMENT_OVERVIEW_COMP_NAME,
      inputProps: {
        ...inputProps,
        width: dimensions.width,
        height: dimensions.height,
      },
      imageFormat: 'jpeg',
      framesPerLambda: 100,
      downloadBehavior: {
        type: 'download',
        fileName: `tournament-${tournament.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${Date.now()}.mp4`,
      },
    });

    console.log('Lambda render started:', result.renderId);

    // Update video record with render metadata
    await updateTournamentVideoStatus(videoId, 'rendering', {
      metadata: {
        renderId: result.renderId,
        bucketName: result.bucketName,
      },
    });

    return NextResponse.json({
      success: true,
      videoId,
      renderId: result.renderId,
      bucketName: result.bucketName,
    });
  } catch (error) {
    console.error('Error rendering tournament video:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to render video' },
      { status: 500 }
    );
  }
}
