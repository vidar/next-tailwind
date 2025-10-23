'use client'

import { useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { identifyUser, resetUser } from '@/lib/posthog'

/**
 * Hook to automatically sync Clerk user with PostHog
 * Call this in your layout or a top-level component
 */
export function usePostHogUser() {
  const { user, isLoaded, isSignedIn } = useUser()

  useEffect(() => {
    if (!isLoaded) return

    if (isSignedIn && user) {
      // Identify user in PostHog
      identifyUser(user.id, {
        email: user.emailAddresses[0]?.emailAddress,
        name: user.fullName,
        username: user.username,
        created_at: user.createdAt,
      })
    } else {
      // Reset PostHog identity on sign out
      resetUser()
    }
  }, [isLoaded, isSignedIn, user])
}
