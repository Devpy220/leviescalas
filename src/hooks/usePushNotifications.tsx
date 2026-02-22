import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

declare global {
  interface Window {
    PushAlertCo?: any;
    pushalertbyiabor498?: any;
  }
}

function isPushAlertReady(): boolean {
  return !!(window.PushAlertCo && typeof window.PushAlertCo.getSubsInfo === 'function');
}

function pushAlertReady(timeoutMs = 20000): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log('[Push] Waiting for PushAlert SDK...');

    if (isPushAlertReady()) {
      console.log('[Push] SDK already initialized');
      resolve();
      return;
    }

    const startTime = Date.now();
    const interval = setInterval(() => {
      if (isPushAlertReady()) {
        clearInterval(interval);
        console.log('[Push] SDK ready after', Date.now() - startTime, 'ms');
        resolve();
        return;
      }

      if (Date.now() - startTime > timeoutMs) {
        clearInterval(interval);
        const scriptEl = document.querySelector('script[src*="pushalert"]');
        console.error('[Push] SDK timeout.', { scriptLoaded: !!scriptEl });
        reject(new Error(scriptEl
          ? 'PushAlert SDK não inicializou. O domínio pode não estar autorizado.'
          : 'Script do PushAlert não carregou. Verifique sua conexão.'));
      }
    }, 500);
  });
}

function getSubscriberId(): string | null {
  try {
    if (window.PushAlertCo && window.PushAlertCo.subs_id) {
      return window.PushAlertCo.subs_id;
    }
    return null;
  } catch {
    return null;
  }
}

async function getSubsInfo(): Promise<{ status: string; subs_id: string } | null> {
  return new Promise((resolve) => {
    try {
      if (window.PushAlertCo && typeof window.PushAlertCo.getSubsInfo === 'function') {
        window.PushAlertCo.getSubsInfo(function (status: string, subsId: string) {
          resolve({ status, subs_id: subsId });
        });
      } else {
        resolve(null);
      }
    } catch {
      resolve(null);
    }
  });
}

const PUSH_SUBSCRIBED_KEY = 'levi_push_subscribed';

async function saveSubscriberMapping(userId: string, subscriberId: string) {
  try {
    const { error } = await supabase
      .from('pushalert_subscribers')
      .upsert(
        { user_id: userId, subscriber_id: subscriberId, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );
    if (error) console.error('[Push] Error saving subscriber mapping:', error);
    else console.log('[Push] Subscriber mapping saved');
  } catch (e) {
    console.error('[Push] Error saving subscriber mapping:', e);
  }
}

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

  // Sync PushAlert subscriber ID on login
  useEffect(() => {
    if (!user || !isSupported) return;

    const syncPushAlert = async () => {
      try {
        await pushAlertReady();
        const info = await getSubsInfo();
        console.log('[Push] PushAlert info:', info);

        if (info && info.status === 'subscribed' && info.subs_id) {
          setIsSubscribedPersisted(true);
          setPermission('granted');
          await saveSubscriberMapping(user.id, info.subs_id);
        } else {
          // Check if permission was already granted and auto-subscribe
          if (Notification.permission === 'granted') {
            console.log('[Push] Permission already granted, triggering subscribe...');
            if (typeof window.PushAlertCo?.forceSubscribe === 'function') {
              window.PushAlertCo.forceSubscribe();
            }
            // Poll for subscriber ID
            setTimeout(async () => {
              const subsId = getSubscriberId();
              if (subsId) {
                setIsSubscribedPersisted(true);
                await saveSubscriberMapping(user.id, subsId);
              }
            }, 3000);
          } else {
            setIsSubscribedPersisted(false);
          }
        }
      } catch (error) {
        console.error('[Push] Error syncing PushAlert:', error);
      }
    };

    syncPushAlert();
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
      // Step 1: Request permission
      let currentPermission = Notification.permission;
      if (currentPermission === 'default') {
        currentPermission = await Notification.requestPermission();
        setPermission(currentPermission);
      }

      if (currentPermission === 'denied') {
        toast.error('Permissão para notificações foi negada. Verifique as configurações do navegador.');
        return false;
      }

      // Step 2: Activate toggle immediately
      setIsSubscribedPersisted(true);
      setPermission('granted');
      toast.success('Notificações ativadas com sucesso!');

      // Step 3: Sync with PushAlert in background
      (async () => {
        try {
          await pushAlertReady(20000);

          if (typeof window.PushAlertCo?.forceSubscribe === 'function') {
            window.PushAlertCo.forceSubscribe();
          }

          // Poll for subscriber ID
          const delays = [1000, 2000, 4000, 8000];
          for (const delay of delays) {
            await new Promise(r => setTimeout(r, delay));
            const subsId = getSubscriberId();
            if (subsId) {
              await saveSubscriberMapping(user.id, subsId);
              console.log('[Push] Subscriber mapped:', subsId);
              break;
            }
          }
        } catch (bgError) {
          console.warn('[Push] Background PushAlert sync failed:', bgError);
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
      await pushAlertReady();
      if (typeof window.PushAlertCo?.unsubscribe === 'function') {
        window.PushAlertCo.unsubscribe();
      }
      setIsSubscribedPersisted(false);

      // Remove mapping from DB
      await supabase
        .from('pushalert_subscribers')
        .delete()
        .eq('user_id', user.id);

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
