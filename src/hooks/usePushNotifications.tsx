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

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

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
        setIsSubscribed(subscribed);
        setPermission(Notification.permission);
        console.log('[Push] WonderPush synced, subscribed:', subscribed);

        // Auto-subscribe if not yet subscribed and permission not denied
        if (!subscribed && Notification.permission !== 'denied') {
          console.log('[Push] Auto-subscribing user...');
          if (typeof wp.subscribeToNotifications === 'function') {
            await wp.subscribeToNotifications();
            console.log('[Push] subscribeToNotifications called directly');
          } else {
            wp.push(['subscribeToNotifications']);
            console.log('[Push] subscribeToNotifications called via queue');
          }
          // Wait a moment then re-check
          setTimeout(async () => {
            const nowSubscribed = await wpIsSubscribed();
            setIsSubscribed(nowSubscribed);
            setPermission(Notification.permission);
            console.log('[Push] Auto-subscribe result:', nowSubscribed);
          }, 2000);
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
      console.log('[Push] Starting subscribe...');
      await wonderPushReady(15000);
      const wp = window.WonderPush;
      console.log('[Push] WonderPush ready, setting userId and subscribing...');

      if (typeof wp.setUserId === 'function') {
        await wp.setUserId(user.id);
      } else {
        wp.push(['setUserId', user.id]);
      }

      if (typeof wp.subscribeToNotifications === 'function') {
        await wp.subscribeToNotifications();
        console.log('[Push] subscribeToNotifications called directly');
      } else {
        wp.push(['subscribeToNotifications']);
        console.log('[Push] subscribeToNotifications called via queue');
      }

      // Wait for subscription to process
      await new Promise(resolve => setTimeout(resolve, 2000));

      const subscribed = await wpIsSubscribed();
      setIsSubscribed(subscribed);
      setPermission(Notification.permission);
      console.log('[Push] Subscribe result:', subscribed, 'Permission:', Notification.permission);

      if (subscribed) {
        toast.success('Notificações ativadas com sucesso!');
        return true;
      } else {
        if (Notification.permission === 'denied') {
          toast.error('Permissão para notificações foi negada. Verifique as configurações do navegador.');
        } else {
          toast.error('Não foi possível ativar notificações. Tente novamente.');
        }
        return false;
      }
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
      setIsSubscribed(false);
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
