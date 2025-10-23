# Analytics Implementation Summary

PostHog has been integrated into Chess Moments with sensible defaults for web analytics, product analytics, and error tracking.

## ✅ What's Implemented

### Core Setup
- ✅ PostHog SDK installed (`posthog-js`)
- ✅ Initialization with privacy-friendly defaults
- ✅ Automatic pageview tracking on route changes
- ✅ User identification synced with Clerk authentication
- ✅ Error boundary for React error tracking
- ✅ Console error capture

### Files Created/Modified

| File | Purpose |
|------|---------|
| `src/lib/posthog.ts` | PostHog initialization and helper functions |
| `src/providers/PostHogProvider.tsx` | Provider for pageview tracking and user sync |
| `src/components/PostHogErrorBoundary.tsx` | React error boundary with PostHog integration |
| `src/hooks/usePostHogUser.ts` | Hook to sync Clerk users with PostHog |
| `src/app/layout.tsx` | Integrated providers and error boundary |
| `src/app/import/page.tsx` | Added event tracking for game search and analysis |

### Environment Variables
```env
NEXT_PUBLIC_POSTHOG_KEY=          # Your PostHog project API key
NEXT_PUBLIC_POSTHOG_HOST=         # Default: https://app.posthog.com
```

## 📊 Automatic Tracking (No Code Needed)

### Web Analytics
- ✅ Page views on every route change
- ✅ Page exits when users leave
- ✅ Web vitals (LCP, FID, CLS)
- ✅ Session duration and frequency

### Product Analytics
- ✅ All button clicks
- ✅ Form submissions
- ✅ Link clicks
- ✅ Scroll depth

### Error Tracking
- ✅ JavaScript console errors
- ✅ React component errors (via Error Boundary)
- ✅ Unhandled promise rejections
- ✅ Manual error tracking with `trackError()`

### User Tracking
- ✅ Automatic user identification on sign in
- ✅ User properties: email, name, username, created_at
- ✅ Anonymous users tracked with session ID
- ✅ Automatic reset on sign out

## 🎯 Custom Events Already Tracked

| Event | Trigger | Properties |
|-------|---------|------------|
| `games_searched` | User searches for chess games | `platform`, `games_found` |
| `game_analyzed` | Game analysis completes successfully | `depth`, `find_alternatives` |

## 🔧 How to Add More Tracking

### Track Custom Events
```typescript
import { trackEvent } from '@/lib/posthog'

// Simple event
trackEvent('button_clicked')

// Event with properties
trackEvent('video_rendered', {
  composition_type: 'annotated',
  aspect_ratio: 'landscape',
  music_genre: 'lofi'
})
```

### Track Errors
```typescript
import { trackError } from '@/lib/posthog'

try {
  // risky operation
} catch (error) {
  trackError(error, {
    context: 'video_rendering',
    user_action: 'render_button_click'
  })
}
```

## 🎨 Recommended Events to Add

Based on your app's features, consider tracking:

### Game Analysis
- `analysis_started` - When user clicks analyze
- `analysis_failed` - When analysis encounters an error
- `annotation_created` - When user adds annotation
- `annotation_ai_generated` - When AI generates annotation

### Video Rendering
- `render_started` - When render begins
- `render_completed` - When render finishes
- `render_failed` - When render fails
- `youtube_upload` - When user uploads to YouTube

### Tournaments
- `tournament_imported` - When tournament data imported
- `tournament_viewed` - When user views tournament details
- `player_searched` - When user searches for player

### Engagement
- `board_flipped` - When user flips board orientation
- `move_navigated` - When user navigates through moves
- `pgn_downloaded` - When user downloads PGN
- `game_shared` - When user shares game

## 📈 PostHog Configuration

### Current Settings
```typescript
{
  capture_pageview: true,          // Auto pageviews
  capture_pageleave: true,         // Track exits
  capture_performance: true,       // Web vitals
  autocapture: true,               // Auto clicks/forms
  persistence: 'localStorage',     // Privacy-friendly
  respect_dnt: true,               // Honor Do Not Track
  capture_exceptions: true,        // Auto error tracking
  disable_session_recording: true  // Recording off by default
}
```

### What's NOT Enabled (Can Enable Later)
- ❌ Session recording (video playback of user sessions)
- ❌ Heatmaps (need to enable in PostHog UI)
- ❌ Feature flags (need to set up in PostHog)
- ❌ A/B testing (need to configure experiments)

## 🔐 Privacy & Compliance

### GDPR-Friendly Defaults
- ✅ No cookies used (localStorage only)
- ✅ Do Not Track respected
- ✅ Session recording disabled
- ✅ Can anonymize IPs in PostHog settings
- ✅ Users can opt out by blocking or clearing storage

### Data Collected
**Automatic:**
- Page URLs visited
- Click events and targets
- User ID (when signed in)
- User email, name (when signed in)
- Browser, device, OS info
- Errors and stack traces

**Not Collected:**
- Passwords
- Payment information
- PGN content (unless explicitly sent in events)
- Session recordings (disabled)

## 🚀 Getting Started

### 1. Get PostHog API Key
1. Sign up at [posthog.com](https://posthog.com)
2. Create a project
3. Copy your API key from project settings

### 2. Set Environment Variable
```bash
# In .env.local
NEXT_PUBLIC_POSTHOG_KEY=phc_your_key_here
```

### 3. Deploy
```bash
npm run build
# Deploy to production with env var set
```

### 4. Verify
1. Visit your app
2. Check browser console for PostHog debug messages (in dev)
3. Check PostHog dashboard for events

## 📊 Useful PostHog Features

### Dashboards to Create
1. **User Journey** - Track sign up → game search → analysis → render
2. **Feature Usage** - Most used features by frequency
3. **Conversion Funnel** - Drop-off points in user flow
4. **Error Dashboard** - Error frequency and types

### Insights to Build
1. **Daily Active Users** - Users visiting per day
2. **Retention Cohorts** - User return rate over time
3. **Feature Adoption** - Usage of new features
4. **Performance** - Page load times and web vitals

### Useful Filters
- By user email/ID
- By page path
- By platform (chess.com vs lichess)
- By composition type (walkthrough vs annotated)

## 🐛 Debugging

### Check if PostHog is Working
1. Open browser console
2. Type: `posthog.capture('test_event', { test: true })`
3. Check PostHog dashboard for event

### Enable Debug Mode
1. In development: Automatically enabled
2. In production: Add `?posthog_debug=true` to URL
3. Check console for PostHog logs

### Common Issues
- **No events showing:** Check API key is set correctly
- **Blocked by ad blocker:** PostHog may be blocked
- **No user data:** Clerk integration may not be working

## 📝 Next Steps

1. **Set up your PostHog account** and add API key
2. **Create initial dashboards** for key metrics
3. **Set up alerts** for errors and important events
4. **Add more custom events** as needed
5. **Review data weekly** and iterate on tracking

## 📚 Resources

- [PostHog Documentation](https://posthog.com/docs)
- [PostHog JavaScript SDK](https://posthog.com/docs/libraries/js)
- [Event Tracking Best Practices](https://posthog.com/docs/product-analytics/analytics-best-practices)
- [GDPR Compliance](https://posthog.com/docs/privacy/gdpr-compliance)

---

**Questions?** Check `POSTHOG_SETUP.md` for detailed configuration options.
