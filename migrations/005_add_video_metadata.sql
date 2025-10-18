-- Add metadata column to videos table for storing YouTube-related data
ALTER TABLE videos ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Add index for faster metadata queries
CREATE INDEX IF NOT EXISTS idx_videos_metadata ON videos USING GIN (metadata);

-- Example metadata structure:
-- {
--   "youtubeUrl": "https://youtube.com/watch?v=...",
--   "description": "Full video description with chapters",
--   "chapters": [
--     {"timestamp": "0:00", "title": "Introduction"},
--     {"timestamp": "0:03", "title": "Opening"}
--   ],
--   "hashtags": ["chess", "chessanalysis"],
--   "pinnedCommentId": "comment_id_from_youtube"
-- }
