import { Chess } from "chess.js";

export interface Chapter {
  timestamp: string; // "0:15" or "1:23"
  title: string;
}

export interface GameAnnotation {
  move_index: number;
  annotation_text: string;
}

/**
 * Formats seconds into MM:SS or H:MM:SS
 */
function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Generate chapters for a chess game video
 */
export function generateChapters(
  pgn: string,
  annotations: GameAnnotation[],
  compositionType: 'walkthrough' | 'annotated' | 'arrows',
  fps: number = 30
): Chapter[] {
  const chapters: Chapter[] = [];
  const game = new Chess();
  game.loadPgn(pgn);
  const moves = game.history();

  const INTRO_DURATION = 3; // seconds
  const SECONDS_PER_MOVE = 1;
  const ANNOTATION_PAUSE = 4; // seconds per annotation

  // Intro chapter
  chapters.push({
    timestamp: '0:00',
    title: 'Introduction',
  });

  let currentTime = INTRO_DURATION;

  if (compositionType === 'annotated' && annotations.length > 0) {
    // For annotated videos, create a chapter for each annotation
    const annotationMap = new Map<number, GameAnnotation>();
    annotations.forEach(ann => annotationMap.set(ann.move_index, ann));

    for (let i = 0; i <= moves.length; i++) {
      if (annotationMap.has(i)) {
        const annotation = annotationMap.get(i)!;
        const moveNotation = i > 0 ? moves[i - 1] : 'Starting Position';
        const moveNumber = i > 0 ? Math.floor((i - 1) / 2) + 1 : 0;
        const color = i % 2 === 1 ? '.' : '...';

        // Truncate annotation text for chapter title
        const truncatedText = annotation.annotation_text.length > 40
          ? annotation.annotation_text.substring(0, 40) + '...'
          : annotation.annotation_text;

        chapters.push({
          timestamp: formatTimestamp(currentTime),
          title: i > 0
            ? `${moveNumber}${color} ${moveNotation} - ${truncatedText}`
            : `Starting Position - ${truncatedText}`,
        });

        currentTime += SECONDS_PER_MOVE + ANNOTATION_PAUSE;
      } else if (i > 0) {
        currentTime += SECONDS_PER_MOVE;
      }
    }
  } else {
    // For non-annotated videos, create chapters for game phases
    const totalMoves = moves.length;

    if (totalMoves >= 10) {
      // Opening (first 10 moves or 33% of game)
      const openingEnd = Math.min(10, Math.ceil(totalMoves * 0.33));

      chapters.push({
        timestamp: formatTimestamp(currentTime),
        title: `Opening - Moves 1-${openingEnd}`,
      });
      currentTime += openingEnd * SECONDS_PER_MOVE;

      // Middlegame
      const middlegameEnd = Math.min(totalMoves, Math.ceil(totalMoves * 0.75));
      if (middlegameEnd > openingEnd && (middlegameEnd - openingEnd) >= 10) {
        chapters.push({
          timestamp: formatTimestamp(currentTime),
          title: `Middlegame - Moves ${openingEnd + 1}-${middlegameEnd}`,
        });
        currentTime += (middlegameEnd - openingEnd) * SECONDS_PER_MOVE;
      }

      // Endgame
      if (totalMoves > middlegameEnd && (totalMoves - middlegameEnd) >= 5) {
        chapters.push({
          timestamp: formatTimestamp(currentTime),
          title: `Endgame - Moves ${middlegameEnd + 1}-${totalMoves}`,
        });
        currentTime += (totalMoves - middlegameEnd) * SECONDS_PER_MOVE;
      }

      // Outro (always at least 10 seconds from last chapter)
      chapters.push({
        timestamp: formatTimestamp(currentTime),
        title: 'Outro',
      });
    }
  }

  // Only return chapters if we have at least 3 (YouTube requirement)
  return chapters.length >= 3 ? chapters : [];
}

/**
 * Generate hashtags based on game content
 */
export function generateHashtags(pgn: string, annotations: GameAnnotation[]): string[] {
  const tags = ['chess', 'chessanalysis', 'chessgame'];

  const pgnLower = pgn.toLowerCase();

  // Opening detection
  if (pgnLower.includes('sicilian')) tags.push('siciliandefense');
  if (pgnLower.includes('italian')) tags.push('italiangame');
  if (pgnLower.includes('spanish') || pgnLower.includes('ruy lopez')) tags.push('ruylopez');
  if (pgnLower.includes('french')) tags.push('frenchdefense');
  if (pgnLower.includes('caro-kann')) tags.push('carokann');
  if (pgnLower.includes('queens gambit') || pgnLower.includes('queen\'s gambit')) tags.push('queensgambit');
  if (pgnLower.includes('kings indian') || pgnLower.includes('king\'s indian')) tags.push('kingsindian');
  if (pgnLower.includes('english')) tags.push('englishopening');

  // Tactical themes from annotations
  const annotationText = annotations.map(a => a.annotation_text.toLowerCase()).join(' ');

  if (annotationText.includes('fork')) tags.push('chesstactics');
  if (annotationText.includes('pin')) tags.push('chesstactics');
  if (annotationText.includes('skewer')) tags.push('chesstactics');
  if (annotationText.includes('sacrifice')) tags.push('chesssacrifice');
  if (annotationText.includes('checkmate') || annotationText.includes('mate')) tags.push('checkmate');
  if (annotationText.includes('blunder')) tags.push('chessblunders');
  if (annotationText.includes('brillian')) tags.push('brilliantmove');

  // Keep unique and limit to 15 hashtags
  return [...new Set(tags)].slice(0, 15);
}

/**
 * Generate detailed YouTube description
 */
export function generateDescription(
  gameInfo: { white: string; black: string; result: string; date: string },
  pgn: string,
  chapters: Chapter[],
  annotations: GameAnnotation[],
  gameId: string
): string {
  const game = new Chess();
  game.loadPgn(pgn);
  const moves = game.history();

  const lines: string[] = [];

  // Title and game info
  lines.push(`🎯 Chess Game Analysis: ${gameInfo.white} vs ${gameInfo.black}`);
  lines.push(`Result: ${gameInfo.result} • Date: ${gameInfo.date}`);
  lines.push('');

  // Chapters - YouTube requires this exact format for timeline chapters:
  // - First chapter MUST start at 0:00
  // - Format: TIMESTAMP<space>Title (no extra characters)
  // - Must have at least 3 timestamps
  // - Each chapter must be at least 10 seconds long
  if (chapters.length >= 3 && chapters[0].timestamp === '0:00') {
    chapters.forEach(chapter => {
      lines.push(`${chapter.timestamp} ${chapter.title}`);
    });
    lines.push('');
  }

  // Statistics
  lines.push('📈 Game Statistics:');
  lines.push(`• Total Moves: ${moves.length}`);
  if (annotations.length > 0) {
    lines.push(`• Annotations: ${annotations.length}`);
  }
  lines.push('');

  // Links
  lines.push('🔗 Links:');
  lines.push(`View Full Analysis: https://chessmoments.com/analyzed_games/${gameId}`);
  lines.push(`Play Through This Game: https://chessmoments.com/analyzed_games/${gameId}`);
  lines.push('');

  // Call to action
  lines.push('---');
  lines.push('🎬 Created with ChessMoments.com');
  lines.push('Turn your chess games into engaging videos automatically!');
  lines.push('');
  lines.push('👍 Like this video if you enjoyed the analysis!');
  lines.push('🔔 Subscribe for daily chess content!');
  lines.push('💬 Comment your thoughts on this game below!');
  lines.push('');

  // Hashtags
  const hashtags = generateHashtags(pgn, annotations);
  lines.push(hashtags.map(tag => `#${tag}`).join(' '));

  return lines.join('\n');
}

/**
 * Generate pinned comment text
 */
export function generatePinnedComment(gameId: string): string {
  return `🎯 Want to analyze YOUR games like this?

1️⃣ Upload your PGN or paste your chess.com/lichess game link
2️⃣ Get instant Stockfish analysis with evaluation
3️⃣ Generate shareable videos automatically
4️⃣ Add your own commentary and annotations

Try it free: https://chessmoments.com

💡 This video was generated automatically from the game analysis. Check out the full interactive board and move-by-move breakdown at: https://chessmoments.com/analyzed_games/${gameId}`;
}
