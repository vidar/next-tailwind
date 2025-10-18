# Tournament Data Implementation Plan

## Overview

This document outlines the implementation plan for handling chess tournament data, starting with round-robin tournaments where all players have FIDE identifiers for easier identification.

---

## Table of Contents

1. [Data Sources](#data-sources)
2. [Database Schema](#database-schema)
3. [Data Ingestion](#data-ingestion)
4. [API Endpoints](#api-endpoints)
5. [UI/UX Design](#uiux-design)
6. [Implementation Phases](#implementation-phases)
7. [Technical Considerations](#technical-considerations)

---

## Data Sources

### 1. PGN File Parsing

PGN files contain tournament metadata in headers:

```pgn
[Event "Candidates Tournament 2024"]
[Site "Toronto CAN"]
[Date "2024.04.04"]
[Round "1"]
[White "Nakamura, Hikaru"]
[Black "Nepomniachtchi, Ian"]
[Result "1/2-1/2"]
[WhiteElo "2789"]
[BlackElo "2771"]
[WhiteFideId "2016192"]
[BlackFideId "4168119"]
[EventDate "2024.04.04"]
[EventType "tourn"]
[EventRounds "14"]
[EventCountry "CAN"]
```

**Key fields for tournaments:**
- `Event` - Tournament name
- `Site` - Location
- `Round` - Round number
- `WhiteFideId` / `BlackFideId` - FIDE identifiers
- `WhiteElo` / `BlackElo` - Player ratings
- `EventDate` - Tournament start date
- `EventRounds` - Total number of rounds
- `EventType` - Tournament type (tourn, swiss, etc.)

### 2. Scraped Data (Future)

- FIDE website
- Chess.com / Lichess tournament pages
- Tournament organizer websites

---

## Database Schema

### Core Tables

#### 1. `tournaments`

Stores tournament metadata.

```sql
CREATE TABLE tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  location VARCHAR(255),
  start_date DATE NOT NULL,
  end_date DATE,
  tournament_type VARCHAR(50) NOT NULL, -- 'round_robin', 'swiss', 'knockout'
  total_rounds INTEGER NOT NULL,
  time_control VARCHAR(100),
  country_code CHAR(3),
  organizer VARCHAR(255),
  description TEXT,
  metadata JSONB DEFAULT '{}', -- Additional flexible data
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT valid_tournament_type CHECK (tournament_type IN ('round_robin', 'swiss', 'knockout', 'arena', 'other'))
);

CREATE INDEX idx_tournaments_name ON tournaments(name);
CREATE INDEX idx_tournaments_date ON tournaments(start_date DESC);
CREATE INDEX idx_tournaments_type ON tournaments(tournament_type);
```

#### 2. `players`

Stores player information with FIDE identifier as primary key.

```sql
CREATE TABLE players (
  fide_id VARCHAR(20) PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  country_code CHAR(3),
  title VARCHAR(10), -- GM, IM, FM, WGM, etc.
  birth_year INTEGER,
  profile_photo_url TEXT,
  fide_profile_url TEXT,
  metadata JSONB DEFAULT '{}', -- Additional data like federation changes, etc.
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_players_name ON players(full_name);
CREATE INDEX idx_players_country ON players(country_code);
CREATE INDEX idx_players_title ON players(title);
```

#### 3. `tournament_players`

Links players to tournaments with their starting ratings.

```sql
CREATE TABLE tournament_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  fide_id VARCHAR(20) NOT NULL REFERENCES players(fide_id) ON DELETE CASCADE,
  starting_rating INTEGER,
  seed_number INTEGER, -- Player's seed/ranking in tournament
  final_score DECIMAL(3, 1), -- e.g., 7.5 out of 14
  final_rank INTEGER,
  metadata JSONB DEFAULT '{}', -- Performance rating, tie-breaks, etc.
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(tournament_id, fide_id)
);

CREATE INDEX idx_tournament_players_tournament ON tournament_players(tournament_id);
CREATE INDEX idx_tournament_players_player ON tournament_players(fide_id);
CREATE INDEX idx_tournament_players_score ON tournament_players(tournament_id, final_score DESC);
```

#### 4. `tournament_rounds`

Organizes games into rounds.

```sql
CREATE TABLE tournament_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  round_date DATE,
  round_name VARCHAR(100), -- e.g., "Round 1", "Semifinals", etc.
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(tournament_id, round_number)
);

CREATE INDEX idx_tournament_rounds_tournament ON tournament_rounds(tournament_id, round_number);
```

#### 5. `tournament_games`

Links games to tournaments and rounds.

```sql
CREATE TABLE tournament_games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  round_id UUID NOT NULL REFERENCES tournament_rounds(id) ON DELETE CASCADE,
  game_id UUID NOT NULL REFERENCES chess_analyses(id) ON DELETE CASCADE,
  white_fide_id VARCHAR(20) NOT NULL REFERENCES players(fide_id),
  black_fide_id VARCHAR(20) NOT NULL REFERENCES players(fide_id),
  board_number INTEGER, -- For team tournaments or multiple boards
  result VARCHAR(10) NOT NULL, -- '1-0', '0-1', '1/2-1/2', '*'
  game_date DATE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(game_id),
  CONSTRAINT valid_result CHECK (result IN ('1-0', '0-1', '1/2-1/2', '*'))
);

CREATE INDEX idx_tournament_games_tournament ON tournament_games(tournament_id);
CREATE INDEX idx_tournament_games_round ON tournament_games(round_id);
CREATE INDEX idx_tournament_games_white ON tournament_games(white_fide_id);
CREATE INDEX idx_tournament_games_black ON tournament_games(black_fide_id);
CREATE INDEX idx_tournament_games_game ON tournament_games(game_id);
```

#### 6. `player_ratings_history`

Tracks rating changes across tournaments (optional but useful).

```sql
CREATE TABLE player_ratings_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fide_id VARCHAR(20) NOT NULL REFERENCES players(fide_id) ON DELETE CASCADE,
  tournament_id UUID REFERENCES tournaments(id) ON DELETE SET NULL,
  rating_date DATE NOT NULL,
  classical_rating INTEGER,
  rapid_rating INTEGER,
  blitz_rating INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ratings_player ON player_ratings_history(fide_id, rating_date DESC);
```

---

## Data Ingestion

### Phase 1: PGN File Parsing

#### Step 1: Extract Tournament Metadata

Parse PGN headers to identify:
1. Tournament name and location
2. Date and number of rounds
3. Player FIDE IDs and names
4. Round information

#### Step 2: Infer Tournament Structure

For round-robin tournaments:
- If all players play each other once → single round-robin
- If all players play each other twice → double round-robin
- Calculate expected games: `n * (n-1) / 2` for single RR

#### Step 3: Batch Import Process

```typescript
interface TournamentImportData {
  tournamentInfo: {
    name: string;
    location: string;
    startDate: string;
    totalRounds: number;
    type: 'round_robin' | 'swiss' | 'knockout';
  };
  players: Array<{
    fideId: string;
    name: string;
    rating: number;
  }>;
  games: Array<{
    round: number;
    whiteFideId: string;
    blackFideId: string;
    result: string;
    pgn: string;
  }>;
}

async function importTournament(data: TournamentImportData) {
  // 1. Create tournament
  const tournament = await createTournament(data.tournamentInfo);

  // 2. Create/update players
  for (const player of data.players) {
    await upsertPlayer(player);
  }

  // 3. Link players to tournament
  for (const player of data.players) {
    await addPlayerToTournament(tournament.id, player.fideId, player.rating);
  }

  // 4. Create rounds
  const rounds = await createTournamentRounds(tournament.id, data.tournamentInfo.totalRounds);

  // 5. Import games and link to tournament
  for (const game of data.games) {
    const analysis = await analyzeGame(game.pgn);
    await linkGameToTournament(
      tournament.id,
      rounds[game.round - 1].id,
      analysis.id,
      game.whiteFideId,
      game.blackFideId,
      game.result
    );
  }

  // 6. Calculate standings
  await calculateTournamentStandings(tournament.id);
}
```

### Phase 2: Scraping (Future)

- FIDE API integration
- Chess.com/Lichess API
- Tournament crosstable scraping

---

## API Endpoints

### Tournament Management

```typescript
// List all tournaments
GET /api/tournaments
Query params: ?type=round_robin&year=2024&limit=20&offset=0

// Get tournament details
GET /api/tournaments/:tournamentId

// Get tournament standings
GET /api/tournaments/:tournamentId/standings

// Get tournament crosstable
GET /api/tournaments/:tournamentId/crosstable

// Get games for a specific round
GET /api/tournaments/:tournamentId/rounds/:roundNumber/games

// Get all games in tournament
GET /api/tournaments/:tournamentId/games

// Create new tournament
POST /api/tournaments
Body: { name, location, startDate, type, rounds, ... }

// Import tournament from PGN bundle
POST /api/tournaments/import
Body: { pgnFiles: string[], tournamentInfo: {...} }
```

### Player Management

```typescript
// Get player profile
GET /api/players/:fideId

// Get player tournament history
GET /api/players/:fideId/tournaments

// Get player games in specific tournament
GET /api/players/:fideId/tournaments/:tournamentId/games

// Get head-to-head record
GET /api/players/:fideId/h2h/:opponentFideId

// Update player info
PATCH /api/players/:fideId
Body: { fullName, countryCode, title, ... }
```

### Statistics

```typescript
// Tournament statistics
GET /api/tournaments/:tournamentId/stats

// Player performance in tournament
GET /api/tournaments/:tournamentId/players/:fideId/performance
```

---

## UI/UX Design

### 1. Tournament List Page (`/tournaments`)

**Features:**
- Grid/list view of tournaments
- Filter by type, year, location
- Search by tournament name
- Sort by date, name, number of players

**Card displays:**
- Tournament name and location
- Date range
- Number of players
- Tournament type badge
- Winner/leading player

### 2. Tournament Detail Page (`/tournaments/:id`)

**Main sections:**

#### a) Tournament Header
- Name, location, dates
- Tournament type and format
- Total rounds
- Status (ongoing/completed)

#### b) Standings Table
- Current rankings
- Player names (clickable to profile)
- Scores (e.g., 5.5/9)
- Performance rating
- Tie-break information

**Features:**
- Sortable by rank, name, score
- Highlight selected player
- Color-code: winner (gold), top 3 (podium colors)

#### c) Rounds Navigator
- Tabs or dropdown for each round
- Shows pairings and results
- Link to each game

#### d) Crosstable (Round Robin)
- Matrix showing all pairings
- Cell shows result from player's perspective
- Click cell to view game

Example crosstable:
```
          | Carlsen | Nakamura | Caruana | Giri
----------|---------|----------|---------|------
Carlsen   |    -    |   1/2    |   1     | 1/2
Nakamura  |   1/2   |    -     |   0     |  1
Caruana   |    0    |   1      |    -    | 1/2
Giri      |   1/2   |   0      |   1/2   |  -
```

#### e) Statistics
- Most decisive player
- Opening statistics
- Average game length
- Performance ratings
- Color advantage statistics

### 3. Round Detail Page (`/tournaments/:id/rounds/:number`)

**Features:**
- List of all games in the round
- Pairings with player photos
- Results and links to game analysis
- Option to batch analyze all games

### 4. Player Profile Page (`/players/:fideId`)

**Sections:**

#### a) Player Header
- Photo
- Name and title
- Country flag
- Current rating
- FIDE link

#### b) Tournament History
- List of tournaments played
- Results and performance
- Filter by year, tournament type

#### c) Statistics
- Win/draw/loss percentages
- Average performance rating
- Best tournament result
- Favorite openings

#### d) Recent Games
- Latest analyzed games
- Quick access to game viewer

### 5. Crosstable View (`/tournaments/:id/crosstable`)

**Interactive matrix:**
- Hover to highlight row/column
- Click cell to view game
- Color coding:
  - Green: Win
  - Gray: Draw
  - Red: Loss
  - White: Not played
- Show scores in margins

### 6. Tournament Import Page (`/tournaments/import`)

**Multi-step wizard:**

#### Step 1: Upload PGN Files
- Drag & drop multiple PGN files
- Or paste PGN text
- Validate PGN format

#### Step 2: Detect Tournament Info
- Auto-detect tournament name, location, dates
- Allow manual correction
- Detect player list from games
- Infer tournament type

#### Step 3: Verify Pairings
- Show detected rounds and games
- Highlight any inconsistencies
- Option to manually adjust

#### Step 4: Import & Analyze
- Progress bar for analysis
- Option to analyze immediately or queue
- Summary of imported data

---

## Implementation Phases

### Phase 1: Core Infrastructure (Weeks 1-2)

**Goal:** Basic tournament data model and storage

- [ ] Create database migrations for all tables
- [ ] Implement TypeScript interfaces and types
- [ ] Build database functions in `lib/db.ts`:
  - `createTournament()`
  - `getTournamentById()`
  - `listTournaments()`
  - `upsertPlayer()`
  - `getPlayerById()`
  - `addPlayerToTournament()`
  - `createTournamentRound()`
  - `linkGameToTournament()`
  - `calculateStandings()`

### Phase 2: PGN Parsing & Import (Weeks 3-4)

**Goal:** Ability to import tournaments from PGN files

- [ ] Build PGN parser utility:
  - Extract tournament metadata
  - Identify players and FIDE IDs
  - Detect rounds
  - Infer tournament structure
- [ ] Create import API endpoint
- [ ] Build import UI with wizard
- [ ] Add validation and error handling
- [ ] Handle edge cases (missing FIDE IDs, incomplete data)

### Phase 3: Tournament Viewing (Weeks 5-6)

**Goal:** Display tournament data in user-friendly way

- [ ] Create tournament list page
- [ ] Build tournament detail page with:
  - Standings table
  - Round navigator
  - Statistics dashboard
- [ ] Implement crosstable view for round-robin
- [ ] Add filtering and search
- [ ] Create responsive design

### Phase 4: Player Profiles (Weeks 7-8)

**Goal:** Individual player pages and statistics

- [ ] Build player profile page
- [ ] Show tournament history
- [ ] Display player statistics
- [ ] Implement head-to-head records
- [ ] Add player search functionality

### Phase 5: Advanced Features (Weeks 9-10)

**Goal:** Enhanced functionality and analytics

- [ ] Performance rating calculations
- [ ] Opening repertoire analysis per player
- [ ] Tournament performance trends
- [ ] Export functionality (PDF reports, PGN bundles)
- [ ] Tournament comparison tool
- [ ] Video generation for tournament highlights

### Phase 6: Scraping & Automation (Weeks 11-12)

**Goal:** Automated data collection

- [ ] FIDE database integration
- [ ] Chess.com API integration
- [ ] Lichess API integration
- [ ] Automated tournament updates
- [ ] Player rating updates

---

## Technical Considerations

### 1. Data Integrity

**Challenges:**
- Missing FIDE IDs in older tournaments
- Name variations (e.g., "Magnus Carlsen" vs "Carlsen, M.")
- Incomplete game data

**Solutions:**
- Fuzzy name matching algorithm
- Manual review queue for ambiguous cases
- Allow games without FIDE IDs but flag them
- Implement merge/split functionality for duplicate players

### 2. Performance

**Optimizations:**
- Database indexes on frequent queries
- Cache tournament standings
- Lazy load game analysis
- Paginate large tournaments
- Use database views for complex queries

### 3. Tournament Type Detection

**Heuristics for round-robin:**
- Check if `n * (n-1) / 2` games exist (single RR)
- Check if `n * (n-1)` games exist (double RR)
- All players play similar number of games
- Sequential round numbers

**For Swiss:**
- Variable number of opponents per player
- Pairing algorithm patterns
- Bye rounds

### 4. Scalability

**Database design considerations:**
- Partition large tables by year
- Archive old tournaments
- Use JSONB for flexible metadata
- Implement proper foreign key constraints

### 5. Data Validation

**PGN import validation:**
```typescript
interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

function validateTournamentPGN(pgns: string[]): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    suggestions: []
  };

  // Check: All games have same Event header
  // Check: Round numbers are sequential
  // Check: No duplicate games
  // Check: All players have FIDE IDs
  // Check: Results match PGN movetext

  return result;
}
```

### 6. Edge Cases

**Handle gracefully:**
- Forfeits and byes
- Unfinished tournaments
- Withdrawn players
- Adjusted results
- Multiple tournaments with same name
- Amateur tournaments without FIDE IDs
- Team tournaments
- Simultaneous exhibitions

---

## Example Queries

### 1. Get Tournament Standings

```sql
SELECT
  p.fide_id,
  p.full_name,
  p.title,
  p.country_code,
  tp.starting_rating,
  tp.final_score,
  tp.final_rank,
  (
    SELECT COUNT(*)
    FROM tournament_games tg
    WHERE tg.tournament_id = $1
    AND ((tg.white_fide_id = p.fide_id AND tg.result = '1-0')
         OR (tg.black_fide_id = p.fide_id AND tg.result = '0-1'))
  ) as wins,
  (
    SELECT COUNT(*)
    FROM tournament_games tg
    WHERE tg.tournament_id = $1
    AND (tg.white_fide_id = p.fide_id OR tg.black_fide_id = p.fide_id)
    AND tg.result = '1/2-1/2'
  ) as draws,
  (
    SELECT COUNT(*)
    FROM tournament_games tg
    WHERE tg.tournament_id = $1
    AND ((tg.white_fide_id = p.fide_id AND tg.result = '0-1')
         OR (tg.black_fide_id = p.fide_id AND tg.result = '1-0'))
  ) as losses
FROM tournament_players tp
JOIN players p ON tp.fide_id = p.fide_id
WHERE tp.tournament_id = $1
ORDER BY tp.final_rank ASC, tp.final_score DESC;
```

### 2. Get Crosstable Data

```sql
SELECT
  tg.white_fide_id,
  tg.black_fide_id,
  tg.result,
  tg.round_id,
  tr.round_number
FROM tournament_games tg
JOIN tournament_rounds tr ON tg.round_id = tr.id
WHERE tg.tournament_id = $1
ORDER BY tr.round_number;
```

### 3. Player Performance in Tournament

```sql
SELECT
  p.full_name,
  COUNT(tg.id) as games_played,
  SUM(CASE
    WHEN (tg.white_fide_id = $2 AND tg.result = '1-0') OR
         (tg.black_fide_id = $2 AND tg.result = '0-1') THEN 1
    ELSE 0
  END) as wins,
  SUM(CASE WHEN tg.result = '1/2-1/2' THEN 0.5 ELSE 0 END) as draws,
  SUM(CASE
    WHEN (tg.white_fide_id = $2 AND tg.result = '0-1') OR
         (tg.black_fide_id = $2 AND tg.result = '1-0') THEN 1
    ELSE 0
  END) as losses
FROM tournament_games tg
JOIN players p ON p.fide_id = $2
WHERE tg.tournament_id = $1
AND (tg.white_fide_id = $2 OR tg.black_fide_id = $2);
```

---

## UI Component Library

### Reusable Components

1. **`<TournamentCard />`** - Tournament preview card
2. **`<StandingsTable />`** - Sortable standings table
3. **`<Crosstable />`** - Interactive crosstable matrix
4. **`<PlayerBadge />`** - Player name with title and flag
5. **`<GameResultBadge />`** - Color-coded result (1-0, 1/2-1/2, 0-1)
6. **`<RoundNavigator />`** - Tab/dropdown for round selection
7. **`<PairingCard />`** - Shows game pairing with players
8. **`<TournamentStats />`** - Statistics dashboard
9. **`<PlayerRatingChart />`** - Rating progression graph
10. **`<ImportWizard />`** - Multi-step import interface

---

## Future Enhancements

### Phase 7+
- [ ] Live tournament tracking
- [ ] Tournament registration system
- [ ] Pairing generation for organizers
- [ ] Mobile app
- [ ] Tournament commentary integration
- [ ] Prize fund tracking
- [ ] Arbitration notes and appeals
- [ ] Player seating charts
- [ ] Print-ready wall charts
- [ ] Integration with chess clocks/DGT boards

---

## Conclusion

This implementation plan provides a comprehensive approach to handling tournament data, starting with round-robin tournaments with FIDE identifiers. The phased approach allows for iterative development while maintaining data integrity and user experience quality.

The system is designed to be:
- **Extensible**: Easy to add new tournament types
- **Scalable**: Handles small club tournaments to World Championships
- **User-friendly**: Intuitive navigation and clear data presentation
- **Data-rich**: Comprehensive statistics and analytics
- **Integration-ready**: APIs for external services

Next steps: Begin with Phase 1 database migrations and core infrastructure.
