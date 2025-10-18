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
