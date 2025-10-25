import { AbsoluteFill, Sequence, useVideoConfig } from 'remotion';
import { z } from 'zod';
import { NarrativeSlide } from './NarrativeSlide';
import { HighlightsSlide } from './HighlightsSlide';
import { LogoIntro } from '../ChessGame/LogoIntro';
import { LogoOutroWithCTA } from '../ChessGame/LogoOutroWithCTA';
import { ChessGameWalkthrough } from '../ChessGame/ChessGameWalkthrough';
import { ChessGameProps } from '../../../types/constants';

// Props schema for Player Overview
export const PlayerOverviewProps = z.object({
  // AI-generated content
  title: z.string(),
  introduction: z.string(),
  performanceSummary: z.string(),
  bestGame: z.object({
    gameId: z.string(),
    description: z.string(),
  }).nullable(),
  disappointingGames: z.array(z.object({
    gameId: z.string(),
    description: z.string(),
  })),
  conclusion: z.string(),

  // Player info
  playerName: z.string(),
  playerTitle: z.string().optional(),
  playerRating: z.number().optional(),
  tournamentName: z.string(),
  finalScore: z.number().optional(),
  finalRank: z.number().optional(),

  // Featured game (best game from the tournament)
  featuredGame: ChessGameProps.optional(),
});

export const PlayerOverview: React.FC<z.infer<typeof PlayerOverviewProps>> = ({
  title,
  introduction,
  performanceSummary,
  bestGame,
  disappointingGames,
  conclusion,
  playerName,
  playerTitle,
  playerRating,
  tournamentName,
  finalScore,
  finalRank,
  featuredGame,
}) => {
  const { fps } = useVideoConfig();

  // Calculate durations (in frames)
  const INTRO_DURATION = fps * 3; // 3 seconds
  const TITLE_DURATION = fps * 5; // 5 seconds
  const INTRODUCTION_DURATION = fps * 8; // 8 seconds
  const PERFORMANCE_DURATION = fps * 8; // 8 seconds
  const BEST_GAME_INTRO_DURATION = bestGame ? fps * 5 : 0; // 5 seconds
  const DISAPPOINTING_DURATION = disappointingGames.length > 0 ? fps * 8 : 0;
  const GAME_DURATION = featuredGame ? fps * 60 : 0; // 1 minute for featured game
  const CONCLUSION_DURATION = fps * 5; // 5 seconds
  const OUTRO_DURATION = fps * 3; // 3 seconds

  let currentTime = 0;

  // Player info subtitle
  const playerInfo = `${playerTitle ? playerTitle + ' ' : ''}${playerName}${playerRating ? ` • ${playerRating}` : ''}${finalScore !== undefined ? ` • Score: ${finalScore}` : ''}${finalRank ? ` • Rank: #${finalRank}` : ''}`;

  // Convert disappointingGames to descriptions
  const disappointingDescriptions = disappointingGames.map(g => g.description);

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
          content={`${tournamentName}`}
          subtitle={playerInfo}
          backgroundColor="#1a1a2e"
        />
      </Sequence>
      {(currentTime += TITLE_DURATION) && null}

      {/* Introduction */}
      <Sequence from={currentTime} durationInFrames={INTRODUCTION_DURATION}>
        <NarrativeSlide
          title="Player Profile"
          content={introduction}
          backgroundColor="#16213e"
        />
      </Sequence>
      {(currentTime += INTRODUCTION_DURATION) && null}

      {/* Performance Summary */}
      <Sequence from={currentTime} durationInFrames={PERFORMANCE_DURATION}>
        <NarrativeSlide
          title="Performance Analysis"
          content={performanceSummary}
          backgroundColor="#0f3460"
        />
      </Sequence>
      {(currentTime += PERFORMANCE_DURATION) && null}

      {/* Best Game Intro */}
      {bestGame && (
        <>
          <Sequence from={currentTime} durationInFrames={BEST_GAME_INTRO_DURATION}>
            <NarrativeSlide
              title="Best Game"
              content={bestGame.description}
              backgroundColor="#16213e"
            />
          </Sequence>
          {(currentTime += BEST_GAME_INTRO_DURATION) && null}
        </>
      )}

      {/* Disappointing Games */}
      {disappointingDescriptions.length > 0 && (
        <>
          <Sequence from={currentTime} durationInFrames={DISAPPOINTING_DURATION}>
            <HighlightsSlide
              title="Challenges & Learning Moments"
              highlights={disappointingDescriptions}
              backgroundColor="#1a1a2e"
              accentColor="#e74c3c"
            />
          </Sequence>
          {(currentTime += DISAPPOINTING_DURATION) && null}
        </>
      )}

      {/* Featured Game Playback */}
      {featuredGame && (
        <>
          <Sequence from={currentTime} durationInFrames={fps * 3}>
            <NarrativeSlide
              title="Game Showcase"
              content="Watch the player's best game from the tournament..."
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
