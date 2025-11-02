'use client';

import { useState, useEffect } from 'react';

interface TournamentVideoControlsProps {
  tournamentId: string;
  rounds: Array<{ id: string; round_number: number }>;
  players: Array<{ fide_id: string; full_name: string }>;
}

interface VideoProgress {
  videoId: string;
  status: string;
  progress?: number;
  url?: string;
  videoType?: string;
  metadata?: Record<string, unknown>;
}

export default function TournamentVideoControls({
  tournamentId,
  rounds,
  players,
}: TournamentVideoControlsProps) {
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [selectedRound, setSelectedRound] = useState<string>('');
  const [selectedPlayer, setSelectedPlayer] = useState<string>('');
  const [activeVideos, setActiveVideos] = useState<VideoProgress[]>([]);
  const [completedVideos, setCompletedVideos] = useState<VideoProgress[]>([]);
  const [uploadingToYoutube, setUploadingToYoutube] = useState<string | null>(null);

  // Fetch all videos for this tournament on mount
  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const response = await fetch(`/api/tournaments/videos/generate?tournamentId=${tournamentId}`);
        const data = await response.json();

        if (data.videos) {
          const completed = data.videos
            .filter((v: Record<string, unknown>) => v.status === 'completed')
            .map((v: Record<string, unknown>) => ({
              videoId: v.id as string,
              status: v.status as string,
              url: v.s3_url as string,
              videoType: v.video_type as string,
              metadata: v.metadata as Record<string, unknown>,
            }));
          setCompletedVideos(completed);
        }
      } catch (error) {
        console.error('Error fetching videos:', error);
      }
    };

    fetchVideos();
  }, [tournamentId]);

  // Poll for video progress
  useEffect(() => {
    if (activeVideos.length === 0) return;

    const interval = setInterval(async () => {
      const updatedVideos = await Promise.all(
        activeVideos.map(async (video) => {
          if (video.status === 'completed' || video.status === 'failed') {
            return video; // Skip completed/failed videos
          }

          try {
            const response = await fetch('/api/tournaments/videos/progress', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ videoId: video.videoId }),
            });

            const data = await response.json();

            if (data.type === 'done') {
              const completedVideo = { ...video, status: 'completed', progress: 100, url: data.url };
              // Move to completed videos
              setCompletedVideos(prev => [...prev, completedVideo]);
              return completedVideo;
            } else if (data.type === 'error') {
              return { ...video, status: 'failed', progress: 0 };
            } else if (data.type === 'progress') {
              return { ...video, status: 'rendering', progress: Math.round(data.progress * 100) };
            }
          } catch (error) {
            console.error('Error checking progress:', error);
          }

          return video;
        })
      );

      setActiveVideos(updatedVideos);
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(interval);
  }, [activeVideos]);

  const generateVideo = async (videoType: 'tournament_overview' | 'round_overview' | 'player_overview') => {
    setGenerating(true);
    setMessage(null);

    try {
      const body: {
        tournamentId: string;
        videoType: string;
        roundId?: string;
        playerFideId?: string;
      } = {
        tournamentId,
        videoType,
      };

      if (videoType === 'round_overview') {
        if (!selectedRound) {
          setMessage({ type: 'error', text: 'Please select a round first' });
          setGenerating(false);
          return;
        }
        body.roundId = selectedRound;
      }

      if (videoType === 'player_overview') {
        if (!selectedPlayer) {
          setMessage({ type: 'error', text: 'Please select a player first' });
          setGenerating(false);
          return;
        }
        body.playerFideId = selectedPlayer;
      }

      const response = await fetch('/api/tournaments/videos/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate video');
      }

      setMessage({
        type: 'success',
        text: `Video generation started! Rendering in progress...`,
      });

      // Add to active videos for progress tracking
      setActiveVideos(prev => [...prev, {
        videoId: data.videoId,
        status: 'generating_script',
        progress: 0,
      }]);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to generate video',
      });
    } finally {
      setGenerating(false);
    }
  };

  const generateBatchVideos = async (batchType: 'all_rounds' | 'all_players') => {
    setGenerating(true);
    setMessage(null);

    try {
      const response = await fetch('/api/tournaments/videos/generate-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournamentId,
          batchType,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate batch videos');
      }

      setMessage({
        type: 'success',
        text: `Batch generation started! Created ${data.count} videos.`,
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to generate batch videos',
      });
    } finally {
      setGenerating(false);
    }
  };

  const uploadToYouTube = async (videoId: string) => {
    setUploadingToYoutube(videoId);
    setMessage(null);

    try {
      const response = await fetch('/api/tournaments/videos/youtube-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload to YouTube');
      }

      setMessage({
        type: 'success',
        text: `Successfully uploaded to YouTube! URL: ${data.youtubeUrl}`,
      });

      // Update completed video with YouTube URL
      setCompletedVideos(prev =>
        prev.map(v =>
          v.videoId === videoId
            ? { ...v, metadata: { ...v.metadata, youtubeUrl: data.youtubeUrl } }
            : v
        )
      );
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to upload to YouTube',
      });
    } finally {
      setUploadingToYoutube(null);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
      <h2 className="text-2xl font-bold mb-4">🎬 Generate Tournament Videos</h2>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        Create AI-powered video summaries of the tournament, rounds, and player performances.
      </p>

      {message && (
        <div
          className={`mb-4 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="space-y-6">
        {/* Tournament Overview */}
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h3 className="font-semibold text-lg mb-2">Tournament Overview</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            Create a comprehensive 2-3 minute video covering the entire tournament with AI-generated narrative.
          </p>
          <button
            onClick={() => generateVideo('tournament_overview')}
            disabled={generating}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {generating ? 'Generating...' : 'Generate Tournament Overview'}
          </button>
        </div>

        {/* Round Overview */}
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h3 className="font-semibold text-lg mb-2">Round Overview</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            Generate a video for a specific round or all rounds at once.
          </p>
          <div className="flex gap-3 mb-3">
            <select
              value={selectedRound}
              onChange={(e) => setSelectedRound(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="">Select a round...</option>
              {rounds.map((round) => (
                <option key={round.id} value={round.id}>
                  Round {round.round_number}
                </option>
              ))}
            </select>
            <button
              onClick={() => generateVideo('round_overview')}
              disabled={generating || !selectedRound}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
            >
              Generate Single Round
            </button>
          </div>
          <button
            onClick={() => generateBatchVideos('all_rounds')}
            disabled={generating}
            className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {generating ? 'Generating...' : `Generate All ${rounds.length} Rounds`}
          </button>
        </div>

        {/* Player Overview */}
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h3 className="font-semibold text-lg mb-2">Player Overview</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            Generate performance analysis videos for specific players or all players.
          </p>
          <div className="flex gap-3 mb-3">
            <select
              value={selectedPlayer}
              onChange={(e) => setSelectedPlayer(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="">Select a player...</option>
              {players.map((player) => (
                <option key={player.fide_id} value={player.fide_id}>
                  {player.full_name}
                </option>
              ))}
            </select>
            <button
              onClick={() => generateVideo('player_overview')}
              disabled={generating || !selectedPlayer}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
            >
              Generate Single Player
            </button>
          </div>
          <button
            onClick={() => generateBatchVideos('all_players')}
            disabled={generating}
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {generating ? 'Generating...' : `Generate All ${players.length} Players`}
          </button>
        </div>
      </div>

      {/* Active Video Renders */}
      {activeVideos.length > 0 && (
        <div className="mt-6 space-y-3">
          <h3 className="font-semibold text-lg">🎬 Active Renders</h3>
          {activeVideos.map((video) => (
            <div
              key={video.videoId}
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">
                  Video ID: {video.videoId.slice(0, 8)}...
                </span>
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    video.status === 'completed'
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                      : video.status === 'failed'
                      ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
                      : 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200'
                  }`}
                >
                  {video.status === 'generating_script' && '🤖 Generating Script...'}
                  {video.status === 'rendering' && '🎥 Rendering...'}
                  {video.status === 'completed' && '✅ Completed'}
                  {video.status === 'failed' && '❌ Failed'}
                </span>
              </div>
              {video.status === 'rendering' && video.progress !== undefined && (
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${video.progress}%` }}
                  />
                </div>
              )}
              {video.status === 'rendering' && video.progress !== undefined && (
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  Progress: {video.progress}%
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Completed Videos */}
      {completedVideos.length > 0 && (
        <div className="mt-6 space-y-3">
          <h3 className="font-semibold text-lg">✅ Completed Videos</h3>
          {completedVideos.map((video) => {
            const videoTypeName = video.videoType?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Video';
            const youtubeUrl = video.metadata?.youtubeUrl as string | undefined;

            return (
              <div
                key={video.videoId}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900/50"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <span className="text-sm font-medium block mb-1">
                      {videoTypeName}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      ID: {video.videoId.slice(0, 8)}...
                    </span>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200">
                    ✅ Ready
                  </span>
                </div>

                <div className="flex gap-2 flex-wrap">
                  {video.url && (
                    <a
                      href={video.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                    >
                      ⬇️ Download Video
                    </a>
                  )}

                  {youtubeUrl ? (
                    <a
                      href={youtubeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
                    >
                      ▶️ View on YouTube
                    </a>
                  ) : (
                    <button
                      onClick={() => uploadToYouTube(video.videoId)}
                      disabled={uploadingToYoutube === video.videoId}
                      className="px-3 py-2 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                    >
                      {uploadingToYoutube === video.videoId ? (
                        <>⏳ Uploading...</>
                      ) : (
                        <>📤 Upload to YouTube</>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          <strong>Note:</strong> Video generation uses AI to create narratives and may take a few minutes.
          Completed videos will appear above with download and YouTube upload options.
        </p>
      </div>
    </div>
  );
}
