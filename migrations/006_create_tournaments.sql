-- Create tournaments table
CREATE TABLE IF NOT EXISTS tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  location VARCHAR(255),
  start_date DATE NOT NULL,
  end_date DATE,
  tournament_type VARCHAR(50) NOT NULL,
  total_rounds INTEGER NOT NULL,
  time_control VARCHAR(100),
  country_code CHAR(3),
  organizer VARCHAR(255),
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT valid_tournament_type CHECK (tournament_type IN ('round_robin', 'swiss', 'knockout', 'arena', 'other')),
  CONSTRAINT valid_rounds CHECK (total_rounds > 0)
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_tournaments_name ON tournaments(name);
CREATE INDEX IF NOT EXISTS idx_tournaments_date ON tournaments(start_date DESC);
CREATE INDEX IF NOT EXISTS idx_tournaments_type ON tournaments(tournament_type);
CREATE INDEX IF NOT EXISTS idx_tournaments_location ON tournaments(location);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_tournaments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tournaments_updated_at
  BEFORE UPDATE ON tournaments
  FOR EACH ROW
  EXECUTE FUNCTION update_tournaments_updated_at();

-- Add comment
COMMENT ON TABLE tournaments IS 'Stores chess tournament metadata including round-robin, Swiss, and knockout tournaments';
