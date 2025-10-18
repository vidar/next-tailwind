# Tournament Auto-Analysis Feature

## Overview

The tournament import system has been enhanced to automatically analyze all games during the import process. When you import a tournament from a PGN file, each game is now automatically analyzed with Stockfish and linked to the tournament.

---

## What Changed

### Before
- Tournament imported successfully ✅
- Players created ✅
- Rounds created ✅
- **Games: 0** ❌ (games were not analyzed or linked)

### After
- Tournament imported successfully ✅
- Players created ✅
- Rounds created ✅
- **Games: Automatically analyzed and linked** ✅

---

## Implementation Details

### 1. New Database Functions (`src/lib/db.ts`)

Added two new functions for managing game analyses:

#### `createPendingAnalysis(pgn, depth, findAlternatives)`
Creates a pending analysis record in the database.

```typescript
const analysis = await createPendingAnalysis(
  gamePgn,
  20, // depth
  true // find alternatives
);
```

**Returns**: `ChessAnalysis` object with generated ID

#### `updateAnalysisResults(id, gameData, analysisResults, status, errorMessage?)`
Updates an analysis with results from Stockfish.

```typescript
await updateAnalysisResults(
  analysis.id,
  analysisData.game_data,
  analysisData,
  'completed'
);
```

**Parameters**:
- `id` - Analysis ID
- `gameData` - Parsed game information
- `analysisResults` - Full Stockfish analysis
- `status` - 'completed' or 'failed'
- `errorMessage` - Optional error message

### 2. Updated Import Process (`src/app/api/tournaments/import/route.ts`)

The import process now includes automatic game analysis:

```typescript
// For each game in the tournament:
for (const game of tournamentInfo.games) {
  // 1. Create pending analysis record
  const analysis = await createPendingAnalysis(game.pgn, 20, true);

  // 2. Call Stockfish API
  const response = await fetch('https://stockfish.chessmoments.com/api/analyze', {
    method: 'POST',
    body: JSON.stringify({ pgn: game.pgn, depth: 20, find_alternatives: true }),
  });

  // 3. Update analysis with results
  const analysisData = await response.json();
  await updateAnalysisResults(analysis.id, analysisData.game_data, analysisData, 'completed');

  // 4. Link game to tournament
  await linkGameToTournament(
    tournament.id,
    round.id,
    analysis.id,
    game.whiteFideId,
    game.blackFideId,
    game.result
  );
}
```

### 3. UI Updates (`src/app/tournaments/import/page.tsx`)

**Loading State**:
- Added message: "Analyzing games with Stockfish (depth 20)..."
- Users know games are being analyzed during import

**Success State**:
- Changed "Games Linked" to "Games Analyzed & Linked"
- Shows accurate count of analyzed games

---

## Analysis Configuration

### Default Settings
- **Depth**: 20 (good balance of speed and accuracy)
- **Find Alternatives**: true (shows better move suggestions)

### Performance
- Each game takes ~2-5 seconds to analyze
- Games are analyzed sequentially
- Total time = number of games × ~3 seconds

**Example**:
- 6-game tournament ≈ 18 seconds
- 20-game tournament ≈ 60 seconds
- 50-game tournament ≈ 150 seconds

---

## Error Handling

If a game fails to analyze:
1. Analysis record is marked as 'failed'
2. Error is logged
3. Import continues with remaining games
4. Warning added to import results
5. Game is NOT linked to tournament

**User sees**:
- "X game(s) failed to analyze" warning
- Tournament still imports successfully
- Failed games can be re-analyzed later

---

## Benefits

### 1. **Seamless Experience**
Users can import a tournament and immediately:
- View all games
- See game analysis
- Access move-by-move evaluation
- View crosstable with linked games

### 2. **Complete Standings**
- Scores automatically calculated from game results
- Rankings accurate from import
- No manual game linking required

### 3. **Game Navigation**
- Click any game in tournament view
- Instantly navigate to full analysis
- All games already processed

---

## User Flow

### Before (Manual)
1. Import tournament PGN ✅
2. See tournament with 0 games ❌
3. Manually import each game individually 😫
4. Wait for each to analyze 😴
5. Manually link games to tournament 🤔
6. Finally see complete tournament 🎉

### After (Automatic)
1. Import tournament PGN ✅
2. Wait ~20 seconds (for 6 games) ⏱️
3. See complete tournament with all games! 🎉

---

## Testing

### Test with Sample Tournament

1. Navigate to `/tournaments/import`
2. Paste contents of `docs/sample_tournament.pgn`
3. Click "Validate & Continue"
4. Review preview
5. Click "Import Tournament"
6. Wait for analysis (should take ~18 seconds for 6 games)
7. View results:
   - ✅ 4 players imported
   - ✅ 3 rounds created
   - ✅ 6 games analyzed and linked
8. Click "View Tournament"
9. Navigate to "Games" tab
10. Click any game to view analysis

### Verify in Database

```sql
-- Check tournament games
SELECT
  t.name,
  COUNT(tg.id) as games_linked,
  COUNT(CASE WHEN ca.status = 'completed' THEN 1 END) as games_analyzed
FROM tournaments t
LEFT JOIN tournament_games tg ON t.id = tg.tournament_id
LEFT JOIN chess_analyses ca ON tg.game_id = ca.id
WHERE t.name = '86th Tata Steel Masters'
GROUP BY t.id, t.name;

-- Should return:
-- name                      | games_linked | games_analyzed
-- 86th Tata Steel Masters   | 6            | 6
```

---

## Future Enhancements

### Configurable Analysis Depth
Allow users to choose analysis depth during import:
- Depth 20 (fast, ~2s per game)
- Depth 30 (balanced, ~4s per game)
- Depth 40 (thorough, ~8s per game)

### Parallel Analysis
Analyze multiple games simultaneously:
- 3x faster for large tournaments
- Requires worker queue system
- Consider API rate limits

### Progress Indicator
Show per-game progress:
- "Analyzing game 3 of 6..."
- Progress bar
- Individual game status

### Batch Re-analysis
For tournaments with failed games:
- "Retry Failed Games" button
- Automatically re-analyze only failed games
- Update standings after completion

### Background Processing
For very large tournaments:
- Start import immediately
- Analyze games in background
- Update tournament as games complete
- Email notification when done

---

## API Impact

### Stockfish API Usage
Each tournament import now makes N API calls:
- N = number of games in tournament
- All calls use depth 20
- All calls request alternatives

**Consideration**: For very large tournaments (100+ games), consider:
- Rate limiting
- Background job queue
- User notification system

---

## Code Changes Summary

### Files Modified
1. `src/lib/db.ts`
   - Added `createPendingAnalysis()` function
   - Added `updateAnalysisResults()` function

2. `src/app/api/tournaments/import/route.ts`
   - Updated imports
   - Replaced game linking logic with analysis + linking
   - Added Stockfish API calls
   - Improved error handling

3. `src/app/tournaments/import/page.tsx`
   - Updated loading message
   - Updated success message
   - Changed "Games Linked" to "Games Analyzed & Linked"

### Lines of Code
- **Added**: ~80 lines
- **Modified**: ~30 lines
- **Total Impact**: ~110 lines

---

## Troubleshooting

### Games Show as 0
**Symptoms**: Tournament imports but shows 0 games

**Possible Causes**:
1. Stockfish API is down
   - Check https://stockfish.chessmoments.com/api/health
   - Wait and retry import

2. Games missing FIDE IDs
   - Check PGN has `WhiteFideId` and `BlackFideId` headers
   - Update PGN and re-import

3. Network timeout
   - Large tournaments may timeout
   - Try smaller batch or increase timeout

### Some Games Missing
**Symptoms**: Tournament has 6 games in PGN but only 4 linked

**Check**:
1. Import warnings section
2. Database for failed analyses:
   ```sql
   SELECT * FROM chess_analyses
   WHERE status = 'failed'
   ORDER BY created_at DESC;
   ```
3. Server logs for errors

### Slow Import
**Symptoms**: Import takes longer than expected

**Expected Times**:
- 6 games: ~18 seconds
- 10 games: ~30 seconds
- 20 games: ~60 seconds
- 50 games: ~150 seconds

**If slower**: Check Stockfish API response times

---

## Conclusion

The tournament import system now provides a complete, one-step solution for importing tournament data. Users can paste a PGN file and immediately have a fully analyzed tournament with all games linked and ready to view.

This enhancement significantly improves the user experience by eliminating manual game analysis and linking steps, making the system truly production-ready for tournament management.
