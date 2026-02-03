import { Bell, BellOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { cn } from '@/lib/utils';

interface PushNotificationToggleProps {
  variant?: 'button' | 'switch';
  className?: string;
}

export function PushNotificationToggle({ variant = 'switch', className }: PushNotificationToggleProps) {
  const { isSupported, isSubscribed, permission, loading, subscribe, unsubscribe } = usePushNotifications();

  if (!isSupported) {
    return (
      <div className={cn("text-sm text-muted-foreground", className)}>
        <BellOff className="h-4 w-4 inline mr-2" />
        Notificações não suportadas neste navegador
      </div>
    );
  }

  if (variant === 'button') {
    return (
      <Button
        variant={isSubscribed ? "outline" : "default"}
        size="sm"
        onClick={isSubscribed ? unsubscribe : subscribe}
        disabled={loading}
        className={className}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : isSubscribed ? (
          <Bell className="h-4 w-4 mr-2" />
        ) : (
          <BellOff className="h-4 w-4 mr-2" />
        )}
        {isSubscribed ? 'Notificações ativas' : 'Ativar notificações'}
      </Button>
    );
  }

  return (
    <div className={cn("flex items-center justify-between gap-4", className)}>
      <div className="flex items-center gap-2">
        {isSubscribed ? (
          <Bell className="h-4 w-4 text-primary" />
        ) : (
          <BellOff className="h-4 w-4 text-muted-foreground" />
        )}
        <Label htmlFor="push-notifications" className="cursor-pointer">
          Notificações push
        </Label>
      </div>
      <div className="flex items-center gap-2">
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        <Switch
          id="push-notifications"
          checked={isSubscribed}
          onCheckedChange={(checked) => checked ? subscribe() : unsubscribe()}
          disabled={loading || permission === 'denied'}
        />
      </div>
      {permission === 'denied' && (
        <p className="text-xs text-destructive mt-1">
          Permissão bloqueada. Altere nas configurações do navegador.
        </p>
      )}
    </div>
  );
}
