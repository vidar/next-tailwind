import {
  speculateFunctionName,
  AwsRegion,
  getRenderProgress,
} from "@remotion/lambda/client";
import { DISK, RAM, REGION, TIMEOUT } from "../../../../../config.mjs";
import { ChessProgressRequest } from "../../../../../types/schema";
import { executeApi } from "../../../../helpers/api-response";
import { getVideoById, updateVideoStatus } from "@/lib/db";

export const POST = executeApi<
  {
    type: "error" | "progress" | "done";
    message?: string;
    progress?: number;
    url?: string;
    size?: number;
  },
  typeof ChessProgressRequest
>(ChessProgressRequest, async (req, body) => {
  // Fetch video record to get render ID
  const video = await getVideoById(body.videoId);
  if (!video) {
    throw new Error(`Video not found: ${body.videoId}`);
  }

  // Type guard for metadata
  const metadata = video.metadata as { renderId?: string; bucketName?: string } | null;

  if (!metadata?.renderId || !metadata?.bucketName) {
    throw new Error("Video render not started");
  }

  const renderProgress = await getRenderProgress({
    bucketName: metadata.bucketName,
    functionName: speculateFunctionName({
      diskSizeInMb: DISK,
      memorySizeInMb: RAM,
      timeoutInSeconds: TIMEOUT,
    }),
    region: REGION as AwsRegion,
    renderId: metadata.renderId,
  });

  if (renderProgress.fatalErrorEncountered) {
    // Update database with error
    await updateVideoStatus(
      body.videoId,
      "failed",
      undefined,
      renderProgress.errors[0].message
    );

    return {
      type: "error" as const,
      message: renderProgress.errors[0].message,
    };
  }

  if (renderProgress.done) {
    // Update database with completed render
    await updateVideoStatus(
      body.videoId,
      "completed",
      renderProgress.outputFile as string
    );

    return {
      type: "done" as const,
      url: renderProgress.outputFile as string,
      size: renderProgress.outputSizeInBytes as number,
    };
  }

  // Update status to rendering if not already
  if (video.status === "pending") {
    await updateVideoStatus(body.videoId, "rendering");
  }

  return {
    type: "progress" as const,
    progress: Math.max(0.03, renderProgress.overallProgress),
  };
});
