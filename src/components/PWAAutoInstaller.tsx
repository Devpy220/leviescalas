import { useEffect, useRef } from 'react';
import { usePWAInstall } from '@/hooks/usePWAInstall';

/**
 * Invisible component that auto-triggers PWA installation prompt
 * - Waits for page to fully load
 * - Triggers native browser prompt automatically (no custom UI)
 * - Respects user's previous choices (dismissed/installed)
 * - Only works on Android/Desktop (iOS requires manual add to home screen)
 */
export function PWAAutoInstaller() {
  const { autoInstall, isInstalled, isIOS, isInstallable } = usePWAInstall();
  const hasTriedRef = useRef(false);

  useEffect(() => {
    // Don't attempt on iOS (not supported) or if already installed
    if (isIOS || isInstalled) {
      return;
    }

    // Don't try if not installable yet
    if (!isInstallable) {
      return;
    }

    // Only try once per session
    if (hasTriedRef.current) {
      return;
    }

    // Wait for page to be fully loaded and interactive
    const timer = setTimeout(async () => {
      hasTriedRef.current = true;
      
      try {
        const success = await autoInstall();
        if (success) {
          console.log('[PWAAutoInstaller] App installed successfully');
        }
      } catch (error) {
        console.error('[PWAAutoInstaller] Error:', error);
      }
    }, 4000); // 4 second delay to let the page load

    return () => clearTimeout(timer);
  }, [isIOS, isInstalled, isInstallable, autoInstall]);

  // This component renders nothing - it's purely for side effects
  return null;
}
