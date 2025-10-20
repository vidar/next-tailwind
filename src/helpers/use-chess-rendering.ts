import { useCallback, useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";

export type ChessRenderState =
  | {
      status: "init";
    }
  | {
      status: "invoking";
    }
  | {
      videoId: string;
      progress: number;
      status: "rendering";
    }
  | {
      videoId: string | null;
      status: "error";
      error: Error;
    }
  | {
      url: string;
      size: number;
      status: "done";
    };

const wait = async (milliSeconds: number) => {
  await new Promise<void>((resolve) => {
    setTimeout(() => {
      resolve();
    }, milliSeconds);
  });
};

export const useChessRendering = (gameId: string) => {
  const { user } = useUser();
  const [state, setState] = useState<ChessRenderState>({
    status: "init",
  });

  const renderMedia = useCallback(async (
    compositionType: "walkthrough" | "annotated" = "walkthrough",
    aspectRatio: "landscape" | "portrait" = "landscape",
    orientation: "white" | "black" = "white"
  ) => {
    if (!user) {
      setState({
        status: "error",
        error: new Error("User not authenticated"),
        videoId: null,
      });
      return;
    }

    setState({
      status: "invoking",
    });

    try {
      // Start render
      const startResponse = await fetch("/api/chess-render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId,
          compositionType,
          aspectRatio,
          orientation,
        }),
      });

      if (!startResponse.ok) {
        throw new Error("Failed to start render");
      }

      const startData = await startResponse.json();
      if (startData.type === "error") {
        throw new Error(startData.message);
      }

      const { videoId } = startData.data;

      setState({
        status: "rendering",
        progress: 0,
        videoId,
      });

      // Poll for progress
      let pending = true;

      while (pending) {
        await wait(2000); // Poll every 2 seconds

        const progressResponse = await fetch("/api/chess-render/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ videoId }),
        });

        if (!progressResponse.ok) {
          throw new Error("Failed to get progress");
        }

        const progressData = await progressResponse.json();
        if (progressData.type === "error") {
          throw new Error(progressData.message);
        }

        const result = progressData.data;

        switch (result.type) {
          case "error": {
            setState({
              status: "error",
              videoId,
              error: new Error(result.message),
            });
            pending = false;
            break;
          }
          case "done": {
            setState({
              size: result.size,
              url: result.url,
              status: "done",
            });
            pending = false;
            break;
          }
          case "progress": {
            setState({
              status: "rendering",
              progress: result.progress,
              videoId,
            });
            break;
          }
        }
      }
    } catch (err) {
      setState({
        status: "error",
        error: err as Error,
        videoId: null,
      });
    }
  }, [gameId, user]);

  const undo = useCallback(() => {
    setState({ status: "init" });
  }, []);

  return useMemo(() => {
    return {
      renderMedia,
      state,
      undo,
    };
  }, [renderMedia, state, undo]);
};
