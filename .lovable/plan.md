

## Fix: Push notifications not activating on mobile browsers (Android Chrome/Firefox)

### Problem
Push notifications work on desktop but fail to activate on mobile browsers (Chrome and Firefox on Android), even when notification permission is already granted. The toggle doesn't turn on after clicking.

### Root Cause Analysis
The likely cause is a **timing issue on mobile**: after calling `subscribeToNotifications()`, the hook waits only 2 seconds before checking `wpIsSubscribed()`. On mobile browsers with slower processing, the WonderPush SDK may not have finished registering the push subscription in that window, causing the check to return `false` and showing the error toast.

Additionally, Firefox for Android has known quirks with the WonderPush SDK's internal subscription check.

### Solution
Three changes to `src/hooks/usePushNotifications.tsx`:

**1. Retry subscription check with exponential backoff**
Instead of a single 2-second wait, poll `wpIsSubscribed()` multiple times (e.g., at 1s, 2s, 4s, 6s) up to ~8 seconds. This accommodates slower mobile processing.

**2. Trust permission as success fallback**
If after all retries `wpIsSubscribed()` still returns false BUT `Notification.permission === 'granted'` and we successfully called `subscribeToNotifications()` without errors, treat it as success. The subscription is likely active but the SDK's internal state hasn't synced yet. Update `isSubscribed` to `true` optimistically.

**3. Add diagnostic logging for mobile debugging**
Log the user agent, display mode (standalone vs browser), and SDK state at key points so future mobile issues can be diagnosed from console screenshots.

### Technical Details

```
subscribe() flow (updated):
  1. Check/request permission (existing)
  2. Wait for SDK ready (existing)
  3. Set userId (existing)
  4. Call subscribeToNotifications (existing)
  5. NEW: Poll wpIsSubscribed() up to 4 times (1s, 2s, 4s, 8s intervals)
  6. NEW: If still false but permission=granted, set isSubscribed=true optimistically
  7. Show success toast
```

Changes are limited to `src/hooks/usePushNotifications.tsx` only -- no other files affected.
