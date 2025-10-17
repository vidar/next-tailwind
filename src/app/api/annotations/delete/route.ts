import { NextRequest, NextResponse } from "next/server";
import { deleteAnnotation } from "@/lib/db";

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { annotationId } = body;

    if (!annotationId) {
      return NextResponse.json(
        { error: "Missing required field: annotationId" },
        { status: 400 }
      );
    }

    await deleteAnnotation(annotationId);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error deleting annotation:", error);
    return NextResponse.json(
      {
        error: "Failed to delete annotation",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
