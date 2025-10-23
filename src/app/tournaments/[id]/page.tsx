'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import StandingsTable from '@/components/tournament/StandingsTable';
import Crosstable from '@/components/tournament/Crosstable';

interface Tournament {
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
  metadata: Record<string, unknown>;
}

interface Player {
  fide_id: string;
  full_name: string;
  title: string | null;
  country_code: string | null;
  starting_rating: number | null;
  final_score: number | null;
  final_rank: number | null;
}

interface Round {
  id: string;
  round_number: number;
  round_date: string | null;
  round_name: string | null;
}

interface Game {
  id: string;
  game_id: string;
  white_fide_id: string;
  black_fide_id: string;
  result: string;
  board_number: number | null;
  game_date: string | null;
  round_id: string;
}

interface CrosstableCell {
  result: string;
  gameId: string | null;
}

type ViewMode = 'standings' | 'crosstable' | 'games';

export default function TournamentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [crosstable, setCrosstable] = useState<{ [key: string]: { [key: string]: CrosstableCell } }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('standings');

  useEffect(() => {
    fetchTournament();
  }, [resolvedParams.id]);

  const fetchTournament = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/tournaments/${resolvedParams.id}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch tournament');
      }

      setTournament(data.tournament);
      setPlayers(data.players);
      setRounds(data.rounds);
      setGames(data.games);
      setCrosstable(data.crosstable);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tournament');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTournamentType = (type: string) => {
    return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const getPlayerName = (fideId: string) => {
    const player = players.find(p => p.fide_id === fideId);
    return player?.full_name || 'Unknown';
  };

  const getRoundNumber = (roundId: string) => {
    const round = rounds.find(r => r.id === roundId);
    return round?.round_number || '?';
  };

  // Loading State
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading tournament...</p>
        </div>
      </div>
    );
  }

  // Error State
  if (error || !tournament) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-red-800 dark:text-red-200 mb-2">
            Error Loading Tournament
          </h2>
          <p className="text-red-700 dark:text-red-300 mb-4">{error || 'Tournament not found'}</p>
          <Link
            href="/tournaments"
            className="inline-block px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Back to Tournaments
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/tournaments"
          className="text-blue-600 dark:text-blue-400 hover:underline mb-4 inline-block"
        >
          ← Back to Tournaments
        </Link>
      </div>

      {/* Tournament Info Card */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold">{tournament.name}</h1>
              {tournament.country_code && (
                <span className="text-3xl">{tournament.country_code}</span>
              )}
            </div>
            <span className="px-3 py-1 text-sm font-medium rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
              {formatTournamentType(tournament.tournament_type)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          {/* Location */}
          {tournament.location && (
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Location</p>
              <p className="font-medium">{tournament.location}</p>
            </div>
          )}

          {/* Date */}
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Date</p>
            <p className="font-medium">
              {formatDate(tournament.start_date)}
              {tournament.end_date && tournament.end_date !== tournament.start_date && (
                <> – {formatDate(tournament.end_date)}</>
              )}
            </p>
          </div>

          {/* Rounds */}
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Rounds</p>
            <p className="font-medium">{tournament.total_rounds}</p>
          </div>

          {/* Time Control */}
          {tournament.time_control && (
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Time Control</p>
              <p className="font-medium">{tournament.time_control}</p>
            </div>
          )}

          {/* Organizer */}
          {tournament.organizer && (
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Organizer</p>
              <p className="font-medium">{tournament.organizer}</p>
            </div>
          )}

          {/* Players */}
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Players</p>
            <p className="font-medium">{players.length}</p>
          </div>

          {/* Games */}
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Games</p>
            <p className="font-medium">{games.length}</p>
          </div>
        </div>

        {/* Description */}
        {tournament.description && (
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Description</p>
            <p className="text-gray-800 dark:text-gray-200">{tournament.description}</p>
          </div>
        )}
      </div>

      {/* View Mode Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg mb-6">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex -mb-px">
            <button
              onClick={() => setViewMode('standings')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                viewMode === 'standings'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              Standings
            </button>
            <button
              onClick={() => setViewMode('crosstable')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                viewMode === 'crosstable'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              Crosstable
            </button>
            <button
              onClick={() => setViewMode('games')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                viewMode === 'games'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              Games ({games.length})
            </button>
          </nav>
        </div>

        <div className="p-6">
          {/* Standings View */}
          {viewMode === 'standings' && (
            <div>
              <h2 className="text-xl font-bold mb-4">Final Standings</h2>
              <StandingsTable players={players} totalRounds={tournament.total_rounds} />
            </div>
          )}

          {/* Crosstable View */}
          {viewMode === 'crosstable' && (
            <div>
              <h2 className="text-xl font-bold mb-4">Crosstable</h2>
              <Crosstable players={players} crosstable={crosstable} />
            </div>
          )}

          {/* Games View */}
          {viewMode === 'games' && (
            <div>
              <h2 className="text-xl font-bold mb-4">Games</h2>
              {games.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No games linked to this tournament yet
                </div>
              ) : (
                <div className="space-y-2">
                  {games.map((game) => (
                    <Link
                      key={game.id}
                      href={`/analyzed_games/${game.game_id}`}
                      className="block p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                              Round {getRoundNumber(game.round_id)}
                            </span>
                            {game.board_number && (
                              <span className="text-sm text-gray-500 dark:text-gray-500">
                                Board {game.board_number}
                              </span>
                            )}
                          </div>
                          <div className="mt-1 font-medium">
                            {getPlayerName(game.white_fide_id)} vs {getPlayerName(game.black_fide_id)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-lg">{game.result}</div>
                          {game.game_date && (
                            <div className="text-sm text-gray-500 dark:text-gray-500">
                              {new Date(game.game_date).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
