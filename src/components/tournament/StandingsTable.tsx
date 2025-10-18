interface Player {
  fide_id: string;
  full_name: string;
  title: string | null;
  country_code: string | null;
  starting_rating: number | null;
  final_score: number | null;
  final_rank: number | null;
}

interface StandingsTableProps {
  players: Player[];
  totalRounds: number;
}

export default function StandingsTable({ players, totalRounds }: StandingsTableProps) {
  // Sort players by rank
  const sortedPlayers = [...players].sort((a, b) => {
    if (a.final_rank === null && b.final_rank === null) return 0;
    if (a.final_rank === null) return 1;
    if (b.final_rank === null) return -1;
    return a.final_rank - b.final_rank;
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b-2 border-gray-300 dark:border-gray-600">
            <th className="text-left py-3 px-2 font-semibold">#</th>
            <th className="text-left py-3 px-2 font-semibold">Player</th>
            <th className="text-center py-3 px-2 font-semibold">Rating</th>
            <th className="text-center py-3 px-2 font-semibold">Score</th>
            <th className="text-center py-3 px-2 font-semibold">%</th>
          </tr>
        </thead>
        <tbody>
          {sortedPlayers.map((player) => (
            <tr
              key={player.fide_id}
              className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              {/* Rank */}
              <td className="py-3 px-2 font-medium">
                {player.final_rank || '-'}
              </td>

              {/* Player Name with Title */}
              <td className="py-3 px-2">
                <div className="flex items-center gap-2">
                  {player.title && (
                    <span className="px-2 py-0.5 text-xs font-bold rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300">
                      {player.title}
                    </span>
                  )}
                  <span className="font-medium">{player.full_name}</span>
                  {player.country_code && (
                    <span className="text-lg">{player.country_code}</span>
                  )}
                </div>
              </td>

              {/* Rating */}
              <td className="py-3 px-2 text-center text-gray-600 dark:text-gray-400">
                {player.starting_rating || '-'}
              </td>

              {/* Score */}
              <td className="py-3 px-2 text-center font-semibold">
                {player.final_score !== null ? (
                  <>
                    {player.final_score}
                    <span className="text-gray-500 dark:text-gray-400">
                      /{totalRounds}
                    </span>
                  </>
                ) : (
                  '-'
                )}
              </td>

              {/* Percentage */}
              <td className="py-3 px-2 text-center text-gray-600 dark:text-gray-400">
                {player.final_score !== null && totalRounds > 0
                  ? `${Math.round((player.final_score / totalRounds) * 100)}%`
                  : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {sortedPlayers.length === 0 && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          No players in this tournament
        </div>
      )}
    </div>
  );
}
