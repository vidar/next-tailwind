# Player Lookup API - Quick Reference

Quick reference guide for using the Chess.com and Lichess API clients.

## Import Statements

```typescript
// Chess.com
import * as ChessCom from '@/lib/player-lookup/chess-com';

// Lichess
import * as Lichess from '@/lib/player-lookup/lichess';
```

## Chess.com API

### Get Player Profile

```typescript
const profile = await ChessCom.getPlayerProfile('hikaru');

// Returns:
// {
//   player_id: 15448422,
//   username: 'hikaru',
//   title: 'GM',
//   name: 'Hikaru Nakamura',
//   avatar: 'https://...',
//   country: 'https://api.chess.com/pub/country/US',
//   joined: 1301554258,
//   last_online: 1729980234,
//   ...
// }
```

### Get Player Stats

```typescript
const stats = await ChessCom.getPlayerStats('hikaru');

// Returns ratings for each time control:
// {
//   chess_bullet: { last: { rating: 3242 }, record: { win: 1543, loss: 823, draw: 124 } },
//   chess_blitz: { ... },
//   chess_rapid: { ... }
// }
```

### Get Recent Games

```typescript
// Get last 100 games
const games = await ChessCom.getRecentGames('hikaru', 100);

// Each game contains:
// {
//   url: 'https://chess.com/game/...',
//   pgn: '[Event "Live Chess"]\n...',
//   time_control: '180',
//   time_class: 'blitz',
//   rated: true,
//   white: { username: 'hikaru', rating: 3012, result: 'win' },
//   black: { username: 'opponent', rating: 2945, result: 'checkmated' },
//   end_time: 1729980234,
//   ...
// }
```

### Helper Functions

```typescript
// Determine player's color
const color = ChessCom.getPlayerColor(game, 'hikaru');
// Returns: 'white' | 'black'

// Get player's rating
const rating = ChessCom.getPlayerRating(game, 'hikaru');
// Returns: 3012

// Get opponent's rating
const oppRating = ChessCom.getOpponentRating(game, 'hikaru');
// Returns: 2945

// Get result from player's perspective
const result = ChessCom.getGameResult(game, 'hikaru');
// Returns: '1-0' | '0-1' | '1/2-1/2'

// Extract country code
const country = ChessCom.extractCountryCode(profile.country);
// Returns: 'US'

// Convert timestamp
const date = ChessCom.convertTimestamp(game.end_time);
// Returns: '2025-11-02T15:30:45.000Z'
```

## Lichess API

### Get Player Profile

```typescript
const profile = await Lichess.getPlayerProfile('DrNykterstein');

// Returns:
// {
//   id: 'drnykterstein',
//   username: 'DrNykterstein',
//   title: 'GM',
//   online: true,
//   perfs: {
//     bullet: { rating: 3218, games: 9559 },
//     blitz: { rating: 3131, games: 604 },
//     rapid: { rating: 2500, games: 0 }
//   },
//   profile: {
//     country: 'NO',
//     fideRating: 2802
//   },
//   ...
// }
```

### Get Recent Games

```typescript
// Get last 100 games
const games = await Lichess.getRecentGames('DrNykterstein', 100);

// Or with more options:
const games = await Lichess.getPlayerGames('DrNykterstein', {
  max: 100,
  rated: true,        // Only rated games
  pgnInJson: true,    // Include PGN
  opening: true,      // Include opening info
  evals: true,        // Include evaluations if available
  clocks: true,       // Include clock times
  since: 1625097600000, // Unix timestamp (ms)
  until: 1640995200000, // Unix timestamp (ms)
});

// Each game contains:
// {
//   id: 'abc123xyz',
//   rated: true,
//   variant: 'standard',
//   speed: 'blitz',
//   players: {
//     white: { user: { name: 'DrNykterstein' }, rating: 3226 },
//     black: { user: { name: 'opponent' }, rating: 3109 }
//   },
//   winner: 'white',
//   opening: { eco: 'B12', name: 'Caro-Kann Defense', ply: 5 },
//   pgn: '[Event "Rated Blitz game"]\n...',
//   createdAt: 1729980234000,
//   ...
// }
```

### Helper Functions

```typescript
// Determine player's color
const color = Lichess.getPlayerColor(game, 'DrNykterstein');
// Returns: 'white' | 'black'

// Get player's rating
const rating = Lichess.getPlayerRating(game, 'DrNykterstein');
// Returns: 3226

// Get opponent's rating
const oppRating = Lichess.getOpponentRating(game, 'DrNykterstein');
// Returns: 3109

// Get result from player's perspective
const result = Lichess.getGameResult(game, 'DrNykterstein');
// Returns: '1-0' | '0-1' | '1/2-1/2'

// Get opponent's username
const opponent = Lichess.getOpponentUsername(game, 'DrNykterstein');
// Returns: 'opponent'

// Convert speed to time class
const timeClass = Lichess.speedToTimeClass(game.speed);
// 'ultraBullet' → 'bullet', 'blitz' → 'blitz', etc.

// Format time control
const timeControl = Lichess.formatTimeControl(game);
// Returns: '180+2' or 'unlimited'

// Extract all ratings from profile
const ratings = Lichess.extractRatings(profile);
// Returns: { bullet: { rating: 3218, games: 9559 }, blitz: { ... } }

// Check if game has analysis
const hasAnalysis = Lichess.hasAnalysis(game);
// Returns: true | false

// Get player accuracy stats (if analyzed)
const accuracy = Lichess.getPlayerAccuracy(game, 'DrNykterstein');
// Returns: { inaccuracy: 2, mistake: 1, blunder: 0, acpl: 15 } | null

// Convert timestamp
const date = Lichess.convertTimestamp(game.createdAt);
// Returns: '2025-11-02T15:30:45.234Z'
```

## Common Patterns

### Search for Player on Both Platforms

```typescript
async function findPlayer(username: string, platform: 'chess_com' | 'lichess') {
  try {
    if (platform === 'chess_com') {
      const profile = await ChessCom.getPlayerProfile(username);
      return { found: true, platform: 'chess_com', profile };
    } else {
      const profile = await Lichess.getPlayerProfile(username);
      return { found: true, platform: 'lichess', profile };
    }
  } catch (error) {
    return { found: false, error: error.message };
  }
}
```

### Import Last 100 Games

```typescript
async function importGames(username: string, platform: 'chess_com' | 'lichess') {
  if (platform === 'chess_com') {
    const games = await ChessCom.getRecentGames(username, 100);

    return games.map(game => ({
      platformGameId: game.uuid,
      platform: 'chess_com',
      pgn: game.pgn,
      timeControl: game.time_control,
      timeClass: game.time_class,
      rated: game.rated,
      whiteUsername: game.white.username,
      whiteRating: game.white.rating,
      blackUsername: game.black.username,
      blackRating: game.black.rating,
      playerColor: ChessCom.getPlayerColor(game, username),
      result: ChessCom.getGameResult(game, username),
      playedAt: ChessCom.convertTimestamp(game.end_time),
      gameUrl: game.url,
    }));
  } else {
    const games = await Lichess.getRecentGames(username, 100);

    return games.map(game => ({
      platformGameId: game.id,
      platform: 'lichess',
      pgn: game.pgn || '',
      timeControl: Lichess.formatTimeControl(game),
      timeClass: Lichess.speedToTimeClass(game.speed),
      rated: game.rated,
      whiteUsername: game.players.white.user?.name || 'Unknown',
      whiteRating: game.players.white.rating,
      blackUsername: game.players.black.user?.name || 'Unknown',
      blackRating: game.players.black.rating,
      playerColor: Lichess.getPlayerColor(game, username),
      result: Lichess.getGameResult(game, username),
      playedAt: Lichess.convertTimestamp(game.createdAt),
      gameUrl: `https://lichess.org/${game.id}`,
      openingEco: game.opening?.eco,
      openingName: game.opening?.name,
    }));
  }
}
```

### Extract Current Ratings

```typescript
// Chess.com
async function getChessComRatings(username: string) {
  const stats = await ChessCom.getPlayerStats(username);
  return {
    bullet: stats.chess_bullet?.last.rating,
    blitz: stats.chess_blitz?.last.rating,
    rapid: stats.chess_rapid?.last.rating,
  };
}

// Lichess
async function getLichessRatings(username: string) {
  const profile = await Lichess.getPlayerProfile(username);
  return Lichess.extractRatings(profile);
}
```

## Rate Limits

### Chess.com
- **Limit**: 1 request per second (implemented)
- **Policy**: No official rate limit, but be respectful
- **Recommendation**: Don't exceed 1 req/s

### Lichess
- **Limit**: 10 requests per second (implemented)
- **Official Limit**: 15 requests per second
- **Recommendation**: Stay under 10 req/s for safety

## Error Handling

Both clients throw errors that should be caught:

```typescript
try {
  const profile = await ChessCom.getPlayerProfile('nonexistent');
} catch (error) {
  if (error.message.includes('not found')) {
    console.log('Player does not exist');
  } else if (error.message.includes('API error')) {
    console.log('API temporarily unavailable');
  } else {
    console.log('Unknown error:', error.message);
  }
}
```

## Testing

Run the test script to verify APIs are working:

```bash
node scripts/test-player-apis.mjs
```

## TypeScript Types

All response types are exported:

```typescript
import type {
  ChessComProfile,
  ChessComStats,
  ChessComGame,
} from '@/lib/player-lookup/chess-com';

import type {
  LichessProfile,
  LichessGame,
} from '@/lib/player-lookup/lichess';
```

## Best Practices

1. **Always use rate limiters** - Built into the clients
2. **Cache responses** - API calls are expensive
3. **Handle errors gracefully** - Players may not exist
4. **Respect platform ToS** - Don't abuse the APIs
5. **Batch operations** - Import games in bulk
6. **Use helper functions** - They normalize platform differences

---

**Last Updated**: 2025-11-02
