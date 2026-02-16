import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

declare global {
  interface Window {
    WonderPush?: any[];
  }
}

function getWonderPushInstance(): any | null {
  if (typeof window === 'undefined') return null;
  return (window as any).WonderPushSDK || null;
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
        // Wait for WonderPush SDK to be ready
        await new Promise<void>((resolve) => {
          window.WonderPush = window.WonderPush || [];
          window.WonderPush.push(['on', 'ready', () => resolve()]);
        });

        const wp = getWonderPushInstance();
        if (!wp) return;

        // Set the user ID so backend can target by Supabase user ID
        await wp.setUserId(user.id);

        // Check if already subscribed
        const subscribed = await wp.isSubscribedToNotifications();
        setIsSubscribed(subscribed);
        setPermission(Notification.permission);
      } catch (error) {
        console.error('Error syncing WonderPush:', error);
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
      window.WonderPush = window.WonderPush || [];

      // Wait for ready
      await new Promise<void>((resolve) => {
        window.WonderPush!.push(['on', 'ready', () => resolve()]);
      });

      const wp = getWonderPushInstance();
      if (!wp) throw new Error('WonderPush SDK not available');

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
      console.error('Error subscribing to push:', error);
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
      const wp = getWonderPushInstance();
      if (wp) {
        await wp.unsubscribeFromNotifications();
      }
      setIsSubscribed(false);
      toast.success('Notificações desativadas');
      return true;
    } catch (error: any) {
      console.error('Error unsubscribing:', error);
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
