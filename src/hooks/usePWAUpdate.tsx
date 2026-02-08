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

        // Check for updates every 10 seconds for faster icon/asset delivery
        checkIntervalRef.current = setInterval(() => {
          reg.update().catch(console.error);
        }, 10 * 1000);

        // Also check immediately on page focus (user returns to app)
        const onFocus = () => reg.update().catch(console.error);
        window.addEventListener('focus', onFocus);
        // Store cleanup ref
        (checkIntervalRef as any).__focusCleanup = onFocus;

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
      const focusCleanup = (checkIntervalRef as any).__focusCleanup;
      if (focusCleanup) {
        window.removeEventListener('focus', focusCleanup);
      }
    };
  }, []);

  const applyUpdate = useCallback(async () => {
    console.log('[PWA] User accepted update');
    
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    
    // Also clear all caches to force fresh icon/asset downloads
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
      console.log('[PWA] All caches cleared for fresh assets');
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
