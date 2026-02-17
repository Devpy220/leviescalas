import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

declare global {
  interface Window {
    WonderPush?: any;
  }
}

function wonderPushReady(timeoutMs = 15000): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log('[Push] Waiting for WonderPush SDK...');
    console.log('[Push] Hostname:', window.location.hostname);
    
    // Check if already initialized
    if (window.WonderPush && typeof window.WonderPush.isSubscribedToNotifications === 'function') {
      console.log('[Push] SDK already initialized');
      resolve();
      return;
    }

    // Use polling approach instead of queue callback (more reliable with VitePWA)
    const startTime = Date.now();
    const interval = setInterval(() => {
      // Check if SDK has replaced the array with the real object
      if (window.WonderPush && typeof window.WonderPush.isSubscribedToNotifications === 'function') {
        clearInterval(interval);
        console.log('[Push] SDK initialized via polling after', Date.now() - startTime, 'ms');
        resolve();
        return;
      }
      
      if (Date.now() - startTime > timeoutMs) {
        clearInterval(interval);
        console.error('[Push] SDK timeout. WonderPush type:', typeof window.WonderPush, 
          'isArray:', Array.isArray(window.WonderPush));
        // Try the queue approach as last resort
        window.WonderPush = window.WonderPush || [];
        const lastChanceTimer = setTimeout(() => {
          reject(new Error('WonderPush SDK não carregou. Verifique se o domínio está autorizado no painel WonderPush.'));
        }, 3000);
        window.WonderPush.push(function() {
          clearTimeout(lastChanceTimer);
          console.log('[Push] SDK initialized via queue fallback');
          resolve();
        });
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

        // Set user ID via command queue
        window.WonderPush.push(['setUserId', user.id]);

        // Check subscription status
        const subscribed = await wpIsSubscribed();
        setIsSubscribed(subscribed);
        setPermission(Notification.permission);
        console.log('[Push] WonderPush synced, subscribed:', subscribed);

        // Auto-subscribe if not yet subscribed and permission not denied
        if (!subscribed && Notification.permission !== 'denied') {
          console.log('[Push] Auto-subscribing user...');
          window.WonderPush.push(['subscribeToNotifications']);
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
      console.log('[Push] WonderPush ready, setting userId and subscribing...');

      window.WonderPush.push(['setUserId', user.id]);
      window.WonderPush.push(['subscribeToNotifications']);

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
      window.WonderPush.push(['unsubscribeFromNotifications']);
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
