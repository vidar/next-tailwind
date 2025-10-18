-- Create players table
CREATE TABLE IF NOT EXISTS players (
  fide_id VARCHAR(20) PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  country_code CHAR(3),
  title VARCHAR(10),
  birth_year INTEGER,
  profile_photo_url TEXT,
  fide_profile_url TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT valid_title CHECK (title IN ('GM', 'IM', 'FM', 'CM', 'WGM', 'WIM', 'WFM', 'WCM', NULL)),
  CONSTRAINT valid_birth_year CHECK (birth_year IS NULL OR (birth_year >= 1900 AND birth_year <= EXTRACT(YEAR FROM CURRENT_DATE)))
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_players_name ON players(full_name);
CREATE INDEX IF NOT EXISTS idx_players_country ON players(country_code);
CREATE INDEX IF NOT EXISTS idx_players_title ON players(title);
CREATE INDEX IF NOT EXISTS idx_players_name_search ON players USING gin(to_tsvector('english', full_name));

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_players_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER players_updated_at
  BEFORE UPDATE ON players
  FOR EACH ROW
  EXECUTE FUNCTION update_players_updated_at();

-- Add comment
COMMENT ON TABLE players IS 'Stores chess player information with FIDE ID as primary identifier';
COMMENT ON COLUMN players.fide_id IS 'Official FIDE identifier for the player';
COMMENT ON COLUMN players.title IS 'FIDE title: GM, IM, FM, CM, WGM, WIM, WFM, WCM';
-- Create tournament_players junction table
CREATE TABLE IF NOT EXISTS tournament_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  fide_id VARCHAR(20) NOT NULL REFERENCES players(fide_id) ON DELETE CASCADE,
  starting_rating INTEGER,
  seed_number INTEGER,
  final_score DECIMAL(4, 1),
  final_rank INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(tournament_id, fide_id),
  CONSTRAINT valid_rating CHECK (starting_rating IS NULL OR (starting_rating >= 0 AND starting_rating <= 3500)),
  CONSTRAINT valid_score CHECK (final_score IS NULL OR final_score >= 0),
  CONSTRAINT valid_rank CHECK (final_rank IS NULL OR final_rank > 0)
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_tournament_players_tournament ON tournament_players(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_players_player ON tournament_players(fide_id);
CREATE INDEX IF NOT EXISTS idx_tournament_players_score ON tournament_players(tournament_id, final_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_tournament_players_rank ON tournament_players(tournament_id, final_rank ASC NULLS LAST);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_tournament_players_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tournament_players_updated_at
  BEFORE UPDATE ON tournament_players
  FOR EACH ROW
  EXECUTE FUNCTION update_tournament_players_updated_at();

-- Add comments
COMMENT ON TABLE tournament_players IS 'Links players to tournaments with their participation details';
COMMENT ON COLUMN tournament_players.starting_rating IS 'Player rating at tournament start';
COMMENT ON COLUMN tournament_players.seed_number IS 'Player seeding/ranking position';
COMMENT ON COLUMN tournament_players.final_score IS 'Final score (e.g., 7.5 out of 14)';
COMMENT ON COLUMN tournament_players.final_rank IS 'Final ranking position in tournament';
COMMENT ON COLUMN tournament_players.metadata IS 'Additional data like performance rating, tie-breaks, etc.';
-- Create tournament_rounds table
CREATE TABLE IF NOT EXISTS tournament_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  round_date DATE,
  round_name VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(tournament_id, round_number),
  CONSTRAINT valid_round_number CHECK (round_number > 0)
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_tournament_rounds_tournament ON tournament_rounds(tournament_id, round_number);
CREATE INDEX IF NOT EXISTS idx_tournament_rounds_date ON tournament_rounds(round_date);

-- Add comments
COMMENT ON TABLE tournament_rounds IS 'Organizes tournament games into rounds';
COMMENT ON COLUMN tournament_rounds.round_number IS 'Sequential round number (1, 2, 3, ...)';
COMMENT ON COLUMN tournament_rounds.round_name IS 'Optional descriptive name (e.g., "Semifinals", "Final")';
-- Create tournament_games table
CREATE TABLE IF NOT EXISTS tournament_games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  round_id UUID NOT NULL REFERENCES tournament_rounds(id) ON DELETE CASCADE,
  game_id UUID NOT NULL REFERENCES chess_analyses(id) ON DELETE CASCADE,
  white_fide_id VARCHAR(20) NOT NULL REFERENCES players(fide_id),
  black_fide_id VARCHAR(20) NOT NULL REFERENCES players(fide_id),
  board_number INTEGER,
  result VARCHAR(10) NOT NULL,
  game_date DATE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(game_id),
  CONSTRAINT valid_result CHECK (result IN ('1-0', '0-1', '1/2-1/2', '*')),
  CONSTRAINT different_players CHECK (white_fide_id != black_fide_id),
  CONSTRAINT valid_board_number CHECK (board_number IS NULL OR board_number > 0)
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_tournament_games_tournament ON tournament_games(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_games_round ON tournament_games(round_id);
CREATE INDEX IF NOT EXISTS idx_tournament_games_white ON tournament_games(white_fide_id);
CREATE INDEX IF NOT EXISTS idx_tournament_games_black ON tournament_games(black_fide_id);
CREATE INDEX IF NOT EXISTS idx_tournament_games_game ON tournament_games(game_id);
CREATE INDEX IF NOT EXISTS idx_tournament_games_players ON tournament_games(white_fide_id, black_fide_id);
CREATE INDEX IF NOT EXISTS idx_tournament_games_date ON tournament_games(game_date);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_tournament_games_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tournament_games_updated_at
  BEFORE UPDATE ON tournament_games
  FOR EACH ROW
  EXECUTE FUNCTION update_tournament_games_updated_at();

-- Add comments
COMMENT ON TABLE tournament_games IS 'Links chess games to tournaments and rounds';
COMMENT ON COLUMN tournament_games.game_id IS 'Reference to the analyzed chess game';
COMMENT ON COLUMN tournament_games.board_number IS 'Board number for team tournaments or simultaneous exhibitions';
COMMENT ON COLUMN tournament_games.result IS 'Game result: 1-0 (white wins), 0-1 (black wins), 1/2-1/2 (draw), * (ongoing/unknown)';
