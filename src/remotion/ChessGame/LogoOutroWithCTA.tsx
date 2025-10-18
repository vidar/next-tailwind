import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";

export const LogoOutroWithCTA = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Logo animation (zooms in slightly)
  const logoSpring = spring({
    frame,
    fps,
    config: {
      damping: 100,
      stiffness: 200,
      mass: 0.5,
    },
  });

  const logoScale = interpolate(logoSpring, [0, 1], [0.8, 1]);
  const logoOpacity = interpolate(logoSpring, [0, 1], [0, 1]);

  // CTA elements slide in after logo appears (after ~1 second)
  const ctaStartFrame = fps * 1;
  const ctaSpring = spring({
    frame: Math.max(0, frame - ctaStartFrame),
    fps,
    config: {
      damping: 100,
      stiffness: 200,
      mass: 0.5,
    },
  });

  const ctaOpacity = interpolate(ctaSpring, [0, 1], [0, 1]);
  const ctaTranslateY = interpolate(ctaSpring, [0, 1], [50, 0]);

  // Subscribe button pulse animation (starts after CTA appears)
  const pulseStartFrame = fps * 1.5;
  const pulseProgress = (frame - pulseStartFrame) / (fps * 0.5); // 0.5 second cycle
  const pulseScale = frame > pulseStartFrame
    ? 1 + Math.sin(pulseProgress * Math.PI * 2) * 0.1
    : 1;

  return (
    <AbsoluteFill
      style={{
        background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      {/* Logo Section */}
      <div
        style={{
          opacity: logoOpacity,
          transform: `scale(${logoScale})`,
          marginBottom: '60px',
        }}
      >
        <div
          style={{
            fontSize: '120px',
            fontWeight: 'bold',
            color: 'white',
            textShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
            letterSpacing: '-2px',
          }}
        >
          ChessMoments
        </div>
        <div
          style={{
            fontSize: '32px',
            color: 'rgba(255, 255, 255, 0.9)',
            textAlign: 'center',
            marginTop: '10px',
            fontWeight: '300',
          }}
        >
          chessmoments.com
        </div>
      </div>

      {/* CTA Section */}
      <div
        style={{
          opacity: ctaOpacity,
          transform: `translateY(${ctaTranslateY}px)`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '40px',
        }}
      >
        {/* Subscribe Button */}
        <div
          style={{
            backgroundColor: '#ff0000',
            color: 'white',
            padding: '24px 60px',
            borderRadius: '50px',
            fontSize: '48px',
            fontWeight: 'bold',
            boxShadow: '0 8px 30px rgba(255, 0, 0, 0.4)',
            display: 'flex',
            alignItems: 'center',
            gap: '20px',
            transform: `scale(${pulseScale})`,
            cursor: 'pointer',
          }}
        >
          {/* Bell Icon */}
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="white"
            style={{
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
            }}
          >
            <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z" />
          </svg>
          SUBSCRIBE
        </div>

        {/* Engagement Icons */}
        <div
          style={{
            display: 'flex',
            gap: '60px',
            fontSize: '36px',
            color: 'white',
            fontWeight: '600',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <span style={{ fontSize: '48px' }}>👍</span>
            <span>Like</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <span style={{ fontSize: '48px' }}>💬</span>
            <span>Comment</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <span style={{ fontSize: '48px' }}>🔔</span>
            <span>Bell</span>
          </div>
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: '32px',
            color: 'rgba(255, 255, 255, 0.95)',
            textAlign: 'center',
            fontWeight: '300',
            marginTop: '20px',
          }}
        >
          Daily Chess Analysis & Game Breakdowns
        </div>
      </div>
    </AbsoluteFill>
  );
};
