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
import { getAnalysisById, createVideo } from "@/lib/db";
import { Chess } from "chess.js";
import { CHESS_GAME_COMP_NAME, CHESS_VIDEO_FPS, CHESS_SECONDS_PER_MOVE } from "../../../../types/constants";

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

  // Prepare input props for Remotion
  const inputProps = {
    pgn: analysis.pgn,
    analysisResults: analysis.analysis_results,
    gameInfo,
  };

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
    composition: CHESS_GAME_COMP_NAME,
    inputProps,
    framesPerLambda: 100,
    downloadBehavior: {
      type: "download",
      fileName: `chess-${body.gameId}-${Date.now()}.mp4`,
    },
  });

  // Create video record with render metadata
  const video = await createVideo(
    body.userId,
    body.gameId,
    body.compositionType || "walkthrough",
    {
      renderId: result.renderId,
      bucketName: result.bucketName,
    }
  );

  return {
    videoId: video.id,
    renderId: result.renderId,
    bucketName: result.bucketName,
  };
});
