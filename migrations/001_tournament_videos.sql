-- Tournament Videos table
CREATE TABLE IF NOT EXISTS tournament_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  video_type TEXT NOT NULL CHECK (video_type IN ('tournament_overview', 'round_overview', 'player_overview')),

  -- For round overview videos
  round_id UUID REFERENCES tournament_rounds(id) ON DELETE CASCADE,

  -- For player overview videos
  player_fide_id TEXT,

  -- Video generation details
  composition_type TEXT DEFAULT 'tournament_overview',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generating_script', 'rendering', 'completed', 'failed')),
  s3_url TEXT,

  -- AI-generated content
  ai_script JSONB, -- Contains narrative, summary, highlights
  selected_game_id UUID REFERENCES chess_analyses(id) ON DELETE SET NULL,

  -- Rendering metadata
  start_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  end_time TIMESTAMP WITH TIME ZONE,
  error TEXT,
  metadata JSONB,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  -- Constraints
  CONSTRAINT valid_round_video CHECK (
    (video_type = 'round_overview' AND round_id IS NOT NULL) OR
    (video_type != 'round_overview')
  ),
  CONSTRAINT valid_player_video CHECK (
    (video_type = 'player_overview' AND player_fide_id IS NOT NULL) OR
    (video_type != 'player_overview')
  )
);

-- Indexes
CREATE INDEX idx_tournament_videos_tournament ON tournament_videos(tournament_id);
CREATE INDEX idx_tournament_videos_user ON tournament_videos(user_id);
CREATE INDEX idx_tournament_videos_type ON tournament_videos(video_type);
CREATE INDEX idx_tournament_videos_status ON tournament_videos(status);
CREATE INDEX idx_tournament_videos_round ON tournament_videos(round_id) WHERE round_id IS NOT NULL;
CREATE INDEX idx_tournament_videos_player ON tournament_videos(player_fide_id) WHERE player_fide_id IS NOT NULL;

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_tournament_videos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tournament_videos_updated_at
  BEFORE UPDATE ON tournament_videos
  FOR EACH ROW
  EXECUTE FUNCTION update_tournament_videos_updated_at();
