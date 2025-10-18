import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/annotations/generate
 *
 * Generates an annotation for a chess move using AI
 *
 * Body:
 * {
 *   position: string; // FEN position before the move
 *   move: string; // Move in SAN notation
 *   evaluation?: number; // Position evaluation
 *   previousEvaluation?: number; // Previous position evaluation
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { position, move, evaluation, previousEvaluation } = body;

    if (!position || !move) {
      return NextResponse.json(
        { error: 'Position and move are required' },
        { status: 400 }
      );
    }

    // Prepare context for AI
    let context = `You are a chess annotation assistant. Generate a concise, insightful annotation for this chess move.

Position (FEN): ${position}
Move: ${move}`;

    if (evaluation !== undefined) {
      context += `\nCurrent evaluation: ${evaluation > 0 ? '+' : ''}${evaluation.toFixed(2)}`;
    }

    if (previousEvaluation !== undefined && evaluation !== undefined) {
      const evalChange = evaluation - previousEvaluation;
      context += `\nEvaluation change: ${evalChange > 0 ? '+' : ''}${evalChange.toFixed(2)}`;

      if (Math.abs(evalChange) > 1.0) {
        context += evalChange > 0 ? ' (significant improvement)' : ' (significant mistake)';
      }
    }

    context += `\n\nProvide a brief annotation (1-2 sentences) explaining:
- What the move accomplishes
- Any tactical or strategic ideas
- Whether it's a good move, mistake, or interesting choice

Keep it concise and educational.`;

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
        model: 'openai/gpt-4o-mini', // Cheap and fast model
        messages: [
          {
            role: 'system',
            content: 'You are a chess annotation assistant. Provide concise, educational annotations for chess moves.'
          },
          {
            role: 'user',
            content: context
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
