# Chess Moments Database Documentation

## Overview

The Chess Moments application uses PostgreSQL as its database with 8 main tables organized into two functional areas:
1. **Core Game Analysis** - Chess game analysis, video rendering, and annotations
2. **Tournament System** - Tournament management with players, rounds, and games

## Quick Start

### Option 1: Automated Script (Recommended)

```bash
# Make sure your .env file has DB_* variables set
./scripts/init-database.sh
```

This script will:
- Drop the existing database (if it exists)
- Create a fresh database
- Run the complete schema migration
- Create all tables, indexes, triggers, and views

### Option 2: Manual Setup

```bash
# Create database
psql -h localhost -U your_user -d postgres -c "CREATE DATABASE chess_moments;"

# Run migration
psql -h localhost -U your_user -d chess_moments -f migrations/000_init_complete_schema.sql
```

### Option 3: Using Docker/Local PostgreSQL

```bash
# Start PostgreSQL (if using Docker)
docker run --name chess-postgres -e POSTGRES_PASSWORD=your_password -p 5432:5432 -d postgres:15

# Run init script
./scripts/init-database.sh
```

## Database Schema

### Core Tables

#### 1. chess_analyses
Stores chess game PGN and analysis results from Stockfish API.

```sql
- id (UUID, PK)
- pgn (TEXT) - Full PGN notation
- game_data (JSONB) - Parsed game metadata
- analysis_config (JSONB) - { depth: 20|30|40, find_alternatives: boolean }
- analysis_results (JSONB) - Stockfish analysis output
- status (VARCHAR) - pending | processing | completed | failed
- progress (INTEGER) - 0-100
- error_message (TEXT)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP) - Auto-updated via trigger
- completed_at (TIMESTAMP)
```

**Indexes:**
- `idx_chess_analyses_status` on status
- `idx_chess_analyses_created_at` on created_at DESC
- `idx_chess_analyses_completed_at` on completed_at DESC (partial)

#### 2. videos
Stores rendered chess videos using Remotion Lambda.

```sql
- id (UUID, PK)
- user_id (VARCHAR) - Clerk user ID
- game_id (UUID, FK → chess_analyses)
- composition_type (VARCHAR) - walkthrough | annotated
- s3_url (TEXT) - URL to rendered video
- status (VARCHAR) - pending | rendering | completed | failed
- start_time (TIMESTAMP)
- end_time (TIMESTAMP)
- error (TEXT)
- metadata (JSONB) - { renderId, bucketName, youtubeUrl, chapters, description }
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP) - Auto-updated via trigger
```

**Indexes:**
- `idx_videos_user_id` on user_id
- `idx_videos_game_id` on game_id
- `idx_videos_status` on status
- `idx_videos_created_at` on created_at DESC

#### 3. game_annotations
User-created text annotations for specific moves in analyzed games.

```sql
- id (UUID, PK)
- game_id (UUID, FK → chess_analyses)
- move_index (INTEGER) - 0-based move number
- annotation_text (TEXT) - Max 500 characters
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP) - Auto-updated via trigger
```

**Constraints:**
- UNIQUE(game_id, move_index)
- CHECK(move_index >= 0)
- CHECK(annotation_text length 1-500)

**Indexes:**
- `idx_annotations_game_id` on game_id
- `idx_annotations_move_index` on move_index

### Tournament System Tables

#### 4. tournaments
Chess tournament metadata and configuration.

```sql
- id (UUID, PK)
- name (VARCHAR)
- location (VARCHAR)
- start_date (DATE)
- end_date (DATE)
- tournament_type (VARCHAR) - round_robin | swiss | knockout | arena | other
- total_rounds (INTEGER)
- time_control (VARCHAR)
- country_code (VARCHAR)
- organizer (VARCHAR)
- description (TEXT)
- metadata (JSONB)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP) - Auto-updated via trigger
```

**Indexes:**
- `idx_tournaments_start_date` on start_date DESC
- `idx_tournaments_type` on tournament_type
- `idx_tournaments_country` on country_code

#### 5. players
Chess player profiles, primarily from FIDE database.

```sql
- fide_id (VARCHAR, PK)
- full_name (VARCHAR)
- country_code (VARCHAR)
- title (VARCHAR) - GM, IM, FM, etc.
- birth_year (INTEGER)
- profile_photo_url (TEXT)
- fide_profile_url (TEXT)
- metadata (JSONB)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP) - Auto-updated via trigger
```

**Indexes:**
- `idx_players_name` on full_name
- `idx_players_country` on country_code
- `idx_players_title` on title

#### 6. tournament_players
Junction table linking players to tournaments with scores and rankings.

```sql
- id (UUID, PK)
- tournament_id (UUID, FK → tournaments)
- fide_id (VARCHAR, FK → players)
- starting_rating (INTEGER) - 0-4000
- seed_number (INTEGER)
- final_score (NUMERIC) - Tournament points
- final_rank (INTEGER) - Final standing
- metadata (JSONB)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP) - Auto-updated via trigger
```

**Constraints:**
- UNIQUE(tournament_id, fide_id)

**Indexes:**
- `idx_tournament_players_tournament` on tournament_id
- `idx_tournament_players_player` on fide_id
- `idx_tournament_players_rank` on (tournament_id, final_rank)

#### 7. tournament_rounds
Individual rounds within tournaments.

```sql
- id (UUID, PK)
- tournament_id (UUID, FK → tournaments)
- round_number (INTEGER)
- round_date (DATE)
- round_name (VARCHAR)
- created_at (TIMESTAMP)
```

**Constraints:**
- UNIQUE(tournament_id, round_number)

**Indexes:**
- `idx_tournament_rounds_tournament` on tournament_id
- `idx_tournament_rounds_number` on (tournament_id, round_number)

#### 8. tournament_games
Links analyzed games to tournament rounds with player pairings.

```sql
- id (UUID, PK)
- tournament_id (UUID, FK → tournaments)
- round_id (UUID, FK → tournament_rounds)
- game_id (UUID, FK → chess_analyses)
- white_fide_id (VARCHAR, FK → players)
- black_fide_id (VARCHAR, FK → players)
- board_number (INTEGER)
- result (VARCHAR) - 1-0 | 0-1 | 1/2-1/2 | *
- game_date (DATE)
- metadata (JSONB)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP) - Auto-updated via trigger
```

**Constraints:**
- CHECK(white_fide_id != black_fide_id)

**Indexes:**
- `idx_tournament_games_tournament` on tournament_id
- `idx_tournament_games_round` on round_id
- `idx_tournament_games_game` on game_id
- `idx_tournament_games_white` on white_fide_id
- `idx_tournament_games_black` on black_fide_id

## Database Features

### Automatic Timestamp Updates
All tables with `updated_at` columns have triggers that automatically update the timestamp on any UPDATE operation.

### Cascade Deletes
Foreign key constraints use `ON DELETE CASCADE` to maintain referential integrity:
- Deleting a `chess_analysis` deletes all related videos, annotations, and tournament_games
- Deleting a `tournament` deletes all related players, rounds, and games
- Deleting a `player` removes them from all tournaments

### Views

#### recent_analyses
Quick view of recently completed analyses with move summaries.

```sql
SELECT * FROM recent_analyses LIMIT 10;
```

#### tournament_standings
Current standings for all tournaments with player info.

```sql
SELECT * FROM tournament_standings WHERE tournament_id = 'xxx';
```

## Environment Variables

Required in your `.env` file:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=chess_moments
DB_USER=your_user
DB_PASSWORD=your_password
```

## Migration Management

### Current State
- **000_init_complete_schema.sql** - Complete schema (all 8 tables)
- **004-010** - Individual migrations (legacy, for reference)

### Creating a Fresh Database
Always use `000_init_complete_schema.sql` for new installations. The numbered migrations (004-010) are historical and missing the foundational tables (001-003).

### Backup and Restore

```bash
# Backup
pg_dump -h localhost -U your_user chess_moments > backup.sql

# Restore
psql -h localhost -U your_user -d chess_moments < backup.sql
```

## Common Queries

### Get all completed analyses for a user
```sql
SELECT ca.*
FROM chess_analyses ca
JOIN videos v ON ca.id = v.game_id
WHERE v.user_id = 'clerk_user_id'
  AND ca.status = 'completed'
ORDER BY ca.completed_at DESC;
```

### Get tournament standings
```sql
SELECT * FROM tournament_standings
WHERE tournament_id = 'tournament_uuid'
ORDER BY final_rank;
```

### Get player's tournament games
```sql
SELECT tg.*, ca.pgn, tr.round_number
FROM tournament_games tg
JOIN chess_analyses ca ON tg.game_id = ca.id
JOIN tournament_rounds tr ON tg.round_id = tr.id
WHERE (tg.white_fide_id = '12345' OR tg.black_fide_id = '12345')
  AND tg.tournament_id = 'tournament_uuid'
ORDER BY tr.round_number;
```

## Troubleshooting

### Connection Issues
```bash
# Test connection
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT version();"
```

### Check Migration Status
```sql
SELECT * FROM schema_migrations ORDER BY applied_at;
```

### Verify Tables
```sql
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
```

### Check Table Sizes
```sql
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

## Performance Tips

1. **Regular VACUUM** - Run `VACUUM ANALYZE` periodically
2. **Index Usage** - Monitor with `pg_stat_user_indexes`
3. **JSONB Indexes** - Add GIN indexes on frequently queried JSONB fields
4. **Connection Pooling** - Already configured in `src/lib/db.ts` with max 20 connections

## Security Recommendations

1. Use separate database users for app vs admin operations
2. Grant minimal required permissions to app user
3. Enable SSL connections in production
4. Regular backups with encryption
5. Keep PostgreSQL updated

## Version Requirements

- PostgreSQL: >= 13 (for `gen_random_uuid()`)
- Required extensions: None (uses built-in functions)
