/**
 * Game Analyzer Service
 * Analyzes player games using Stockfish and queues them for batch processing
 */

import {
  getPlayerGames,
  queueGameForAnalysis,
  getNextQueueItems,
  updateQueueItemStatus,
  getPlayerGameById,
  updatePlayerGameAnalysisStatus,
  createPendingAnalysis,
  updatePlayerProfileAnalysisStatus,
  type AnalysisQueueItem,
} from '@/lib/db';

export interface QueueGameOptions {
  priority?: number; // 1-10, higher = more important
  forceRequeue?: boolean; // Re-queue even if already analyzed
}

export interface AnalyzeResult {
  gameId: string;
  analysisId: string | null;
  status: 'completed' | 'failed' | 'skipped';
  error?: string;
}

/**
 * Queue a single game for analysis
 */
export async function queueSingleGame(
  gameId: string,
  options: QueueGameOptions = {}
): Promise<void> {
  const game = await getPlayerGameById(gameId);

  if (!game) {
    throw new Error(`Game ${gameId} not found`);
  }

  // Check if already analyzed
  if (game.analysis_status === 'completed' && !options.forceRequeue) {
    console.log(`Game ${gameId} already analyzed, skipping`);
    return;
  }

  // Add to queue
  await queueGameForAnalysis(gameId, options.priority || 5);

  // Update game status
  await updatePlayerGameAnalysisStatus(gameId, 'pending', {
    analysis_queued_at: new Date().toISOString(),
  });

  console.log(`Game ${gameId} queued for analysis`);
}

/**
 * Queue all pending games for a profile
 */
export async function queueAllPendingGames(
  profileId: string,
  options: QueueGameOptions = {}
): Promise<number> {
  // Get all games that haven't been analyzed
  const games = await getPlayerGames(profileId, {
    analysisStatus: 'pending',
  });

  console.log(`Found ${games.length} pending games for profile ${profileId}`);

  let queued = 0;
  for (const game of games) {
    try {
      await queueSingleGame(game.id, options);
      queued++;
    } catch (error) {
      console.error(`Failed to queue game ${game.id}:`, error);
    }
  }

  return queued;
}

/**
 * Process next batch of games from the analysis queue
 * This function should be called periodically (e.g., every minute)
 */
export async function processAnalysisQueue(
  batchSize: number = 5,
  depth: number = 18
): Promise<AnalyzeResult[]> {
  const results: AnalyzeResult[] = [];

  // Get next items to process
  const queueItems = await getNextQueueItems(batchSize);

  if (queueItems.length === 0) {
    console.log('No items in queue');
    return results;
  }

  console.log(`Processing ${queueItems.length} games from queue...`);

  // Process each item
  for (const queueItem of queueItems) {
    try {
      const result = await analyzeSingleGame(queueItem, depth);
      results.push(result);
    } catch (error) {
      console.error(`Failed to process queue item ${queueItem.id}:`, error);
      results.push({
        gameId: queueItem.player_game_id,
        analysisId: null,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return results;
}

/**
 * Analyze a single game from the queue
 */
async function analyzeSingleGame(
  queueItem: AnalysisQueueItem,
  depth: number
): Promise<AnalyzeResult> {
  const gameId = queueItem.player_game_id;

  try {
    // Mark as processing
    await updateQueueItemStatus(queueItem.id, 'processing', {
      started_at: new Date().toISOString(),
    });

    await updatePlayerGameAnalysisStatus(gameId, 'analyzing');

    // Get the game
    const game = await getPlayerGameById(gameId);
    if (!game) {
      throw new Error(`Game ${gameId} not found`);
    }

    console.log(`Analyzing game ${gameId}...`);

    // Create analysis record
    const analysis = await createPendingAnalysis(
      game.pgn,
      depth,
      true // find alternatives
    );

    // NOTE: In a real implementation, this would trigger the actual Stockfish analysis
    // For now, we'll just mark it as pending and let the existing analysis system handle it
    // The analysis system will update the status when complete

    // Update game with analysis ID
    await updatePlayerGameAnalysisStatus(gameId, 'analyzing', {
      chess_analysis_id: analysis.id,
    });

    // Mark queue item as completed
    await updateQueueItemStatus(queueItem.id, 'completed', {
      completed_at: new Date().toISOString(),
    });

    return {
      gameId,
      analysisId: analysis.id,
      status: 'completed',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Update queue item
    if (queueItem.attempts + 1 < queueItem.max_attempts) {
      // Retry
      await updateQueueItemStatus(queueItem.id, 'retry', {
        last_error: errorMessage,
      });
    } else {
      // Failed permanently
      await updateQueueItemStatus(queueItem.id, 'failed', {
        last_error: errorMessage,
      });
    }

    // Update game status
    await updatePlayerGameAnalysisStatus(gameId, 'failed');

    return {
      gameId,
      analysisId: null,
      status: 'failed',
      error: errorMessage,
    };
  }
}

/**
 * Start analysis for a player profile (import + queue all games)
 */
export async function startProfileAnalysis(
  profileId: string,
  priority: number = 5
): Promise<{
  totalGames: number;
  queued: number;
}> {
  // Mark profile as analysis in progress
  await updatePlayerProfileAnalysisStatus(profileId, {
    analysis_in_progress: true,
  });

  // Get all pending games
  const games = await getPlayerGames(profileId, {
    analysisStatus: 'pending',
  });

  console.log(`Starting analysis for ${games.length} games`);

  // Queue all games
  const queued = await queueAllPendingGames(profileId, { priority });

  return {
    totalGames: games.length,
    queued,
  };
}

/**
 * Get analysis progress for a profile
 */
export async function getProfileAnalysisProgress(
  profileId: string
): Promise<{
  total: number;
  pending: number;
  analyzing: number;
  completed: number;
  failed: number;
  percentComplete: number;
}> {
  const allGames = await getPlayerGames(profileId);

  const statusCounts = {
    pending: 0,
    analyzing: 0,
    completed: 0,
    failed: 0,
    skipped: 0,
  };

  for (const game of allGames) {
    statusCounts[game.analysis_status]++;
  }

  const total = allGames.length;
  const completed = statusCounts.completed + statusCounts.skipped;
  const percentComplete = total > 0 ? Math.round((completed / total) * 100) : 0;

  return {
    total,
    pending: statusCounts.pending,
    analyzing: statusCounts.analyzing,
    completed: statusCounts.completed,
    failed: statusCounts.failed,
    percentComplete,
  };
}

/**
 * Wait for all games in a profile to finish analyzing
 * This is a helper function for testing/debugging
 */
export async function waitForProfileAnalysis(
  profileId: string,
  pollIntervalMs: number = 5000,
  timeoutMs: number = 300000 // 5 minutes
): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const progress = await getProfileAnalysisProgress(profileId);

    console.log(
      `Analysis progress: ${progress.percentComplete}% ` +
      `(${progress.completed}/${progress.total} completed)`
    );

    if (progress.percentComplete === 100) {
      return true;
    }

    // Wait before polling again
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }

  console.log('Analysis timeout reached');
  return false;
}

/**
 * Cancel analysis for a profile
 */
export async function cancelProfileAnalysis(
  profileId: string
): Promise<void> {
  await updatePlayerProfileAnalysisStatus(profileId, {
    analysis_in_progress: false,
  });

  // Note: This doesn't remove items from the queue
  // They will just be skipped when processed
}

/**
 * Get queue statistics
 */
export async function getQueueStatistics(): Promise<{
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  retry: number;
}> {
  // This would ideally be a single query with GROUP BY
  // For now, we'll fetch all and count
  const allItems = await getNextQueueItems(10000); // Large limit

  const stats = {
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    retry: 0,
  };

  for (const item of allItems) {
    stats[item.status]++;
  }

  return stats;
}
