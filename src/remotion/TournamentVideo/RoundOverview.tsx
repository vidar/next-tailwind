import { AbsoluteFill, Sequence, useVideoConfig } from 'remotion';
import { z } from 'zod';
import { NarrativeSlide } from './NarrativeSlide';
import { HighlightsSlide } from './HighlightsSlide';
import { StandingsSlide } from './StandingsSlide';
import { LogoIntro } from '../ChessGame/LogoIntro';
import { LogoOutroWithCTA } from '../ChessGame/LogoOutroWithCTA';
import { ChessGameWalkthrough } from '../ChessGame/ChessGameWalkthrough';
import { ChessGameProps } from '../../../types/constants';

// Props schema for Round Overview
export const RoundOverviewProps = z.object({
  // AI-generated content
  title: z.string(),
  summary: z.string(),
  gameHighlights: z.array(z.object({
    gameId: z.string(),
    description: z.string(),
  })),
  standingsNarrative: z.string(),

  // Round info
  tournamentName: z.string(),
  roundNumber: z.number(),
  roundDate: z.string().optional(),
  location: z.string().optional(),

  // Current standings after this round
  topPlayers: z.array(z.object({
    rank: z.number(),
    name: z.string(),
    score: z.number(),
    rating: z.number().optional(),
  })),

  // Featured game from this round
  featuredGame: ChessGameProps.optional(),
});

export const RoundOverview: React.FC<z.infer<typeof RoundOverviewProps>> = ({
  title,
  summary,
  gameHighlights,
  standingsNarrative,
  tournamentName,
  roundNumber,
  roundDate,
  location,
  topPlayers,
  featuredGame,
}) => {
  const { fps } = useVideoConfig();

  // Calculate durations (in frames)
  const INTRO_DURATION = fps * 3; // 3 seconds
  const TITLE_DURATION = fps * 5; // 5 seconds
  const SUMMARY_DURATION = fps * 8; // 8 seconds
  const HIGHLIGHTS_DURATION = fps * 10; // 10 seconds for game highlights
  const STANDINGS_DURATION = fps * 8; // 8 seconds
  const STANDINGS_NARRATIVE_DURATION = fps * 5; // 5 seconds
  const GAME_DURATION = featuredGame ? fps * 60 : 0; // 1 minute for featured game
  const OUTRO_DURATION = fps * 3; // 3 seconds

  let currentTime = 0;

  // Convert gameHighlights to simple strings for HighlightsSlide
  const highlightDescriptions = gameHighlights.map(h => h.description);

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
          content={`${tournamentName} • Round ${roundNumber}${roundDate ? ` • ${roundDate}` : ''}${location ? ` • ${location}` : ''}`}
          backgroundColor="#1a1a2e"
        />
      </Sequence>
      {(currentTime += TITLE_DURATION) && null}

      {/* Summary */}
      <Sequence from={currentTime} durationInFrames={SUMMARY_DURATION}>
        <NarrativeSlide
          title="Round Overview"
          content={summary}
          backgroundColor="#16213e"
        />
      </Sequence>
      {(currentTime += SUMMARY_DURATION) && null}

      {/* Game Highlights */}
      {highlightDescriptions.length > 0 && (
        <>
          <Sequence from={currentTime} durationInFrames={HIGHLIGHTS_DURATION}>
            <HighlightsSlide
              title="Key Games"
              highlights={highlightDescriptions}
              backgroundColor="#0f3460"
            />
          </Sequence>
          {(currentTime += HIGHLIGHTS_DURATION) && null}
        </>
      )}

      {/* Standings after round */}
      {topPlayers.length > 0 && (
        <>
          <Sequence from={currentTime} durationInFrames={STANDINGS_DURATION}>
            <StandingsSlide
              title={`Standings After Round ${roundNumber}`}
              standings={topPlayers}
              maxDisplay={8}
              backgroundColor="#1a1a2e"
            />
          </Sequence>
          {(currentTime += STANDINGS_DURATION) && null}
        </>
      )}

      {/* Standings Narrative */}
      <Sequence from={currentTime} durationInFrames={STANDINGS_NARRATIVE_DURATION}>
        <NarrativeSlide
          title="Impact on Standings"
          content={standingsNarrative}
          backgroundColor="#16213e"
        />
      </Sequence>
      {(currentTime += STANDINGS_NARRATIVE_DURATION) && null}

      {/* Featured Game */}
      {featuredGame && (
        <>
          <Sequence from={currentTime} durationInFrames={fps * 3}>
            <NarrativeSlide
              title="Featured Game"
              content="Watch one of the round's most exciting games..."
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

      {/* Outro */}
      <Sequence from={currentTime} durationInFrames={OUTRO_DURATION}>
        <LogoOutroWithCTA />
      </Sequence>
    </AbsoluteFill>
  );
};
