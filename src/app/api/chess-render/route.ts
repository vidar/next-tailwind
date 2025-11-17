import { AwsRegion } from "@remotion/lambda/client";
import {
  renderMediaOnLambda,
  speculateFunctionName,
} from "@remotion/lambda/client";
import {
  DISK,
  RAM,
  REGION,
  SITE_NAME,
  TIMEOUT,
} from "../../../../config.mjs";
import { ChessRenderRequest } from "../../../../types/schema";
import { executeApi } from "../../../helpers/api-response";
import { getAnalysisById, createVideo, getAnnotationsByGameId, type GameAnnotation } from "@/lib/db";
import { CHESS_GAME_COMP_NAME, CHESS_GAME_ANNOTATED_COMP_NAME, CHESS_GAME_HIGHLIGHTS_COMP_NAME, CHESS_GAME_PUZZLE_COMP_NAME, ASPECT_RATIOS } from "../../../../types/constants";
import { generateChapters, generateDescription } from "@/lib/youtube-metadata";
import { auth } from "@clerk/nextjs/server";

function extractGameInfo(pgn: string) {
  const whiteMatch = pgn.match(/\[White "([^"]+)"\]/);
  const blackMatch = pgn.match(/\[Black "([^"]+)"\]/);
  const resultMatch = pgn.match(/\[Result "([^"]+)"\]/);
  const dateMatch = pgn.match(/\[Date "([^"]+)"\]/);

  return {
    white: whiteMatch ? whiteMatch[1] : "Unknown",
    black: blackMatch ? blackMatch[1] : "Unknown",
    result: resultMatch ? resultMatch[1] : "*",
    date: dateMatch ? dateMatch[1] : "Unknown",
  };
}

export const POST = executeApi<
  { videoId: string; renderId: string; bucketName: string },
  typeof ChessRenderRequest
>(ChessRenderRequest, async (req, body) => {
  // Get authenticated user from Clerk
  const { userId } = await auth();
  if (!userId) {
    throw new Error("User not authenticated");
  }

  if (
    !process.env.AWS_ACCESS_KEY_ID &&
    !process.env.REMOTION_AWS_ACCESS_KEY_ID
  ) {
    throw new TypeError(
      "Set up Remotion Lambda to render videos. See the README.md for how to do so.",
    );
  }
  if (
    !process.env.AWS_SECRET_ACCESS_KEY &&
    !process.env.REMOTION_AWS_SECRET_ACCESS_KEY
  ) {
    throw new TypeError(
      "The environment variable REMOTION_AWS_SECRET_ACCESS_KEY is missing. Add it to your .env file.",
    );
  }

  // Fetch game data
  const analysis = await getAnalysisById(body.gameId);
  if (!analysis) {
    throw new Error(`Game not found: ${body.gameId}`);
  }

  // Extract game info from PGN
  const gameInfo = extractGameInfo(analysis.pgn);

  // Determine composition type and fetch annotations if needed
  const compositionType = body.compositionType || "walkthrough";
  const aspectRatio = body.aspectRatio || "landscape";
  const orientation = body.orientation || "white";
  const musicGenre = body.musicGenre || "none";

  const inputProps: Record<string, unknown> = {
    pgn: analysis.pgn,
    analysisResults: analysis.analysis_results,
    gameInfo,
    orientation,
    musicGenre,
  };

  let compositionId = CHESS_GAME_COMP_NAME;
  let annotations: GameAnnotation[] = [];

  if (compositionType === "annotated") {
    annotations = await getAnnotationsByGameId(body.gameId);
    if (annotations.length === 0) {
      throw new Error("Cannot render annotated video without annotations");
    }
    inputProps.annotations = annotations;
    compositionId = CHESS_GAME_ANNOTATED_COMP_NAME;
  } else if (compositionType === "highlights") {
    compositionId = CHESS_GAME_HIGHLIGHTS_COMP_NAME;
  } else if (compositionType === "puzzle") {
    annotations = await getAnnotationsByGameId(body.gameId);
    if (annotations.length === 0) {
      throw new Error("Cannot render puzzle video without annotations");
    }
    inputProps.annotations = annotations;
    compositionId = CHESS_GAME_PUZZLE_COMP_NAME;
  }

  // Generate YouTube metadata (chapters, description, etc.)
  const chapters = generateChapters(
    analysis.pgn,
    annotations,
    compositionType as 'walkthrough' | 'annotated' | 'highlights' | 'puzzle'
  );

  const description = generateDescription(
    gameInfo,
    analysis.pgn,
    chapters,
    annotations,
    body.gameId
  );

  const metadata = {
    gameInfo,
    chapters,
    description,
    hashtags: chapters.length > 0 ? [] : [], // Hashtags are included in description
  };

  // Get dimensions based on aspect ratio
  const dimensions = ASPECT_RATIOS[aspectRatio as keyof typeof ASPECT_RATIOS];

  // Start Lambda render
  const result = await renderMediaOnLambda({
    codec: "h264",
    functionName: speculateFunctionName({
      diskSizeInMb: DISK,
      memorySizeInMb: RAM,
      timeoutInSeconds: TIMEOUT,
    }),
    region: REGION as AwsRegion,
    serveUrl: SITE_NAME,
    composition: compositionId,
    inputProps: {
      ...inputProps,
      width: dimensions.width,
      height: dimensions.height,
    },
    imageFormat: "jpeg",
    framesPerLambda: 100,
    downloadBehavior: {
      type: "download",
      fileName: `chess-${compositionType}-${aspectRatio}-${body.gameId}-${Date.now()}.mp4`,
    },
  });

  // Create video record with render and YouTube metadata
  const video = await createVideo(
    userId,
    body.gameId,
    body.compositionType || "walkthrough",
    {
      renderId: result.renderId,
      bucketName: result.bucketName,
      ...metadata,
    }
  );

  return {
    videoId: video.id,
    renderId: result.renderId,
    bucketName: result.bucketName,
  };
});
