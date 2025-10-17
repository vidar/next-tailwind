import { NextRequest, NextResponse } from "next/server";
import { upsertAnnotation } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { gameId, moveIndex, annotationText } = body;

    // Validation
    if (!gameId || moveIndex === undefined || !annotationText) {
      return NextResponse.json(
        { error: "Missing required fields: gameId, moveIndex, annotationText" },
        { status: 400 }
      );
    }

    if (typeof moveIndex !== "number" || moveIndex < 0) {
      return NextResponse.json(
        { error: "moveIndex must be a non-negative number" },
        { status: 400 }
      );
    }

    if (annotationText.length > 500) {
      return NextResponse.json(
        { error: "Annotation text must be 500 characters or less" },
        { status: 400 }
      );
    }

    if (annotationText.trim().length === 0) {
      return NextResponse.json(
        { error: "Annotation text cannot be empty" },
        { status: 400 }
      );
    }

    const annotation = await upsertAnnotation(gameId, moveIndex, annotationText.trim());

    return NextResponse.json({ annotation }, { status: 200 });
  } catch (error) {
    console.error("Error creating/updating annotation:", error);
    return NextResponse.json(
      {
        error: "Failed to save annotation",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
