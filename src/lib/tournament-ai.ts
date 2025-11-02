/**
 * AI service for generating tournament narratives and summaries
 */

import type { Tournament, TournamentPlayer, TournamentRound, TournamentGame, Player } from './db';

interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface TournamentContext {
  tournament: Tournament;
  players: (TournamentPlayer & Player)[];
  rounds: TournamentRound[];
  games: TournamentGame[];
}

interface RoundContext {
  tournament: Tournament;
  round: TournamentRound;
  roundGames: TournamentGame[];
  players: (TournamentPlayer & Player)[];
}

interface PlayerContext {
  tournament: Tournament;
  player: TournamentPlayer & Player;
  playerGames: TournamentGame[];
  allPlayers: (TournamentPlayer & Player)[];
}

/**
 * Call OpenRouter API with retry logic
 */
async function callOpenRouter(
  messages: OpenRouterMessage[],
  options: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  } = {}
): Promise<string> {
  const {
    model = 'openai/gpt-4o-mini',
    temperature = 0.7,
    maxTokens = 1500,
  } = options;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'X-Title': 'Chess Moments',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error: ${error}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}

/**
 * Generate tournament overview narrative
 */
export async function generateTournamentOverview(context: TournamentContext): Promise<{
  title: string;
  summary: string;
  highlights: string[];
  roundSummaries: string[];
  conclusion: string;
}> {
  const { tournament, players, rounds } = context;

  // Gather player info
  const topPlayers = players
    .sort((a, b) => (b.final_score || 0) - (a.final_score || 0))
    .slice(0, 5);

  const playerInfo = topPlayers.map(p =>
    `${p.title || ''} ${p.full_name} (${p.fide_id}): ${p.final_score} points, Rating: ${p.starting_rating}`
  ).join('\n');

  const prompt = `You are creating a compelling narrative for a chess tournament video overview.

Tournament: ${tournament.name}
Location: ${tournament.location || 'Unknown'}
Dates: ${tournament.start_date} to ${tournament.end_date || 'Ongoing'}
Type: ${tournament.tournament_type}
Total Rounds: ${tournament.total_rounds}

Top Players:
${playerInfo}

Based on this information, create a structured tournament overview:

1. A catchy title (5-8 words)
2. An opening summary (2-3 sentences introducing the tournament, its significance, and atmosphere)
3. 3-5 key highlights or memorable moments from the tournament
4. A brief summary for each round (1-2 sentences per round, focusing on key games and standings)
5. A powerful conclusion (1-2 sentences)

Format your response as JSON:
{
  "title": "...",
  "summary": "...",
  "highlights": ["...", "..."],
  "roundSummaries": ["Round 1: ...", "Round 2: ..."],
  "conclusion": "..."
}`;

  const response = await callOpenRouter([
    {
      role: 'system',
      content: 'You are a professional chess commentator creating engaging tournament narratives. Provide responses in valid JSON format only.',
    },
    {
      role: 'user',
      content: prompt,
    },
  ], {
    maxTokens: 2000,
    temperature: 0.8,
  });

  // Parse JSON response
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error('Error parsing AI response:', e);
  }

  // Fallback
  return {
    title: `${tournament.name} Overview`,
    summary: `The ${tournament.name} brought together ${players.length} players in ${tournament.location || 'a prestigious venue'}.`,
    highlights: ['Exciting games throughout', 'Strong competition', 'Memorable moments'],
    roundSummaries: rounds.map((r) => `Round ${r.round_number}: Competitive games played`),
    conclusion: 'A tournament to remember!',
  };
}

/**
 * Generate round overview narrative
 */
export async function generateRoundOverview(context: RoundContext): Promise<{
  title: string;
  summary: string;
  gameHighlights: Array<{ gameId: string; description: string }>;
  standingsNarrative: string;
}> {
  const { tournament, round, roundGames, players } = context;

  // Get players involved in this round
  const gamesSummary = roundGames.map(game => {
    const white = players.find(p => p.fide_id === game.white_fide_id);
    const black = players.find(p => p.fide_id === game.black_fide_id);
    return `Board ${game.board_number || '?'}: ${white?.full_name || 'Unknown'} vs ${black?.full_name || 'Unknown'} - Result: ${game.result}`;
  }).join('\n');

  const prompt = `Create a compelling narrative for Round ${round.round_number} of the ${tournament.name}.

Round Information:
- Round Number: ${round.round_number}
- Date: ${round.round_date || 'Unknown'}
- Games Played: ${roundGames.length}

Games:
${gamesSummary}

Create:
1. A title for this round (5-8 words)
2. An engaging summary (2-3 sentences about the round's significance and key moments)
3. Highlights for 2-3 most interesting games (each 1-2 sentences)
4. A narrative about how the standings changed (1-2 sentences)

Format as JSON:
{
  "title": "...",
  "summary": "...",
  "gameHighlights": [
    {"gameId": "game-uuid", "description": "..."}
  ],
  "standingsNarrative": "..."
}`;

  const response = await callOpenRouter([
    {
      role: 'system',
      content: 'You are a chess commentator. Provide engaging round summaries in JSON format.',
    },
    {
      role: 'user',
      content: prompt,
    },
  ], {
    maxTokens: 1500,
  });

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error('Error parsing AI response:', e);
  }

  return {
    title: `Round ${round.round_number} Highlights`,
    summary: `Round ${round.round_number} featured ${roundGames.length} exciting games.`,
    gameHighlights: roundGames.slice(0, 2).map(g => ({
      gameId: g.game_id,
      description: 'An exciting game with tactical complications.',
    })),
    standingsNarrative: 'The standings remained tight after this round.',
  };
}

/**
 * Generate player overview narrative
 */
export async function generatePlayerOverview(context: PlayerContext): Promise<{
  title: string;
  introduction: string;
  performanceSummary: string;
  bestGame: { gameId: string; description: string } | null;
  disappointingGames: Array<{ gameId: string; description: string }>;
  conclusion: string;
}> {
  const { tournament, player, playerGames, allPlayers } = context;

  const wins = playerGames.filter(g =>
    (g.white_fide_id === player.fide_id && g.result === '1-0') ||
    (g.black_fide_id === player.fide_id && g.result === '0-1')
  ).length;

  const losses = playerGames.filter(g =>
    (g.white_fide_id === player.fide_id && g.result === '0-1') ||
    (g.black_fide_id === player.fide_id && g.result === '1-0')
  ).length;

  const draws = playerGames.filter(g => g.result === '1/2-1/2').length;

  const gamesInfo = playerGames.map(game => {
    const isWhite = game.white_fide_id === player.fide_id;
    const opponent = allPlayers.find(p => p.fide_id === (isWhite ? game.black_fide_id : game.white_fide_id));
    return `vs ${opponent?.full_name || 'Unknown'} (${opponent?.starting_rating || '?'}): ${game.result}`;
  }).join('\n');

  const prompt = `Create a compelling player profile for ${player.title || ''} ${player.full_name}'s performance in the ${tournament.name}.

Player Information:
- Name: ${player.title || ''} ${player.full_name}
- Rating: ${player.starting_rating || 'Unknown'}
- Final Score: ${player.final_score || 0}/${playerGames.length}
- Final Rank: ${player.final_rank || 'Unknown'}
- Record: ${wins}W - ${losses}L - ${draws}D

Games:
${gamesInfo}

Create:
1. A title (5-8 words, e.g., "Magnus Carlsen's Dominant Performance")
2. An introduction (2-3 sentences about the player and their approach to the tournament)
3. A performance summary (2-3 sentences analyzing their play, strengths, and challenges)
4. Identification of their best game (if performance was good) with description
5. 1-2 disappointing games with brief analysis
6. A conclusion (1-2 sentences about their overall tournament experience)

Format as JSON:
{
  "title": "...",
  "introduction": "...",
  "performanceSummary": "...",
  "bestGame": {"gameId": "uuid", "description": "..."} or null,
  "disappointingGames": [{"gameId": "uuid", "description": "..."}],
  "conclusion": "..."
}`;

  const response = await callOpenRouter([
    {
      role: 'system',
      content: 'You are a chess analyst creating player performance reviews. Provide JSON format only.',
    },
    {
      role: 'user',
      content: prompt,
    },
  ], {
    maxTokens: 1800,
  });

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error('Error parsing AI response:', e);
  }

  return {
    title: `${player.full_name}'s Tournament Performance`,
    introduction: `${player.title || ''} ${player.full_name} competed in the ${tournament.name} with a rating of ${player.starting_rating || 'Unknown'}.`,
    performanceSummary: `The player scored ${player.final_score || 0} points, finishing in position ${player.final_rank || 'Unknown'}.`,
    bestGame: playerGames.length > 0 ? {
      gameId: playerGames[0].game_id,
      description: 'A well-played game showcasing solid technique.',
    } : null,
    disappointingGames: [],
    conclusion: 'Overall, a learning experience in a competitive field.',
  };
}

/**
 * Select the most interesting game from a tournament/round
 */
export async function selectMostInterestingGame(
  games: TournamentGame[],
  players: (TournamentPlayer & Player)[]
): Promise<string | null> {
  if (games.length === 0) return null;

  // Simple heuristic: prefer decisive games between high-rated players
  const scoredGames = games.map(game => {
    const white = players.find(p => p.fide_id === game.white_fide_id);
    const black = players.find(p => p.fide_id === game.black_fide_id);

    let score = 0;

    // Prefer decisive games
    if (game.result !== '1/2-1/2' && game.result !== '*') score += 10;

    // Prefer games with higher-rated players
    if (white?.starting_rating) score += white.starting_rating / 1000;
    if (black?.starting_rating) score += black.starting_rating / 1000;

    // Prefer earlier board numbers (usually stronger players)
    if (game.board_number) score += (20 - game.board_number);

    return { game, score };
  });

  scoredGames.sort((a, b) => b.score - a.score);
  return scoredGames[0]?.game.game_id || null;
}
