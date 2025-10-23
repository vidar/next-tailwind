import posthog from 'posthog-js'

export function initPostHog() {
  if (typeof window === 'undefined') return

  // Only initialize if not already initialized
  if (posthog.__loaded) return

  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY
  const apiHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com'

  if (!apiKey) {
    console.warn('PostHog API key not found. Analytics disabled.')
    return
  }

  posthog.init(apiKey, {
    api_host: apiHost,

    // Basic web analytics
    capture_pageview: true, // Automatic pageview tracking
    capture_pageleave: true, // Track when users leave pages

    // Session recording (disabled by default, enable in PostHog UI if needed)
    disable_session_recording: true,

    // Performance tracking
    capture_performance: true, // Track web vitals

    // Product analytics
    autocapture: true, // Automatically capture clicks, form submissions

    // Privacy-friendly defaults
    persistence: 'localStorage', // Use localStorage instead of cookies
    respect_dnt: true, // Respect Do Not Track

    // Error tracking
    capture_exceptions: true, // Automatically capture console errors

    // Development
    loaded: (posthog) => {
      if (process.env.NODE_ENV === 'development') {
        posthog.debug() // Enable debug mode in development
      }
    }
  })
}

// Helper to identify users (call after user signs in)
export function identifyUser(userId: string, userProperties?: Record<string, unknown>) {
  if (typeof window === 'undefined') return
  posthog.identify(userId, userProperties)
}

// Helper to reset identity (call on sign out)
export function resetUser() {
  if (typeof window === 'undefined') return
  posthog.reset()
}

// Track custom events
export function trackEvent(eventName: string, properties?: Record<string, unknown>) {
  if (typeof window === 'undefined') return
  posthog.capture(eventName, properties)
}

// Track errors manually
export function trackError(error: Error, context?: Record<string, unknown>) {
  if (typeof window === 'undefined') return

  posthog.capture('error', {
    error_message: error.message,
    error_stack: error.stack,
    error_name: error.name,
    ...context
  })
}

export { posthog }
