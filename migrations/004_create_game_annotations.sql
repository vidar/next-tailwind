-- Create game_annotations table for storing text annotations on specific moves
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

-- Create index for faster lookups by game_id
CREATE INDEX idx_annotations_game_id ON game_annotations(game_id);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_annotations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_annotations_updated_at
  BEFORE UPDATE ON game_annotations
  FOR EACH ROW
  EXECUTE FUNCTION update_annotations_updated_at();
