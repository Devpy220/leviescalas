import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CalendarSync, Copy, Check, Download, RefreshCw, Loader2, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CalendarSyncDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CalendarSyncDialog({ open, onOpenChange }: CalendarSyncDialogProps) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const fetchOrCreateToken = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Try to get existing token
      const { data: existing } = await supabase
        .from('calendar_sync_tokens' as any)
        .select('token')
        .eq('user_id', user.id)
        .single();

      if (existing) {
        setToken((existing as any).token);
      } else {
        // Create new token
        const { data: newToken, error } = await supabase
          .from('calendar_sync_tokens' as any)
          .insert({ user_id: user.id } as any)
          .select('token')
          .single();

        if (error) throw error;
        setToken((newToken as any).token);
      }
    } catch (error: any) {
      console.error('Error getting calendar token:', error);
      toast({ variant: 'destructive', title: 'Erro ao gerar link', description: error.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) fetchOrCreateToken();
  }, [open]);

  const regenerateToken = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Delete old and create new
      await supabase.from('calendar_sync_tokens' as any).delete().eq('user_id', user.id);
      const { data: newToken, error } = await supabase
        .from('calendar_sync_tokens' as any)
        .insert({ user_id: user.id } as any)
        .select('token')
        .single();

      if (error) throw error;
      setToken((newToken as any).token);
      toast({ title: 'Link regenerado!', description: 'O link anterior foi invalidado.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const calendarUrl = token
    ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/calendar-sync?token=${token}`
    : '';

  const googleCalUrl = token
    ? `https://calendar.google.com/calendar/r?cid=webcal://${calendarUrl.replace('https://', '')}`
    : '';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(calendarUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: 'Link copiado!' });
  };

  const handleDownload = () => {
    if (calendarUrl) {
      window.open(calendarUrl, '_blank');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarSync className="w-5 h-5 text-primary" />
            Sincronizar Calendário
          </DialogTitle>
          <DialogDescription>
            Sincronize suas escalas com Google Calendar ou Apple Calendar.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-5 py-2">
            {/* Subscription URL */}
            <div className="space-y-2">
              <Label>Link de assinatura</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={calendarUrl}
                  className="text-xs font-mono"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <Button variant="outline" size="icon" onClick={handleCopy} className="shrink-0">
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Cole este link no seu app de calendário para sincronizar automaticamente.
              </p>
            </div>

            {/* Quick actions */}
            <div className="grid grid-cols-1 gap-2">
              <Button variant="outline" className="justify-start gap-2" asChild>
                <a href={googleCalUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4" />
                  Adicionar ao Google Calendar
                </a>
              </Button>
              <Button variant="outline" className="justify-start gap-2" onClick={handleDownload}>
                <Download className="w-4 h-4" />
                Baixar arquivo .ics (Apple Calendar)
              </Button>
            </div>

            {/* Regenerate */}
            <div className="border-t border-border pt-4">
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground gap-1" onClick={regenerateToken}>
                <RefreshCw className="w-3 h-3" />
                Regenerar link (invalida o anterior)
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
