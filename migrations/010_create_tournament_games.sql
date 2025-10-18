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
