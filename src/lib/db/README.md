# Database Module Refactoring

## Overview

The original `db.ts` file (1478 lines) has been refactored into a modular structure organized by domain. This improves maintainability, testability, and code organization.

## Structure

```
db/
├── types.ts              # All TypeScript interfaces and types
├── connection.ts         # PostgreSQL pool management
├── chess-analysis.ts     # Chess game analysis operations
├── videos.ts             # Video rendering and management
├── annotations.ts        # Game move annotations
├── index.ts              # Main export file (backwards compatible)
└── README.md             # This file
```

## Migration Status

### ✅ Completed Modules

- **types.ts** (240 lines) - All database model interfaces
- **connection.ts** (22 lines) - Database connection pool singleton
- **chess-analysis.ts** (75 lines) - Chess analysis CRUD operations
- **videos.ts** (95 lines) - Video CRUD operations
- **annotations.ts** (48 lines) - Annotation CRUD operations

### 🚧 To Be Migrated

The following domains remain in the original `db.ts` and should be extracted into separate modules:

- **tournaments.ts** - Tournament, Player, Round, and Game operations (~400 lines)
- **player-lookup.ts** - Player profiles, games, insights, and opening stats (~500 lines)
- **tournament-videos.ts** - Tournament video operations (~100 lines)
- **queue.ts** - Analysis queue operations (~75 lines)

## Usage

### Before (Old Import)

```typescript
import { getAnalysisById, createVideo } from '@/lib/db'
```

### After (New Import - Recommended)

```typescript
import { getAnalysisById } from '@/lib/db/chess-analysis'
import { createVideo } from '@/lib/db/videos'
```

### Backwards Compatibility

```typescript
// This still works! index.ts re-exports everything
import { getAnalysisById, createVideo } from '@/lib/db'
```

## Benefits

1. **Smaller Files**: Each module is focused and easier to understand
2. **Better Testing**: Can test each domain independently
3. **Clearer Dependencies**: Import only what you need
4. **Easier Maintenance**: Changes are scoped to specific domains
5. **Type Safety**: All types centralized in one place

## Next Steps

1. Extract remaining domains from `db.ts` into separate modules
2. Update imports across the codebase to use specific modules
3. Remove re-exports from index.ts once migration is complete
4. Add comprehensive unit tests for each module
5. Consider adding JSDoc comments for complex queries

## Testing

Each module can be tested independently:

```typescript
// Example test for chess-analysis.ts
import { getAnalysisById } from '@/lib/db/chess-analysis'
import { getPool } from '@/lib/db/connection'

jest.mock('@/lib/db/connection')

describe('Chess Analysis', () => {
  it('should get analysis by ID', async () => {
    // Test implementation
  })
})
```
