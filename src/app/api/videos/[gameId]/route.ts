import { NextRequest, NextResponse } from "next/server";
import { getVideosByGameId } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    const videos = await getVideosByGameId(gameId);

    return NextResponse.json({ videos });
  } catch (error) {
    console.error("Database error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch videos",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
