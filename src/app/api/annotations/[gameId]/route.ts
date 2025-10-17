import { NextRequest, NextResponse } from "next/server";
import { getAnnotationsByGameId } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    const annotations = await getAnnotationsByGameId(gameId);

    return NextResponse.json({ annotations });
  } catch (error) {
    console.error("Error fetching annotations:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch annotations",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
