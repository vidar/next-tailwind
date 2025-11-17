import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import {
  indexGames,
  indexVideos,
  indexTournaments,
  indexPlayers,
  deleteDocument,
  INDEXES,
} from '@/lib/meilisearch';

/**
 * Sync endpoint to update Meilisearch when database changes occur
 * POST /api/search/sync
 *
 * Body:
 * {
 *   "action": "index" | "update" | "delete",
 *   "type": "game" | "video" | "tournament" | "player",
 *   "id": "..." (for update/delete)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, type, id } = body;

    if (!action || !type) {
      return NextResponse.json(
        { success: false, error: 'Missing action or type' },
        { status: 400 }
      );
    }

    const pool = getPool();

    switch (type) {
      case 'game': {
        if (action === 'delete' && id) {
          await deleteDocument(INDEXES.GAMES, id);
          return NextResponse.json({ success: true, action: 'deleted', id });
        }

        // Index/update game
        const gameResult = await pool.query(
          `
          SELECT
            ca.id,
            ca.pgn,
            ca.game_data,
            ca.status,
            ca.created_at,
            (
              SELECT json_agg(json_build_object('annotation_text', ga.annotation_text))
              FROM game_annotations ga
              WHERE ga.game_id = ca.id
            ) as annotations,
            CASE
              WHEN tg.tournament_id IS NOT NULL THEN
                json_build_object('id', t.id, 'name', t.name)
              ELSE NULL
            END as tournament
          FROM chess_analyses ca
          LEFT JOIN tournament_games tg ON tg.game_id = ca.id
          LEFT JOIN tournaments t ON t.id = tg.tournament_id
          WHERE ca.id = $1
        `,
          [id]
        );

        if (gameResult.rows.length > 0) {
          await indexGames(gameResult.rows);
          return NextResponse.json({ success: true, action: 'indexed', id });
        }
        break;
      }

      case 'video': {
        if (action === 'delete' && id) {
          await deleteDocument(INDEXES.VIDEOS, id);
          return NextResponse.json({ success: true, action: 'deleted', id });
        }

        const videoResult = await pool.query(
          `
          SELECT
            v.*,
            json_build_object('pgn', ca.pgn, 'game_data', ca.game_data) as game
          FROM videos v
          LEFT JOIN chess_analyses ca ON ca.id = v.game_id
          WHERE v.id = $1
        `,
          [id]
        );

        if (videoResult.rows.length > 0) {
          await indexVideos(videoResult.rows);
          return NextResponse.json({ success: true, action: 'indexed', id });
        }
        break;
      }

      case 'tournament': {
        if (action === 'delete' && id) {
          await deleteDocument(INDEXES.TOURNAMENTS, id);
          return NextResponse.json({ success: true, action: 'deleted', id });
        }

        const tournamentResult = await pool.query(
          `
          SELECT
            t.*,
            (
              SELECT json_agg(json_build_object('full_name', p.full_name))
              FROM tournament_players tp
              JOIN players p ON p.fide_id = tp.fide_id
              WHERE tp.tournament_id = t.id
            ) as players,
            (
              SELECT json_agg(tg.*)
              FROM tournament_games tg
              WHERE tg.tournament_id = t.id
            ) as games
          FROM tournaments t
          WHERE t.id = $1
        `,
          [id]
        );

        if (tournamentResult.rows.length > 0) {
          await indexTournaments(tournamentResult.rows);
          return NextResponse.json({ success: true, action: 'indexed', id });
        }
        break;
      }

      case 'player': {
        const { fideId } = body;

        if (action === 'delete' && id) {
          await deleteDocument(INDEXES.PLAYERS, id);
          return NextResponse.json({ success: true, action: 'deleted', id });
        }

        if (fideId) {
          // FIDE player
          const fideResult = await pool.query(
            'SELECT * FROM players WHERE fide_id = $1',
            [fideId]
          );
          if (fideResult.rows.length > 0) {
            await indexPlayers(fideResult.rows, []);
            return NextResponse.json({ success: true, action: 'indexed', fideId });
          }
        } else if (id) {
          // Platform player
          const platformResult = await pool.query(
            'SELECT * FROM player_profiles WHERE id = $1',
            [id]
          );
          if (platformResult.rows.length > 0) {
            await indexPlayers([], platformResult.rows);
            return NextResponse.json({ success: true, action: 'indexed', id });
          }
        }
        break;
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid type' },
          { status: 400 }
        );
    }

    return NextResponse.json(
      { success: false, error: 'Resource not found' },
      { status: 404 }
    );
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Sync failed',
      },
      { status: 500 }
    );
  }
}

/**
 * Bulk sync all data
 * GET /api/search/sync?full=true
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const full = searchParams.get('full') === 'true';

    if (!full) {
      return NextResponse.json(
        {
          success: false,
          error: 'Use POST for individual syncs or GET with ?full=true for full re-index',
        },
        { status: 400 }
      );
    }

    const pool = getPool();
    const results = {
      games: 0,
      videos: 0,
      tournaments: 0,
      players: 0,
    };

    // Index games
    const gamesResult = await pool.query(`
      SELECT
        ca.id,
        ca.pgn,
        ca.game_data,
        ca.status,
        ca.created_at,
        (
          SELECT json_agg(json_build_object('annotation_text', ga.annotation_text))
          FROM game_annotations ga
          WHERE ga.game_id = ca.id
        ) as annotations,
        CASE
          WHEN tg.tournament_id IS NOT NULL THEN
            json_build_object('id', t.id, 'name', t.name)
          ELSE NULL
        END as tournament
      FROM chess_analyses ca
      LEFT JOIN tournament_games tg ON tg.game_id = ca.id
      LEFT JOIN tournaments t ON t.id = tg.tournament_id
      WHERE ca.status = 'completed'
    `);
    await indexGames(gamesResult.rows);
    results.games = gamesResult.rows.length;

    // Index videos
    const videosResult = await pool.query(`
      SELECT
        v.*,
        json_build_object('pgn', ca.pgn, 'game_data', ca.game_data) as game
      FROM videos v
      LEFT JOIN chess_analyses ca ON ca.id = v.game_id
    `);
    await indexVideos(videosResult.rows);
    results.videos = videosResult.rows.length;

    // Index tournaments
    const tournamentsResult = await pool.query(`
      SELECT
        t.*,
        (
          SELECT json_agg(json_build_object('full_name', p.full_name))
          FROM tournament_players tp
          JOIN players p ON p.fide_id = tp.fide_id
          WHERE tp.tournament_id = t.id
        ) as players,
        (
          SELECT json_agg(tg.*)
          FROM tournament_games tg
          WHERE tg.tournament_id = t.id
        ) as games
      FROM tournaments t
    `);
    await indexTournaments(tournamentsResult.rows);
    results.tournaments = tournamentsResult.rows.length;

    // Index players
    const fidePlayers = await pool.query('SELECT * FROM players');
    const platformPlayers = await pool.query('SELECT * FROM player_profiles');
    await indexPlayers(fidePlayers.rows, platformPlayers.rows);
    results.players = fidePlayers.rows.length + platformPlayers.rows.length;

    return NextResponse.json({
      success: true,
      message: 'Full sync completed',
      results,
    });
  } catch (error) {
    console.error('Full sync error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Full sync failed',
      },
      { status: 500 }
    );
  }
}
