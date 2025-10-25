import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';

interface PlayerStanding {
  rank: number;
  name: string;
  score: number;
  rating?: number;
}

interface StandingsSlideProps {
  title: string;
  standings: PlayerStanding[];
  maxDisplay?: number;
  backgroundColor?: string;
  textColor?: string;
  accentColor?: string;
}

export const StandingsSlide: React.FC<StandingsSlideProps> = ({
  title,
  standings,
  maxDisplay = 8,
  backgroundColor = '#16213e',
  textColor = '#ffffff',
  accentColor = '#e94560',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const displayStandings = standings.slice(0, maxDisplay);

  return (
    <AbsoluteFill
      style={{
        backgroundColor,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '60px 80px',
      }}
    >
      <div style={{ maxWidth: '1200px', width: '100%' }}>
        <h2
          style={{
            fontSize: 56,
            color: textColor,
            marginBottom: 40,
            fontWeight: 800,
            textAlign: 'center',
          }}
        >
          {title}
        </h2>

        {/* Table Header */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '80px 1fr 120px 120px',
            gap: 20,
            padding: '15px 30px',
            backgroundColor: 'rgba(255,255,255,0.1)',
            borderRadius: '8px 8px 0 0',
            fontWeight: 700,
            fontSize: 24,
            color: textColor,
            opacity: 0.8,
          }}
        >
          <div>Rank</div>
          <div>Player</div>
          <div style={{ textAlign: 'center' }}>Score</div>
          <div style={{ textAlign: 'center' }}>Rating</div>
        </div>

        {/* Table Rows */}
        {displayStandings.map((player, index) => {
          const rowOpacity = interpolate(
            frame,
            [fps * 0.3 + index * fps * 0.1, fps * 0.5 + index * fps * 0.1],
            [0, 1],
            { extrapolateRight: 'clamp' }
          );

          const rowTranslateX = interpolate(
            frame,
            [fps * 0.3 + index * fps * 0.1, fps * 0.5 + index * fps * 0.1],
            [-30, 0],
            { extrapolateRight: 'clamp' }
          );

          const isTopThree = player.rank <= 3;

          return (
            <div
              key={index}
              style={{
                display: 'grid',
                gridTemplateColumns: '80px 1fr 120px 120px',
                gap: 20,
                padding: '20px 30px',
                backgroundColor: isTopThree
                  ? 'rgba(233, 69, 96, 0.2)'
                  : index % 2 === 0
                  ? 'rgba(255,255,255,0.05)'
                  : 'transparent',
                borderLeft: isTopThree ? `4px solid ${accentColor}` : 'none',
                fontSize: 28,
                color: textColor,
                alignItems: 'center',
                opacity: rowOpacity,
                transform: `translateX(${rowTranslateX}px)`,
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 32 }}>
                {player.rank === 1 && '🥇 '}
                {player.rank === 2 && '🥈 '}
                {player.rank === 3 && '🥉 '}
                {player.rank > 3 && `${player.rank}.`}
              </div>
              <div style={{ fontWeight: 600 }}>{player.name}</div>
              <div style={{ textAlign: 'center', fontWeight: 700, color: accentColor }}>
                {player.score}
              </div>
              <div style={{ textAlign: 'center', opacity: 0.8 }}>
                {player.rating || '—'}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
