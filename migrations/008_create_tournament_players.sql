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
