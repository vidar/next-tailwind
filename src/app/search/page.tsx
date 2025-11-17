'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface SearchResult {
  id: string;
  [key: string]: unknown;
}

interface SearchResponse {
  success: boolean;
  results: Array<{
    hits: SearchResult[];
    query: string;
    processingTimeMs: number;
    estimatedTotalHits: number;
    indexUid: string;
  }>;
  query: string;
  hybrid: boolean;
}

interface FacetsResponse {
  success: boolean;
  facets: Record<string, Record<string, number>>;
}

function SearchPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [facets, setFacets] = useState<Record<string, Record<string, number>>>({});
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<string>('all');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [hybridEnabled, setHybridEnabled] = useState(true);

  // Perform search
  const performSearch = useCallback(async () => {
    if (!query.trim()) {
      setResults(null);
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('q', query);
      params.set('hybrid', String(hybridEnabled));
      if (selectedIndex !== 'all') {
        params.set('indexes', selectedIndex);
      }
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.set(key, value);
      });

      const response = await fetch(`/api/search?${params.toString()}`);
      const data = await response.json();
      setResults(data);

      // Update URL
      const newParams = new URLSearchParams();
      newParams.set('q', query);
      if (selectedIndex !== 'all') newParams.set('index', selectedIndex);
      router.push(`/search?${newParams.toString()}`, { scroll: false });
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  }, [query, hybridEnabled, selectedIndex, filters, router]);

  // Load facets
  const loadFacets = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/search/facets?index=${selectedIndex === 'all' ? 'chess_games' : selectedIndex}`
      );
      const data: FacetsResponse = await response.json();
      if (data.success) {
        setFacets(data.facets);
      }
    } catch (error) {
      console.error('Facets error:', error);
    }
  }, [selectedIndex]);

  // Search on query change (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query) performSearch();
    }, 500);
    return () => clearTimeout(timer);
  }, [query, performSearch]);

  // Load facets on mount and index change
  useEffect(() => {
    loadFacets();
  }, [loadFacets]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({});
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Search Chess Games & Videos
          </h1>
          <p className="text-gray-600">
            AI-powered semantic search across games, tournaments, videos, and players
          </p>
        </div>

        {/* Search Bar */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex gap-4 mb-4">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for players, openings, tournaments..."
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
            />
            <button
              onClick={performSearch}
              disabled={loading || !query.trim()}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>

          {/* Index Selection */}
          <div className="flex flex-wrap gap-2 mb-4">
            {[
              { value: 'all', label: 'All' },
              { value: 'chess_games', label: 'Games' },
              { value: 'chess_videos', label: 'Videos' },
              { value: 'tournaments', label: 'Tournaments' },
              { value: 'players', label: 'Players' },
            ].map((index) => (
              <button
                key={index.value}
                onClick={() => setSelectedIndex(index.value)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  selectedIndex === index.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {index.label}
              </button>
            ))}
          </div>

          {/* AI Toggle */}
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={hybridEnabled}
                onChange={(e) => setHybridEnabled(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">
                Enable AI-powered semantic search
                <span className="ml-1 text-xs text-gray-500">(uses OpenAI embeddings)</span>
              </span>
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Filters Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
                {Object.keys(filters).length > 0 && (
                  <button
                    onClick={clearFilters}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    Clear all
                  </button>
                )}
              </div>

              {/* Game Status Filter */}
              {selectedIndex === 'chess_games' || selectedIndex === 'all' ? (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    value={filters.status || ''}
                    onChange={(e) => handleFilterChange('status', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All statuses</option>
                    <option value="completed">Completed</option>
                    <option value="processing">Processing</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>
              ) : null}

              {/* Result Filter */}
              {selectedIndex === 'chess_games' || selectedIndex === 'all' ? (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Result
                  </label>
                  <select
                    value={filters.result || ''}
                    onChange={(e) => handleFilterChange('result', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All results</option>
                    <option value="1-0">White wins (1-0)</option>
                    <option value="0-1">Black wins (0-1)</option>
                    <option value="1/2-1/2">Draw (1/2-1/2)</option>
                  </select>
                </div>
              ) : null}

              {/* Annotations Filter */}
              {selectedIndex === 'chess_games' || selectedIndex === 'all' ? (
                <div className="mb-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filters.has_annotations === 'true'}
                      onChange={(e) =>
                        handleFilterChange('has_annotations', e.target.checked ? 'true' : '')
                      }
                      className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Has annotations</span>
                  </label>
                </div>
              ) : null}

              {/* Facets Display */}
              {Object.keys(facets).length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-medium text-gray-900 mb-3">
                    Common Filters
                  </h3>
                  {Object.entries(facets).map(([facetName, facetValues]) => (
                    <div key={facetName} className="mb-4">
                      <div className="text-xs text-gray-500 uppercase mb-2">
                        {facetName.replace(/_/g, ' ')}
                      </div>
                      <div className="space-y-1">
                        {Object.entries(facetValues)
                          .slice(0, 5)
                          .map(([value, count]) => (
                            <div
                              key={value}
                              className="flex items-center justify-between text-sm"
                            >
                              <span className="text-gray-700 truncate">{value}</span>
                              <span className="text-gray-500 ml-2">{count}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Results */}
          <div className="lg:col-span-3">
            {loading && (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                <p className="mt-4 text-gray-600">Searching...</p>
              </div>
            )}

            {!loading && results && (
              <>
                {/* Results Stats */}
                <div className="mb-4 text-sm text-gray-600">
                  {results.results.reduce((acc, r) => acc + r.estimatedTotalHits, 0)} results
                  found in{' '}
                  {results.results.reduce((acc, r) => acc + r.processingTimeMs, 0)}ms
                  {hybridEnabled && ' (AI-powered)'}
                </div>

                {/* Results by Index */}
                {results.results.map((indexResult) => (
                  <div key={indexResult.indexUid} className="mb-8">
                    {results.results.length > 1 && (
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 capitalize">
                        {indexResult.indexUid.replace(/_/g, ' ')} ({indexResult.hits.length})
                      </h3>
                    )}

                    <div className="space-y-4">
                      {indexResult.hits.map((hit) => (
                        <ResultCard
                          key={hit.id}
                          hit={hit}
                          indexUid={indexResult.indexUid}
                        />
                      ))}
                    </div>

                    {indexResult.hits.length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        No results found in {indexResult.indexUid.replace(/_/g, ' ')}
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}

            {!loading && !results && query && (
              <div className="text-center py-12 text-gray-500">
                Press Enter or click Search to see results
              </div>
            )}

            {!loading && !query && (
              <div className="text-center py-12 text-gray-500">
                <p className="text-lg mb-2">Start typing to search</p>
                <p className="text-sm">
                  Try searching for player names, openings, or tournament names
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ResultCard({ hit, indexUid }: { hit: SearchResult; indexUid: string }) {
  if (indexUid === 'chess_games') {
    return (
      <Link
        href={`/analyzed_games/${hit.id}`}
        className="block bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow"
      >
        <div className="flex items-start justify-between mb-2">
          <h4 className="text-lg font-semibold text-gray-900">
            {String(hit.white_player)} vs {String(hit.black_player)}
          </h4>
          <span className="text-sm font-medium text-gray-600">{String(hit.result)}</span>
        </div>
        <div className="text-sm text-gray-600 space-y-1">
          {Boolean(hit.opening_name) && (
            <p>
              <span className="font-medium">Opening:</span> {String(hit.opening_name)}{' '}
              {hit.opening_eco ? `(${String(hit.opening_eco)})` : ''}
            </p>
          )}
          {Boolean(hit.tournament_name) && (
            <p>
              <span className="font-medium">Tournament:</span> {String(hit.tournament_name)}
            </p>
          )}
          {Boolean(hit.date) && (
            <p>
              <span className="font-medium">Date:</span> {String(hit.date)}
            </p>
          )}
          {Boolean(hit.has_annotations) && (
            <p className="text-blue-600 font-medium">✓ Has annotations</p>
          )}
        </div>
      </Link>
    );
  }

  if (indexUid === 'chess_videos') {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-start justify-between mb-2">
          <h4 className="text-lg font-semibold text-gray-900">
            {String(hit.white_player)} vs {String(hit.black_player)}
          </h4>
          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
            {String(hit.composition_type)}
          </span>
        </div>
        <div className="text-sm text-gray-600 space-y-1">
          <p>
            <span className="font-medium">Status:</span> {String(hit.status)}
          </p>
          {Boolean(hit.has_youtube_url) && Boolean(hit.youtube_url) && (
            <a
              href={String(hit.youtube_url)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              View on YouTube →
            </a>
          )}
        </div>
      </div>
    );
  }

  if (indexUid === 'tournaments') {
    return (
      <Link
        href={`/tournaments/${hit.id}`}
        className="block bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow"
      >
        <h4 className="text-lg font-semibold text-gray-900 mb-2">{String(hit.name)}</h4>
        <div className="text-sm text-gray-600 space-y-1">
          {Boolean(hit.location) && (
            <p>
              <span className="font-medium">Location:</span> {String(hit.location)}
            </p>
          )}
          {Boolean(hit.tournament_type) && (
            <p>
              <span className="font-medium">Type:</span>{' '}
              <span className="capitalize">{String(hit.tournament_type).replace(/_/g, ' ')}</span>
            </p>
          )}
          {Boolean(hit.start_date) && (
            <p>
              <span className="font-medium">Date:</span>{' '}
              {new Date(String(hit.start_date)).toLocaleDateString()}
            </p>
          )}
          <p>
            <span className="font-medium">Games:</span> {Number(hit.game_count) || 0}
          </p>
        </div>
      </Link>
    );
  }

  if (indexUid === 'players') {
    const isFide = hit.type === 'fide';
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-start justify-between mb-2">
          <h4 className="text-lg font-semibold text-gray-900">
            {isFide ? String(hit.full_name) : String(hit.username)}
          </h4>
          <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">
            {isFide ? 'FIDE' : String(hit.platform)}
          </span>
        </div>
        <div className="text-sm text-gray-600 space-y-1">
          {Boolean(hit.title) && (
            <p>
              <span className="font-medium">Title:</span> {String(hit.title)}
            </p>
          )}
          {Boolean(hit.country_code) && (
            <p>
              <span className="font-medium">Country:</span> {String(hit.country_code)}
            </p>
          )}
          {!isFide && Number(hit.total_games_analyzed) > 0 && (
            <p>
              <span className="font-medium">Games analyzed:</span> {Number(hit.total_games_analyzed)}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <pre className="text-xs text-gray-600 overflow-auto">
        {JSON.stringify(hit, null, 2)}
      </pre>
    </div>
  );
}


export default function SearchPage() {
  return (
    <Suspense fallback={<div className="container mx-auto px-4 py-8">Loading...</div>}>
      <SearchPageContent />
    </Suspense>
  );
}
