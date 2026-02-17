import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

declare global {
  interface Window {
    WonderPush?: any;
  }
}

function waitForWonderPush(): Promise<any> {
  return new Promise((resolve) => {
    window.WonderPush = window.WonderPush || [];
    window.WonderPush.push(['on', 'ready', () => {
      resolve(window.WonderPush);
    }]);
  });
}

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  // Check support
  useEffect(() => {
    const supported = 'serviceWorker' in navigator && 
                      'PushManager' in window && 
                      'Notification' in window;
    setIsSupported(supported);
    if (supported) {
      setPermission(Notification.permission);
    }
  }, []);

  // Re-check permission on tab focus
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

  // Set WonderPush userId when user logs in, and check subscription status
  useEffect(() => {
    if (!user || !isSupported) return;

    const syncWonderPush = async () => {
      try {
        const wp = await waitForWonderPush();

        // Set the user ID so backend can target by Supabase user ID
        await wp.setUserId(user.id);

        // Check if already subscribed
        const subscribed = await wp.isSubscribedToNotifications();
        setIsSubscribed(subscribed);
        setPermission(Notification.permission);
        console.log('[Push] WonderPush synced, subscribed:', subscribed);
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
      const wp = await waitForWonderPush();

      await wp.setUserId(user.id);
      await wp.subscribeToNotifications();

      const subscribed = await wp.isSubscribedToNotifications();
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
      const wp = await waitForWonderPush();
      await wp.unsubscribeFromNotifications();
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
