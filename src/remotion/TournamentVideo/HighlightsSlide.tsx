import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';

interface HighlightsSlideProps {
  title: string;
  highlights: string[];
  backgroundColor?: string;
  textColor?: string;
  accentColor?: string;
}

export const HighlightsSlide: React.FC<HighlightsSlideProps> = ({
  title,
  highlights,
  backgroundColor = '#0f3460',
  textColor = '#ffffff',
  accentColor = '#e94560',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Fade in animation
  const opacity = interpolate(frame, [0, fps * 0.3], [0, 1], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '80px',
        opacity,
      }}
    >
      <div style={{ maxWidth: '1200px', width: '100%' }}>
        <h2
          style={{
            fontSize: 64,
            color: textColor,
            marginBottom: 60,
            fontWeight: 800,
            borderBottom: `4px solid ${accentColor}`,
            paddingBottom: 20,
          }}
        >
          {title}
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
          {highlights.map((highlight, index) => {
            // Stagger the animation for each highlight
            const highlightOpacity = interpolate(
              frame,
              [fps * 0.5 + index * fps * 0.2, fps * 0.7 + index * fps * 0.2],
              [0, 1],
              { extrapolateRight: 'clamp' }
            );

            const highlightTranslateX = interpolate(
              frame,
              [fps * 0.5 + index * fps * 0.2, fps * 0.7 + index * fps * 0.2],
              [-50, 0],
              { extrapolateRight: 'clamp' }
            );

            return (
              <div
                key={index}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 30,
                  opacity: highlightOpacity,
                  transform: `translateX(${highlightTranslateX}px)`,
                }}
              >
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    backgroundColor: accentColor,
                    flexShrink: 0,
                    marginTop: 12,
                  }}
                />
                <p
                  style={{
                    fontSize: 32,
                    color: textColor,
                    lineHeight: 1.5,
                    margin: 0,
                    fontWeight: 400,
                  }}
                >
                  {highlight}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
