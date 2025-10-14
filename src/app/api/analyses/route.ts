import { NextResponse } from "next/server";
import { getCompletedAnalyses } from "@/lib/db";

export async function GET() {
  try {
    const analyses = await getCompletedAnalyses();
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
