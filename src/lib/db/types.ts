/**
 * Shared TypeScript types for database models
 */

// Type for JSONB fields in PostgreSQL
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface ChessAnalysis {
  id: string;
  pgn: string;
  game_data: JsonValue;
  analysis_config: {
    depth: number;
    find_alternatives: boolean;
  };
  analysis_results: JsonValue;
  status: string;
  progress: number | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface Video {
  id: string;
  user_id: string;
  game_id: string;
  composition_type: string;
  s3_url: string | null;
  status: 'pending' | 'rendering' | 'completed' | 'failed';
  start_time: string;
  end_time: string | null;
  error: string | null;
  metadata: JsonValue;
  created_at: string;
  updated_at: string;
}

export interface GameAnnotation {
  id: string;
  game_id: string;
  move_index: number;
  annotation_text: string;
  created_at: string;
  updated_at: string;
}

export interface Tournament {
  id: string;
  name: string;
  location: string | null;
  start_date: string;
  end_date: string | null;
  tournament_type: 'round_robin' | 'swiss' | 'knockout' | 'arena' | 'other';
  total_rounds: number;
  time_control: string | null;
  country_code: string | null;
  organizer: string | null;
  description: string | null;
  metadata: JsonValue;
  created_at: string;
  updated_at: string;
}

export interface Player {
  fide_id: string;
  full_name: string;
  country_code: string | null;
  title: string | null;
  birth_year: number | null;
  profile_photo_url: string | null;
  fide_profile_url: string | null;
  metadata: JsonValue;
  created_at: string;
  updated_at: string;
}

export interface TournamentPlayer {
  id: string;
  tournament_id: string;
  fide_id: string;
  starting_rating: number | null;
  seed_number: number | null;
  final_score: number | null;
  final_rank: number | null;
  metadata: JsonValue;
  created_at: string;
  updated_at: string;
}

export interface TournamentRound {
  id: string;
  tournament_id: string;
  round_number: number;
  round_date: string | null;
  round_name: string | null;
  created_at: string;
}

export interface TournamentGame {
  id: string;
  tournament_id: string;
  round_id: string;
  game_id: string;
  white_fide_id: string;
  black_fide_id: string;
  board_number: number | null;
  result: '1-0' | '0-1' | '1/2-1/2' | '*';
  game_date: string | null;
  metadata: JsonValue;
  created_at: string;
  updated_at: string;
}

export interface TournamentVideo {
  id: string;
  user_id: string;
  tournament_id: string;
  video_type: 'tournament_overview' | 'round_overview' | 'player_overview';
  round_id: string | null;
  player_fide_id: string | null;
  composition_type: string;
  status: 'pending' | 'generating_script' | 'rendering' | 'completed' | 'failed';
  s3_url: string | null;
  ai_script: JsonValue;
  selected_game_id: string | null;
  start_time: string;
  end_time: string | null;
  error: string | null;
  metadata: JsonValue;
  created_at: string;
  updated_at: string;
}

export interface PlayerProfile {
  id: string;
  username: string;
  platform: 'chess_com' | 'lichess';
  platform_user_id: string | null;
  display_name: string | null;
  country: string | null;
  joined_date: string | null;
  avatar_url: string | null;
  profile_url: string | null;
  ratings: JsonValue;
  last_analysis_date: string | null;
  total_games_analyzed: number;
  analysis_in_progress: boolean;
  fide_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlayerGame {
  id: string;
  player_profile_id: string;
  chess_analysis_id: string | null;
  platform_game_id: string;
  platform: 'chess_com' | 'lichess';
  game_url: string | null;
  pgn: string;
  time_control: string | null;
  time_class: string | null;
  rated: boolean | null;
  variant: string;
  white_username: string;
  white_rating: number | null;
  black_username: string;
  black_rating: number | null;
  player_color: 'white' | 'black';
  result: string | null;
  termination: string | null;
  opening_eco: string | null;
  opening_name: string | null;
  opening_variation: string | null;
  played_at: string;
  moves_count: number | null;
  analysis_status: 'pending' | 'analyzing' | 'completed' | 'failed' | 'skipped';
  analysis_queued_at: string | null;
  analysis_completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlayerGameInsight {
  id: string;
  player_game_id: string;
  chess_analysis_id: string | null;
  average_centipawn_loss: number | null;
  accuracy_percentage: number | null;
  blunders_count: number;
  mistakes_count: number;
  inaccuracies_count: number;
  brilliant_moves_count: number;
  best_moves_count: number;
  game_changing_blunder: JsonValue;
  missed_wins: JsonValue;
  brilliant_moment: JsonValue;
  expected_result: number | null;
  actual_result: number | null;
  result_surprise: number | null;
  opening_phase_eval: number | null;
  opening_advantage: boolean | null;
  created_at: string;
}

export interface PlayerOpeningStat {
  id: string;
  player_profile_id: string;
  opening_eco: string;
  opening_name: string;
  player_color: 'white' | 'black';
  time_class: string | null;
  total_games: number;
  wins: number;
  draws: number;
  losses: number;
  win_rate: number | null;
  average_accuracy: number | null;
  average_centipawn_loss: number | null;
  average_opponent_rating: number | null;
  rating_performance: number | null;
  last_played_at: string | null;
  first_played_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AnalysisQueueItem {
  id: string;
  player_game_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'retry';
  priority: number;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  queued_at: string;
  started_at: string | null;
  completed_at: string | null;
}
