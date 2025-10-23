import { NextRequest, NextResponse } from 'next/server';
import { parseTournamentFromPGN, validateTournamentData } from '@/lib/pgn-parser';
import {
  createTournament,
  upsertPlayer,
  addPlayerToTournament,
  createTournamentRound,
  linkGameToTournament,
  calculateTournamentStandings,
  getTournamentRoundByNumber,
  createPendingAnalysis,
  updateAnalysisResults,
  type Tournament,
} from '@/lib/db';
import { auth } from '@clerk/nextjs/server';

/**
 * POST /api/tournaments/import
 *
 * Imports a tournament from PGN text
 *
 * Body:
 * {
 *   pgnText: string;
 *   analyzeGames?: boolean; // Whether to analyze games that don't exist yet
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Get authenticated user from Clerk
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { pgnText } = body;

    if (!pgnText || typeof pgnText !== 'string') {
      return NextResponse.json(
        { error: 'PGN text is required' },
        { status: 400 }
      );
    }

    // Parse tournament from PGN
    let tournamentInfo;
    try {
      tournamentInfo = parseTournamentFromPGN(pgnText);
    } catch (error) {
      return NextResponse.json(
        {
          error: 'Failed to parse PGN',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 400 }
      );
    }

    // Validate tournament data
    const validation = validateTournamentData(tournamentInfo);
    if (!validation.isValid) {
      return NextResponse.json(
        {
          error: 'Tournament validation failed',
          errors: validation.errors,
          warnings: validation.warnings,
        },
        { status: 400 }
      );
    }

    // Start import process
    const importResult: {
      tournament: Tournament | null;
      playersImported: number;
      roundsCreated: number;
      gamesLinked: number;
      gamesToAnalyze: string[];
      warnings: string[];
      suggestions: string[];
    } = {
      tournament: null,
      playersImported: 0,
      roundsCreated: 0,
      gamesLinked: 0,
      gamesToAnalyze: [],
      warnings: validation.warnings,
      suggestions: validation.suggestions,
    };

    // Step 1: Create tournament
    const tournament = await createTournament({
      name: tournamentInfo.name,
      location: tournamentInfo.location || undefined,
      start_date: tournamentInfo.startDate || new Date().toISOString().split('T')[0],
      end_date: tournamentInfo.endDate || undefined,
      tournament_type: tournamentInfo.type,
      total_rounds: tournamentInfo.totalRounds,
      time_control: tournamentInfo.timeControl || undefined,
      country_code: tournamentInfo.countryCode || undefined,
      metadata: {
        imported_at: new Date().toISOString(),
        imported_by: userId,
        game_count: tournamentInfo.games.length,
      },
    });

    importResult.tournament = tournament;

    // Step 2: Create/update players
    for (const player of tournamentInfo.players) {
      await upsertPlayer({
        fide_id: player.fideId,
        full_name: player.name,
        title: player.title || undefined,
        country_code: player.country || undefined,
      });

      await addPlayerToTournament(
        tournament.id,
        player.fideId,
        player.rating || undefined
      );

      importResult.playersImported++;
    }

    // Step 3: Create rounds
    for (let i = 1; i <= tournamentInfo.totalRounds; i++) {
      await createTournamentRound(tournament.id, i);
      importResult.roundsCreated++;
    }

    // Step 4: Analyze and link games to tournament
    for (const game of tournamentInfo.games) {
      if (!game.whiteFideId || !game.blackFideId) {
        continue; // Skip games without FIDE IDs
      }

      // Get round
      const round = await getTournamentRoundByNumber(tournament.id, game.round);
      if (!round) {
        console.warn(`Round ${game.round} not found for tournament ${tournament.id}`);
        continue;
      }

      try {
        // Create pending analysis in database
        const analysis = await createPendingAnalysis(
          game.pgn,
          20, // Default depth
          true // Find alternatives
        );

        // Call Stockfish API to analyze the game
        const stockfishResponse = await fetch(
          'https://stockfish.chessmoments.com/api/analyze',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              pgn: game.pgn,
              depth: 20,
              find_alternatives: true,
            }),
          }
        );

        if (stockfishResponse.ok) {
          const analysisData = await stockfishResponse.json();

          // Update analysis with results
          await updateAnalysisResults(
            analysis.id,
            analysisData.game_data || {},
            analysisData,
            'completed'
          );

          // Link the analyzed game to the tournament
          await linkGameToTournament(
            tournament.id,
            round.id,
            analysis.id,
            game.whiteFideId,
            game.blackFideId,
            game.result,
            undefined, // board number
            game.date || undefined
          );

          importResult.gamesLinked++;
        } else {
          // If analysis fails, still create the record but mark as failed
          await updateAnalysisResults(
            analysis.id,
            {},
            {},
            'failed',
            `Stockfish API error: ${stockfishResponse.statusText}`
          );
          importResult.gamesToAnalyze.push(game.pgn);
        }
      } catch (error) {
        console.error(`Failed to analyze game ${game.whiteName} vs ${game.blackName}:`, error);
        importResult.gamesToAnalyze.push(game.pgn);
      }
    }

    // Step 5: Calculate initial standings
    await calculateTournamentStandings(tournament.id);

    // Add warning if some games failed to analyze
    if (importResult.gamesToAnalyze.length > 0) {
      importResult.warnings.push(
        `${importResult.gamesToAnalyze.length} game(s) failed to analyze`
      );
    }

    return NextResponse.json({
      success: true,
      tournament: {
        id: tournament.id,
        name: tournament.name,
        type: tournament.tournament_type,
        players: importResult.playersImported,
        rounds: importResult.roundsCreated,
        games: importResult.gamesLinked,
      },
      details: importResult,
    });
  } catch (error) {
    console.error('Tournament import error:', error);
    return NextResponse.json(
      {
        error: 'Failed to import tournament',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

