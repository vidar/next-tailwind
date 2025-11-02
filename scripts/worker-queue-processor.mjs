#!/usr/bin/env node

/**
 * Background Worker - Analysis Queue Processor
 * Run with: node scripts/worker-queue-processor.mjs
 *
 * This script processes the analysis queue periodically.
 * It should be run as a background process or cron job.
 */

import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const API_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const BATCH_SIZE = parseInt(process.env.WORKER_BATCH_SIZE || '10');
const INTERVAL_MS = parseInt(process.env.WORKER_INTERVAL_MS || '60000'); // 1 minute

console.log('🔄 Analysis Queue Worker Started');
console.log(`   API URL: ${API_BASE_URL}`);
console.log(`   Batch Size: ${BATCH_SIZE}`);
console.log(`   Interval: ${INTERVAL_MS}ms (${INTERVAL_MS / 1000}s)`);
console.log('');

let processingCount = 0;
let errorCount = 0;

async function processQueue() {
  try {
    console.log(`[${new Date().toISOString()}] Processing queue...`);

    const response = await fetch(`${API_BASE_URL}/api/player-lookup/process-queue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        batchSize: BATCH_SIZE,
        depth: 18,
        calculateInsights: true,
        aggregateStats: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    console.log(`   ✓ Processed ${data.processed} games`);
    console.log(`     - Completed: ${data.completed}`);
    console.log(`     - Failed: ${data.failed}`);

    processingCount += data.processed;

    if (data.processed === 0) {
      console.log('   ℹ Queue is empty');
    }

    console.log('');
  } catch (error) {
    errorCount++;
    console.error(`   ✗ Error processing queue:`, error.message);
    console.log('');
  }
}

// Process immediately on start
processQueue();

// Then process at regular intervals
const interval = setInterval(processQueue, INTERVAL_MS);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Worker shutting down...');
  console.log(`   Total batches processed: ${processingCount}`);
  console.log(`   Total errors: ${errorCount}`);
  clearInterval(interval);
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n🛑 Worker shutting down...');
  console.log(`   Total batches processed: ${processingCount}`);
  console.log(`   Total errors: ${errorCount}`);
  clearInterval(interval);
  process.exit(0);
});

// Keep process alive
process.stdin.resume();
