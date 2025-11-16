import { renderHook } from '@testing-library/react'
import { usePostHogUser } from '../usePostHogUser'
import { useUser } from '@clerk/nextjs'
import { identifyUser, resetUser } from '@/lib/posthog'

jest.mock('@clerk/nextjs')
jest.mock('@/lib/posthog')

describe('usePostHogUser', () => {
  const mockUseUser = useUser as jest.MockedFunction<typeof useUser>
  const mockIdentifyUser = identifyUser as jest.MockedFunction<typeof identifyUser>
  const mockResetUser = resetUser as jest.MockedFunction<typeof resetUser>

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should not call posthog when user is not loaded', () => {
    mockUseUser.mockReturnValue({
      user: null,
      isLoaded: false,
      isSignedIn: false,
    } as any)

    renderHook(() => usePostHogUser())

    expect(mockIdentifyUser).not.toHaveBeenCalled()
    expect(mockResetUser).not.toHaveBeenCalled()
  })

  it('should identify user when signed in', () => {
    const mockUser = {
      id: 'user-123',
      emailAddresses: [{ emailAddress: 'test@example.com' }],
      fullName: 'Test User',
      username: 'testuser',
      createdAt: new Date('2024-01-01'),
    }

    mockUseUser.mockReturnValue({
      user: mockUser,
      isLoaded: true,
      isSignedIn: true,
    } as any)

    renderHook(() => usePostHogUser())

    expect(mockIdentifyUser).toHaveBeenCalledWith('user-123', {
      email: 'test@example.com',
      name: 'Test User',
      username: 'testuser',
      created_at: mockUser.createdAt,
    })
    expect(mockResetUser).not.toHaveBeenCalled()
  })

  it('should reset user when signed out', () => {
    mockUseUser.mockReturnValue({
      user: null,
      isLoaded: true,
      isSignedIn: false,
    } as any)

    renderHook(() => usePostHogUser())

    expect(mockResetUser).toHaveBeenCalled()
    expect(mockIdentifyUser).not.toHaveBeenCalled()
  })

  it('should handle user without email', () => {
    const mockUser = {
      id: 'user-456',
      emailAddresses: [],
      fullName: 'Test User',
      username: 'testuser',
      createdAt: new Date('2024-01-01'),
    }

    mockUseUser.mockReturnValue({
      user: mockUser,
      isLoaded: true,
      isSignedIn: true,
    } as any)

    renderHook(() => usePostHogUser())

    expect(mockIdentifyUser).toHaveBeenCalledWith('user-456', {
      email: undefined,
      name: 'Test User',
      username: 'testuser',
      created_at: mockUser.createdAt,
    })
  })

  it('should re-identify when user changes', () => {
    const mockUser1 = {
      id: 'user-1',
      emailAddresses: [{ emailAddress: 'user1@example.com' }],
      fullName: 'User One',
      username: 'user1',
      createdAt: new Date('2024-01-01'),
    }

    const mockUser2 = {
      id: 'user-2',
      emailAddresses: [{ emailAddress: 'user2@example.com' }],
      fullName: 'User Two',
      username: 'user2',
      createdAt: new Date('2024-01-02'),
    }

    mockUseUser.mockReturnValue({
      user: mockUser1,
      isLoaded: true,
      isSignedIn: true,
    } as any)

    const { rerender } = renderHook(() => usePostHogUser())

    expect(mockIdentifyUser).toHaveBeenCalledTimes(1)

    mockUseUser.mockReturnValue({
      user: mockUser2,
      isLoaded: true,
      isSignedIn: true,
    } as any)

    rerender()

    expect(mockIdentifyUser).toHaveBeenCalledTimes(2)
    expect(mockIdentifyUser).toHaveBeenLastCalledWith('user-2', {
      email: 'user2@example.com',
      name: 'User Two',
      username: 'user2',
      created_at: mockUser2.createdAt,
    })
  })
})
