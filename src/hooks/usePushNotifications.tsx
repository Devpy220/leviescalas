import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

declare global {
  interface Window {
    WonderPush?: any;
  }
}

function wonderPushReady(): Promise<void> {
  return new Promise((resolve) => {
    window.WonderPush = window.WonderPush || [];
    window.WonderPush.push(function() {
      resolve();
    });
  });
}

async function wpIsSubscribed(): Promise<boolean> {
  return new Promise((resolve) => {
    window.WonderPush.push(function() {
      window.WonderPush.isSubscribedToNotifications()
        .then((val: boolean) => resolve(val))
        .catch(() => resolve(false));
    });
  });
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
      setPermission(Notification.permission);
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
      await wonderPushReady();

      window.WonderPush.push(['setUserId', user.id]);
      window.WonderPush.push(['subscribeToNotifications']);

      // Wait for subscription to process
      await new Promise(resolve => setTimeout(resolve, 2000));

      const subscribed = await wpIsSubscribed();
      setIsSubscribed(subscribed);
      setPermission(Notification.permission);

      if (subscribed) {
        toast.success('Notificações ativadas com sucesso!');
        return true;
      } else {
        toast.error('Permissão para notificações foi negada');
        return false;
      }
    } catch (error: any) {
      console.error('[Push] Error subscribing:', error);
      toast.error('Erro ao ativar notificações: ' + error.message);
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
