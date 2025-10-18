interface Player {
  fide_id: string;
  full_name: string;
  title: string | null;
  final_rank: number | null;
  final_score: number | null;
}

interface CrosstableProps {
  players: Player[];
  crosstable: { [key: string]: { [key: string]: string } };
}

export default function Crosstable({ players, crosstable }: CrosstableProps) {
  // Sort players by rank
  const sortedPlayers = [...players].sort((a, b) => {
    if (a.final_rank === null && b.final_rank === null) return 0;
    if (a.final_rank === null) return 1;
    if (b.final_rank === null) return -1;
    return a.final_rank - b.final_rank;
  });

  // Get player display name (shortened for table)
  const getShortName = (fullName: string) => {
    const parts = fullName.split(' ');
    if (parts.length === 1) return fullName;
    const lastName = parts[parts.length - 1];
    const initials = parts
      .slice(0, -1)
      .map((name) => name[0])
      .join('');
    return `${lastName}, ${initials}`;
  };

  // Get result display with color coding
  const getResultCell = (result: string) => {
    let bgColor = 'bg-gray-100 dark:bg-gray-700';
    let textColor = 'text-gray-600 dark:text-gray-400';

    if (result === '1') {
      bgColor = 'bg-green-100 dark:bg-green-900/30';
      textColor = 'text-green-800 dark:text-green-300 font-bold';
    } else if (result === '0') {
      bgColor = 'bg-red-100 dark:bg-red-900/30';
      textColor = 'text-red-800 dark:text-red-300';
    } else if (result === '½') {
      bgColor = 'bg-yellow-100 dark:bg-yellow-900/30';
      textColor = 'text-yellow-800 dark:text-yellow-300 font-medium';
    }

    return (
      <div className={`${bgColor} ${textColor} px-2 py-1 text-center rounded text-sm`}>
        {result}
      </div>
    );
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="border border-gray-300 dark:border-gray-600 p-2 text-left bg-gray-50 dark:bg-gray-800 font-semibold sticky left-0 z-10">
              #
            </th>
            <th className="border border-gray-300 dark:border-gray-600 p-2 text-left bg-gray-50 dark:bg-gray-800 font-semibold sticky left-12 z-10 min-w-[200px]">
              Player
            </th>
            {sortedPlayers.map((_, index) => (
              <th
                key={index}
                className="border border-gray-300 dark:border-gray-600 p-2 text-center bg-gray-50 dark:bg-gray-800 font-semibold min-w-[50px]"
              >
                {index + 1}
              </th>
            ))}
            <th className="border border-gray-300 dark:border-gray-600 p-2 text-center bg-gray-50 dark:bg-gray-800 font-semibold">
              Score
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedPlayers.map((player, rowIndex) => (
            <tr key={player.fide_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
              {/* Rank */}
              <td className="border border-gray-300 dark:border-gray-600 p-2 text-center font-medium bg-white dark:bg-gray-800 sticky left-0 z-10">
                {player.final_rank || '-'}
              </td>

              {/* Player Name */}
              <td className="border border-gray-300 dark:border-gray-600 p-2 bg-white dark:bg-gray-800 sticky left-12 z-10">
                <div className="flex items-center gap-2">
                  {player.title && (
                    <span className="px-1.5 py-0.5 text-xs font-bold rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300">
                      {player.title}
                    </span>
                  )}
                  <span className="text-sm font-medium">
                    {getShortName(player.full_name)}
                  </span>
                </div>
              </td>

              {/* Results against each opponent */}
              {sortedPlayers.map((opponent, colIndex) => (
                <td
                  key={opponent.fide_id}
                  className="border border-gray-300 dark:border-gray-600 p-1"
                >
                  {rowIndex === colIndex ? (
                    <div className="px-2 py-1 text-center text-gray-400">×</div>
                  ) : (
                    getResultCell(
                      crosstable[player.fide_id]?.[opponent.fide_id] || '-'
                    )
                  )}
                </td>
              ))}

              {/* Total Score */}
              <td className="border border-gray-300 dark:border-gray-600 p-2 text-center font-bold">
                {player.final_score !== null ? player.final_score : '-'}
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
