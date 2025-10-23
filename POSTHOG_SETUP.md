# PostHog Analytics Setup

This project uses [PostHog](https://posthog.com) for web analytics, product analytics, and error tracking.

## Quick Setup

### 1. Create PostHog Account
1. Go to [posthog.com](https://posthog.com) and create an account
2. Create a new project
3. Copy your **Project API Key**

### 2. Configure Environment Variables
Add to your `.env.local` file:

```env
NEXT_PUBLIC_POSTHOG_KEY=phc_your_key_here
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

> **Note:** If you're self-hosting PostHog, change the `NEXT_PUBLIC_POSTHOG_HOST` to your instance URL.

### 3. That's It!
PostHog is automatically initialized and tracking is enabled. No additional code changes needed.

## What's Being Tracked

### 📊 Web Analytics (Automatic)
- **Pageviews** - Every page navigation
- **Page exits** - When users leave pages
- **Performance metrics** - Web vitals (LCP, FID, CLS)
- **User sessions** - Session duration and frequency

### 🎯 Product Analytics (Automatic)
- **Button clicks** - All clickable elements
- **Form submissions** - Form interactions
- **Link clicks** - External and internal navigation
- **Scroll depth** - How far users scroll

### 🔍 Custom Events (Manual)
Key user actions are tracked:

| Event | When | Properties |
|-------|------|------------|
| `games_searched` | User searches for games | `platform`, `games_found` |
| `game_analyzed` | Game analysis completes | `depth`, `find_alternatives` |
| `video_rendered` | Video render starts | `composition_type`, `aspect_ratio` |
| `annotation_added` | User adds annotation | `move_index`, `game_id` |

### 🐛 Error Tracking (Automatic)
- **JavaScript errors** - Caught console errors
- **React errors** - Component errors via Error Boundary
- **Network errors** - Failed API requests

## User Identification

Users are automatically identified when they sign in via Clerk:

```typescript
// Automatic on sign in
identifyUser(userId, {
  email: user.email,
  name: user.fullName,
  created_at: user.createdAt
})

// Automatic on sign out
resetUser()
```

## Custom Event Tracking

To track additional custom events, use the helper function:

```typescript
import { trackEvent } from '@/lib/posthog'

// Track a simple event
trackEvent('button_clicked')

// Track with properties
trackEvent('feature_used', {
  feature_name: 'dark_mode',
  enabled: true
})
```

## Error Tracking

Errors are automatically captured, but you can also manually track errors:

```typescript
import { trackError } from '@/lib/posthog'

try {
  // Some risky operation
} catch (error) {
  trackError(error, {
    context: 'user_action',
    additional_info: 'something went wrong'
  })
}
```

## Privacy & GDPR Compliance

PostHog is configured with privacy-friendly defaults:

- ✅ **Do Not Track respected** - Honors browser DNT settings
- ✅ **localStorage persistence** - No cookies used
- ✅ **Session recording disabled** - No video recordings by default
- ✅ **IP anonymization** - Can be enabled in PostHog settings
- ✅ **User opt-out** - Users can disable tracking

### Disabling Tracking

Users can disable tracking by:
1. Enabling "Do Not Track" in their browser
2. Blocking PostHog domain
3. Clearing localStorage

## PostHog Dashboard

### Recommended Dashboards to Create

1. **User Journey**
   - Sign ups → Game searches → Analyses → Video renders

2. **Feature Usage**
   - Walkthrough vs Annotated videos
   - Analysis depth distribution
   - Music genre preferences

3. **Conversion Funnel**
   - Visit → Sign up → First analysis → First render

4. **Error Tracking**
   - Most common errors
   - Error rate over time
   - Errors by page

### Useful Insights

```sql
-- Most popular features
SELECT properties.feature_name, count()
FROM events
WHERE event = 'feature_used'
GROUP BY properties.feature_name
ORDER BY count() DESC

-- Analysis success rate
SELECT
  countIf(event = 'game_analyzed') / countIf(event = 'analysis_started') * 100 as success_rate
FROM events
WHERE timestamp > now() - INTERVAL 7 DAY
```

## Advanced Configuration

### Enable Session Recording

In `src/lib/posthog.ts`, change:

```typescript
disable_session_recording: false, // Enable recordings
```

> **Warning:** Session recordings may capture sensitive user data. Enable only if needed and ensure GDPR compliance.

### Add Feature Flags

```typescript
import { posthog } from '@/lib/posthog'

// Check if feature is enabled
if (posthog.isFeatureEnabled('new-ui')) {
  // Show new UI
}
```

### A/B Testing

```typescript
import { posthog } from '@/lib/posthog'

// Get variant for user
const variant = posthog.getFeatureFlag('pricing-test')

if (variant === 'variant-a') {
  // Show pricing A
} else if (variant === 'variant-b') {
  // Show pricing B
}
```

## Monitoring & Alerts

Set up alerts in PostHog for:

1. **Error spike** - Alert when error rate exceeds threshold
2. **User drop-off** - Alert when conversion rate drops
3. **Performance degradation** - Alert on slow page loads
4. **Feature adoption** - Track new feature usage

## Troubleshooting

### Events Not Appearing

1. Check browser console for PostHog errors
2. Verify `NEXT_PUBLIC_POSTHOG_KEY` is set correctly
3. Check that PostHog is not blocked by ad blockers
4. Enable debug mode: Add `?posthog_debug=true` to URL

### Development Mode

PostHog automatically enables debug mode in development:

```bash
# Check browser console for:
[PostHog] Event captured: pageview
[PostHog] User identified: user_123
```

### Self-Hosted PostHog

If using self-hosted PostHog:

```env
NEXT_PUBLIC_POSTHOG_HOST=https://your-posthog-instance.com
```

## Performance Impact

PostHog is lightweight and has minimal performance impact:

- **Bundle size:** ~50KB gzipped
- **Load time:** Async, non-blocking
- **Events:** Batched and sent asynchronously
- **No render blocking:** Zero impact on page load

## Data Retention

PostHog Cloud retention:
- **Free plan:** 30 days
- **Paid plans:** Configurable (90 days to unlimited)

## Migration from Other Analytics

If migrating from Google Analytics or similar:

1. Keep both running in parallel for 2 weeks
2. Compare data and dashboards
3. Migrate custom events gradually
4. Remove old analytics when confident

## Support

- **PostHog Docs:** https://posthog.com/docs
- **Community Slack:** https://posthog.com/slack
- **GitHub Issues:** https://github.com/PostHog/posthog

## Example Queries

### User Retention
```sql
SELECT
  date_trunc('week', timestamp) as week,
  count(DISTINCT person_id) as active_users
FROM events
WHERE event = '$pageview'
GROUP BY week
ORDER BY week
```

### Feature Usage by User Type
```sql
SELECT
  person.properties.user_type,
  count() as feature_uses
FROM events
WHERE event = 'feature_used'
GROUP BY person.properties.user_type
```

### Error Rate Trend
```sql
SELECT
  date_trunc('day', timestamp) as day,
  countIf(event = 'error') / count() * 100 as error_rate
FROM events
GROUP BY day
ORDER BY day
```
