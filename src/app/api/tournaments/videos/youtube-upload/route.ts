import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { google } from 'googleapis';
import { getTournamentVideo, updateTournamentVideoStatus, getTournamentById } from '@/lib/db';
import { Readable } from 'stream';

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
        { error: 'Video ID is required' },
        { status: 400 }
      );
    }

    // Get video from database
    const video = await getTournamentVideo(videoId);
    if (!video) {
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }

    // Check if user owns this video
    if (video.user_id !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get S3 URL from video record
    if (!video.s3_url) {
      return NextResponse.json(
        { error: 'Video has no S3 URL' },
        { status: 400 }
      );
    }

    const s3Url = video.s3_url;

    // Check for required YouTube OAuth credentials
    if (
      !process.env.YOUTUBE_CLIENT_ID ||
      !process.env.YOUTUBE_CLIENT_SECRET ||
      !process.env.YOUTUBE_REFRESH_TOKEN
    ) {
      return NextResponse.json(
        {
          error:
            'YouTube API credentials not configured. Please set YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, and YOUTUBE_REFRESH_TOKEN in your .env file.',
        },
        { status: 500 }
      );
    }

    // Initialize OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.YOUTUBE_CLIENT_ID,
      process.env.YOUTUBE_CLIENT_SECRET,
      process.env.YOUTUBE_REDIRECT_URI || 'http://localhost:3000/api/youtube/callback'
    );

    // Set refresh token
    oauth2Client.setCredentials({
      refresh_token: process.env.YOUTUBE_REFRESH_TOKEN,
    });

    // Initialize YouTube API
    const youtube = google.youtube({
      version: 'v3',
      auth: oauth2Client,
    });

    // Download video from S3
    console.log('Downloading video from S3:', s3Url);
    const videoResponse = await fetch(s3Url);
    if (!videoResponse.ok) {
      throw new Error('Failed to download video from S3');
    }

    // Convert the response to a buffer
    const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());

    // Create a readable stream from the buffer
    const videoStream = Readable.from(videoBuffer);

    // Get tournament info
    const tournament = await getTournamentById(video.tournament_id);
    const aiScript = video.ai_script as Record<string, unknown> | null;

    // Generate title and description based on video type
    let title = '';
    let description = '';

    switch (video.video_type) {
      case 'tournament_overview':
        title = `${tournament?.name || 'Chess Tournament'} - Overview and Highlights`;
        description = `Complete overview of ${tournament?.name || 'the chess tournament'}\n\n`;
        if (aiScript?.summary) {
          description += `${aiScript.summary}\n\n`;
        }
        if (aiScript?.highlights && Array.isArray(aiScript.highlights)) {
          description += `Key Highlights:\n${aiScript.highlights.map((h: string) => `• ${h}`).join('\n')}\n\n`;
        }
        break;

      case 'round_overview':
        // Try to get round number from AI script or use a placeholder
        const roundNumber = aiScript?.roundNumber || '?';
        title = `${tournament?.name || 'Chess Tournament'} - Round ${roundNumber} Highlights`;
        description = `Analysis and highlights from Round ${roundNumber} of ${tournament?.name || 'the chess tournament'}\n\n`;
        if (aiScript?.summary) {
          description += `${aiScript.summary}\n\n`;
        }
        break;

      case 'player_overview':
        // Try to get player name from AI script or use a placeholder
        const playerName = aiScript?.playerName || 'Player';
        title = `${playerName} - ${tournament?.name || 'Chess Tournament'} Performance`;
        description = `Performance analysis of ${playerName} at ${tournament?.name || 'the chess tournament'}\n\n`;
        if (aiScript?.performanceSummary) {
          description += `${aiScript.performanceSummary}\n\n`;
        }
        break;
    }

    description += `\nGenerated with AI by chessmoments.com`;

    // Tags
    const tags = ['chess', 'tournament', 'chessanalysis', 'chessgame'];
    if (tournament?.name) {
      tags.push(tournament.name.replace(/\s+/g, '').toLowerCase());
    }

    // Upload to YouTube
    console.log('Uploading to YouTube...');
    const uploadResponse = await youtube.videos.insert({
      part: ['snippet', 'status'],
      requestBody: {
        snippet: {
          title: title.slice(0, 100), // YouTube title limit
          description: description.slice(0, 5000), // YouTube description limit
          tags,
          categoryId: '20', // Gaming category
        },
        status: {
          privacyStatus: 'unlisted', // You can change to "public" or "private"
        },
      },
      media: {
        body: videoStream,
      },
    });

    const youtubeVideoId = uploadResponse.data.id;
    const youtubeUrl = `https://www.youtube.com/watch?v=${youtubeVideoId}`;

    console.log('Upload successful:', youtubeUrl);

    // Update video metadata with YouTube URL
    const existingMetadata = video.metadata as Record<string, unknown> | null;
    const updatedMetadata = {
      ...(existingMetadata || {}),
      youtubeUrl,
      youtubeVideoId: youtubeVideoId || null,
      uploadedAt: new Date().toISOString(),
    };

    await updateTournamentVideoStatus(videoId, 'completed', {
      metadata: updatedMetadata,
    });

    return NextResponse.json({
      success: true,
      youtubeUrl,
      youtubeVideoId,
    });
  } catch (error) {
    console.error('YouTube upload error:', error);
    return NextResponse.json(
      {
        error: 'Failed to upload to YouTube',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
