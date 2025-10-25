import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  getTournamentById,
  getTournamentPlayers,
  getTournamentRounds,
  createTournamentVideo,
} from '@/lib/db';

/**
 * POST /api/tournaments/videos/generate-batch
 *
 * Generate multiple tournament videos at once
 *
 * Body:
 * {
 *   tournamentId: string;
 *   batchType: 'all_rounds' | 'all_players';
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { tournamentId, batchType } = body;

    if (!tournamentId || !batchType) {
      return NextResponse.json(
        { error: 'tournamentId and batchType are required' },
        { status: 400 }
      );
    }

    // Get tournament data
    const tournament = await getTournamentById(tournamentId);
    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    const videoIds: string[] = [];

    if (batchType === 'all_rounds') {
      const rounds = await getTournamentRounds(tournamentId);

      // Create video for each round
      for (const round of rounds) {
        const video = await createTournamentVideo(userId, tournamentId, 'round_overview', {
          roundId: round.id,
        });
        videoIds.push(video.id);

        // Trigger generation asynchronously
        fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/tournaments/videos/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tournamentId,
            videoType: 'round_overview',
            roundId: round.id,
          }),
        }).catch(err => console.error(`Error triggering round ${round.round_number} video:`, err));
      }

      return NextResponse.json({
        success: true,
        message: `Created ${rounds.length} round overview videos`,
        videoIds,
        count: rounds.length,
      });
    }

    if (batchType === 'all_players') {
      const players = await getTournamentPlayers(tournamentId);

      // Create video for each player
      for (const player of players) {
        const video = await createTournamentVideo(userId, tournamentId, 'player_overview', {
          playerFideId: player.fide_id,
        });
        videoIds.push(video.id);

        // Trigger generation asynchronously
        fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/tournaments/videos/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tournamentId,
            videoType: 'player_overview',
            playerFideId: player.fide_id,
          }),
        }).catch(err => console.error(`Error triggering player ${player.full_name} video:`, err));
      }

      return NextResponse.json({
        success: true,
        message: `Created ${players.length} player overview videos`,
        videoIds,
        count: players.length,
      });
    }

    return NextResponse.json(
      { error: 'Invalid batchType. Must be "all_rounds" or "all_players"' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error creating batch videos:', error);
    return NextResponse.json(
      { error: 'Failed to create batch videos' },
      { status: 500 }
    );
  }
}
