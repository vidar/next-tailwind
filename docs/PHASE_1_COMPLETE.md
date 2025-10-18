# Phase 1: Core Infrastructure - COMPLETE ✅

## Overview

Phase 1 of the tournament implementation has been successfully completed. All database migrations and core TypeScript interfaces have been created.

---

## Created Files

### Database Migrations

1. **`migrations/006_create_tournaments.sql`**
   - Creates `tournaments` table with all metadata
   - Indexes on name, date, type, location
   - Auto-updating `updated_at` trigger
   - Constraints for tournament type and rounds

2. **`migrations/007_create_players.sql`**
   - Creates `players` table with FIDE ID as primary key
   - Indexes on name, country, title
   - Full-text search index on player names
   - Auto-updating `updated_at` trigger
   - Constraints for title and birth year validation

3. **`migrations/008_create_tournament_players.sql`**
   - Junction table linking players to tournaments
   - Stores starting rating, seed, final score, and rank
   - Unique constraint on (tournament_id, fide_id)
   - Indexes for efficient queries
   - Auto-updating `updated_at` trigger

4. **`migrations/009_create_tournament_rounds.sql`**
   - Organizes games into tournament rounds
   - Sequential round numbering
   - Optional round names (for knockouts)
   - Unique constraint on (tournament_id, round_number)

5. **`migrations/010_create_tournament_games.sql`**
   - Links analyzed games to tournaments and rounds
   - References both players via FIDE IDs
   - Stores result and board number
   - Multiple indexes for efficient querying
   - Constraint ensuring players are different
   - Auto-updating `updated_at` trigger

### TypeScript Interfaces (in `src/lib/db.ts`)

Added 5 new interfaces:
- `Tournament` - Tournament metadata
- `Player` - Player profile information
- `TournamentPlayer` - Player participation in tournament
- `TournamentRound` - Round organization
- `TournamentGame` - Game-tournament linkage

---

## Implemented Functions

### Tournament Operations (6 functions)

1. **`createTournament(data)`**
   - Creates a new tournament
   - Returns: `Tournament`

2. **`getTournamentById(tournamentId)`**
   - Fetches tournament by ID
   - Returns: `Tournament | null`

3. **`listTournaments(params?)`**
   - Lists tournaments with optional filters
   - Params: type, year, limit, offset
   - Returns: `Tournament[]`

### Player Operations (3 functions)

4. **`upsertPlayer(data)`**
   - Creates or updates player info
   - Uses FIDE ID as unique identifier
   - Returns: `Player`

5. **`getPlayerById(fideId)`**
   - Fetches player by FIDE ID
   - Returns: `Player | null`

6. **`searchPlayers(searchTerm, limit?)`**
   - Searches players by name (case-insensitive)
   - Returns: `Player[]`

### Tournament-Player Operations (3 functions)

7. **`addPlayerToTournament(tournamentId, fideId, startingRating?, seedNumber?)`**
   - Links player to tournament
   - Returns: `TournamentPlayer`

8. **`getTournamentPlayers(tournamentId)`**
   - Gets all players in a tournament with rankings
   - Joins with player info
   - Returns: `(TournamentPlayer & Player)[]`

9. **`updateTournamentPlayerScore(tournamentId, fideId, finalScore, finalRank?, metadata?)`**
   - Updates player's final score and rank
   - Returns: `TournamentPlayer`

### Round Operations (3 functions)

10. **`createTournamentRound(tournamentId, roundNumber, roundDate?, roundName?)`**
    - Creates a tournament round
    - Returns: `TournamentRound`

11. **`getTournamentRounds(tournamentId)`**
    - Gets all rounds for a tournament
    - Sorted by round number
    - Returns: `TournamentRound[]`

12. **`getTournamentRoundByNumber(tournamentId, roundNumber)`**
    - Gets specific round
    - Returns: `TournamentRound | null`

### Game Operations (4 functions)

13. **`linkGameToTournament(tournamentId, roundId, gameId, whiteFideId, blackFideId, result, boardNumber?, gameDate?, metadata?)`**
    - Links an analyzed game to tournament
    - Returns: `TournamentGame`

14. **`getTournamentGames(tournamentId)`**
    - Gets all games in tournament
    - Includes round numbers
    - Returns: `TournamentGame[]`

15. **`getRoundGames(roundId)`**
    - Gets games for specific round
    - Returns: `TournamentGame[]`

16. **`getPlayerTournamentGames(tournamentId, fideId)`**
    - Gets all games for a player in tournament
    - Returns: `TournamentGame[]`

### Standings Calculation (1 function)

17. **`calculateTournamentStandings(tournamentId)`**
    - Calculates scores for all players
    - Assigns ranks based on scores (tie-break by rating)
    - Updates `tournament_players` table
    - Returns: `void`

---

## Database Schema Features

### Key Relationships

```
tournaments (1) ──→ (N) tournament_players ←── (N) players
     │                         │
     │                         │
     ↓                         ↓
tournament_rounds (1) ──→ (N) tournament_games ←── (1) chess_analyses
```

### Indexes Created

**Performance optimizations for common queries:**

- Tournament name search
- Tournament date sorting
- Tournament type filtering
- Player name search (full-text)
- Player country filtering
- Tournament player lookups
- Round game retrieval
- Player game history
- Crosstable queries (white/black player combos)

### Constraints

**Data integrity enforced:**

- Valid tournament types: round_robin, swiss, knockout, arena, other
- Valid chess titles: GM, IM, FM, CM, WGM, WIM, WFM, WCM
- Valid game results: 1-0, 0-1, 1/2-1/2, *
- Birth years between 1900 and current year
- Ratings between 0 and 3500
- Round numbers > 0
- Players can't play themselves
- Unique game IDs (each game in only one tournament)
- Unique player-tournament combinations

---

## Running the Migrations

To apply these migrations to your database:

```bash
# Method 1: Using psql
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f migrations/006_create_tournaments.sql
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f migrations/007_create_players.sql
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f migrations/008_create_tournament_players.sql
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f migrations/009_create_tournament_rounds.sql
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f migrations/010_create_tournament_games.sql

# Method 2: All at once
cat migrations/006_*.sql migrations/007_*.sql migrations/008_*.sql migrations/009_*.sql migrations/010_*.sql | psql -h $DB_HOST -U $DB_USER -d $DB_NAME
```

Or use your preferred migration tool.

---

## Example Usage

### Creating a Tournament

```typescript
import { createTournament, upsertPlayer, addPlayerToTournament, createTournamentRound, linkGameToTournament, calculateTournamentStandings } from '@/lib/db';

// 1. Create tournament
const tournament = await createTournament({
  name: "Candidates Tournament 2024",
  location: "Toronto, Canada",
  start_date: "2024-04-04",
  end_date: "2024-04-28",
  tournament_type: "round_robin",
  total_rounds: 14,
  time_control: "Classical",
  country_code: "CAN",
  organizer: "FIDE"
});

// 2. Add players
const players = [
  { fide_id: "2016192", full_name: "Hikaru Nakamura", country_code: "USA", title: "GM" },
  { fide_id: "4168119", full_name: "Ian Nepomniachtchi", country_code: "RUS", title: "GM" },
  // ... more players
];

for (const player of players) {
  await upsertPlayer(player);
  await addPlayerToTournament(tournament.id, player.fide_id, 2789);
}

// 3. Create rounds
for (let i = 1; i <= 14; i++) {
  await createTournamentRound(tournament.id, i);
}

// 4. Link games (assuming games are already analyzed)
const round1 = await getTournamentRoundByNumber(tournament.id, 1);
await linkGameToTournament(
  tournament.id,
  round1.id,
  gameId, // from chess_analyses
  "2016192", // Nakamura
  "4168119", // Nepomniachtchi
  "1/2-1/2"
);

// 5. Calculate standings after all games
await calculateTournamentStandings(tournament.id);

// 6. Get final standings
const standings = await getTournamentPlayers(tournament.id);
console.log(standings); // Sorted by rank
```

---

## Testing the Implementation

### Verify Tables Created

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE 'tournament%' OR table_name = 'players';
```

Should return:
- tournaments
- players
- tournament_players
- tournament_rounds
- tournament_games

### Check Indexes

```sql
SELECT tablename, indexname FROM pg_indexes
WHERE tablename IN ('tournaments', 'players', 'tournament_players', 'tournament_rounds', 'tournament_games')
ORDER BY tablename, indexname;
```

### Test Data Integrity

```sql
-- Try inserting invalid tournament type (should fail)
INSERT INTO tournaments (name, start_date, tournament_type, total_rounds)
VALUES ('Test', '2024-01-01', 'invalid_type', 5);

-- Try inserting player with themselves as opponent (should fail)
INSERT INTO tournament_games (tournament_id, round_id, game_id, white_fide_id, black_fide_id, result)
VALUES (uuid_generate_v4(), uuid_generate_v4(), uuid_generate_v4(), '123456', '123456', '1-0');
```

---

## Next Steps: Phase 2

Now that the core infrastructure is in place, we can proceed to Phase 2:

### Phase 2 Goals: PGN Parsing & Import (Weeks 3-4)

- [ ] Build PGN parser utility
  - Extract tournament metadata from headers
  - Identify players and FIDE IDs
  - Detect rounds and infer structure
- [ ] Create import API endpoint `/api/tournaments/import`
- [ ] Build import UI wizard
- [ ] Add validation and error handling
- [ ] Handle edge cases (missing FIDE IDs, incomplete data)

**Files to create:**
- `src/lib/pgn-parser.ts` - PGN parsing logic
- `src/app/api/tournaments/import/route.ts` - Import endpoint
- `src/app/tournaments/import/page.tsx` - Import wizard UI

---

## Summary

✅ **5 database migrations created**
✅ **5 TypeScript interfaces defined**
✅ **17 database functions implemented**
✅ **Comprehensive indexing and constraints**
✅ **Ready for Phase 2: PGN Import**

Phase 1 provides a solid foundation for tournament data management with:
- Proper normalization
- FIDE ID as player identifier
- Flexible metadata storage (JSONB)
- Efficient queries via indexes
- Data integrity via constraints
- Type-safe TypeScript interfaces

The database is now ready to store tournament data!
