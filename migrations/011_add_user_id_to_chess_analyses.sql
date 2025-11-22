-- Add user_id column to chess_analyses table
ALTER TABLE chess_analyses
ADD COLUMN user_id VARCHAR(255);

-- Create index for user_id queries
CREATE INDEX idx_chess_analyses_user_id ON chess_analyses(user_id);

-- Create index for user_id + status
CREATE INDEX idx_chess_analyses_user_id_status ON chess_analyses(user_id, status);
