'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

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
  created_at: string;
}

export default function TournamentsPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [yearFilter, setYearFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Delete confirmation state
  const [deletingTournament, setDeletingTournament] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    fetchTournaments();
  }, [typeFilter, yearFilter]);

  const fetchTournaments = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (typeFilter) params.append('type', typeFilter);
      if (yearFilter) params.append('year', yearFilter);

      const response = await fetch(`/api/tournaments?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch tournaments');
      }

      setTournaments(data.tournaments);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tournaments');
    } finally {
      setLoading(false);
    }
  };

  // Filter tournaments by search query (client-side)
  const filteredTournaments = tournaments.filter((tournament) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      tournament.name.toLowerCase().includes(query) ||
      tournament.location?.toLowerCase().includes(query) ||
      tournament.organizer?.toLowerCase().includes(query)
    );
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTournamentType = (type: string) => {
    return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const handleDeleteClick = (tournamentId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setConfirmDelete(tournamentId);
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;

    setDeletingTournament(confirmDelete);
    setError(null);

    try {
      const response = await fetch(`/api/tournaments/${confirmDelete}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete tournament');
      }

      // Remove tournament from list
      setTournaments(tournaments.filter(t => t.id !== confirmDelete));
      setConfirmDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete tournament');
    } finally {
      setDeletingTournament(null);
    }
  };

  const handleCancelDelete = () => {
    setConfirmDelete(null);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold mb-2">Tournaments</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Browse and manage chess tournaments
          </p>
        </div>
        <Link
          href="/tournaments/import"
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          Import Tournament
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Filters</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium mb-2">Search</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Name, location, organizer..."
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-lg"
            />
          </div>

          {/* Type Filter */}
          <div>
            <label className="block text-sm font-medium mb-2">Type</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-lg"
            >
              <option value="">All Types</option>
              <option value="round_robin">Round Robin</option>
              <option value="swiss">Swiss</option>
              <option value="knockout">Knockout</option>
              <option value="arena">Arena</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Year Filter */}
          <div>
            <label className="block text-sm font-medium mb-2">Year</label>
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-lg"
            >
              <option value="">All Years</option>
              {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Clear Filters */}
        {(typeFilter || yearFilter || searchQuery) && (
          <button
            onClick={() => {
              setTypeFilter('');
              setYearFilter('');
              setSearchQuery('');
            }}
            className="mt-4 text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            Clear all filters
          </button>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading tournaments...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && filteredTournaments.length === 0 && (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h3 className="mt-4 text-lg font-medium">No tournaments found</h3>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            {searchQuery || typeFilter || yearFilter
              ? 'Try adjusting your filters'
              : 'Get started by importing a tournament'}
          </p>
          <Link
            href="/tournaments/import"
            className="mt-4 inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Import Tournament
          </Link>
        </div>
      )}

      {/* Tournaments Grid */}
      {!loading && !error && filteredTournaments.length > 0 && (
        <div>
          <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
            Showing {filteredTournaments.length} tournament{filteredTournaments.length !== 1 ? 's' : ''}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTournaments.map((tournament) => (
              <div
                key={tournament.id}
                className="relative bg-white dark:bg-gray-800 rounded-lg shadow-lg hover:shadow-xl transition-shadow"
              >
                <Link
                  href={`/tournaments/${tournament.id}`}
                  className="block p-6"
                >
                {/* Tournament Type Badge */}
                <div className="flex items-start justify-between mb-3">
                  <span className="px-3 py-1 text-xs font-medium rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                    {formatTournamentType(tournament.tournament_type)}
                  </span>
                  {tournament.country_code && (
                    <span className="text-2xl">{tournament.country_code}</span>
                  )}
                </div>

                {/* Tournament Name */}
                <h3 className="text-xl font-bold mb-2 line-clamp-2">
                  {tournament.name}
                </h3>

                {/* Location */}
                {tournament.location && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {tournament.location}
                  </p>
                )}

                {/* Date */}
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 flex items-center">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {formatDate(tournament.start_date)}
                  {tournament.end_date && tournament.end_date !== tournament.start_date && (
                    <> – {formatDate(tournament.end_date)}</>
                  )}
                </p>

                {/* Metadata */}
                <div className="flex gap-4 text-sm text-gray-600 dark:text-gray-400">
                  <div>
                    <span className="font-medium">{tournament.total_rounds}</span> rounds
                  </div>
                  {tournament.time_control && (
                    <div>
                      <span className="font-medium">{tournament.time_control}</span>
                    </div>
                  )}
                </div>
              </Link>

              {/* Delete Button */}
              <button
                onClick={(e) => handleDeleteClick(tournament.id, e)}
                disabled={deletingTournament === tournament.id}
                className="absolute top-4 right-4 p-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                title="Delete tournament"
              >
                {deletingTournament === tournament.id ? (
                  <div className="animate-spin h-5 w-5 border-2 border-red-600 border-t-transparent rounded-full"></div>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                )}
              </button>
            </div>
            ))}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-2xl font-bold mb-4 text-red-600 dark:text-red-400">
              Delete Tournament?
            </h2>
            <p className="mb-2 text-gray-800 dark:text-gray-200">
              Are you sure you want to delete this tournament?
            </p>
            <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
              This will permanently delete all tournament data including players, rounds, and game links. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleCancelDelete}
                className="flex-1 px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
