import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  getTournamentById,
  getTournamentPlayers,
  getTournamentRounds,
  getTournamentGames,
  createTournamentVideo,
  updateTournamentVideoStatus,
  getAnalysisById,
  type TournamentGame,
} from '@/lib/db';
import {
  generateTournamentOverview,
  generateRoundOverview,
  generatePlayerOverview,
  selectMostInterestingGame,
} from '@/lib/tournament-ai';
import {
  renderMediaOnLambda,
  speculateFunctionName,
  AwsRegion,
} from '@remotion/lambda/client';
import { DISK, RAM, REGION, SITE_NAME, TIMEOUT } from '../../../../../../config.mjs';
import { TOURNAMENT_OVERVIEW_COMP_NAME, ROUND_OVERVIEW_COMP_NAME, PLAYER_OVERVIEW_COMP_NAME, ASPECT_RATIOS } from '../../../../../../types/constants';

/**
 * POST /api/tournaments/videos/generate
 *
 * Generate AI-powered tournament videos
 *
 * Body:
 * {
 *   tournamentId: string;
 *   videoType: 'tournament_overview' | 'round_overview' | 'player_overview';
 *   roundId?: string; // Required for round_overview
 *   playerFideId?: string; // Required for player_overview
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { tournamentId, videoType, roundId, playerFideId } = body;

    if (!tournamentId || !videoType) {
      return NextResponse.json(
        { error: 'tournamentId and videoType are required' },
        { status: 400 }
      );
    }

    // Validate video type specific requirements
    if (videoType === 'round_overview' && !roundId) {
      return NextResponse.json(
        { error: 'roundId is required for round_overview videos' },
        { status: 400 }
      );
    }

    if (videoType === 'player_overview' && !playerFideId) {
      return NextResponse.json(
        { error: 'playerFideId is required for player_overview videos' },
        { status: 400 }
      );
    }

    // Get tournament data
    const tournament = await getTournamentById(tournamentId);
    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    // Create video record
    const video = await createTournamentVideo(userId, tournamentId, videoType, {
      roundId,
      playerFideId,
    });

    // Generate AI script asynchronously (don't await - let it run in background)
    generateVideoScript(video.id, tournamentId, videoType, roundId, playerFideId).catch(error => {
      console.error('Error generating video script:', error);
      updateTournamentVideoStatus(video.id, 'failed', {
        error: error.message,
      });
    });

    return NextResponse.json({
      success: true,
      videoId: video.id,
      status: 'generating_script',
    });
  } catch (error) {
    console.error('Error creating tournament video:', error);
    return NextResponse.json(
      { error: 'Failed to create tournament video' },
      { status: 500 }
    );
  }
}

/**
 * Generate video script and trigger rendering
 */
async function generateVideoScript(
  videoId: string,
  tournamentId: string,
  videoType: string,
  roundId?: string,
  playerFideId?: string
) {
  try {
    // Update status to generating_script
    await updateTournamentVideoStatus(videoId, 'generating_script');

    const tournament = await getTournamentById(tournamentId);
    if (!tournament) throw new Error('Tournament not found');

    const players = await getTournamentPlayers(tournamentId);
    const rounds = await getTournamentRounds(tournamentId);
    const allGames = await getTournamentGames(tournamentId);

    let aiScript;
    let selectedGameId = null;

    switch (videoType) {
      case 'tournament_overview': {
        // Generate tournament overview
        aiScript = await generateTournamentOverview({
          tournament,
          players,
          rounds,
          games: allGames,
        });

        // Select most interesting game
        selectedGameId = await selectMostInterestingGame(allGames, players);
        break;
      }

      case 'round_overview': {
        if (!roundId) throw new Error('Round ID required');

        const round = rounds.find(r => r.id === roundId);
        if (!round) throw new Error('Round not found');

        const roundGames = allGames.filter(g => g.round_id === roundId);

        aiScript = await generateRoundOverview({
          tournament,
          round,
          roundGames,
          players,
        });

        // Select most interesting game from this round
        selectedGameId = await selectMostInterestingGame(roundGames, players);
        break;
      }

      case 'player_overview': {
        if (!playerFideId) throw new Error('Player FIDE ID required');

        const player = players.find(p => p.fide_id === playerFideId);
        if (!player) throw new Error('Player not found in tournament');

        const playerGames = allGames.filter(
          g => g.white_fide_id === playerFideId || g.black_fide_id === playerFideId
        );

        aiScript = await generatePlayerOverview({
          tournament,
          player,
          playerGames,
          allPlayers: players,
        });

        // Use the best game from the AI script
        if (aiScript.bestGame?.gameId) {
          selectedGameId = aiScript.bestGame.gameId;
        } else if (playerGames.length > 0) {
          // Fallback to first game
          selectedGameId = playerGames[0].game_id;
        }
        break;
      }

      default:
        throw new Error('Invalid video type');
    }

    // Update with AI script and selected game
    await updateTournamentVideoStatus(videoId, 'pending', {
      aiScript: aiScript as Record<string, unknown>,
      selectedGameId: selectedGameId || undefined,
      metadata: {
        generatedAt: new Date().toISOString(),
        model: 'openai/gpt-4o-mini',
      } as Record<string, unknown>,
    });

    console.log(`Video script generated for ${videoId}. Ready for rendering.`);

    // Trigger Lambda rendering automatically
    try {
      await triggerLambdaRender(
        videoId,
        videoType,
        aiScript,
        tournament,
        players,
        rounds,
        selectedGameId,
        roundId,
        playerFideId
      );
    } catch (renderError) {
      console.error('Error triggering Lambda render:', renderError);
      // Don't throw - script is generated, render can be triggered manually
    }

  } catch (error) {
    console.error('Error generating video script:', error);
    throw error;
  }
}

/**
 * Trigger Lambda rendering for a video
 */
async function triggerLambdaRender(
  videoId: string,
  videoType: string,
  aiScript: any,
  tournament: any,
  players: any[],
  rounds: any[],
  selectedGameId: string | null,
  roundId?: string,
  playerFideId?: string
) {
  // Check AWS credentials
  if (
    !process.env.AWS_ACCESS_KEY_ID &&
    !process.env.REMOTION_AWS_ACCESS_KEY_ID
  ) {
    console.warn('AWS credentials not configured. Skipping Lambda render.');
    return;
  }

  // Prepare top players for standings
  const topPlayers = players.slice(0, 8).map(p => ({
    rank: p.final_rank || 0,
    name: `${p.title || ''} ${p.full_name}`.trim(),
    score: p.final_score || 0,
    rating: p.starting_rating || undefined,
  }));

  // Prepare featured game (if available)
  let featuredGame;
  if (selectedGameId) {
    const game = await getAnalysisById(selectedGameId);
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

  // Prepare input props based on video type
  let inputProps: any;
  let compositionName: string;
  let fileName: string;

  switch (videoType) {
    case 'tournament_overview': {
      inputProps = {
        ...aiScript,
        tournamentName: tournament.name,
        location: tournament.location || undefined,
        dates: tournament.start_date && tournament.end_date
          ? `${tournament.start_date} - ${tournament.end_date}`
          : tournament.start_date || undefined,
        topPlayers,
        featuredGame,
      };
      compositionName = TOURNAMENT_OVERVIEW_COMP_NAME;
      fileName = `tournament-${tournament.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${Date.now()}.mp4`;
      break;
    }

    case 'round_overview': {
      const round = rounds.find(r => r.id === roundId);
      inputProps = {
        ...aiScript,
        tournamentName: tournament.name,
        roundNumber: round?.round_number || 0,
        roundDate: round?.round_date || undefined,
        location: tournament.location || undefined,
        topPlayers,
        featuredGame,
      };
      compositionName = ROUND_OVERVIEW_COMP_NAME;
      fileName = `round-${round?.round_number || 'unknown'}-${tournament.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${Date.now()}.mp4`;
      break;
    }

    case 'player_overview': {
      const player = players.find(p => p.fide_id === playerFideId);
      inputProps = {
        ...aiScript,
        playerName: player?.full_name || 'Unknown',
        playerTitle: player?.title || undefined,
        playerRating: player?.starting_rating || undefined,
        tournamentName: tournament.name,
        finalScore: player?.final_score || undefined,
        finalRank: player?.final_rank || undefined,
        featuredGame,
      };
      compositionName = PLAYER_OVERVIEW_COMP_NAME;
      fileName = `player-${player?.full_name.replace(/[^a-z0-9]/gi, '-').toLowerCase() || 'unknown'}-${Date.now()}.mp4`;
      break;
    }

    default:
      throw new Error(`Invalid video type: ${videoType}`);
  }

  // Get dimensions (always landscape for now)
  const dimensions = ASPECT_RATIOS.landscape;

  console.log(`Starting Lambda render for ${videoType}:`, videoId);

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
    composition: compositionName,
    inputProps: {
      ...inputProps,
      width: dimensions.width,
      height: dimensions.height,
    },
    imageFormat: 'jpeg',
    framesPerLambda: 100,
    downloadBehavior: {
      type: 'download',
      fileName,
    },
  });

  console.log('Lambda render started:', result.renderId);

  // Update video record with render metadata
  await updateTournamentVideoStatus(videoId, 'rendering', {
    metadata: {
      renderId: result.renderId,
      bucketName: result.bucketName,
    } as Record<string, unknown>,
  });
}

/**
 * GET /api/tournaments/videos/generate?tournamentId=xxx
 *
 * Get all videos for a tournament
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const tournamentId = searchParams.get('tournamentId');

    if (!tournamentId) {
      return NextResponse.json(
        { error: 'tournamentId is required' },
        { status: 400 }
      );
    }

    // Import getTournamentVideos
    const { getTournamentVideos } = await import('@/lib/db');
    const videos = await getTournamentVideos(tournamentId);

    return NextResponse.json({ videos });
  } catch (error) {
    console.error('Error fetching tournament videos:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tournament videos' },
      { status: 500 }
    );
  }
}
