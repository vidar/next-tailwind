import {
  parsePGNHeaders,
  splitPGNGames,
  parseGame,
  extractPlayers,
  inferTournamentType,
  parseTournamentFromPGN,
  type PGNHeaders,
  type ParsedGame,
} from '../pgn-parser'

describe('PGN Parser', () => {
  describe('parsePGNHeaders', () => {
    it('should parse standard PGN headers', () => {
      const pgn = `[Event "World Championship"]
[Site "London"]
[Date "2024.01.15"]
[Round "1"]
[White "Carlsen, Magnus"]
[Black "Nakamura, Hikaru"]
[Result "1-0"]
[WhiteElo "2830"]
[BlackElo "2800"]

1. e4 e5 2. Nf3 Nc6`

      const headers = parsePGNHeaders(pgn)

      expect(headers.Event).toBe('World Championship')
      expect(headers.Site).toBe('London')
      expect(headers.Date).toBe('2024.01.15')
      expect(headers.Round).toBe('1')
      expect(headers.White).toBe('Carlsen, Magnus')
      expect(headers.Black).toBe('Nakamura, Hikaru')
      expect(headers.Result).toBe('1-0')
      expect(headers.WhiteElo).toBe('2830')
      expect(headers.BlackElo).toBe('2800')
    })

    it('should handle empty PGN', () => {
      const headers = parsePGNHeaders('')
      expect(Object.keys(headers).length).toBe(0)
    })

    it('should handle PGN with special characters in values', () => {
      const pgn = `[Event "World Ch. (Women's)"]
[Site "Kazan, Russia"]`

      const headers = parsePGNHeaders(pgn)

      expect(headers.Event).toBe("World Ch. (Women's)")
      expect(headers.Site).toBe('Kazan, Russia')
    })

    it('should handle FIDE IDs', () => {
      const pgn = `[WhiteFideId "1503014"]
[BlackFideId "2016192"]`

      const headers = parsePGNHeaders(pgn)

      expect(headers.WhiteFideId).toBe('1503014')
      expect(headers.BlackFideId).toBe('2016192')
    })
  })

  describe('splitPGNGames', () => {
    it('should split multiple games correctly', () => {
      const pgnText = `[Event "Tournament 1"]
[Site "City A"]
[Date "2024.01.01"]
[Round "1"]
[White "Player A"]
[Black "Player B"]
[Result "1-0"]

1. e4 e5

[Event "Tournament 2"]
[Site "City B"]
[Date "2024.01.02"]
[Round "2"]
[White "Player C"]
[Black "Player D"]
[Result "0-1"]

1. d4 d5`

      const games = splitPGNGames(pgnText)

      expect(games).toHaveLength(2)
      expect(games[0]).toContain('[Event "Tournament 1"]')
      expect(games[1]).toContain('[Event "Tournament 2"]')
    })

    it('should handle single game', () => {
      const pgnText = `[Event "Single Game"]
[White "Player A"]
[Black "Player B"]

1. e4 e5`

      const games = splitPGNGames(pgnText)

      expect(games).toHaveLength(1)
      expect(games[0]).toContain('[Event "Single Game"]')
    })

    it('should handle empty string', () => {
      const games = splitPGNGames('')
      expect(games).toHaveLength(0)
    })

    it('should handle whitespace-only string', () => {
      const games = splitPGNGames('   \n\n   ')
      expect(games).toHaveLength(0)
    })
  })

  describe('parseGame', () => {
    it('should parse a complete game', () => {
      const pgn = `[Event "FIDE World Cup"]
[Site "Baku"]
[Date "2023.08.01"]
[Round "1"]
[White "Carlsen, Magnus"]
[Black "Nakamura, Hikaru"]
[Result "1/2-1/2"]
[WhiteElo "2830"]
[BlackElo "2800"]
[WhiteFideId "1503014"]
[BlackFideId "2016192"]
[WhiteTitle "GM"]
[BlackTitle "GM"]

1. e4 e5 2. Nf3 Nc6 1/2-1/2`

      const game = parseGame(pgn)

      expect(game.round).toBe(1)
      expect(game.whiteName).toBe('Carlsen, Magnus')
      expect(game.blackName).toBe('Nakamura, Hikaru')
      expect(game.whiteRating).toBe(2830)
      expect(game.blackRating).toBe(2800)
      expect(game.whiteFideId).toBe('1503014')
      expect(game.blackFideId).toBe('2016192')
      expect(game.result).toBe('1/2-1/2')
      expect(game.date).toBe('2023.08.01')
      expect(game.pgn).toBe(pgn)
    })

    it('should handle missing optional fields', () => {
      const pgn = `[Event "Local Tournament"]
[White "Player A"]
[Black "Player B"]

1. e4 e5`

      const game = parseGame(pgn)

      expect(game.whiteName).toBe('Player A')
      expect(game.blackName).toBe('Player B')
      expect(game.whiteRating).toBeNull()
      expect(game.blackRating).toBeNull()
      expect(game.whiteFideId).toBeNull()
      expect(game.blackFideId).toBeNull()
      expect(game.result).toBe('*')
      expect(game.round).toBe(1)
    })

    it('should parse different result formats', () => {
      const testResults: Array<[string, ParsedGame['result']]> = [
        ['1-0', '1-0'],
        ['0-1', '0-1'],
        ['1/2-1/2', '1/2-1/2'],
        ['*', '*'],
      ]

      for (const [resultStr, expected] of testResults) {
        const pgn = `[Result "${resultStr}"]
[White "A"]
[Black "B"]

1. e4 e5`
        const game = parseGame(pgn)
        expect(game.result).toBe(expected)
      }
    })

    it('should parse different round formats', () => {
      const testRounds = [
        { input: '1', expected: 1 },
        { input: '5', expected: 5 },
        { input: 'Round 3', expected: 3 },
        { input: '2.1', expected: 2 },
      ]

      for (const { input, expected } of testRounds) {
        const pgn = `[Round "${input}"]
[White "A"]
[Black "B"]

1. e4`
        const game = parseGame(pgn)
        expect(game.round).toBe(expected)
      }
    })
  })

  describe('extractPlayers', () => {
    it('should extract unique players from games', () => {
      const games: ParsedGame[] = [
        {
          headers: { WhiteTitle: 'GM', BlackTitle: 'IM' },
          pgn: '',
          round: 1,
          whiteFideId: '1503014',
          blackFideId: '2016192',
          whiteName: 'Carlsen, Magnus',
          blackName: 'Nakamura, Hikaru',
          whiteRating: 2830,
          blackRating: 2800,
          result: '1-0',
          date: '2024.01.01',
        },
        {
          headers: { WhiteTitle: 'GM', BlackTitle: 'GM' },
          pgn: '',
          round: 2,
          whiteFideId: '2016192', // Same player as black in first game
          blackFideId: '5000017',
          whiteName: 'Nakamura, Hikaru',
          blackName: 'Caruana, Fabiano',
          whiteRating: 2800,
          blackRating: 2820,
          result: '1/2-1/2',
          date: '2024.01.02',
        },
      ]

      const players = extractPlayers(games)

      expect(players).toHaveLength(3)
      expect(players.map(p => p.fideId).sort()).toEqual(['1503014', '2016192', '5000017'])

      const nakamura = players.find(p => p.fideId === '2016192')
      expect(nakamura).toBeDefined()
      expect(nakamura?.name).toBe('Nakamura, Hikaru')
      expect(nakamura?.rating).toBe(2800)
      expect(nakamura?.title).toBe('IM')
    })

    it('should handle games without FIDE IDs', () => {
      const games: ParsedGame[] = [
        {
          headers: {},
          pgn: '',
          round: 1,
          whiteFideId: null,
          blackFideId: null,
          whiteName: 'Player A',
          blackName: 'Player B',
          whiteRating: null,
          blackRating: null,
          result: '1-0',
          date: null,
        },
      ]

      const players = extractPlayers(games)
      expect(players).toHaveLength(0)
    })

    it('should handle empty games array', () => {
      const players = extractPlayers([])
      expect(players).toHaveLength(0)
    })
  })

  describe('inferTournamentType', () => {
    it('should detect round-robin from game count (single)', () => {
      const playerCount = 4
      const expectedGames = (playerCount * (playerCount - 1)) / 2 // 6 games
      const games = Array(expectedGames).fill({
        headers: {},
        round: 1,
        whiteFideId: '1',
        blackFideId: '2',
      } as ParsedGame)

      const type = inferTournamentType(games, playerCount)
      expect(type).toBe('round_robin')
    })

    it('should detect round-robin from game count (double)', () => {
      const playerCount = 4
      const expectedGames = playerCount * (playerCount - 1) // 12 games
      const games = Array(expectedGames).fill({
        headers: {},
        round: 1,
        whiteFideId: '1',
        blackFideId: '2',
      } as ParsedGame)

      const type = inferTournamentType(games, playerCount)
      expect(type).toBe('round_robin')
    })

    it('should detect swiss tournament', () => {
      // 10 players, each plays ~7 rounds (not everyone plays everyone)
      const games: ParsedGame[] = []
      for (let i = 1; i <= 35; i++) {
        games.push({
          headers: {},
          pgn: '',
          round: Math.floor((i - 1) / 5) + 1,
          whiteFideId: String(i % 10 + 1),
          blackFideId: String((i + 5) % 10 + 1),
          whiteName: `Player ${i % 10 + 1}`,
          blackName: `Player ${(i + 5) % 10 + 1}`,
          whiteRating: null,
          blackRating: null,
          result: '1-0',
          date: null,
        })
      }

      const type = inferTournamentType(games, 10)
      expect(type).toBe('swiss')
    })

    it('should detect from EventType header', () => {
      const games: ParsedGame[] = [
        {
          headers: { EventType: 'Swiss System' },
          pgn: '',
          round: 1,
          whiteFideId: '1',
          blackFideId: '2',
          whiteName: 'A',
          blackName: 'B',
          whiteRating: null,
          blackRating: null,
          result: '1-0',
          date: null,
        },
      ]

      const type = inferTournamentType(games, 10)
      expect(type).toBe('swiss')
    })

    it('should return "other" for empty games', () => {
      const type = inferTournamentType([], 0)
      expect(type).toBe('other')
    })

    it('should detect knockout tournament from explicit EventType', () => {
      const games: ParsedGame[] = [
        {
          headers: { EventType: 'Knockout' },
          pgn: '',
          round: 1,
          whiteFideId: '1',
          blackFideId: '2',
          whiteName: 'P1',
          blackName: 'P2',
          whiteRating: null,
          blackRating: null,
          result: '1-0',
          date: null,
        },
      ]

      const type = inferTournamentType(games, 4)
      expect(type).toBe('knockout')
    })
  })

  describe('parseTournamentFromPGN', () => {
    it('should parse complete tournament data', () => {
      const pgnText = `[Event "Candidates Tournament 2024"]
[Site "Toronto, CAN"]
[Date "2024.04.03"]
[Round "1"]
[White "Nakamura, Hikaru"]
[Black "Nepomniachtchi, Ian"]
[Result "1/2-1/2"]
[WhiteElo "2789"]
[BlackElo "2758"]
[WhiteFideId "2016192"]
[BlackFideId "4168119"]
[WhiteTitle "GM"]
[BlackTitle "GM"]
[EventDate "2024.04.03"]
[EventRounds "14"]
[TimeControl "40/7200:20/3600:900+30"]

1. e4 e5 1/2-1/2

[Event "Candidates Tournament 2024"]
[Site "Toronto, CAN"]
[Date "2024.04.04"]
[Round "2"]
[White "Nepomniachtchi, Ian"]
[Black "Gukesh, D"]
[Result "0-1"]
[WhiteElo "2758"]
[BlackElo "2743"]
[WhiteFideId "4168119"]
[BlackFideId "46616543"]
[WhiteTitle "GM"]
[BlackTitle "GM"]
[EventDate "2024.04.03"]
[EventRounds "14"]

1. d4 Nf6 0-1`

      const tournament = parseTournamentFromPGN(pgnText)

      expect(tournament.name).toBe('Candidates Tournament 2024')
      expect(tournament.location).toBe('Toronto, CAN')
      expect(tournament.startDate).toBe('2024.04.03')
      expect(tournament.totalRounds).toBe(14)
      expect(tournament.timeControl).toBe('40/7200:20/3600:900+30')
      expect(tournament.games).toHaveLength(2)
      expect(tournament.players).toHaveLength(3) // Nakamura, Nepomniachtchi, Gukesh

      const nakamura = tournament.players.find(p => p.fideId === '2016192')
      expect(nakamura).toBeDefined()
      expect(nakamura?.name).toBe('Nakamura, Hikaru')
      expect(nakamura?.rating).toBe(2789)
      expect(nakamura?.title).toBe('GM')
    })

    it('should throw error for empty PGN', () => {
      expect(() => parseTournamentFromPGN('')).toThrow('No valid PGN games found')
    })

    it('should throw error when no players have FIDE IDs', () => {
      const pgnText = `[Event "Local Club Tournament"]
[White "John Doe"]
[Black "Jane Smith"]
[Result "1-0"]

1. e4 e5`

      expect(() => parseTournamentFromPGN(pgnText)).toThrow(
        'No players with FIDE IDs found'
      )
    })

    it('should calculate max round correctly', () => {
      const pgnText = `[Event "Test"]
[Round "1"]
[White "A"]
[Black "B"]
[WhiteFideId "1"]
[BlackFideId "2"]

1. e4

[Event "Test"]
[Round "5"]
[White "A"]
[Black "B"]
[WhiteFideId "1"]
[BlackFideId "2"]

1. e4`

      const tournament = parseTournamentFromPGN(pgnText)
      expect(tournament.totalRounds).toBe(5)
    })
  })
})
