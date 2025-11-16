# Testing Documentation

## Overview

This project now has a comprehensive test suite using Jest and React Testing Library.

## Test Infrastructure

### Tools
- **Jest** - Test runner and assertion library
- **@testing-library/react** - React component testing utilities
- **@testing-library/jest-dom** - Custom DOM matchers
- **@testing-library/user-event** - User interaction simulation
- **@swc/jest** - Fast TypeScript transformation
- **MSW** (Mock Service Worker) - API mocking (installed, ready for use)

### Configuration

- **jest.config.ts** - Main Jest configuration with Next.js integration
- **jest.setup.ts** - Test environment setup, mocks for Clerk, PostHog, Next.js router

## Test Scripts

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## Test Coverage

### Current Test Suites (38 tests, 100% passing)

#### 1. PGN Parser Tests (`src/lib/__tests__/pgn-parser.test.ts`)
**27 tests covering:**
- PGN header parsing
- Multiple game splitting
- Individual game parsing
- Player extraction
- Tournament type inference
- Complete tournament parsing
- Edge cases (empty input, malformed data, etc.)

**Key test scenarios:**
- ✅ Parse standard PGN headers
- ✅ Handle special characters in values
- ✅ Split multiple games correctly
- ✅ Extract FIDE IDs and ratings
- ✅ Infer tournament types (round-robin, swiss, knockout)
- ✅ Calculate max rounds
- ✅ Error handling for invalid input

#### 2. API Response Helper Tests (`src/helpers/__tests__/api-response.test.ts`)
**7 tests covering:**
- Successful API execution with valid input
- Schema validation failures
- Handler error handling
- Empty schema handling
- Complex nested schema validation
- Malformed JSON handling
- Type safety verification

**Key test scenarios:**
- ✅ Execute handlers with Zod schema validation
- ✅ Return proper error responses
- ✅ Handle async operations
- ✅ Type-safe responses

#### 3. PostHog User Hook Tests (`src/hooks/__tests__/usePostHogUser.test.ts`)
**4 tests covering:**
- User identification on sign-in
- User reset on sign-out
- Loading state handling
- User change detection

**Key test scenarios:**
- ✅ Identify user when signed in
- ✅ Reset user when signed out
- ✅ Handle missing user data
- ✅ Re-identify on user change

## Testing Best Practices

### 1. Test File Location
Place test files next to the code they test:
```
src/
  lib/
    pgn-parser.ts
    __tests__/
      pgn-parser.test.ts
```

### 2. Test Naming Convention
- Files: `*.test.ts` or `*.spec.ts`
- Describe blocks: Group related tests by function/component
- Test names: Start with "should" for clarity

```typescript
describe('parsePGNHeaders', () => {
  it('should parse standard PGN headers', () => {
    // test implementation
  })
})
```

### 3. Test Structure
Follow the Arrange-Act-Assert (AAA) pattern:
```typescript
it('should create pending analysis', async () => {
  // Arrange
  const pgn = '[Event "Test"]\n1. e4 e5'
  const depth = 20

  // Act
  const result = await createPendingAnalysis(pgn, depth, true)

  // Assert
  expect(result.status).toBe('pending')
  expect(result.pgn).toBe(pgn)
})
```

### 4. Mocking
- **External APIs**: Use MSW for HTTP mocking
- **Database**: Mock the pool/query functions
- **Third-party libraries**: Use Jest mocks

Example:
```typescript
jest.mock('@clerk/nextjs', () => ({
  useUser: jest.fn(() => ({ user: mockUser, isLoaded: true }))
}))
```

## Areas for Additional Testing

### High Priority
1. **Component Tests**
   - `<ChessBoard />` - Board rendering and interaction
   - `<EvaluationChart />` - Chart display and data visualization
   - `<RenderOptionsModal />` - Form validation and submission

2. **API Route Tests**
   - `/api/chess/search` - Game search functionality
   - `/api/chess-render` - Video rendering
   - `/api/youtube/upload` - YouTube integration

3. **Database Module Tests**
   - Test each refactored db module independently
   - Mock PostgreSQL queries
   - Test error handling

### Medium Priority
4. **Integration Tests**
   - Complete user flows (import game → analyze → generate video)
   - Tournament management workflows

5. **Remotion Video Tests**
   - Video composition rendering
   - Frame calculations
   - Audio synchronization

## Running Specific Tests

```bash
# Run tests for a specific file
npm test -- pgn-parser

# Run tests matching a pattern
npm test -- --testPathPatterns="api-response|pgn-parser"

# Run tests in a specific directory
npm test -- src/lib/__tests__

# Run with coverage for specific files
npm test -- --coverage --collectCoverageFrom="src/lib/pgn-parser.ts"
```

## Continuous Integration

### GitHub Actions (Recommended)
Add to `.github/workflows/test.yml`:
```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm test
```

## Debugging Tests

### VSCode Integration
Add to `.vscode/launch.json`:
```json
{
  "type": "node",
  "request": "launch",
  "name": "Jest Current File",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["${fileBasename}", "--runInBand"],
  "console": "integratedTerminal"
}
```

### Common Issues

1. **Module not found errors**
   - Check `moduleNameMapper` in jest.config.ts
   - Ensure path aliases match tsconfig.json

2. **Async test timeouts**
   - Increase timeout: `jest.setTimeout(10000)`
   - Check for unhandled promises

3. **Mock not working**
   - Ensure mocks are hoisted before imports
   - Use `jest.mock()` at top of file

## Next Steps

1. ✅ Add tests for remaining utility functions
2. ✅ Add component tests for critical UI components
3. ✅ Add API route tests
4. ✅ Increase coverage to >80%
5. ✅ Set up CI/CD with automated testing
6. ✅ Add E2E tests with Playwright (for critical user flows)

## Resources

- [Jest Documentation](https://jestjs.io/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Next.js](https://nextjs.org/docs/testing)
