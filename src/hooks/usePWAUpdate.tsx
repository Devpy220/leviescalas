import { useEffect, useState, useCallback, useRef } from 'react';

interface ServiceWorkerRegistrationWithUpdate extends ServiceWorkerRegistration {
  waiting: ServiceWorker | null;
}

export function usePWAUpdate() {
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistrationWithUpdate | null>(null);
  const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    const registerSW = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        setRegistration(reg as ServiceWorkerRegistrationWithUpdate);
        console.log('[PWA] Service Worker registered');

        // Check if there's already a waiting worker
        if (reg.waiting) {
          console.log('[PWA] Update available (waiting worker found)');
          setShowUpdatePrompt(true);
        }

        // Listen for new updates
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[PWA] New content available');
              setShowUpdatePrompt(true);
            }
          });
        });

        // Check for updates every 30 seconds
        checkIntervalRef.current = setInterval(() => {
          console.log('[PWA] Checking for updates...');
          reg.update().catch(console.error);
        }, 30 * 1000);

      } catch (error) {
        console.error('[PWA] Registration failed:', error);
      }
    };

    // Handle controller change (when skipWaiting is called)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('[PWA] Controller changed, reloading...');
      window.location.reload();
    });

    registerSW();

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, []);

  const applyUpdate = useCallback(async () => {
    console.log('[PWA] User accepted update');
    
    if (registration?.waiting) {
      // Tell the waiting service worker to activate
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    
    setShowUpdatePrompt(false);
  }, [registration]);

  const dismissUpdate = useCallback(() => {
    console.log('[PWA] User dismissed update');
    setShowUpdatePrompt(false);
  }, []);

  return {
    showUpdatePrompt,
    applyUpdate,
    dismissUpdate,
  };
}
