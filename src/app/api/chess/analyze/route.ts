import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pgn, depth, find_alternatives } = body;

    if (!pgn) {
      return NextResponse.json(
        { error: "PGN data is required" },
        { status: 400 }
      );
    }

    if (!depth || ![20, 30, 40].includes(depth)) {
      return NextResponse.json(
        { error: "Depth must be 20, 30, or 40" },
        { status: 400 }
      );
    }

    // Forward the request to the Stockfish API
    const response = await fetch(
      "https://stockfish.chessmoments.com/api/analyze",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pgn,
          depth,
          find_alternatives: find_alternatives ?? true,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Stockfish API error:", errorText);
      return NextResponse.json(
        {
          error: `Stockfish API error: ${response.statusText}`,
          details: errorText,
        },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Log the raw analysis results from the external service
    console.log("=== Analysis Results from Stockfish API ===");
    console.log(JSON.stringify(data, null, 2));
    console.log("=== End Analysis Results ===");

    return NextResponse.json(data);
  } catch (error) {
    console.error("Analysis API error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "An error occurred",
      },
      { status: 500 }
    );
  }
}
