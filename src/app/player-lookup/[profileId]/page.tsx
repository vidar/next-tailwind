/**
 * Player Dashboard Page
 * Display profile, progress, insights, and opening stats
 */

'use client';

import { useState, useEffect } from 'react';
import { use } from 'react';

interface ProfileData {
  profile: {
    id: string;
    username: string;
    platform: string;
    displayName?: string;
    country?: string;
    ratings: Record<string, unknown>;
    totalGamesAnalyzed: number;
    analysisInProgress: boolean;
  };
  games: {
    total: number;
    pending: number;
    analyzing: number;
    completed: number;
    failed: number;
  };
}

interface ProgressData {
  total: number;
  pending: number;
  analyzing: number;
  completed: number;
  failed: number;
  percentComplete: number;
}

interface InsightsData {
  summary: {
    totalGamesAnalyzed: number;
    averageAccuracy: number | null;
    averageCPL: number | null;
    totalBlunders: number;
    totalMistakes: number;
  };
  surprisingGames: Array<Record<string, unknown>>;
  recentGames: Array<Record<string, unknown>>;
}

interface OpeningStats {
  white: {
    totalOpenings: number;
    totalGames: number;
    topOpenings: Array<Record<string, unknown>>;
  };
  black: {
    totalOpenings: number;
    totalGames: number;
    topOpenings: Array<Record<string, unknown>>;
  };
  topPerformers: Array<Record<string, unknown>>;
}

export default function PlayerDashboardPage({ params }: { params: Promise<{ profileId: string }> }) {
  const resolvedParams = use(params);
  const profileId = resolvedParams.profileId;

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [openings, setOpenings] = useState<OpeningStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'insights' | 'openings'>('overview');

  useEffect(() => {
    fetchData();
  }, [profileId]);

  // Auto-refresh progress while analysis is in progress
  useEffect(() => {
    if (!profile?.profile.analysisInProgress) return;

    const interval = setInterval(() => {
      fetchProgress();
    }, 5000);

    return () => clearInterval(interval);
  }, [profile?.profile.analysisInProgress]);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([
      fetchProfile(),
      fetchProgress(),
      fetchInsights(),
      fetchOpenings(),
    ]);
    setLoading(false);
  };

  const fetchProfile = async () => {
    try {
      const response = await fetch(`/api/player-lookup/${profileId}`);
      if (response.ok) {
        const data = await response.json();
        setProfile(data);
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error);
    }
  };

  const fetchProgress = async () => {
    try {
      const response = await fetch(`/api/player-lookup/${profileId}/progress`);
      if (response.ok) {
        const data = await response.json();
        setProgress(data);
      }
    } catch (error) {
      console.error('Failed to fetch progress:', error);
    }
  };

  const fetchInsights = async () => {
    try {
      const response = await fetch(`/api/player-lookup/${profileId}/insights`);
      if (response.ok) {
        const data = await response.json();
        setInsights(data);
      }
    } catch (error) {
      console.error('Failed to fetch insights:', error);
    }
  };

  const fetchOpenings = async () => {
    try {
      const response = await fetch(`/api/player-lookup/${profileId}/openings`);
      if (response.ok) {
        const data = await response.json();
        setOpenings(data);
      }
    } catch (error) {
      console.error('Failed to fetch openings:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading player data...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">Profile not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {profile.profile.username}
              </h1>
              <p className="text-gray-600 mt-1">
                {profile.profile.platform === 'chess_com' ? 'Chess.com' : 'Lichess'}
                {profile.profile.country && ` • ${profile.profile.country}`}
              </p>
            </div>
            {profile.profile.ratings && (
              <div className="text-right">
                <div className="text-sm text-gray-600">Ratings</div>
                <div className="flex gap-4 mt-1">
                  {Object.entries(profile.profile.ratings as Record<string, unknown>).map(([key, value]) => (
                    <div key={key}>
                      <div className="text-xs text-gray-500 uppercase">{key}</div>
                      <div className="text-lg font-semibold">{typeof value === 'object' && value !== null && 'rating' in value ? (value as Record<string, unknown>).rating as string : value as string}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        {progress && progress.percentComplete < 100 && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold">Analysis Progress</h2>
              <span className="text-2xl font-bold text-blue-600">{progress.percentComplete}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4 mb-4">
              <div
                className="bg-blue-600 h-4 rounded-full transition-all duration-500"
                style={{ width: `${progress.percentComplete}%` }}
              ></div>
            </div>
            <div className="grid grid-cols-4 gap-4 text-sm">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-700">{progress.completed}</div>
                <div className="text-gray-500">Completed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{progress.analyzing}</div>
                <div className="text-gray-500">Analyzing</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-400">{progress.pending}</div>
                <div className="text-gray-500">Pending</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{progress.failed}</div>
                <div className="text-gray-500">Failed</div>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-lg mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('overview')}
                className={`py-4 px-6 font-medium text-sm border-b-2 ${
                  activeTab === 'overview'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab('insights')}
                className={`py-4 px-6 font-medium text-sm border-b-2 ${
                  activeTab === 'insights'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Insights
              </button>
              <button
                onClick={() => setActiveTab('openings')}
                className={`py-4 px-6 font-medium text-sm border-b-2 ${
                  activeTab === 'openings'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Openings
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-6">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="text-sm text-blue-600 font-medium">Total Games</div>
                    <div className="text-3xl font-bold text-blue-900 mt-2">{profile.games.total}</div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4">
                    <div className="text-sm text-green-600 font-medium">Analyzed</div>
                    <div className="text-3xl font-bold text-green-900 mt-2">{profile.games.completed}</div>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-4">
                    <div className="text-sm text-purple-600 font-medium">Avg Accuracy</div>
                    <div className="text-3xl font-bold text-purple-900 mt-2">
                      {insights?.summary.averageAccuracy?.toFixed(1) || '-'}%
                    </div>
                  </div>
                </div>

                {/* Performance Summary */}
                {insights && insights.summary.totalGamesAnalyzed > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Performance Summary</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="border rounded-lg p-4">
                        <div className="text-sm text-gray-600">Average CPL</div>
                        <div className="text-2xl font-bold">{insights.summary.averageCPL?.toFixed(1) || '-'}</div>
                      </div>
                      <div className="border rounded-lg p-4">
                        <div className="text-sm text-gray-600">Total Blunders</div>
                        <div className="text-2xl font-bold text-red-600">{insights.summary.totalBlunders}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'insights' && insights && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold">Most Surprising Games</h3>
                {insights.surprisingGames.length > 0 ? (
                  <div className="space-y-3">
                    {insights.surprisingGames.slice(0, 10).map((game, idx) => {
                      const gameData = game as Record<string, unknown>;
                      const insight = gameData.insight as Record<string, unknown> | undefined;
                      return (
                        <div key={idx} className="border rounded-lg p-4 hover:bg-gray-50">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-medium">
                                {gameData.whiteUsername as string} vs {gameData.blackUsername as string}
                              </div>
                              <div className="text-sm text-gray-600 mt-1">
                                {gameData.openingName as string} • {gameData.timeClass as string}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className={`text-lg font-bold ${
                                ((insight?.resultSurprise as number) || 0) > 0 ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {(insight?.resultSurprise as number) > 0 ? '+' : ''}
                                {((insight?.resultSurprise as number) * 100).toFixed(0)}%
                              </div>
                              <div className="text-xs text-gray-500">surprise</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-gray-500">No analyzed games yet</p>
                )}
              </div>
            )}

            {activeTab === 'openings' && openings && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  {/* White Openings */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4">As White</h3>
                    <div className="space-y-2">
                      {openings.white.topOpenings.map((opening, idx) => {
                        const openingData = opening as Record<string, unknown>;
                        return (
                          <div key={idx} className="border rounded p-3">
                            <div className="font-medium">{openingData.eco as string} {openingData.name as string}</div>
                            <div className="text-sm text-gray-600">{openingData.games as number} games</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Black Openings */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4">As Black</h3>
                    <div className="space-y-2">
                      {openings.black.topOpenings.map((opening, idx) => {
                        const openingData = opening as Record<string, unknown>;
                        return (
                          <div key={idx} className="border rounded p-3">
                            <div className="font-medium">{openingData.eco as string} {openingData.name as string}</div>
                            <div className="text-sm text-gray-600">{openingData.games as number} games</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Top Performers */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Best Performing Openings</h3>
                  <div className="space-y-2">
                    {openings.topPerformers.map((opening, idx) => {
                      const openingData = opening as Record<string, unknown>;
                      return (
                        <div key={idx} className="border rounded p-3 flex justify-between items-center">
                          <div>
                            <div className="font-medium">{openingData.eco as string} {openingData.name as string}</div>
                            <div className="text-sm text-gray-600">
                              {openingData.totalGames as number} games as {openingData.color as string}
                            </div>
                          </div>
                          <div className="text-2xl font-bold text-green-600">
                            {(openingData.winRate as number).toFixed(0)}%
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
