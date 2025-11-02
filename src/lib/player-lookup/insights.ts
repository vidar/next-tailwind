/**
 * Insights Calculator Service
 * Computes insights from analyzed games (accuracy, blunders, surprising results, etc.)
 */

import {
  getPlayerGameById,
  getAnalysisById,
  createPlayerGameInsight,
  getPlayerGames,
  ChessAnalysis,
} from '@/lib/db';

interface MoveEvaluation {
  moveNumber: number;
  move: string;
  evalBefore: number | null;
  evalAfter: number | null;
  evalDrop: number;
  classification: 'brilliant' | 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';
}

interface GameAnalysisData {
  moveEvaluations: MoveEvaluation[];
  playerMoves: MoveEvaluation[];
  averageCPL: number;
  accuracy: number;
}

/**
 * Calculate expected result based on rating difference (Elo formula)
 * Returns probability of winning (0.0 to 1.0)
 */
export function calculateExpectedResult(
  playerRating: number,
  opponentRating: number
): number {
  const ratingDiff = playerRating - opponentRating;
  return 1 / (1 + Math.pow(10, -ratingDiff / 400));
}

/**
 * Parse analysis results and extract move-by-move evaluations
 */
function parseAnalysisResults(analysis: ChessAnalysis): GameAnalysisData | null {
  if (!analysis.analysis_results) {
    return null;
  }

  // TODO: This needs to be adapted to match the actual analysis_results structure
  // For now, we'll create a placeholder structure
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const analysisData = analysis.analysis_results as any;

  if (!analysisData.moves || !Array.isArray(analysisData.moves)) {
    return null;
  }

  const moveEvaluations: MoveEvaluation[] = [];
  let totalCPL = 0;
  let moveCount = 0;

  for (let i = 0; i < analysisData.moves.length; i++) {
    const moveData = analysisData.moves[i];

    const evalBefore = moveData.evalBefore ?? null;
    const evalAfter = moveData.evalAfter ?? null;
    const evalDrop = Math.abs((evalAfter || 0) - (evalBefore || 0));

    // Classify move based on eval drop
    let classification: MoveEvaluation['classification'] = 'best';
    if (evalDrop > 300) {
      classification = 'blunder';
    } else if (evalDrop > 100) {
      classification = 'mistake';
    } else if (evalDrop > 50) {
      classification = 'inaccuracy';
    } else if (evalDrop < 10 && moveData.isBest) {
      classification = 'best';
    }

    moveEvaluations.push({
      moveNumber: Math.floor(i / 2) + 1,
      move: moveData.move || '',
      evalBefore,
      evalAfter,
      evalDrop,
      classification,
    });

    totalCPL += evalDrop;
    moveCount++;
  }

  const averageCPL = moveCount > 0 ? totalCPL / moveCount : 0;

  // Calculate accuracy (simplified formula)
  const accuracy = Math.max(0, 100 - averageCPL / 10);

  return {
    moveEvaluations,
    playerMoves: moveEvaluations, // In a full implementation, filter by player color
    averageCPL,
    accuracy,
  };
}

/**
 * Find the most game-changing blunder
 */
function findGameChangingBlunder(
  moves: MoveEvaluation[]
): { move: string; moveNumber: number; evalDrop: number } | null {
  const blunders = moves.filter(m => m.classification === 'blunder');

  if (blunders.length === 0) {
    return null;
  }

  // Find worst blunder
  const worstBlunder = blunders.reduce((worst, current) =>
    current.evalDrop > worst.evalDrop ? current : worst
  );

  return {
    move: worstBlunder.move,
    moveNumber: worstBlunder.moveNumber,
    evalDrop: worstBlunder.evalDrop,
  };
}

/**
 * Find missed wins (positions where player had winning advantage but didn't convert)
 */
function findMissedWins(
  moves: MoveEvaluation[],
  result: string
): Array<{ moveNumber: number; eval: number }> | null {
  // Only look for missed wins if player didn't win
  if (result === '1-0' || result === '0-1') {
    return null; // Player won, no missed wins
  }

  const missedWins: Array<{ moveNumber: number; eval: number }> = [];

  for (const move of moves) {
    // If evaluation was strongly winning (>300 centipawns) but player didn't win
    if (move.evalAfter && Math.abs(move.evalAfter) > 300) {
      missedWins.push({
        moveNumber: move.moveNumber,
        eval: move.evalAfter,
      });
    }
  }

  return missedWins.length > 0 ? missedWins : null;
}

/**
 * Find brilliant moments (best moves in critical positions)
 */
function findBrilliantMoment(
  moves: MoveEvaluation[]
): { move: string; moveNumber: number; eval: number } | null {
  const brilliantMoves = moves.filter(
    m => m.classification === 'brilliant' || m.classification === 'best'
  );

  if (brilliantMoves.length === 0) {
    return null;
  }

  // Find best move in most critical position
  const bestMove = brilliantMoves.reduce((best, current) => {
    const currentCriticality = Math.abs(current.evalBefore || 0);
    const bestCriticality = Math.abs(best.evalBefore || 0);
    return currentCriticality > bestCriticality ? current : best;
  });

  return {
    move: bestMove.move,
    moveNumber: bestMove.moveNumber,
    eval: bestMove.evalAfter || 0,
  };
}

/**
 * Evaluate opening phase performance
 */
function evaluateOpeningPhase(
  moves: MoveEvaluation[]
): { eval: number; advantage: boolean } | null {
  // Look at first 10 moves
  const openingMoves = moves.slice(0, 10);

  if (openingMoves.length === 0) {
    return null;
  }

  // Average evaluation at end of opening
  const lastMove = openingMoves[openingMoves.length - 1];
  const evaluation = lastMove.evalAfter || 0;

  return {
    eval: evaluation,
    advantage: Math.abs(evaluation) > 50, // More than 0.5 pawns advantage
  };
}

/**
 * Calculate insights for a single game
 */
export async function calculateGameInsights(gameId: string): Promise<void> {
  const game = await getPlayerGameById(gameId);

  if (!game) {
    throw new Error(`Game ${gameId} not found`);
  }

  if (!game.chess_analysis_id) {
    console.log(`Game ${gameId} has no analysis yet`);
    return;
  }

  const analysis = await getAnalysisById(game.chess_analysis_id);

  if (!analysis || analysis.status !== 'completed') {
    console.log(`Analysis for game ${gameId} not completed yet`);
    return;
  }

  // Parse analysis
  const analysisData = parseAnalysisResults(analysis);

  if (!analysisData) {
    console.log(`Could not parse analysis results for game ${gameId}`);
    return;
  }

  // Calculate insights
  const playerMoves = analysisData.playerMoves;

  const blunders = playerMoves.filter(m => m.classification === 'blunder').length;
  const mistakes = playerMoves.filter(m => m.classification === 'mistake').length;
  const inaccuracies = playerMoves.filter(m => m.classification === 'inaccuracy').length;
  const brilliantMoves = playerMoves.filter(m => m.classification === 'brilliant').length;
  const bestMoves = playerMoves.filter(m => m.classification === 'best').length;

  const gameChangingBlunder = findGameChangingBlunder(playerMoves);
  const missedWins = findMissedWins(playerMoves, game.result || '1/2-1/2');
  const brilliantMoment = findBrilliantMoment(playerMoves);
  const openingPhase = evaluateOpeningPhase(analysisData.moveEvaluations);

  // Calculate expected vs actual result
  let expectedResult: number | null = null;
  let actualResult: number | null = null;
  let resultSurprise: number | null = null;

  const playerRating = game.player_color === 'white' ? game.white_rating : game.black_rating;
  const opponentRating = game.player_color === 'white' ? game.black_rating : game.white_rating;

  if (playerRating && opponentRating) {
    expectedResult = calculateExpectedResult(playerRating, opponentRating);

    // Convert game result to score (1 = win, 0.5 = draw, 0 = loss)
    if (game.result === '1-0') {
      actualResult = game.player_color === 'white' ? 1 : 0;
    } else if (game.result === '0-1') {
      actualResult = game.player_color === 'white' ? 0 : 1;
    } else {
      actualResult = 0.5;
    }

    // Surprise factor: difference between actual and expected
    resultSurprise = actualResult - expectedResult;
  }

  // Create insights record
  await createPlayerGameInsight({
    player_game_id: gameId,
    chess_analysis_id: game.chess_analysis_id,
    average_centipawn_loss: analysisData.averageCPL,
    accuracy_percentage: analysisData.accuracy,
    blunders_count: blunders,
    mistakes_count: mistakes,
    inaccuracies_count: inaccuracies,
    brilliant_moves_count: brilliantMoves,
    best_moves_count: bestMoves,
    game_changing_blunder: gameChangingBlunder,
    missed_wins: missedWins,
    brilliant_moment: brilliantMoment,
    expected_result: expectedResult ?? undefined,
    actual_result: actualResult ?? undefined,
    result_surprise: resultSurprise ?? undefined,
    opening_phase_eval: openingPhase?.eval,
    opening_advantage: openingPhase?.advantage,
  });

  console.log(`Insights calculated for game ${gameId}`);
}

/**
 * Calculate insights for all analyzed games in a profile
 */
export async function calculateProfileInsights(profileId: string): Promise<{
  processed: number;
  errors: number;
}> {
  const games = await getPlayerGames(profileId, {
    analysisStatus: 'completed',
  });

  console.log(`Calculating insights for ${games.length} games`);

  let processed = 0;
  let errors = 0;

  for (const game of games) {
    try {
      await calculateGameInsights(game.id);
      processed++;
    } catch (error) {
      console.error(`Error calculating insights for game ${game.id}:`, error);
      errors++;
    }
  }

  return { processed, errors };
}

/**
 * Get most surprising games (biggest difference between expected and actual result)
 */
export async function getMostSurprisingGames(
  profileId: string,
  limit: number = 10
): Promise<Array<{ gameId: string; surprise: number; result: string }>> {
  // This would ideally be a database query with JOIN and ORDER BY
  // For now, we'll fetch all games and sort in memory

  const games = await getPlayerGames(profileId, {
    analysisStatus: 'completed',
  });

  const gamesWithInsights = await Promise.all(
    games.map(async game => {
      // We'd need a function to get insights by game ID
      // For now, return placeholder
      return {
        gameId: game.id,
        surprise: 0, // Would come from insights
        result: game.result || '1/2-1/2',
      };
    })
  );

  // Sort by absolute surprise value
  gamesWithInsights.sort((a, b) => Math.abs(b.surprise) - Math.abs(a.surprise));

  return gamesWithInsights.slice(0, limit);
}
