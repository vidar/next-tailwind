import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export const LogoOutro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Fade out animation
  const fadeOut = interpolate(frame, [0, 30], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const slideUp = spring({
    frame,
    fps,
    config: {
      damping: 200,
    },
  });

  const translateY = interpolate(slideUp, [0, 1], [50, 0]);

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(135deg, #1e3a8a 0%, #7c3aed 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: fadeOut,
      }}
    >
      <div
        style={{
          transform: `translateY(${translateY}px)`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "30px",
        }}
      >
        {/* CM Logo - Smaller for outro */}
        <svg
          width="200"
          height="200"
          viewBox="0 0 200 200"
          style={{
            filter: "drop-shadow(0 20px 40px rgba(0, 0, 0, 0.3))",
          }}
        >
          {/* Background Circle */}
          <circle
            cx="100"
            cy="100"
            r="90"
            fill="white"
            opacity="0.1"
          />

          {/* C Letter */}
          <path
            d="M 70 50 Q 40 50 40 80 Q 40 100 40 120 Q 40 150 70 150 L 80 150 L 80 130 L 70 130 Q 60 130 60 120 Q 60 100 60 80 Q 60 70 70 70 L 80 70 L 80 50 Z"
            fill="white"
          />

          {/* M Letter */}
          <path
            d="M 100 50 L 100 150 L 120 150 L 120 90 L 130 110 L 140 110 L 150 90 L 150 150 L 170 150 L 170 50 L 150 50 L 135 85 L 120 50 Z"
            fill="white"
          />

          {/* Chess Knight Silhouette */}
          <g transform="translate(85, 165)" opacity="0.8">
            <path
              d="M 5 20 L 5 18 L 6 16 L 8 15 L 15 15 L 18 12 L 19 8 L 18 5 L 16 3 L 14 4 L 13 6 L 14 8 L 16 9 L 18 10 L 19 12 L 18 15 L 15 18 L 20 18 L 22 20 Z"
              fill="white"
              transform="scale(1.2)"
            />
          </g>
        </svg>

        {/* Text */}
        <div
          style={{
            fontFamily: "sans-serif",
            fontSize: "40px",
            fontWeight: "bold",
            color: "white",
            letterSpacing: "4px",
            textShadow: "0 4px 20px rgba(0, 0, 0, 0.3)",
          }}
        >
          CHESS MOMENTS
        </div>

        {/* Website URL */}
        <div
          style={{
            fontFamily: "sans-serif",
            fontSize: "28px",
            color: "rgba(255, 255, 255, 0.9)",
            letterSpacing: "2px",
          }}
        >
          chessmoments.com
        </div>
      </div>
    </AbsoluteFill>
  );
};
