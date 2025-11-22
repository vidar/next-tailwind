import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getCompletedAnalyses } from "@/lib/db";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized - Please sign in to view your analyzed games" },
        { status: 401 }
      );
    }

    const analyses = await getCompletedAnalyses(userId);
    return NextResponse.json({ analyses });
  } catch (error) {
    console.error("Database error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch analyses",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
