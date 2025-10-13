import { NextRequest, NextResponse } from "next/server";

interface ChessGame {
  id: string;
  white: string;
  black: string;
  result: string;
  date: string;
  pgn?: string;
}

// Chess.com API types
interface ChessComGame {
  url: string;
  pgn: string;
  time_control: string;
  end_time: number;
  rated: boolean;
  white: {
    username: string;
    rating: number;
  };
  black: {
    username: string;
    rating: number;
  };
}

interface ChessComArchive {
  games: ChessComGame[];
}

// Lichess API types
interface LichessGame {
  id: string;
  rated: boolean;
  variant: string;
  speed: string;
  status: string;
  createdAt: number;
  lastMoveAt: number;
  players: {
    white: {
      user: {
        name: string;
        id: string;
      };
      rating?: number;
    };
    black: {
      user: {
        name: string;
        id: string;
      };
      rating?: number;
    };
  };
  winner?: "white" | "black";
}

async function fetchChessComGames(username: string): Promise<ChessGame[]> {
  try {
    // Get current year and month
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");

    // Fetch games from current month
    const response = await fetch(
      `https://api.chess.com/pub/player/${username}/games/${year}/${month}`,
      {
        headers: {
          "User-Agent": "NextJS Chess App",
        },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch Chess.com games");
    }

    const data: ChessComArchive = await response.json();

    // Get the last 20 games
    const recentGames = data.games.slice(-20).reverse();

    return recentGames.map((game, index) => {
      const gameDate = new Date(game.end_time * 1000);
      let result = "*";

      // Parse result from PGN
      const resultMatch = game.pgn.match(/\[Result "([^"]+)"\]/);
      if (resultMatch) {
        result = resultMatch[1];
      }

      return {
        id: `chesscom-${game.url}-${index}`,
        white: game.white.username,
        black: game.black.username,
        result,
        date: gameDate.toISOString().split("T")[0],
        pgn: game.pgn,
      };
    });
  } catch (error) {
    console.error("Chess.com API error:", error);
    throw new Error("Failed to fetch games from Chess.com");
  }
}

async function fetchLichessGames(username: string): Promise<ChessGame[]> {
  try {
    // Fetch recent games (last 20)
    const response = await fetch(
      `https://lichess.org/api/games/user/${username}?max=20&pgnInJson=true`,
      {
        headers: {
          Accept: "application/x-ndjson",
        },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch Lichess games");
    }

    const text = await response.text();
    const lines = text.trim().split("\n");
    const games: LichessGame[] = lines
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line));

    return games.map((game) => {
      const gameDate = new Date(game.createdAt);
      let result = "*";

      if (game.status === "mate" || game.status === "resign") {
        result = game.winner === "white" ? "1-0" : "0-1";
      } else if (game.status === "draw" || game.status === "stalemate") {
        result = "1/2-1/2";
      }

      return {
        id: `lichess-${game.id}`,
        white: game.players.white.user.name,
        black: game.players.black.user.name,
        result,
        date: gameDate.toISOString().split("T")[0],
      };
    });
  } catch (error) {
    console.error("Lichess API error:", error);
    throw new Error("Failed to fetch games from Lichess");
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const platform = searchParams.get("platform");
    const username = searchParams.get("username");

    if (!platform || !username) {
      return NextResponse.json(
        { error: "Platform and username are required" },
        { status: 400 }
      );
    }

    let games: ChessGame[] = [];

    if (platform === "chess.com") {
      games = await fetchChessComGames(username);
    } else if (platform === "lichess") {
      games = await fetchLichessGames(username);
    } else {
      return NextResponse.json(
        { error: "Invalid platform. Use 'chess.com' or 'lichess'" },
        { status: 400 }
      );
    }

    return NextResponse.json({ games });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "An error occurred",
      },
      { status: 500 }
    );
  }
}
