import { AwsRegion, RenderMediaOnLambdaOutput } from "@remotion/lambda/client";
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
import { getAnalysisById, createVideo, getAnnotationsByGameId } from "@/lib/db";
import { Chess } from "chess.js";
import { CHESS_GAME_COMP_NAME, CHESS_GAME_ANNOTATED_COMP_NAME, CHESS_VIDEO_FPS, CHESS_SECONDS_PER_MOVE, ASPECT_RATIOS } from "../../../../types/constants";
import { generateChapters, generateDescription } from "@/lib/youtube-metadata";

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

function calculateDuration(pgn: string, fps: number): number {
  try {
    const game = new Chess();
    game.loadPgn(pgn);
    const moves = game.history();
    const INTRO_DURATION = 3; // 3 seconds intro
    const OUTRO_DURATION = 3; // 3 seconds outro
    const gameDuration = moves.length * CHESS_SECONDS_PER_MOVE;
    return (INTRO_DURATION + gameDuration + OUTRO_DURATION) * fps;
  } catch {
    return 66 * fps; // Default to 66 seconds (60 + 3 intro + 3 outro)
  }
}

function calculateAnnotatedDuration(pgn: string, annotationCount: number, fps: number): number {
  try {
    const game = new Chess();
    game.loadPgn(pgn);
    const moves = game.history();
    const INTRO_DURATION = 3; // 3 seconds intro
    const OUTRO_DURATION = 3; // 3 seconds outro
    const baseDuration = moves.length * CHESS_SECONDS_PER_MOVE;
    const annotationDuration = annotationCount * 4; // 4 seconds per annotation
    return (INTRO_DURATION + baseDuration + annotationDuration + OUTRO_DURATION) * fps;
  } catch {
    return 66 * fps; // Default
  }
}

export const POST = executeApi<
  { videoId: string; renderId: string; bucketName: string },
  typeof ChessRenderRequest
>(ChessRenderRequest, async (req, body) => {
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

  let inputProps: any = {
    pgn: analysis.pgn,
    analysisResults: analysis.analysis_results,
    gameInfo,
  };

  let compositionId = CHESS_GAME_COMP_NAME;
  let annotations: any[] = [];

  if (compositionType === "annotated") {
    annotations = await getAnnotationsByGameId(body.gameId);
    if (annotations.length === 0) {
      throw new Error("Cannot render annotated video without annotations");
    }
    inputProps.annotations = annotations;
    compositionId = CHESS_GAME_ANNOTATED_COMP_NAME;
  }

  // Generate YouTube metadata (chapters, description, etc.)
  const chapters = generateChapters(
    analysis.pgn,
    annotations,
    compositionType as any,
    CHESS_VIDEO_FPS
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
    inputProps,
    imageFormat: "jpeg",
    width: dimensions.width,
    height: dimensions.height,
    framesPerLambda: 100,
    downloadBehavior: {
      type: "download",
      fileName: `chess-${compositionType}-${aspectRatio}-${body.gameId}-${Date.now()}.mp4`,
    },
  });

  // Create video record with render and YouTube metadata
  const video = await createVideo(
    body.userId,
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
