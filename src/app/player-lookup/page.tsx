/**
 * Player Lookup Search Page
 * Search and import players from Chess.com or Lichess
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function PlayerLookupPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [platform, setPlatform] = useState<'chess_com' | 'lichess'>('chess_com');
  const [maxGames, setMaxGames] = useState(100);
  const [searching, setSearching] = useState(false);
  const [importing, setImporting] = useState(false);
  const [searchResult, setSearchResult] = useState<{ found: boolean; error?: string } | null>(null);
  const [importResult, setImportResult] = useState<any>(null);

  const handleSearch = async () => {
    if (!username.trim()) return;

    setSearching(true);
    setSearchResult(null);

    try {
      const response = await fetch('/api/player-lookup/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), platform }),
      });

      const data = await response.json();

      if (response.ok) {
        setSearchResult({ found: true });
      } else {
        setSearchResult({ found: false, error: data.error });
      }
    } catch {
      setSearchResult({ found: false, error: 'Search failed' });
    } finally {
      setSearching(false);
    }
  };

  const handleImport = async () => {
    if (!username.trim()) return;

    setImporting(true);
    setImportResult(null);

    try {
      const response = await fetch('/api/player-lookup/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          platform,
          maxGames,
          startAnalysis: true,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setImportResult(data);
        // Redirect to dashboard after a delay
        setTimeout(() => {
          router.push(`/player-lookup/${data.profile.id}`);
        }, 2000);
      } else {
        setImportResult({ error: data.error });
      }
    } catch {
      setImportResult({ error: 'Import failed' });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Player Lookup
          </h1>
          <p className="text-gray-600 mb-8">
            Import and analyze games from Chess.com or Lichess
          </p>

          {/* Platform Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Platform
            </label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="chess_com"
                  checked={platform === 'chess_com'}
                  onChange={(e) => setPlatform(e.target.value as 'chess_com')}
                  className="mr-2"
                />
                <span>Chess.com</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="lichess"
                  checked={platform === 'lichess'}
                  onChange={(e) => setPlatform(e.target.value as 'lichess')}
                  className="mr-2"
                />
                <span>Lichess</span>
              </label>
            </div>
          </div>

          {/* Username Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={platform === 'chess_com' ? 'hikaru' : 'DrNykterstein'}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>

          {/* Max Games Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Number of Games to Import
            </label>
            <input
              type="number"
              value={maxGames}
              onChange={(e) => setMaxGames(parseInt(e.target.value) || 100)}
              min={1}
              max={1000}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-sm text-gray-500 mt-1">
              Recommended: 100-500 games. More games = longer analysis time.
            </p>
          </div>

          {/* Search Button */}
          <button
            onClick={handleSearch}
            disabled={searching || !username.trim()}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed mb-4"
          >
            {searching ? 'Searching...' : 'Search Player'}
          </button>

          {/* Search Result */}
          {searchResult && (
            <div className={`p-4 rounded-md mb-4 ${
              searchResult.found ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
            }`}>
              {searchResult.found ? (
                <div>
                  <p className="text-green-800 font-medium">✓ Player found!</p>
                  <p className="text-green-700 text-sm mt-1">
                    Click "Import Games" to start analyzing.
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-red-800 font-medium">✗ Player not found</p>
                  <p className="text-red-700 text-sm mt-1">
                    {searchResult.error || 'Please check the username and try again.'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Import Button */}
          {searchResult?.found && (
            <button
              onClick={handleImport}
              disabled={importing}
              className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {importing ? 'Importing...' : `Import ${maxGames} Games & Analyze`}
            </button>
          )}

          {/* Import Result */}
          {importResult && (
            <div className={`mt-4 p-4 rounded-md ${
              importResult.error ? 'bg-red-50 border border-red-200' : 'bg-blue-50 border border-blue-200'
            }`}>
              {importResult.error ? (
                <div>
                  <p className="text-red-800 font-medium">Import failed</p>
                  <p className="text-red-700 text-sm mt-1">{importResult.error}</p>
                </div>
              ) : (
                <div>
                  <p className="text-blue-800 font-medium">✓ Import successful!</p>
                  <div className="text-blue-700 text-sm mt-2 space-y-1">
                    <p>• Imported: {importResult.import.gamesImported} games</p>
                    <p>• Duplicates: {importResult.import.gamesDuplicate} games</p>
                    {importResult.analysis && (
                      <p>• Queued for analysis: {importResult.analysis.queued} games</p>
                    )}
                  </div>
                  <p className="text-blue-600 text-sm mt-3 font-medium">
                    Redirecting to dashboard...
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Info Box */}
          <div className="mt-8 p-4 bg-gray-50 rounded-md border border-gray-200">
            <h3 className="font-medium text-gray-900 mb-2">How it works</h3>
            <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
              <li>Search for a player on Chess.com or Lichess</li>
              <li>Choose how many recent games to import</li>
              <li>Games are automatically analyzed with Stockfish</li>
              <li>View insights, opening statistics, and surprising results</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
