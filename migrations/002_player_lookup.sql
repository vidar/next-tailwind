-- Player Lookup Feature
-- External player profiles from Chess.com and Lichess

-- Player Profiles Table
CREATE TABLE IF NOT EXISTS player_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  username TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('chess_com', 'lichess')),
  platform_user_id TEXT,
  display_name TEXT,

  -- Profile Info
  country TEXT,
  joined_date DATE,
  avatar_url TEXT,
  profile_url TEXT,

  -- Current Ratings (from platform)
  ratings JSONB,

  -- Analysis Metadata
  last_analysis_date TIMESTAMP WITH TIME ZONE,
  total_games_analyzed INTEGER DEFAULT 0,
  analysis_in_progress BOOLEAN DEFAULT false,

  -- Link to FIDE if available
  fide_id TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(username, platform)
);

CREATE INDEX idx_profiles_username ON player_profiles(username, platform);
CREATE INDEX idx_profiles_platform ON player_profiles(platform);
CREATE INDEX idx_profiles_last_analysis ON player_profiles(last_analysis_date);

-- Player Games Table
CREATE TABLE IF NOT EXISTS player_games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Links
  player_profile_id UUID NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
  chess_analysis_id UUID REFERENCES chess_analyses(id) ON DELETE SET NULL,

  -- Game Identity (from platform)
  platform_game_id TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('chess_com', 'lichess')),
  game_url TEXT,

  -- Basic Game Info
  pgn TEXT NOT NULL,
  time_control TEXT,
  time_class TEXT,
  rated BOOLEAN,
  variant TEXT DEFAULT 'standard',

  -- Players
  white_username TEXT NOT NULL,
  white_rating INTEGER,
  black_username TEXT NOT NULL,
  black_rating INTEGER,
  player_color TEXT NOT NULL CHECK (player_color IN ('white', 'black')),

  -- Result
  result TEXT,
  termination TEXT,

  -- Opening Info
  opening_eco TEXT,
  opening_name TEXT,
  opening_variation TEXT,

  -- Game Metadata
  played_at TIMESTAMP WITH TIME ZONE NOT NULL,
  moves_count INTEGER,

  -- Analysis Status
  analysis_status TEXT DEFAULT 'pending' CHECK (
    analysis_status IN ('pending', 'analyzing', 'completed', 'failed', 'skipped')
  ),
  analysis_queued_at TIMESTAMP WITH TIME ZONE,
  analysis_completed_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(platform, platform_game_id)
);

CREATE INDEX idx_games_profile ON player_games(player_profile_id);
CREATE INDEX idx_games_played_at ON player_games(played_at DESC);
CREATE INDEX idx_games_opening ON player_games(opening_eco);
CREATE INDEX idx_games_time_class ON player_games(time_class);
CREATE INDEX idx_games_analysis_status ON player_games(analysis_status);
CREATE INDEX idx_games_player_color ON player_games(player_profile_id, player_color);

-- Player Game Insights Table
CREATE TABLE IF NOT EXISTS player_game_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  player_game_id UUID NOT NULL REFERENCES player_games(id) ON DELETE CASCADE,
  chess_analysis_id UUID REFERENCES chess_analyses(id) ON DELETE SET NULL,

  -- Performance Metrics
  average_centipawn_loss DECIMAL(8, 2),
  accuracy_percentage DECIMAL(5, 2),
  blunders_count INTEGER DEFAULT 0,
  mistakes_count INTEGER DEFAULT 0,
  inaccuracies_count INTEGER DEFAULT 0,
  brilliant_moves_count INTEGER DEFAULT 0,
  best_moves_count INTEGER DEFAULT 0,

  -- Critical Moments
  game_changing_blunder JSONB,
  missed_wins JSONB,
  brilliant_moment JSONB,

  -- Expected vs Actual Result
  expected_result DECIMAL(3, 2),
  actual_result DECIMAL(3, 2),
  result_surprise DECIMAL(4, 2),

  -- Opening Performance
  opening_phase_eval DECIMAL(6, 2),
  opening_advantage BOOLEAN,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(player_game_id)
);

CREATE INDEX idx_insights_game ON player_game_insights(player_game_id);
CREATE INDEX idx_insights_surprise ON player_game_insights(result_surprise DESC);
CREATE INDEX idx_insights_accuracy ON player_game_insights(accuracy_percentage DESC);

-- Player Opening Stats Table
CREATE TABLE IF NOT EXISTS player_opening_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  player_profile_id UUID NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,

  -- Opening Identity
  opening_eco TEXT NOT NULL,
  opening_name TEXT NOT NULL,
  player_color TEXT NOT NULL CHECK (player_color IN ('white', 'black')),

  -- Time Control Filter (NULL = all time controls)
  time_class TEXT CHECK (time_class IN ('bullet', 'blitz', 'rapid', 'classical')),

  -- Game Counts
  total_games INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  draws INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,

  -- Performance
  win_rate DECIMAL(5, 2),
  average_accuracy DECIMAL(5, 2),
  average_centipawn_loss DECIMAL(8, 2),

  -- Rating Performance
  average_opponent_rating DECIMAL(6, 1),
  rating_performance DECIMAL(7, 2),

  -- Last Played
  last_played_at TIMESTAMP WITH TIME ZONE,
  first_played_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(player_profile_id, opening_eco, player_color, time_class)
);

CREATE INDEX idx_opening_stats_profile ON player_opening_stats(player_profile_id);
CREATE INDEX idx_opening_stats_eco ON player_opening_stats(opening_eco);
CREATE INDEX idx_opening_stats_winrate ON player_opening_stats(win_rate DESC);
CREATE INDEX idx_opening_stats_performance ON player_opening_stats(rating_performance DESC);

-- Analysis Queue Table
CREATE TABLE IF NOT EXISTS analysis_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  player_game_id UUID NOT NULL REFERENCES player_games(id) ON DELETE CASCADE,

  status TEXT DEFAULT 'pending' CHECK (
    status IN ('pending', 'processing', 'completed', 'failed', 'retry')
  ),
  priority INTEGER DEFAULT 5,

  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  last_error TEXT,

  queued_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,

  UNIQUE(player_game_id)
);

CREATE INDEX idx_queue_status ON analysis_queue(status, priority, queued_at);
CREATE INDEX idx_queue_pending ON analysis_queue(queued_at) WHERE status = 'pending';

-- Updated at triggers
CREATE OR REPLACE FUNCTION update_player_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER player_profiles_updated_at
  BEFORE UPDATE ON player_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_player_profiles_updated_at();

CREATE OR REPLACE FUNCTION update_player_games_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER player_games_updated_at
  BEFORE UPDATE ON player_games
  FOR EACH ROW
  EXECUTE FUNCTION update_player_games_updated_at();

CREATE OR REPLACE FUNCTION update_player_opening_stats_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER player_opening_stats_updated_at
  BEFORE UPDATE ON player_opening_stats
  FOR EACH ROW
  EXECUTE FUNCTION update_player_opening_stats_updated_at();
