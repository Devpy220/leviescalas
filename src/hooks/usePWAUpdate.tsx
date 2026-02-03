import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

export function usePWAUpdate() {
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      console.log('[PWA] Service Worker registered:', swUrl);
      
      // Check for updates every 30 seconds (much faster than default)
      if (registration) {
        setInterval(() => {
          console.log('[PWA] Checking for updates...');
          registration.update();
        }, 30 * 1000);
      }
    },
    onRegisterError(error) {
      console.error('[PWA] Registration error:', error);
    },
  });

  useEffect(() => {
    if (needRefresh) {
      console.log('[PWA] New content available, prompting user');
      setShowUpdatePrompt(true);
    }
  }, [needRefresh]);

  const applyUpdate = async () => {
    console.log('[PWA] User accepted update, reloading...');
    await updateServiceWorker(true);
    setShowUpdatePrompt(false);
  };

  const dismissUpdate = () => {
    console.log('[PWA] User dismissed update');
    setNeedRefresh(false);
    setShowUpdatePrompt(false);
  };

  return {
    showUpdatePrompt,
    applyUpdate,
    dismissUpdate,
    needRefresh,
  };
}
