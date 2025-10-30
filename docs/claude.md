# Claude AI Assistant Guide for Chess Moments Project

> **Purpose**: This document helps AI assistants (like Claude) maintain context, understand conventions, and work effectively on this project across multiple sessions.

## Project Overview

**Chess Moments** is a Next.js application for analyzing chess games and tournaments, generating AI-powered video summaries, and uploading them to YouTube.

**Core Features**:
1. Chess game analysis with Stockfish
2. Automated video generation with Remotion
3. Tournament management and analysis
4. AI-generated narratives using OpenRouter
5. YouTube integration for video uploads
6. AWS Lambda for video rendering

## Technology Stack

### Frontend
- **Framework**: Next.js 15.2.4 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Custom React components
- **State Management**: React hooks (useState, useEffect)
- **Authentication**: Clerk

### Backend
- **API**: Next.js API Routes
- **Database**: PostgreSQL (via pg library)
- **ORM**: None (raw SQL queries)
- **File Storage**: AWS S3
- **Video Rendering**: AWS Lambda + Remotion

### External Services
- **AI**: OpenRouter API (gpt-4o-mini model)
- **Chess Engine**: Stockfish
- **Video Platform**: YouTube Data API v3
- **Cloud**: AWS (Lambda, S3)

### Key Libraries
- `remotion` - Video rendering
- `chess.js` - Chess logic
- `@clerk/nextjs` - Authentication
- `zod` - Schema validation
- `googleapis` - YouTube API
- `pg` - PostgreSQL client

## Project Structure

```
next-tailwind/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── api/                      # API routes
│   │   │   ├── analyze/              # Chess analysis endpoints
│   │   │   ├── tournaments/          # Tournament management
│   │   │   │   └── videos/           # Tournament video generation
│   │   │   │       ├── generate/     # Video generation endpoint
│   │   │   │       ├── progress/     # Progress polling
│   │   │   │       └── youtube-upload/ # YouTube upload
│   │   │   └── youtube/              # YouTube API endpoints
│   │   ├── games/[id]/               # Game detail pages
│   │   └── tournaments/[id]/         # Tournament detail pages
│   ├── components/                   # React components
│   │   ├── tournament/               # Tournament-specific components
│   │   └── ui/                       # Reusable UI components
│   ├── lib/                          # Utility libraries
│   │   ├── db.ts                     # Database functions
│   │   ├── tournament-ai.ts          # AI narrative generation
│   │   └── stockfish.ts              # Chess analysis
│   └── remotion/                     # Video compositions
│       ├── ChessGame/                # Chess game videos
│       │   ├── ChessGameWalkthrough.tsx
│       │   ├── ChessGameAnnotated.tsx
│       │   └── LogoIntro.tsx
│       └── TournamentVideo/          # Tournament videos
│           ├── TournamentOverview.tsx
│           ├── RoundOverview.tsx
│           ├── PlayerOverview.tsx
│           ├── NarrativeSlide.tsx
│           ├── HighlightsSlide.tsx
│           └── StandingsSlide.tsx
├── types/
│   └── constants.ts                  # Shared constants and schemas
├── migrations/                       # SQL migrations
├── scripts/                          # Utility scripts
│   ├── render-game.mjs              # Local game video rendering
│   └── render-tournament.mjs        # Local tournament video rendering
├── docs/                            # Documentation
│   ├── tournament-video-*.mmd       # Mermaid diagrams
│   ├── tournament-video-*.svg       # Rendered diagrams
│   └── tournament-video-architecture.md
├── config.mjs                       # Remotion/Lambda config
└── remotion.config.ts              # Remotion configuration
```

## Key Architectural Patterns

### 1. Database Access Pattern

**Location**: `src/lib/db.ts`

**Pattern**: Direct SQL queries with connection pooling

```typescript
// ALWAYS use getPool() - never create new pools
const pool = getPool();

// Use parameterized queries to prevent SQL injection
const result = await pool.query(
  'SELECT * FROM table WHERE id = $1',
  [id]
);

// Return typed results
return result.rows[0] as TypeName;
```

**Important**:
- Database functions use `getPool()` for connection management
- All queries are parameterized (never string concatenation)
- JSONB columns use `JSON.stringify()` and `JSON.parse()`
- Type interfaces match database schema exactly

### 2. Async API Pattern

**Pattern**: Return immediately, process in background

```typescript
// API endpoint pattern for long-running operations
export async function POST(request: NextRequest) {
  // 1. Create database record
  const record = await createRecord(userId, data);

  // 2. Start async background process (don't await)
  processInBackground(record.id, data).catch(error => {
    updateRecordStatus(record.id, 'failed', { error: error.message });
  });

  // 3. Return immediately
  return NextResponse.json({ id: record.id, status: 'processing' });
}
```

**Used for**:
- Chess game analysis
- Video rendering
- AI script generation

### 3. Progress Polling Pattern

**Frontend Pattern**: Poll every 5 seconds with useEffect

```typescript
useEffect(() => {
  if (activeItems.length === 0) return;

  const interval = setInterval(async () => {
    const updated = await Promise.all(
      activeItems.map(async (item) => {
        const response = await fetch('/api/progress', {
          method: 'POST',
          body: JSON.stringify({ id: item.id }),
        });
        const data = await response.json();

        if (data.type === 'done') {
          // Move to completed
          setCompleted(prev => [...prev, { ...item, ...data }]);
          return { ...item, status: 'completed' };
        }
        return { ...item, progress: data.progress };
      })
    );
    setActiveItems(updated.filter(i => i.status !== 'completed'));
  }, 5000);

  return () => clearInterval(interval);
}, [activeItems]);
```

### 4. Remotion Video Composition Pattern

**Structure**: Sequence of slides with calculated durations

```typescript
export const VideoComposition: React.FC<Props> = ({ data }) => {
  const { fps } = useVideoConfig();

  // Calculate durations in frames
  const INTRO = fps * 3;
  const SLIDE_1 = fps * 5;
  let currentTime = 0;

  return (
    <AbsoluteFill>
      <Sequence from={currentTime} durationInFrames={INTRO}>
        <LogoIntro />
      </Sequence>
      {(currentTime += INTRO) && null}

      <Sequence from={currentTime} durationInFrames={SLIDE_1}>
        <ContentSlide {...data} />
      </Sequence>
      {(currentTime += SLIDE_1) && null}
    </AbsoluteFill>
  );
};
```

**Key Points**:
- Use `{(currentTime += DURATION) && null}` to increment timeline
- Durations in frames: `fps * seconds`
- Register in `Root.tsx` with schema validation

### 5. AI Generation Pattern

**Location**: `src/lib/tournament-ai.ts`

**Pattern**: Structured prompts with JSON responses

```typescript
async function generateWithAI(context: Context): Promise<Output> {
  const prompt = `Create structured content...

Context:
${formatContext(context)}

Format as JSON:
{
  "field1": "...",
  "field2": ["...", "..."]
}`;

  const response = await callOpenRouter([
    { role: 'system', content: 'You are a chess commentator. Return JSON only.' },
    { role: 'user', content: prompt }
  ], { temperature: 0.7, maxTokens: 1500 });

  // Parse JSON from response
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (jsonMatch) return JSON.parse(jsonMatch[0]);

  // Fallback
  return getDefaultOutput();
}
```

## Database Schema Conventions

### Naming Conventions
- Tables: `snake_case` (e.g., `tournament_videos`)
- Columns: `snake_case` (e.g., `user_id`, `created_at`)
- Foreign keys: `{table}_id` (e.g., `tournament_id`)
- Junction tables: `{table1}_{table2}` (e.g., `tournament_players`)

### Standard Columns
Every table should have:
```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
```

### JSONB Usage
- Use JSONB for flexible, semi-structured data
- Store AI-generated content in `ai_script` JSONB column
- Store render metadata in `metadata` JSONB column
- Always validate JSONB structure in TypeScript

### Indexes
```sql
-- Always index foreign keys
CREATE INDEX idx_videos_tournament ON tournament_videos(tournament_id);

-- Index status columns for filtering
CREATE INDEX idx_videos_status ON tournament_videos(status);

-- Partial indexes for optional relationships
CREATE INDEX idx_videos_round ON tournament_videos(round_id)
  WHERE round_id IS NOT NULL;
```

## API Endpoint Conventions

### Response Format
```typescript
// Success
return NextResponse.json({
  data: result,
  message: 'Success message'
});

// Error
return NextResponse.json(
  { error: 'Error message', details: errorDetails },
  { status: 400 }
);

// Async operation started
return NextResponse.json({
  id: recordId,
  status: 'processing',
  message: 'Operation started'
});
```

### Authentication Pattern
```typescript
import { auth } from '@clerk/nextjs/server';

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Proceed with authenticated request
}
```

### Parameter Validation
```typescript
const body = await request.json();
const { requiredField } = body;

if (!requiredField) {
  return NextResponse.json(
    { error: 'requiredField is required' },
    { status: 400 }
  );
}
```

## Common Operations & Where to Find Them

### Database Operations
**File**: `src/lib/db.ts`

| Operation | Function |
|-----------|----------|
| Create tournament video | `createTournamentVideo(userId, tournamentId, videoType, options)` |
| Update video status | `updateTournamentVideoStatus(videoId, status, updates)` |
| Get single video | `getTournamentVideo(videoId)` |
| Get all tournament videos | `getTournamentVideos(tournamentId)` |
| Get tournament data | `getTournamentById(tournamentId)` |
| Get tournament players | `getTournamentPlayers(tournamentId)` |
| Get tournament rounds | `getTournamentRounds(tournamentId)` |
| Get tournament games | `getTournamentGames(tournamentId)` |

### AI Generation
**File**: `src/lib/tournament-ai.ts`

| Operation | Function |
|-----------|----------|
| Generate tournament overview | `generateTournamentOverview(context)` |
| Generate round overview | `generateRoundOverview(context)` |
| Generate player overview | `generatePlayerOverview(context)` |
| Select best game | `selectMostInterestingGame(games, players)` |

### Video Rendering
**Files**:
- API: `src/app/api/tournaments/videos/generate/route.ts`
- Local: `scripts/render-tournament.mjs`

**Lambda Rendering**:
```typescript
import { renderMediaOnLambda, speculateFunctionName } from '@remotion/lambda/client';

const result = await renderMediaOnLambda({
  codec: 'h264',
  functionName: speculateFunctionName({ diskSizeInMb, memorySizeInMb, timeoutInSeconds }),
  region: REGION,
  serveUrl: SITE_NAME,
  composition: COMPOSITION_NAME,
  inputProps: { ...props, width, height },
  imageFormat: 'jpeg',
  framesPerLambda: 100,
});
```

**Local Rendering**:
```bash
node scripts/render-tournament.mjs <tournament-id>
```

### YouTube Upload
**File**: `src/app/api/tournaments/videos/youtube-upload/route.ts`

**Required Environment Variables**:
- `YOUTUBE_CLIENT_ID`
- `YOUTUBE_CLIENT_SECRET`
- `YOUTUBE_REFRESH_TOKEN`
- `YOUTUBE_REDIRECT_URI` (optional)

## Important Gotchas & Lessons Learned

### 1. S3 URL Storage
❌ **Wrong**: Store in `metadata.s3Url`
✅ **Right**: Store in `s3_url` column

**Reason**: The database has a dedicated `s3_url` TEXT column. Metadata is for additional info like render IDs and YouTube URLs.

### 2. Import Paths
❌ **Wrong**: `import { X } from '../../../../../config.mjs'` (wrong number of `..`)
✅ **Right**: Count carefully from file location to root

**Tip**: Use VS Code autocomplete or check existing imports in similar files.

### 3. Remotion Props
❌ **Wrong**: Pass undefined or null values
✅ **Right**: Use optional chaining and defaults

```typescript
// Good
tournamentName: tournament?.name || 'Unknown',
location: tournament?.location || undefined,
```

### 4. JSONB Type Casting
```typescript
// Reading from DB
const metadata = video.metadata as { renderId?: string; bucketName?: string } | null;
const renderId = metadata?.renderId;

// Writing to DB
await updateStatus(id, status, {
  metadata: { key: value } as Record<string, unknown>
});
```

### 5. Async Background Functions
Always wrap in try-catch and update status on error:

```typescript
async function backgroundTask(id: string) {
  try {
    await updateStatus(id, 'processing');
    const result = await doWork();
    await updateStatus(id, 'completed', { result });
  } catch (error) {
    await updateStatus(id, 'failed', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Call without await
backgroundTask(id).catch(console.error);
```

### 6. Polling Cleanup
Always clean up intervals:

```typescript
useEffect(() => {
  const interval = setInterval(() => { /* poll */ }, 5000);
  return () => clearInterval(interval); // IMPORTANT!
}, [dependencies]);
```

### 7. Remotion Composition Registration
After creating a new composition, ALWAYS:
1. Add constants to `types/constants.ts`
2. Import in `src/remotion/Root.tsx`
3. Register with schema and default props
4. Test locally before deploying to Lambda

### 8. Authentication in Background Tasks
Background async functions don't have auth context. Solution:
- Pass `userId` as parameter
- Don't make HTTP calls to authenticated endpoints
- Call services directly instead

### 9. Video Type Switching
When adding support for new video types:
1. Add composition constant
2. Create Remotion component
3. Add case in `triggerLambdaRender()` switch statement
4. Update AI generation service
5. Add default props

## Development Workflow

### 1. Starting Development
```bash
npm run dev          # Start Next.js dev server
npm run remotion     # Start Remotion studio (for video dev)
```

### 2. Database Changes
```bash
# 1. Create migration file
touch migrations/00X_description.sql

# 2. Write SQL (CREATE, ALTER, etc.)

# 3. Run migration manually (no automated tool)
psql -d chess_moments -f migrations/00X_description.sql

# 4. Update TypeScript interfaces in src/lib/db.ts
```

### 3. Adding New API Endpoint
```bash
# 1. Create route file
src/app/api/feature/route.ts

# 2. Implement handlers (GET, POST, etc.)
# 3. Add database functions in src/lib/db.ts
# 4. Test with curl or Postman
# 5. Add frontend integration
```

### 4. Creating New Video Composition
```bash
# 1. Add composition name to types/constants.ts
export const NEW_COMP_NAME = 'NewComposition';

# 2. Create component
src/remotion/Category/NewComposition.tsx

# 3. Register in Root.tsx
<Composition
  id={NEW_COMP_NAME}
  component={NewComposition}
  durationInFrames={fps * 60}
  fps={CHESS_VIDEO_FPS}
  width={CHESS_VIDEO_WIDTH}
  height={CHESS_VIDEO_HEIGHT}
  defaultProps={defaultNewProps}
  schema={NewCompositionProps}
/>

# 4. Test in Remotion studio
npm run remotion

# 5. Test Lambda render
# 6. Add to triggerLambdaRender() switch
```

### 5. Testing Video Rendering

**Local (Fast)**:
```bash
node scripts/render-tournament.mjs <tournament-id>
```

**Lambda (Production)**:
- Use the UI to trigger generation
- Monitor progress in browser
- Check logs in API response

### 6. Git Workflow
```bash
# Check status
git status

# Stage changes
git add src/path/to/file.ts

# Commit with descriptive message
git commit -m "Add round overview video generation

- Create RoundOverview Remotion composition
- Add AI generation for round narratives
- Update Lambda trigger to support round videos"

# Push (if needed)
git push origin main
```

## Debugging Tips

### Database Issues
```typescript
// Add logging in db.ts functions
console.log('Query:', query);
console.log('Params:', params);
console.log('Result:', result.rows);
```

### AI Generation Issues
```typescript
// Log prompts and responses
console.log('Prompt:', prompt);
console.log('AI Response:', response);
console.log('Parsed:', parsed);
```

### Remotion Issues
```bash
# Test in studio first
npm run remotion

# Check props match schema
console.log('Input props:', inputProps);

# Verify all required props are provided
```

### Lambda Issues
```typescript
// Check render metadata
console.log('Render ID:', renderId);
console.log('Bucket:', bucketName);

// Monitor progress
const progress = await getRenderProgress({ renderId, bucketName, ... });
console.log('Progress:', progress);
```

## Environment Variables

**Required**:
```env
# Database
DATABASE_URL=postgresql://...

# Clerk Auth
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...

# OpenRouter AI
OPENROUTER_API_KEY=sk-or-...

# AWS (for Lambda rendering)
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
REMOTION_AWS_ACCESS_KEY_ID=...    # Alternative
REMOTION_AWS_SECRET_ACCESS_KEY=... # Alternative

# YouTube (optional)
YOUTUBE_CLIENT_ID=...
YOUTUBE_CLIENT_SECRET=...
YOUTUBE_REFRESH_TOKEN=...
```

**Remotion Lambda Config** (`config.mjs`):
```javascript
export const SITE_NAME = 'chess-moments-site-name';
export const REGION = 'us-east-1';
export const RAM = 3009;
export const DISK = 2048;
export const TIMEOUT = 900;
```

## Current State & Next Steps

### Completed Features
✅ Chess game analysis with Stockfish
✅ Individual game video generation (annotated & non-annotated)
✅ Tournament data management
✅ Tournament video generation (3 types)
✅ AI-powered narratives with OpenRouter
✅ AWS Lambda rendering
✅ Progress tracking with polling
✅ YouTube upload integration
✅ Local rendering scripts
✅ Architecture documentation with diagrams

### Known Issues
- None currently blocking

### Potential Next Steps
1. **Batch operations UI improvements**
   - Show individual progress for batch renders
   - Cancel/retry functionality

2. **Video customization**
   - Allow users to choose music
   - Custom branding/logos
   - Orientation selection (portrait/landscape)

3. **Advanced AI features**
   - Multi-language support
   - Voice-over generation
   - Custom narrative styles

4. **Performance optimizations**
   - Cache AI responses
   - Parallelize Lambda renders
   - Database query optimization

5. **Analytics**
   - Track video views
   - Popular tournaments
   - User engagement metrics

## Working with This Document

### For AI Assistants
When starting a new session:
1. Read this document to understand context
2. Check `docs/tournament-video-architecture.md` for system design
3. Review recent git commits for latest changes
4. Ask user about their current goal
5. Use patterns and conventions from this guide

### Updating This Document
When you make significant changes:
1. Update relevant sections
2. Add new patterns to "Key Architectural Patterns"
3. Document new gotchas in "Important Gotchas"
4. Update "Current State & Next Steps"
5. Commit changes with the code

### Quick Reference Checklist
- [ ] Read this document
- [ ] Check architecture diagrams
- [ ] Review git status
- [ ] Understand user's goal
- [ ] Follow established patterns
- [ ] Update documentation if needed
- [ ] Test changes locally
- [ ] Commit with descriptive message

## Contact & Resources

**Documentation**:
- Architecture: `docs/tournament-video-architecture.md`
- Diagrams: `docs/tournament-video-*.svg`

**External Docs**:
- [Next.js 15](https://nextjs.org/docs)
- [Remotion](https://remotion.dev)
- [OpenRouter](https://openrouter.ai/docs)
- [Clerk](https://clerk.com/docs)
- [PostgreSQL](https://postgresql.org/docs)

**Useful Commands**:
```bash
npm run dev              # Start dev server
npm run build           # Build for production
npm run remotion        # Remotion studio
npm run lint            # Run linter
git status              # Check git status
psql -d chess_moments   # Connect to DB
```

---

**Last Updated**: 2025-10-30
**Version**: 1.0
**Maintained by**: Claude AI Assistant
