/**
 * Game Importer Service
 * Imports games from Chess.com and Lichess and stores them in the database
 */

import * as ChessCom from './chess-com';
import * as Lichess from './lichess';
import {
  upsertPlayerProfile,
  getPlayerProfile,
  createPlayerGame,
  type PlayerProfile,
} from '@/lib/db';

export interface ImportResult {
  profile: PlayerProfile;
  gamesImported: number;
  gamesDuplicate: number;
  errors: string[];
}

/**
 * Import player profile and recent games from Chess.com
 */
export async function importFromChessCom(
  username: string,
  maxGames: number = 100
): Promise<ImportResult> {
  const errors: string[] = [];
  let gamesImported = 0;
  let gamesDuplicate = 0;

  try {
    // Fetch player profile
    console.log(`Fetching Chess.com profile for ${username}...`);
    const apiProfile = await ChessCom.getPlayerProfile(username);
    const apiStats = await ChessCom.getPlayerStats(username);

    // Extract ratings
    const ratings = {
      bullet: apiStats.chess_bullet?.last.rating || null,
      blitz: apiStats.chess_blitz?.last.rating || null,
      rapid: apiStats.chess_rapid?.last.rating || null,
    };

    // Create/update profile in database
    const profile = await upsertPlayerProfile({
      username: apiProfile.username,
      platform: 'chess_com',
      platform_user_id: apiProfile.player_id.toString(),
      display_name: apiProfile.name || apiProfile.username,
      country: ChessCom.extractCountryCode(apiProfile.country) || undefined,
      joined_date: ChessCom.convertTimestamp(apiProfile.joined),
      avatar_url: apiProfile.avatar || undefined,
      profile_url: apiProfile.url,
      ratings,
    });

    console.log(`Profile created/updated: ${profile.id}`);

    // Fetch recent games
    console.log(`Fetching last ${maxGames} games...`);
    const games = await ChessCom.getRecentGames(username, maxGames);
    console.log(`Found ${games.length} games`);

    // Import each game
    for (const game of games) {
      try {
        const playerColor = ChessCom.getPlayerColor(game, username);
        const result = ChessCom.getGameResult(game, username);

        // Extract ECO code from URL if available
        let ecoCode = null;
        if (game.eco) {
          ecoCode = ChessCom.extractEcoCode(game.eco);
        }

        const gameRecord = await createPlayerGame({
          player_profile_id: profile.id,
          platform_game_id: game.uuid,
          platform: 'chess_com',
          game_url: game.url,
          pgn: game.pgn,
          time_control: game.time_control,
          time_class: game.time_class,
          rated: game.rated,
          variant: game.rules === 'chess' ? 'standard' : game.rules,
          white_username: game.white.username,
          white_rating: game.white.rating,
          black_username: game.black.username,
          black_rating: game.black.rating,
          player_color: playerColor,
          result,
          termination: game.white.result, // Chess.com stores termination in result field
          opening_eco: ecoCode || undefined,
          played_at: ChessCom.convertTimestamp(game.end_time),
          moves_count: undefined, // Would need to parse PGN
        });

        if (gameRecord) {
          gamesImported++;
        } else {
          // ON CONFLICT DO NOTHING returns undefined
          gamesDuplicate++;
        }
      } catch (error) {
        errors.push(`Game ${game.uuid}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return {
      profile,
      gamesImported,
      gamesDuplicate,
      errors,
    };
  } catch (error) {
    throw new Error(`Failed to import from Chess.com: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Import player profile and recent games from Lichess
 */
export async function importFromLichess(
  username: string,
  maxGames: number = 100
): Promise<ImportResult> {
  const errors: string[] = [];
  let gamesImported = 0;
  let gamesDuplicate = 0;

  try {
    // Fetch player profile
    console.log(`Fetching Lichess profile for ${username}...`);
    const apiProfile = await Lichess.getPlayerProfile(username);

    // Extract ratings
    const ratings = Lichess.extractRatings(apiProfile);

    // Create/update profile in database
    const profile = await upsertPlayerProfile({
      username: apiProfile.username,
      platform: 'lichess',
      platform_user_id: apiProfile.id,
      display_name: apiProfile.username,
      country: apiProfile.profile?.country || undefined,
      joined_date: Lichess.convertTimestamp(apiProfile.createdAt),
      avatar_url: undefined, // Lichess doesn't provide avatar URL in basic profile
      profile_url: apiProfile.url,
      ratings,
    });

    console.log(`Profile created/updated: ${profile.id}`);

    // Fetch recent games
    console.log(`Fetching last ${maxGames} games...`);
    const games = await Lichess.getRecentGames(username, maxGames);
    console.log(`Found ${games.length} games`);

    // Import each game
    for (const game of games) {
      try {
        const playerColor = Lichess.getPlayerColor(game, username);
        const result = Lichess.getGameResult(game, username);
        const timeControl = Lichess.formatTimeControl(game);
        const timeClass = Lichess.speedToTimeClass(game.speed);

        const gameRecord = await createPlayerGame({
          player_profile_id: profile.id,
          platform_game_id: game.id,
          platform: 'lichess',
          game_url: `https://lichess.org/${game.id}`,
          pgn: game.pgn || '',
          time_control: timeControl,
          time_class: timeClass,
          rated: game.rated,
          variant: game.variant,
          white_username: game.players.white.user?.name || 'Unknown',
          white_rating: game.players.white.rating || undefined,
          black_username: game.players.black.user?.name || 'Unknown',
          black_rating: game.players.black.rating || undefined,
          player_color: playerColor,
          result,
          termination: game.status,
          opening_eco: game.opening?.eco || undefined,
          opening_name: game.opening?.name || undefined,
          played_at: Lichess.convertTimestamp(game.createdAt),
          moves_count: game.moves ? game.moves.split(' ').length : undefined,
        });

        if (gameRecord) {
          gamesImported++;
        } else {
          // ON CONFLICT DO NOTHING returns undefined
          gamesDuplicate++;
        }
      } catch (error) {
        errors.push(`Game ${game.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return {
      profile,
      gamesImported,
      gamesDuplicate,
      errors,
    };
  } catch (error) {
    throw new Error(`Failed to import from Lichess: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Import from both platforms and combine results
 */
export async function importFromBothPlatforms(
  chessComUsername?: string,
  lichessUsername?: string,
  maxGamesPerPlatform: number = 100
): Promise<{
  chessCom?: ImportResult;
  lichess?: ImportResult;
  totalGamesImported: number;
  totalErrors: number;
}> {
  let chessComResult: ImportResult | undefined;
  let lichessResult: ImportResult | undefined;

  if (chessComUsername) {
    try {
      chessComResult = await importFromChessCom(chessComUsername, maxGamesPerPlatform);
    } catch (error) {
      console.error('Chess.com import failed:', error);
    }
  }

  if (lichessUsername) {
    try {
      lichessResult = await importFromLichess(lichessUsername, maxGamesPerPlatform);
    } catch (error) {
      console.error('Lichess import failed:', error);
    }
  }

  const totalGamesImported =
    (chessComResult?.gamesImported || 0) +
    (lichessResult?.gamesImported || 0);

  const totalErrors =
    (chessComResult?.errors.length || 0) +
    (lichessResult?.errors.length || 0);

  return {
    chessCom: chessComResult,
    lichess: lichessResult,
    totalGamesImported,
    totalErrors,
  };
}

/**
 * Check if a player exists on a platform
 */
export async function checkPlayerExists(
  username: string,
  platform: 'chess_com' | 'lichess'
): Promise<boolean> {
  try {
    if (platform === 'chess_com') {
      await ChessCom.getPlayerProfile(username);
    } else {
      await Lichess.getPlayerProfile(username);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Get existing profile from database or create new one
 */
export async function getOrCreateProfile(
  username: string,
  platform: 'chess_com' | 'lichess'
): Promise<PlayerProfile> {
  // Check if already in database
  let profile = await getPlayerProfile(username, platform);

  if (profile) {
    return profile;
  }

  // Import profile (without games)
  if (platform === 'chess_com') {
    const apiProfile = await ChessCom.getPlayerProfile(username);
    const apiStats = await ChessCom.getPlayerStats(username);

    const ratings = {
      bullet: apiStats.chess_bullet?.last.rating || null,
      blitz: apiStats.chess_blitz?.last.rating || null,
      rapid: apiStats.chess_rapid?.last.rating || null,
    };

    profile = await upsertPlayerProfile({
      username: apiProfile.username,
      platform: 'chess_com',
      platform_user_id: apiProfile.player_id.toString(),
      display_name: apiProfile.name || apiProfile.username,
      country: ChessCom.extractCountryCode(apiProfile.country) || undefined,
      joined_date: ChessCom.convertTimestamp(apiProfile.joined),
      avatar_url: apiProfile.avatar || undefined,
      profile_url: apiProfile.url,
      ratings,
    });
  } else {
    const apiProfile = await Lichess.getPlayerProfile(username);
    const ratings = Lichess.extractRatings(apiProfile);

    profile = await upsertPlayerProfile({
      username: apiProfile.username,
      platform: 'lichess',
      platform_user_id: apiProfile.id,
      display_name: apiProfile.username,
      country: apiProfile.profile?.country || undefined,
      joined_date: Lichess.convertTimestamp(apiProfile.createdAt),
      profile_url: apiProfile.url,
      ratings,
    });
  }

  return profile;
}
