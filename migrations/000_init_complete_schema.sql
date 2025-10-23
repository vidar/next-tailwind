-- Complete database schema for Chess Moments application
-- This migration creates all tables, indexes, constraints, and triggers from scratch
-- Run this on a fresh database to set up the complete schema

-- =============================================================================
-- CORE TABLES
-- =============================================================================

-- Table 1: chess_analyses
-- Stores chess game analysis results from Stockfish API
CREATE TABLE IF NOT EXISTS chess_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pgn TEXT NOT NULL,
  game_data JSONB DEFAULT '{}',
  analysis_config JSONB NOT NULL DEFAULT '{"depth": 20, "find_alternatives": true}',
  analysis_results JSONB DEFAULT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  error_message TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP DEFAULT NULL
);

-- Indexes for chess_analyses
CREATE INDEX idx_chess_analyses_status ON chess_analyses(status);
CREATE INDEX idx_chess_analyses_created_at ON chess_analyses(created_at DESC);
CREATE INDEX idx_chess_analyses_completed_at ON chess_analyses(completed_at DESC) WHERE completed_at IS NOT NULL;

-- Table 2: videos
-- Stores rendered chess videos (Remotion Lambda)
CREATE TABLE IF NOT EXISTS videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  game_id UUID NOT NULL REFERENCES chess_analyses(id) ON DELETE CASCADE,
  composition_type VARCHAR(50) NOT NULL DEFAULT 'walkthrough' CHECK (composition_type IN ('walkthrough', 'annotated')),
  s3_url TEXT DEFAULT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'rendering', 'completed', 'failed')),
  start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  end_time TIMESTAMP DEFAULT NULL,
  error TEXT DEFAULT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for videos
CREATE INDEX idx_videos_user_id ON videos(user_id);
CREATE INDEX idx_videos_game_id ON videos(game_id);
CREATE INDEX idx_videos_status ON videos(status);
CREATE INDEX idx_videos_created_at ON videos(created_at DESC);

-- Table 3: game_annotations
-- Stores user annotations for specific moves in a game
CREATE TABLE IF NOT EXISTS game_annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES chess_analyses(id) ON DELETE CASCADE,
  move_index INTEGER NOT NULL,
  annotation_text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_game_move UNIQUE(game_id, move_index),
  CONSTRAINT valid_move_index CHECK (move_index >= 0),
  CONSTRAINT annotation_length CHECK (LENGTH(annotation_text) > 0 AND LENGTH(annotation_text) <= 500)
);

-- Indexes for game_annotations
CREATE INDEX idx_annotations_game_id ON game_annotations(game_id);
CREATE INDEX idx_annotations_move_index ON game_annotations(move_index);

-- =============================================================================
-- TOURNAMENT SYSTEM TABLES
-- =============================================================================

-- Table 4: tournaments
-- Stores chess tournament metadata
CREATE TABLE IF NOT EXISTS tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(500) NOT NULL,
  location VARCHAR(255) DEFAULT NULL,
  start_date DATE NOT NULL,
  end_date DATE DEFAULT NULL,
  tournament_type VARCHAR(50) NOT NULL CHECK (tournament_type IN ('round_robin', 'swiss', 'knockout', 'arena', 'other')),
  total_rounds INTEGER NOT NULL CHECK (total_rounds > 0),
  time_control VARCHAR(100) DEFAULT NULL,
  country_code VARCHAR(3) DEFAULT NULL,
  organizer VARCHAR(255) DEFAULT NULL,
  description TEXT DEFAULT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for tournaments
CREATE INDEX idx_tournaments_start_date ON tournaments(start_date DESC);
CREATE INDEX idx_tournaments_type ON tournaments(tournament_type);
CREATE INDEX idx_tournaments_country ON tournaments(country_code);

-- Table 5: players
-- Stores chess player information (primarily FIDE data)
CREATE TABLE IF NOT EXISTS players (
  fide_id VARCHAR(20) PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  country_code VARCHAR(3) DEFAULT NULL,
  title VARCHAR(10) DEFAULT NULL,
  birth_year INTEGER DEFAULT NULL CHECK (birth_year IS NULL OR (birth_year >= 1900 AND birth_year <= EXTRACT(YEAR FROM CURRENT_DATE))),
  profile_photo_url TEXT DEFAULT NULL,
  fide_profile_url TEXT DEFAULT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for players
CREATE INDEX idx_players_name ON players(full_name);
CREATE INDEX idx_players_country ON players(country_code);
CREATE INDEX idx_players_title ON players(title);

-- Table 6: tournament_players
-- Junction table linking players to tournaments with their scores and rankings
CREATE TABLE IF NOT EXISTS tournament_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  fide_id VARCHAR(20) NOT NULL REFERENCES players(fide_id) ON DELETE CASCADE,
  starting_rating INTEGER DEFAULT NULL CHECK (starting_rating IS NULL OR (starting_rating >= 0 AND starting_rating <= 4000)),
  seed_number INTEGER DEFAULT NULL CHECK (seed_number IS NULL OR seed_number > 0),
  final_score NUMERIC(4, 1) DEFAULT NULL CHECK (final_score IS NULL OR final_score >= 0),
  final_rank INTEGER DEFAULT NULL CHECK (final_rank IS NULL OR final_rank > 0),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_tournament_player UNIQUE(tournament_id, fide_id)
);

-- Indexes for tournament_players
CREATE INDEX idx_tournament_players_tournament ON tournament_players(tournament_id);
CREATE INDEX idx_tournament_players_player ON tournament_players(fide_id);
CREATE INDEX idx_tournament_players_rank ON tournament_players(tournament_id, final_rank);

-- Table 7: tournament_rounds
-- Stores individual rounds within tournaments
CREATE TABLE IF NOT EXISTS tournament_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL CHECK (round_number > 0),
  round_date DATE DEFAULT NULL,
  round_name VARCHAR(100) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_tournament_round UNIQUE(tournament_id, round_number)
);

-- Indexes for tournament_rounds
CREATE INDEX idx_tournament_rounds_tournament ON tournament_rounds(tournament_id);
CREATE INDEX idx_tournament_rounds_number ON tournament_rounds(tournament_id, round_number);

-- Table 8: tournament_games
-- Links analyzed games to tournament rounds with player pairings
CREATE TABLE IF NOT EXISTS tournament_games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  round_id UUID NOT NULL REFERENCES tournament_rounds(id) ON DELETE CASCADE,
  game_id UUID NOT NULL REFERENCES chess_analyses(id) ON DELETE CASCADE,
  white_fide_id VARCHAR(20) NOT NULL REFERENCES players(fide_id) ON DELETE CASCADE,
  black_fide_id VARCHAR(20) NOT NULL REFERENCES players(fide_id) ON DELETE CASCADE,
  board_number INTEGER DEFAULT NULL CHECK (board_number IS NULL OR board_number > 0),
  result VARCHAR(10) NOT NULL CHECK (result IN ('1-0', '0-1', '1/2-1/2', '*')),
  game_date DATE DEFAULT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT different_players CHECK (white_fide_id != black_fide_id)
);

-- Indexes for tournament_games
CREATE INDEX idx_tournament_games_tournament ON tournament_games(tournament_id);
CREATE INDEX idx_tournament_games_round ON tournament_games(round_id);
CREATE INDEX idx_tournament_games_game ON tournament_games(game_id);
CREATE INDEX idx_tournament_games_white ON tournament_games(white_fide_id);
CREATE INDEX idx_tournament_games_black ON tournament_games(black_fide_id);

-- =============================================================================
-- TRIGGERS FOR AUTOMATIC TIMESTAMP UPDATES
-- =============================================================================

-- Generic trigger function for updating updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update triggers to all tables with updated_at
CREATE TRIGGER trigger_chess_analyses_updated_at
  BEFORE UPDATE ON chess_analyses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_videos_updated_at
  BEFORE UPDATE ON videos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_annotations_updated_at
  BEFORE UPDATE ON game_annotations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_tournaments_updated_at
  BEFORE UPDATE ON tournaments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_players_updated_at
  BEFORE UPDATE ON players
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_tournament_players_updated_at
  BEFORE UPDATE ON tournament_players
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_tournament_games_updated_at
  BEFORE UPDATE ON tournament_games
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- VIEWS (OPTIONAL - USEFUL FOR QUERYING)
-- =============================================================================

-- View: Recent completed analyses
CREATE OR REPLACE VIEW recent_analyses AS
SELECT
  id,
  pgn,
  status,
  completed_at,
  created_at,
  (analysis_results->>'moves')::jsonb AS moves_summary
FROM chess_analyses
WHERE status = 'completed'
ORDER BY completed_at DESC;

-- View: Tournament standings
CREATE OR REPLACE VIEW tournament_standings AS
SELECT
  tp.tournament_id,
  t.name AS tournament_name,
  tp.fide_id,
  p.full_name AS player_name,
  p.title,
  p.country_code,
  tp.starting_rating,
  tp.final_score,
  tp.final_rank
FROM tournament_players tp
JOIN tournaments t ON tp.tournament_id = t.id
JOIN players p ON tp.fide_id = p.fide_id
ORDER BY tp.tournament_id, tp.final_rank ASC NULLS LAST;

-- =============================================================================
-- COMMENTS FOR DOCUMENTATION
-- =============================================================================

COMMENT ON TABLE chess_analyses IS 'Stores chess game PGN and analysis results from Stockfish API';
COMMENT ON TABLE videos IS 'Stores rendered chess videos using Remotion Lambda';
COMMENT ON TABLE game_annotations IS 'User-created text annotations for specific moves in analyzed games';
COMMENT ON TABLE tournaments IS 'Chess tournament metadata and configuration';
COMMENT ON TABLE players IS 'Chess player profiles, primarily from FIDE database';
COMMENT ON TABLE tournament_players IS 'Junction table linking players to tournaments with scores';
COMMENT ON TABLE tournament_rounds IS 'Individual rounds within tournaments';
COMMENT ON TABLE tournament_games IS 'Links analyzed games to tournament rounds with pairings';

-- =============================================================================
-- GRANT PERMISSIONS (ADJUST AS NEEDED FOR YOUR ENVIRONMENT)
-- =============================================================================

-- Example: Grant permissions to application user
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO your_app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO your_app_user;

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================

-- Insert a record to track this migration
CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(20) PRIMARY KEY,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO schema_migrations (version) VALUES ('000_init_complete_schema')
ON CONFLICT (version) DO NOTHING;
