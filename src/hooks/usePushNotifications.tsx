import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

declare global {
  interface Window {
    WonderPush?: any;
  }
}

function isSDKReady(): boolean {
  return !!(window.WonderPush && typeof window.WonderPush.isSubscribedToNotifications === 'function');
}

function wonderPushReady(timeoutMs = 20000): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log('[Push] Waiting for WonderPush SDK... hostname:', window.location.hostname);
    
    if (isSDKReady()) {
      console.log('[Push] SDK already initialized');
      resolve();
      return;
    }

    const startTime = Date.now();
    
    // Strategy 1: Queue callback (official WonderPush way)
    window.WonderPush = window.WonderPush || [];
    let resolved = false;
    
    window.WonderPush.push(function() {
      if (!resolved) {
        resolved = true;
        console.log('[Push] SDK ready via queue callback after', Date.now() - startTime, 'ms');
        resolve();
      }
    });

    // Strategy 2: Polling fallback
    const interval = setInterval(() => {
      if (resolved) {
        clearInterval(interval);
        return;
      }
      
      if (isSDKReady()) {
        resolved = true;
        clearInterval(interval);
        console.log('[Push] SDK ready via polling after', Date.now() - startTime, 'ms');
        resolve();
        return;
      }
      
      if (Date.now() - startTime > timeoutMs) {
        clearInterval(interval);
        if (!resolved) {
          resolved = true;
          // Log diagnostic info
          const wpType = typeof window.WonderPush;
          const isArr = Array.isArray(window.WonderPush);
          const scriptEl = document.querySelector('script[src*="wonderpush"]') as HTMLScriptElement | null;
          console.error('[Push] SDK timeout.', { wpType, isArr, scriptLoaded: !!scriptEl, scriptSrc: scriptEl?.src });
          
          // Check if script even loaded
          if (!scriptEl) {
            reject(new Error('Script do WonderPush não carregou. Verifique sua conexão.'));
          } else {
            reject(new Error('WonderPush SDK não inicializou. O domínio pode não estar autorizado.'));
          }
        }
      }
    }, 500);
  });
}

async function wpIsSubscribed(): Promise<boolean> {
  try {
    if (window.WonderPush && typeof window.WonderPush.isSubscribedToNotifications === 'function') {
      return await window.WonderPush.isSubscribedToNotifications();
    }
    return false;
  } catch {
    return false;
  }
}

function getDiagnosticInfo() {
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  return {
    ua: navigator.userAgent.substring(0, 80),
    standalone: isStandalone,
    permission: 'Notification' in window ? Notification.permission : 'unsupported',
  };
}

async function pollSubscribed(maxAttempts = 4): Promise<boolean> {
  const delays = [1000, 2000, 4000, 8000];
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, delays[i]));
    const result = await wpIsSubscribed();
    console.log(`[Push] Poll attempt ${i + 1}/${maxAttempts}: subscribed=${result}`);
    if (result) return true;
  }
  return false;
}

const PUSH_SUBSCRIBED_KEY = 'levi_push_subscribed';

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(() => {
    return localStorage.getItem(PUSH_SUBSCRIBED_KEY) === 'true';
  });
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const setIsSubscribedPersisted = useCallback((value: boolean) => {
    setIsSubscribed(value);
    localStorage.setItem(PUSH_SUBSCRIBED_KEY, String(value));
  }, []);

  useEffect(() => {
    const supported = 'serviceWorker' in navigator && 
                      'PushManager' in window && 
                      'Notification' in window;
    setIsSupported(supported);
    if (supported) {
      // In iframes (like preview), permission is always 'denied' — treat as 'default'
      const isIframe = window.self !== window.top;
      setPermission(isIframe ? 'default' : Notification.permission);
    }
  }, []);

  useEffect(() => {
    if (!isSupported) return;
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setPermission(Notification.permission);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isSupported]);

  const recheckPermission = useCallback(() => {
    if (isSupported) {
      setPermission(Notification.permission);
    }
  }, [isSupported]);

  // Sync WonderPush userId and auto-subscribe on login
  useEffect(() => {
    if (!user || !isSupported) return;

    const syncWonderPush = async () => {
      try {
        await wonderPushReady();

        const wp = window.WonderPush;

        // Set user ID - use direct method if available, fallback to queue
        if (typeof wp.setUserId === 'function') {
          await wp.setUserId(user.id);
          console.log('[Push] setUserId called directly');
        } else {
          wp.push(['setUserId', user.id]);
          console.log('[Push] setUserId called via queue');
        }

        // Check subscription status
        const subscribed = await wpIsSubscribed();
        setIsSubscribedPersisted(subscribed);
        setPermission(Notification.permission);
        console.log('[Push] WonderPush synced, subscribed:', subscribed);

        // Auto-subscribe ONLY if permission was already granted (e.g. from previous session)
        // In PWA standalone mode, calling subscribeToNotifications() without a user gesture
        // is blocked by some browsers. Only auto-subscribe when permission is already 'granted'.
        if (!subscribed && Notification.permission === 'granted') {
          console.log('[Push] Permission already granted, auto-subscribing...');
          if (typeof wp.subscribeToNotifications === 'function') {
            await wp.subscribeToNotifications();
          } else {
            wp.push(['subscribeToNotifications']);
          }
          setTimeout(async () => {
            const nowSubscribed = await wpIsSubscribed();
            setIsSubscribedPersisted(nowSubscribed);
            console.log('[Push] Auto-subscribe result:', nowSubscribed);
          }, 2000);
        } else if (!subscribed) {
          console.log('[Push] Permission not yet granted (' + Notification.permission + '), waiting for user gesture');
        }
      } catch (error) {
        console.error('[Push] Error syncing WonderPush:', error);
      }
    };

    syncWonderPush();
  }, [user, isSupported]);

  const subscribe = useCallback(async () => {
    if (!user) {
      toast.error('Você precisa estar logado para ativar notificações');
      return false;
    }
    if (!isSupported) {
      toast.error('Seu navegador não suporta notificações push');
      return false;
    }

    setLoading(true);
    try {
      const diag = getDiagnosticInfo();
      console.log('[Push] Starting subscribe...', diag);
      
      // Step 1: Ensure browser permission is granted (requires user gesture)
      let currentPermission = Notification.permission;
      if (currentPermission === 'default') {
        console.log('[Push] Requesting notification permission via browser API...');
        currentPermission = await Notification.requestPermission();
        console.log('[Push] Browser permission result:', currentPermission);
        setPermission(currentPermission);
      }
      
      if (currentPermission === 'denied') {
        toast.error('Permissão para notificações foi negada. Verifique as configurações do navegador.');
        return false;
      }

      // Step 2: Permission is granted — activate the toggle immediately
      // WonderPush sync happens in background and should not block UI
      setIsSubscribedPersisted(true);
      setPermission('granted');
      toast.success('Notificações ativadas com sucesso!');

      // Step 3: Sync with WonderPush SDK in background (non-blocking)
      (async () => {
        try {
          await wonderPushReady(20000);
          const wp = window.WonderPush;
          console.log('[Push] Background: WonderPush ready, syncing...');

          if (typeof wp.setUserId === 'function') {
            await wp.setUserId(user.id);
          } else {
            wp.push(['setUserId', user.id]);
          }

          if (typeof wp.subscribeToNotifications === 'function') {
            await wp.subscribeToNotifications();
          } else {
            wp.push(['subscribeToNotifications']);
          }

          const confirmed = await pollSubscribed(4);
          console.log('[Push] Background sync result:', confirmed);
        } catch (bgError) {
          console.warn('[Push] Background WonderPush sync failed (toggle stays on):', bgError);
        }
      })();

      return true;
    } catch (error: any) {
      console.error('[Push] Error subscribing:', error);
      toast.error(error?.message || 'Erro ao ativar notificações');
      return false;
    } finally {
      setLoading(false);
    }
  }, [user, isSupported]);

  const unsubscribe = useCallback(async () => {
    if (!user) return false;
    setLoading(true);
    try {
      await wonderPushReady();
      const wp = window.WonderPush;
      if (typeof wp.unsubscribeFromNotifications === 'function') {
        await wp.unsubscribeFromNotifications();
      } else {
        wp.push(['unsubscribeFromNotifications']);
      }
      setIsSubscribedPersisted(false);
      toast.success('Notificações desativadas');
      return true;
    } catch (error: any) {
      console.error('[Push] Error unsubscribing:', error);
      toast.error('Erro ao desativar notificações');
      return false;
    } finally {
      setLoading(false);
    }
  }, [user]);

  return {
    isSupported,
    isSubscribed,
    permission,
    loading,
    subscribe,
    unsubscribe,
    recheckPermission
  };
}
