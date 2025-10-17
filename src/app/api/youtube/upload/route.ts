import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getVideoById, updateVideoMetadata } from "@/lib/db";
import { Readable } from "stream";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { videoId } = body;

    if (!videoId) {
      return NextResponse.json(
        { error: "Video ID is required" },
        { status: 400 }
      );
    }

    // Get video from database
    const video = await getVideoById(videoId);
    if (!video) {
      return NextResponse.json(
        { error: "Video not found" },
        { status: 404 }
      );
    }

    if (!video.s3_url) {
      return NextResponse.json(
        { error: "Video has no S3 URL" },
        { status: 400 }
      );
    }

    // Check for required YouTube OAuth credentials
    if (!process.env.YOUTUBE_CLIENT_ID || !process.env.YOUTUBE_CLIENT_SECRET || !process.env.YOUTUBE_REFRESH_TOKEN) {
      return NextResponse.json(
        { error: "YouTube API credentials not configured. Please set YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, and YOUTUBE_REFRESH_TOKEN in your .env file." },
        { status: 500 }
      );
    }

    // Initialize OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.YOUTUBE_CLIENT_ID,
      process.env.YOUTUBE_CLIENT_SECRET,
      process.env.YOUTUBE_REDIRECT_URI || "http://localhost:3000/api/youtube/callback"
    );

    // Set refresh token
    oauth2Client.setCredentials({
      refresh_token: process.env.YOUTUBE_REFRESH_TOKEN,
    });

    // Initialize YouTube API
    const youtube = google.youtube({
      version: "v3",
      auth: oauth2Client,
    });

    // Download video from S3
    console.log("Downloading video from S3:", video.s3_url);
    const videoResponse = await fetch(video.s3_url);
    if (!videoResponse.ok) {
      throw new Error("Failed to download video from S3");
    }

    // Convert the response to a buffer
    const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());

    // Create a readable stream from the buffer
    const videoStream = Readable.from(videoBuffer);

    // Get game info from metadata
    const gameInfo = video.metadata?.gameInfo || {};
    const title = `${gameInfo.white || "Player 1"} vs ${gameInfo.black || "Player 2"} - Chess Game Analysis`;
    const description = `Chess game analysis and walkthrough.

White: ${gameInfo.white || "Unknown"}
Black: ${gameInfo.black || "Unknown"}
Result: ${gameInfo.result || "Unknown"}
Date: ${gameInfo.date || "Unknown"}

Generated with chessmoments.com`;

    // Upload to YouTube
    console.log("Uploading to YouTube...");
    const uploadResponse = await youtube.videos.insert({
      part: ["snippet", "status"],
      requestBody: {
        snippet: {
          title,
          description,
          tags: ["chess", "chess analysis", "chess game", "chess strategy"],
          categoryId: "20", // Gaming category
        },
        status: {
          privacyStatus: "unlisted", // You can change to "public" or "private"
        },
      },
      media: {
        body: videoStream,
      },
    });

    const youtubeVideoId = uploadResponse.data.id;
    const youtubeUrl = `https://www.youtube.com/watch?v=${youtubeVideoId}`;

    console.log("Upload successful:", youtubeUrl);

    // Update video metadata with YouTube URL
    const updatedMetadata = {
      ...video.metadata,
      youtubeUrl,
      youtubeVideoId,
      uploadedAt: new Date().toISOString(),
    };

    await updateVideoMetadata(videoId, updatedMetadata);

    return NextResponse.json({
      success: true,
      youtubeUrl,
      youtubeVideoId,
    });
  } catch (error) {
    console.error("YouTube upload error:", error);
    return NextResponse.json(
      {
        error: "Failed to upload to YouTube",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
