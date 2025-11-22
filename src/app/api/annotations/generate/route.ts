import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

/**
 * POST /api/annotations/generate
 *
 * Generates an annotation for a chess move using AI
 *
 * Body:
 * {
 *   position: string; // FEN position before the move
 *   move: string; // Move in SAN notation
 *   evaluation?: number; // Position evaluation after the move
 *   previousEvaluation?: number; // Previous position evaluation
 *   bestMove?: string; // Engine's recommended best move
 *   bestEvaluation?: number; // Evaluation of the best move
 *   classification?: string; // Move classification (blunder, mistake, brilliant, best, etc.)
 *   moveNumber?: number; // Move number in the game
 *   sideToMove?: 'white' | 'black'; // Which side played this move
 *   previousMoves?: string[]; // Last few moves for context
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized - Please sign in to generate annotations' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      position,
      move,
      evaluation,
      previousEvaluation,
      bestMove,
      bestEvaluation,
      classification,
      moveNumber,
      sideToMove,
      previousMoves
    } = body;

    if (!position || !move) {
      return NextResponse.json(
        { error: 'Position and move are required' },
        { status: 400 }
      );
    }

    // Determine game phase from FEN
    const gamePhase = determineGamePhase(position);

    // Format evaluation for readability
    const formatEval = (val: number | undefined): string => {
      if (val === undefined) return 'Unknown';
      if (Math.abs(val) > 10) return val > 0 ? 'Winning' : 'Losing';
      if (Math.abs(val) > 5) return val > 0 ? 'Clear advantage' : 'Clear disadvantage';
      if (Math.abs(val) > 2) return val > 0 ? 'Slight advantage' : 'Slight disadvantage';
      if (Math.abs(val) > 0.5) return val > 0 ? 'Slightly better' : 'Slightly worse';
      return 'Equal';
    };

    // Build comprehensive context
    const systemPrompt = `You are an expert chess coach providing move annotations in the style of grandmaster commentary.

Guidelines for high-quality annotations:
- Focus on the IDEAS and PLANS behind moves, not just describing what happened
- Explain tactical themes (pins, forks, discovered attacks, skewers, deflection, etc.)
- Highlight strategic concepts (pawn structure, piece activity, king safety, space advantage)
- When a move is a mistake, BRIEFLY explain what was better and why
- Avoid stating obvious things like "develops a piece" without explaining the deeper purpose
- Use chess terminology appropriately but remain accessible
- Be specific about what makes a move good or bad
- Keep annotations to 2-3 sentences maximum

Examples of GOOD annotations:
- "This pawn break challenges Black's central control and opens the long diagonal for the light-squared bishop, though it does create a slight weakness on d3."
- "Missing Nf6+! which would have won material after the forced king move. The text move allows Black to consolidate with tempo."
- "An excellent positional sacrifice! White gives up the exchange for a dominant knight on d5 and lasting pressure against Black's weak c-pawn."
- "Preparing the thematic b4-b5 pawn break while sidestepping any Ng4 tactics. A patient approach that maintains White's spatial advantage."

Examples of BAD annotations:
- "White plays Nf3." (too obvious, no insight)
- "This move develops the knight." (superficial, lacks depth)
- "Good move!" (not educational, no explanation)
- "The position is complex." (vague, unhelpful)`;

    let userPrompt = `Game Context:
${moveNumber ? `Move ${Math.ceil(moveNumber / 2)}${moveNumber % 2 === 1 ? '.' : '...'} ${sideToMove === 'white' ? 'White' : sideToMove === 'black' ? 'Black' : ''}` : ''}
Game Phase: ${gamePhase}
Position (FEN): ${position}
${previousMoves && previousMoves.length > 0 ? `\nRecent moves: ${previousMoves.join(' ')}` : ''}

Move Played: ${move}`;

    if (classification) {
      userPrompt += `\nMove Classification: ${classification}`;
    }

    if (evaluation !== undefined) {
      userPrompt += `\nPosition after move: ${formatEval(evaluation)} (${evaluation > 0 ? '+' : ''}${evaluation.toFixed(2)})`;
    }

    if (previousEvaluation !== undefined && evaluation !== undefined) {
      const evalChange = evaluation - previousEvaluation;
      userPrompt += `\nEvaluation change: ${evalChange > 0 ? '+' : ''}${evalChange.toFixed(2)}`;
    }

    if (bestMove && bestMove !== move && bestEvaluation !== undefined && evaluation !== undefined) {
      const evalLoss = Math.abs(bestEvaluation - evaluation);
      userPrompt += `\n\nEngine Analysis:
Best Move: ${bestMove} (${bestEvaluation > 0 ? '+' : ''}${bestEvaluation.toFixed(2)})
Evaluation Loss: ${evalLoss.toFixed(2)} (${evalLoss < 0.5 ? 'negligible' : evalLoss < 1.5 ? 'minor' : evalLoss < 3 ? 'significant' : 'major'})`;
    } else if (bestMove && bestMove === move) {
      userPrompt += `\n\nThis was the engine's top choice.`;
    }

    userPrompt += `\n\nProvide an educational annotation explaining the move's purpose, key ideas, and any tactical or strategic significance. Focus on WHY and WHAT the move accomplishes, not just WHAT happened.`;

    // Call OpenRouter API
    const openRouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'X-Title': 'Chess Moments',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-sonnet', // Better chess understanding than gpt-4o-mini
        messages: [
          {
            role: 'user',
            content: systemPrompt + '\n\n' + userPrompt
          }
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!openRouterResponse.ok) {
      const errorText = await openRouterResponse.text();
      console.error('OpenRouter API error:', errorText);
      return NextResponse.json(
        {
          error: 'Failed to generate annotation',
          details: errorText,
        },
        { status: openRouterResponse.status }
      );
    }

    const data = await openRouterResponse.json();
    const annotation = data.choices?.[0]?.message?.content?.trim();

    if (!annotation) {
      return NextResponse.json(
        { error: 'No annotation generated' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      annotation,
    });
  } catch (error) {
    console.error('Annotation generation error:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate annotation',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Determine game phase from FEN position
 */
function determineGamePhase(fen: string): 'opening' | 'middlegame' | 'endgame' {
  const parts = fen.split(' ');
  const position = parts[0];
  const moveNumber = parseInt(parts[5] || '1', 10);

  // Count pieces (excluding kings and pawns)
  const pieces = position.replace(/[^QRBNqrbn]/g, '');
  const pieceCount = pieces.length;

  // Opening: first 10 moves or lots of pieces on board
  if (moveNumber <= 10) {
    return 'opening';
  }

  // Endgame: few pieces remaining (4 or fewer non-pawn pieces)
  if (pieceCount <= 4) {
    return 'endgame';
  }

  // Middlegame: everything else
  return 'middlegame';
}
