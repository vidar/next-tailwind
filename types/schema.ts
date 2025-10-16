import { z } from "zod";
import { CompositionProps, ChessGameProps } from "./constants";

export const RenderRequest = z.object({
  id: z.string(),
  inputProps: CompositionProps,
});

export const ProgressRequest = z.object({
  bucketName: z.string(),
  id: z.string(),
});

export type ProgressResponse =
  | {
      type: "error";
      message: string;
    }
  | {
      type: "progress";
      progress: number;
    }
  | {
      type: "done";
      url: string;
      size: number;
    };

// Chess game rendering schemas
export const ChessRenderRequest = z.object({
  gameId: z.string().uuid(),
  userId: z.string(),
  compositionType: z.string().optional().default("walkthrough"),
});

export const ChessProgressRequest = z.object({
  videoId: z.string().uuid(),
});
