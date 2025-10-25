import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';

interface NarrativeSlideProps {
  title: string;
  content: string;
  subtitle?: string;
  backgroundColor?: string;
  textColor?: string;
}

export const NarrativeSlide: React.FC<NarrativeSlideProps> = ({
  title,
  content,
  subtitle,
  backgroundColor = '#1a1a2e',
  textColor = '#ffffff',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Fade in animation
  const opacity = interpolate(frame, [0, fps * 0.5], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // Slide up animation
  const translateY = interpolate(frame, [0, fps * 0.5], [30, 0], {
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
      <div
        style={{
          maxWidth: '1200px',
          transform: `translateY(${translateY}px)`,
        }}
      >
        {subtitle && (
          <div
            style={{
              fontSize: 32,
              color: textColor,
              opacity: 0.7,
              marginBottom: 20,
              textTransform: 'uppercase',
              letterSpacing: '3px',
              fontWeight: 600,
            }}
          >
            {subtitle}
          </div>
        )}

        <h1
          style={{
            fontSize: 72,
            color: textColor,
            marginBottom: 60,
            fontWeight: 800,
            lineHeight: 1.2,
            textShadow: '0 4px 20px rgba(0,0,0,0.3)',
          }}
        >
          {title}
        </h1>

        <p
          style={{
            fontSize: 36,
            color: textColor,
            lineHeight: 1.6,
            opacity: 0.9,
            fontWeight: 400,
          }}
        >
          {content}
        </p>
      </div>
    </AbsoluteFill>
  );
};
