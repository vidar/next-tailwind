import { AbsoluteFill, Sequence, useVideoConfig } from 'remotion';
import { z } from 'zod';
import { NarrativeSlide } from './NarrativeSlide';
import { HighlightsSlide } from './HighlightsSlide';
import { StandingsSlide } from './StandingsSlide';
import { LogoIntro } from '../ChessGame/LogoIntro';
import { LogoOutroWithCTA } from '../ChessGame/LogoOutroWithCTA';

// Import ChessGameWalkthrough for the featured game
import { ChessGameWalkthrough } from '../ChessGame/ChessGameWalkthrough';
import { ChessGameProps } from '../../../types/constants';

// Props schema
export const TournamentOverviewProps = z.object({
  // AI-generated content
  title: z.string(),
  summary: z.string(),
  highlights: z.array(z.string()),
  roundSummaries: z.array(z.string()),
  conclusion: z.string(),

  // Tournament info
  tournamentName: z.string(),
  location: z.string().optional(),
  dates: z.string().optional(),

  // Standings
  topPlayers: z.array(z.object({
    rank: z.number(),
    name: z.string(),
    score: z.number(),
    rating: z.number().optional(),
  })),

  // Featured game (optional)
  featuredGame: ChessGameProps.optional(),
});

export const TournamentOverview: React.FC<z.infer<typeof TournamentOverviewProps>> = ({
  title,
  summary,
  highlights,
  roundSummaries,
  conclusion,
  tournamentName,
  location,
  dates,
  topPlayers,
  featuredGame,
}) => {
  const { fps } = useVideoConfig();

  // Calculate durations (in frames)
  const INTRO_DURATION = fps * 3; // 3 seconds
  const TITLE_DURATION = fps * 5; // 5 seconds
  const SUMMARY_DURATION = fps * 8; // 8 seconds
  const HIGHLIGHTS_DURATION = fps * 12; // 12 seconds (2 seconds per highlight + buffer)
  const ROUNDS_DURATION = fps * 10; // 10 seconds
  const STANDINGS_DURATION = fps * 8; // 8 seconds
  const CONCLUSION_DURATION = fps * 5; // 5 seconds
  const GAME_DURATION = featuredGame ? fps * 60 : 0; // 1 minute for featured game
  const OUTRO_DURATION = fps * 3; // 3 seconds

  let currentTime = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000000' }}>
      {/* Intro */}
      <Sequence from={currentTime} durationInFrames={INTRO_DURATION}>
        <LogoIntro />
      </Sequence>
      {(currentTime += INTRO_DURATION) && null}

      {/* Title Slide */}
      <Sequence from={currentTime} durationInFrames={TITLE_DURATION}>
        <NarrativeSlide
          title={title}
          content={`${tournamentName}${location ? ` • ${location}` : ''}${dates ? ` • ${dates}` : ''}`}
          backgroundColor="#1a1a2e"
        />
      </Sequence>
      {(currentTime += TITLE_DURATION) && null}

      {/* Summary */}
      <Sequence from={currentTime} durationInFrames={SUMMARY_DURATION}>
        <NarrativeSlide
          title="Overview"
          content={summary}
          backgroundColor="#16213e"
        />
      </Sequence>
      {(currentTime += SUMMARY_DURATION) && null}

      {/* Highlights */}
      {highlights.length > 0 && (
        <>
          <Sequence from={currentTime} durationInFrames={HIGHLIGHTS_DURATION}>
            <HighlightsSlide
              title="Key Moments"
              highlights={highlights}
              backgroundColor="#0f3460"
            />
          </Sequence>
          {(currentTime += HIGHLIGHTS_DURATION) && null}
        </>
      )}

      {/* Round Summaries */}
      {roundSummaries.length > 0 && (
        <>
          <Sequence from={currentTime} durationInFrames={ROUNDS_DURATION}>
            <HighlightsSlide
              title="Round by Round"
              highlights={roundSummaries}
              backgroundColor="#16213e"
              accentColor="#4ecca3"
            />
          </Sequence>
          {(currentTime += ROUNDS_DURATION) && null}
        </>
      )}

      {/* Standings */}
      {topPlayers.length > 0 && (
        <>
          <Sequence from={currentTime} durationInFrames={STANDINGS_DURATION}>
            <StandingsSlide
              title="Final Standings"
              standings={topPlayers}
              maxDisplay={8}
              backgroundColor="#1a1a2e"
            />
          </Sequence>
          {(currentTime += STANDINGS_DURATION) && null}
        </>
      )}

      {/* Featured Game */}
      {featuredGame && (
        <>
          <Sequence from={currentTime} durationInFrames={fps * 3}>
            <NarrativeSlide
              title="Featured Game"
              content="Watch one of the tournament's most exciting games..."
              backgroundColor="#0f3460"
            />
          </Sequence>
          {(currentTime += fps * 3) && null}

          <Sequence from={currentTime} durationInFrames={GAME_DURATION}>
            <ChessGameWalkthrough {...featuredGame} />
          </Sequence>
          {(currentTime += GAME_DURATION) && null}
        </>
      )}

      {/* Conclusion */}
      <Sequence from={currentTime} durationInFrames={CONCLUSION_DURATION}>
        <NarrativeSlide
          title="Final Thoughts"
          content={conclusion}
          backgroundColor="#16213e"
        />
      </Sequence>
      {(currentTime += CONCLUSION_DURATION) && null}

      {/* Outro */}
      <Sequence from={currentTime} durationInFrames={OUTRO_DURATION}>
        <LogoOutroWithCTA />
      </Sequence>
    </AbsoluteFill>
  );
};
