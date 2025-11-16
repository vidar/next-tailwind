import '@testing-library/jest-dom'
import 'whatwg-fetch'

// Mock environment variables
process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'test-key'
process.env.CLERK_SECRET_KEY = 'test-secret'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      pathname: '/',
      query: {},
      asPath: '/',
    }
  },
  usePathname() {
    return '/'
  },
  useSearchParams() {
    return new URLSearchParams()
  },
  useParams() {
    return {}
  },
}))

// Mock Clerk
jest.mock('@clerk/nextjs', () => ({
  auth: jest.fn(() => ({ userId: 'test-user-id' })),
  currentUser: jest.fn(() => ({ id: 'test-user-id', emailAddresses: [{ emailAddress: 'test@example.com' }] })),
  useAuth: jest.fn(() => ({ userId: 'test-user-id', isLoaded: true, isSignedIn: true })),
  useUser: jest.fn(() => ({ user: { id: 'test-user-id' }, isLoaded: true, isSignedIn: true })),
  ClerkProvider: ({ children }: { children: React.ReactNode }) => children,
  SignInButton: ({ children }: { children: React.ReactNode }) => children,
  SignUpButton: ({ children }: { children: React.ReactNode }) => children,
  UserButton: () => null,
}))

// Mock PostHog
jest.mock('posthog-js', () => ({
  init: jest.fn(),
  capture: jest.fn(),
  identify: jest.fn(),
}))

// Suppress console errors in tests (optional, can be removed if you want to see them)
const originalError = console.error
beforeAll(() => {
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning: ReactDOM.render') ||
       args[0].includes('Not implemented: HTMLFormElement.prototype.submit'))
    ) {
      return
    }
    originalError.call(console, ...args)
  }
})

afterAll(() => {
  console.error = originalError
})
