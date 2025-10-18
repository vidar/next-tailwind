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
