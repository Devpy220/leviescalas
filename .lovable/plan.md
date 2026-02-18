

## Fix: WonderPush "ConsentError" blocking push notifications

### Problem
The WonderPush SDK is configured with `requiresUserConsent: true` in `index.html`. Even though `setUserConsent(true)` is called before `setUserId`, the SDK's internal consent state isn't ready in time, causing a `ConsentError` that blocks all push functionality.

### Solution
Remove `requiresUserConsent: true` from the WonderPush initialization. This flag is redundant because our code already controls when to subscribe -- we only call `subscribeToNotifications` after the user is logged in and interacts with the toggle. Without this flag, `setUserId` and subscription calls will work immediately.

### Changes

**1. `index.html`** -- Remove `requiresUserConsent: true` from WonderPush init:
```javascript
WonderPush.push(["init", {
  webKey: "08c2222c...",
  serviceWorkerUrl: "/sw.js"
  // requiresUserConsent removed
}]);
```

**2. `src/hooks/usePushNotifications.tsx`** -- Remove all `setUserConsent` calls (no longer needed):
- Remove `setUserConsent(true)` from `syncWonderPush` function
- Remove `setUserConsent(true)` from `subscribe` function
- Keep the `setUserId` and `subscribeToNotifications` logic intact

### Technical Details
- The `requiresUserConsent` flag in WonderPush blocks ALL SDK API calls (including `setUserId`) until consent is granted
- Our app already gates push subscription behind user login and explicit toggle interaction, making this flag redundant
- Removing it eliminates the race condition between consent and userId calls
