import { useEffect, useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ShieldOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SelfBlockToggleProps {
  departmentId: string;
}

export default function SelfBlockToggle({ departmentId }: SelfBlockToggleProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_my_blocked' as any, { dept_id: departmentId });
      if (!cancelled) {
        if (!error) setBlocked(!!data);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [departmentId]);

  const toggle = async () => {
    const next = !blocked;
    setSaving(true);
    try {
      const { error } = await supabase.rpc('set_my_blocked' as any, { dept_id: departmentId, blocked: next });
      if (error) throw error;
      setBlocked(next);
      toast({
        title: next ? 'Você está bloqueado para escalas' : 'Você voltou a ficar disponível',
        description: next
          ? 'O líder não conseguirá te escalar até você se desbloquear.'
          : 'Agora você pode ser escalado normalmente.',
      });
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast({ variant: 'destructive', title: 'Erro', description: err?.message || 'Não foi possível atualizar.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={cn(
      'flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors',
      blocked ? 'border-destructive/40 bg-destructive/5' : 'border-border bg-muted/30'
    )}>
      <div className="flex items-start gap-2 min-w-0">
        <ShieldOff className={cn('w-4 h-4 mt-0.5 flex-shrink-0', blocked ? 'text-destructive' : 'text-muted-foreground')} />
        <div className="min-w-0">
          <Label className="text-sm font-semibold text-foreground">Bloquear minhas escalas</Label>
          <p className="text-[11px] text-muted-foreground leading-tight">
            Enquanto ativado, você não pode ser escalado neste departamento.
          </p>
        </div>
      </div>
      {loading || saving ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Switch checked={blocked} onCheckedChange={toggle} />
      )}
    </div>
  );
}
