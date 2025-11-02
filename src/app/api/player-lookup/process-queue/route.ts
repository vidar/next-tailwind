/**
 * Queue Processing API
 * POST /api/player-lookup/process-queue
 * Process analysis queue (background worker endpoint)
 */

import { NextRequest, NextResponse } from 'next/server';
import { processAnalysisQueue } from '@/lib/player-lookup/game-analyzer';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { batchSize = 10, depth = 18 } = body;

    console.log(`Processing analysis queue (batch size: ${batchSize})...`);

    // Process queue
    const results = await processAnalysisQueue(batchSize, depth);

    console.log(`Processed ${results.length} games`);

    // Note: In a full implementation, we'd track which profiles are complete
    // and automatically calculate insights/aggregate stats
    // For now, this is handled manually via the insights/openings endpoints

    return NextResponse.json({
      success: true,
      processed: results.length,
      completed: results.filter(r => r.status === 'completed').length,
      failed: results.filter(r => r.status === 'failed').length,
      insightsProcessed: 0,
      statsAggregated: 0,
    });
  } catch (error) {
    console.error('Queue processing error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Queue processing failed' },
      { status: 500 }
    );
  }
}
