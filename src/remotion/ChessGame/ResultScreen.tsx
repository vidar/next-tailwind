import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

interface ResultScreenProps {
  white: string;
  black: string;
  result: string;
  termination?: string;
}

export const ResultScreen = ({ white, black, result, termination }: ResultScreenProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Spring animation for entrance
  const entrance = spring({
    frame,
    fps,
    config: {
      damping: 100,
      stiffness: 200,
      mass: 0.5,
    },
  });

  // Fade in
  const opacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // Parse result to determine winner - use termination if available, otherwise result
  const displayText = termination || result;
  let resultText = '';
  let resultColor = '#9ca3af';

  if (result === '1-0') {
    resultText = `${white} wins!`;
    resultColor = '#10b981'; // green
  } else if (result === '0-1') {
    resultText = `${black} wins!`;
    resultColor = '#10b981'; // green
  } else if (result === '1/2-1/2') {
    resultText = 'Draw';
    resultColor = '#f59e0b'; // orange
  } else {
    resultText = displayText;
  }

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#1e293b',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        opacity,
      }}
    >
      {/* Main result text */}
      <div
        style={{
          fontSize: '120px',
          fontWeight: 'bold',
          color: resultColor,
          marginBottom: '40px',
          transform: `scale(${entrance})`,
        }}
      >
        {resultText}
      </div>

      {/* Termination/Score */}
      <div
        style={{
          fontSize: '56px',
          color: '#e5e7eb',
          marginBottom: '60px',
          transform: `scale(${entrance})`,
          textAlign: 'center',
          maxWidth: '90%',
        }}
      >
        {displayText}
      </div>

      {/* Players */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          alignItems: 'center',
          transform: `translateY(${interpolate(frame, [10, 30], [20, 0], { extrapolateRight: 'clamp' })}px)`,
          opacity: interpolate(frame, [10, 30], [0, 1], { extrapolateRight: 'clamp' }),
        }}
      >
        <div
          style={{
            fontSize: '48px',
            color: '#f3f4f6',
          }}
        >
          {white}
        </div>
        <div
          style={{
            fontSize: '36px',
            color: '#9ca3af',
          }}
        >
          vs
        </div>
        <div
          style={{
            fontSize: '48px',
            color: '#f3f4f6',
          }}
        >
          {black}
        </div>
      </div>
    </AbsoluteFill>
  );
};
