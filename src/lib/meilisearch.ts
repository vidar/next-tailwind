import { MeiliSearch } from 'meilisearch';

// Initialize Meilisearch client
const client = new MeiliSearch({
  host: process.env.MEILISEARCH_HOST || 'http://localhost:7700',
  apiKey: process.env.MEILISEARCH_MASTER_KEY || '',
});

// Index names
export const INDEXES = {
  GAMES: 'chess_games',
  VIDEOS: 'chess_videos',
  TOURNAMENTS: 'tournaments',
  PLAYERS: 'players',
} as const;

// Types for indexed documents
export interface GameDocument {
  id: string;
  white_player: string;
  black_player: string;
  result: string;
  date: string;
  opening_name?: string;
  opening_eco?: string;
  pgn: string;
  status: string;
  has_annotations: boolean;
  annotation_text?: string;
  tournament_name?: string;
  tournament_id?: string;
  time_control?: string;
  fen?: string;
  created_at: number;
  // Fields for semantic search
  search_text: string; // Combined text for embedding
}

export interface VideoDocument {
  id: string;
  game_id: string;
  user_id?: string;
  white_player: string;
  black_player: string;
  composition_type: string;
  status: string;
  has_youtube_url: boolean;
  youtube_url?: string;
  s3_url?: string;
  created_at: number;
  search_text: string;
}

export interface TournamentDocument {
  id: string;
  name: string;
  location?: string;
  country_code?: string;
  start_date?: string;
  end_date?: string;
  tournament_type?: string;
  total_rounds?: number;
  time_control?: string;
  player_names: string[];
  game_count: number;
  search_text: string;
}

export interface PlayerDocument {
  id: string;
  type: 'fide' | 'platform';
  // FIDE fields
  fide_id?: string;
  full_name?: string;
  title?: string;
  country_code?: string;
  birth_year?: number;
  // Platform fields
  username?: string;
  platform?: string;
  display_name?: string;
  total_games_analyzed?: number;
  search_text: string;
}

/**
 * Initialize all Meilisearch indexes with proper settings
 */
export async function initializeIndexes() {
  try {
    // Games index
    const gamesIndex = client.index(INDEXES.GAMES);
    await gamesIndex.updateSettings({
      searchableAttributes: [
        'white_player',
        'black_player',
        'opening_name',
        'opening_eco',
        'tournament_name',
        'annotation_text',
        'search_text',
      ],
      filterableAttributes: [
        'status',
        'result',
        'opening_eco',
        'has_annotations',
        'tournament_id',
        'date',
        'created_at',
      ],
      sortableAttributes: ['date', 'created_at'],
      rankingRules: [
        'words',
        'typo',
        'proximity',
        'attribute',
        'sort',
        'exactness',
      ],
      // AI-powered hybrid search configuration
      embedders: {
        default: {
          source: 'openAi',
          model: 'text-embedding-3-small',
          apiKey: process.env.OPENAI_API_KEY,
          documentTemplate:
            "A chess game between {{doc.white_player}} (White) and {{doc.black_player}} (Black) with result {{doc.result}}. Opening: {{doc.opening_name}}. {{doc.annotation_text}}",
        },
      },
    });

    // Videos index
    const videosIndex = client.index(INDEXES.VIDEOS);
    await videosIndex.updateSettings({
      searchableAttributes: [
        'white_player',
        'black_player',
        'composition_type',
        'search_text',
      ],
      filterableAttributes: [
        'status',
        'composition_type',
        'has_youtube_url',
        'user_id',
        'created_at',
      ],
      sortableAttributes: ['created_at'],
      embedders: {
        default: {
          source: 'openAi',
          model: 'text-embedding-3-small',
          apiKey: process.env.OPENAI_API_KEY,
          documentTemplate:
            "A {{doc.composition_type}} chess video of {{doc.white_player}} vs {{doc.black_player}}",
        },
      },
    });

    // Tournaments index
    const tournamentsIndex = client.index(INDEXES.TOURNAMENTS);
    await tournamentsIndex.updateSettings({
      searchableAttributes: [
        'name',
        'location',
        'player_names',
        'search_text',
      ],
      filterableAttributes: [
        'tournament_type',
        'country_code',
        'start_date',
        'total_rounds',
      ],
      sortableAttributes: ['start_date'],
      embedders: {
        default: {
          source: 'openAi',
          model: 'text-embedding-3-small',
          apiKey: process.env.OPENAI_API_KEY,
          documentTemplate:
            'A {{doc.tournament_type}} chess tournament named "{{doc.name}}" in {{doc.location}}',
        },
      },
    });

    // Players index
    const playersIndex = client.index(INDEXES.PLAYERS);
    await playersIndex.updateSettings({
      searchableAttributes: [
        'full_name',
        'username',
        'display_name',
        'search_text',
      ],
      filterableAttributes: [
        'type',
        'title',
        'country_code',
        'platform',
        'birth_year',
      ],
      sortableAttributes: ['total_games_analyzed'],
    });

    console.log('Meilisearch indexes initialized successfully');
    return true;
  } catch (error) {
    console.error('Error initializing Meilisearch indexes:', error);
    throw error;
  }
}

/**
 * Index chess games from database
 */
export async function indexGames(
  games: Array<{
    id: string;
    pgn: string;
    game_data?: { white?: string; black?: string; result?: string; date?: string; eco?: string; opening?: string; time_control?: string };
    status: string;
    created_at: Date;
    annotations?: Array<{ annotation_text: string }>;
    tournament?: { id: string; name: string };
  }>
): Promise<void> {
  const gamesIndex = client.index(INDEXES.GAMES);

  const documents: GameDocument[] = games.map((game) => {
    // Extract game info from PGN or game_data
    const gameData = game.game_data || {};
    const headers = extractPGNHeaders(game.pgn);

    const whitePlayer = headers.White || gameData.white || 'Unknown';
    const blackPlayer = headers.Black || gameData.black || 'Unknown';
    const result = headers.Result || gameData.result || '*';
    const date = headers.Date || gameData.date || '';
    const opening = headers.Opening || gameData.opening || '';
    const eco = headers.ECO || gameData.eco || '';
    const timeControl = headers.TimeControl || gameData.time_control || '';

    const annotationText = game.annotations
      ?.map((a) => a.annotation_text)
      .join(' ') || '';

    const searchText = `${whitePlayer} vs ${blackPlayer} ${opening} ${annotationText} ${game.tournament?.name || ''}`;

    return {
      id: game.id,
      white_player: whitePlayer,
      black_player: blackPlayer,
      result,
      date,
      opening_name: opening,
      opening_eco: eco,
      pgn: game.pgn,
      status: game.status,
      has_annotations: (game.annotations?.length || 0) > 0,
      annotation_text: annotationText,
      tournament_name: game.tournament?.name,
      tournament_id: game.tournament?.id,
      time_control: timeControl,
      created_at: game.created_at.getTime(),
      search_text: searchText,
    };
  });

  await gamesIndex.addDocuments(documents);
}

/**
 * Index videos from database
 */
export async function indexVideos(
  videos: Array<{
    id: string;
    game_id: string;
    user_id?: string;
    composition_type: string;
    status: string;
    metadata?: { youtubeUrl?: string; s3Url?: string };
    created_at: Date;
    game?: {
      pgn: string;
      game_data?: { white?: string; black?: string; result?: string; date?: string };
    };
  }>
): Promise<void> {
  const videosIndex = client.index(INDEXES.VIDEOS);

  const documents: VideoDocument[] = videos.map((video) => {
    const headers = video.game
      ? extractPGNHeaders(video.game.pgn)
      : { White: 'Unknown', Black: 'Unknown' };
    const youtubeUrl = video.metadata?.youtubeUrl;

    const searchText = `${headers.White} vs ${headers.Black} ${video.composition_type} video`;

    return {
      id: video.id,
      game_id: video.game_id,
      user_id: video.user_id,
      white_player: headers.White || 'Unknown',
      black_player: headers.Black || 'Unknown',
      composition_type: video.composition_type,
      status: video.status,
      has_youtube_url: !!youtubeUrl,
      youtube_url: youtubeUrl,
      s3_url: video.metadata?.s3Url,
      created_at: video.created_at.getTime(),
      search_text: searchText,
    };
  });

  await videosIndex.addDocuments(documents);
}

/**
 * Index tournaments from database
 */
export async function indexTournaments(
  tournaments: Array<{
    id: string;
    name: string;
    location?: string;
    country_code?: string;
    start_date?: Date;
    end_date?: Date;
    tournament_type?: string;
    total_rounds?: number;
    time_control?: string;
    players?: Array<{ full_name: string }>;
    games?: Array<{ id: string }>;
  }>
): Promise<void> {
  const tournamentsIndex = client.index(INDEXES.TOURNAMENTS);

  const documents: TournamentDocument[] = tournaments.map((tournament) => {
    const playerNames = tournament.players?.map((p) => p.full_name) || [];
    const searchText = `${tournament.name} ${tournament.location || ''} ${playerNames.join(' ')}`;

    return {
      id: tournament.id,
      name: tournament.name,
      location: tournament.location,
      country_code: tournament.country_code,
      start_date: tournament.start_date?.toISOString(),
      end_date: tournament.end_date?.toISOString(),
      tournament_type: tournament.tournament_type,
      total_rounds: tournament.total_rounds,
      time_control: tournament.time_control,
      player_names: playerNames,
      game_count: tournament.games?.length || 0,
      search_text: searchText,
    };
  });

  await tournamentsIndex.addDocuments(documents);
}

/**
 * Index players from database
 */
export async function indexPlayers(
  fidePlayers: Array<{
    fide_id: string;
    full_name: string;
    title?: string;
    country_code?: string;
    birth_year?: number;
  }>,
  platformPlayers: Array<{
    id: string;
    username: string;
    platform: string;
    display_name?: string;
    country?: string;
    total_games_analyzed?: number;
  }>
): Promise<void> {
  const playersIndex = client.index(INDEXES.PLAYERS);

  const fideDocuments: PlayerDocument[] = fidePlayers.map((player) => ({
    id: `fide-${player.fide_id}`,
    type: 'fide',
    fide_id: player.fide_id,
    full_name: player.full_name,
    title: player.title,
    country_code: player.country_code,
    birth_year: player.birth_year,
    search_text: `${player.full_name} ${player.title || ''} ${player.country_code || ''}`,
  }));

  const platformDocuments: PlayerDocument[] = platformPlayers.map(
    (player) => ({
      id: `platform-${player.id}`,
      type: 'platform',
      username: player.username,
      platform: player.platform,
      display_name: player.display_name,
      country_code: player.country,
      total_games_analyzed: player.total_games_analyzed,
      search_text: `${player.username} ${player.display_name || ''} ${player.platform}`,
    })
  );

  await playersIndex.addDocuments([...fideDocuments, ...platformDocuments]);
}

/**
 * Perform unified search across all indexes
 */
export async function unifiedSearch(
  query: string,
  options: {
    indexes?: string[];
    limit?: number;
    filters?: Record<string, string | boolean>;
    hybrid?: boolean;
  } = {}
) {
  const {
    indexes = Object.values(INDEXES),
    limit = 20,
    filters = {},
    hybrid = true,
  } = options;

  const searchParams: {
    limit: number;
    hybrid?: { semanticRatio: number; embedder: string };
    filter?: string[];
  } = {
    limit,
  };

  // Enable hybrid search (semantic + keyword)
  if (hybrid && process.env.OPENAI_API_KEY) {
    searchParams.hybrid = {
      semanticRatio: 0.5, // Balance between semantic (0.0) and keyword (1.0)
      embedder: 'default',
    };
  }

  // Build filter strings for each index
  const filterStrings: Record<string, string> = {};
  Object.keys(filters).forEach((key) => {
    const value = filters[key];
    if (Array.isArray(value)) {
      filterStrings[key] = value.map((v) => `${key} = "${v}"`).join(' OR ');
    } else if (typeof value === 'string') {
      filterStrings[key] = `${key} = "${value}"`;
    }
  });

  // Search across multiple indexes
  const results = await client.multiSearch({
    queries: indexes.map((indexName) => ({
      indexUid: indexName,
      q: query,
      ...searchParams,
      filter: filterStrings[indexName] || undefined,
    })),
  });

  return results.results;
}

/**
 * Get facet distribution for filtering
 */
export async function getFacets(indexName: string, facets: string[]) {
  const index = client.index(indexName);
  const result = await index.search('', {
    facets,
    limit: 0,
  });
  return result.facetDistribution;
}

/**
 * Delete a document from an index
 */
export async function deleteDocument(indexName: string, documentId: string) {
  const index = client.index(indexName);
  await index.deleteDocument(documentId);
}

/**
 * Update a single document in an index
 */
export async function updateDocument(
  indexName: string,
  document: Record<string, unknown>
) {
  const index = client.index(indexName);
  await index.addDocuments([document], { primaryKey: 'id' });
}

/**
 * Utility: Extract headers from PGN string
 */
function extractPGNHeaders(pgn: string): Record<string, string> {
  const headers: Record<string, string> = {};
  const headerRegex = /\[(\w+)\s+"([^"]*)"\]/g;
  let match;

  while ((match = headerRegex.exec(pgn)) !== null) {
    headers[match[1]] = match[2];
  }

  return headers;
}

export { client as meilisearchClient };
