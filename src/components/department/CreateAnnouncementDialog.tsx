import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Pin, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CreateAnnouncementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departmentId: string;
  departmentName?: string;
  editingAnnouncement?: { id: string; title: string; content: string; is_pinned: boolean } | null;
  onSuccess: () => void;
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  is_pinned: boolean;
}

interface CreateAnnouncementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departmentId: string;
  editingAnnouncement?: Announcement | null;
  onSuccess: () => void;
}

export default function CreateAnnouncementDialog({
  open,
  onOpenChange,
  departmentId,
  departmentName,
  editingAnnouncement,
  onSuccess,
}: CreateAnnouncementDialogProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (editingAnnouncement) {
      setTitle(editingAnnouncement.title);
      setContent(editingAnnouncement.content);
      setIsPinned(editingAnnouncement.is_pinned);
    } else {
      setTitle('');
      setContent('');
      setIsPinned(false);
    }
  }, [editingAnnouncement, open]);

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) {
      toast({ variant: 'destructive', title: 'Preencha todos os campos' });
      return;
    }

    setSaving(true);
    try {
      if (editingAnnouncement) {
        const { error } = await supabase
          .from('department_announcements' as any)
          .update({ title: title.trim(), content: content.trim(), is_pinned: isPinned } as any)
          .eq('id', editingAnnouncement.id);
        if (error) throw error;
        toast({ title: 'Aviso atualizado!' });
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const { error } = await supabase
          .from('department_announcements' as any)
          .insert({
            department_id: departmentId,
            author_id: user.id,
            title: title.trim(),
            content: content.trim(),
            is_pinned: isPinned,
          } as any);
        if (error) throw error;
        toast({ title: 'Aviso publicado!' });

        // Send push + in-app notifications to members
        if (departmentName) {
          supabase.functions.invoke('send-announcement-notification', {
            body: {
              department_id: departmentId,
              department_name: departmentName,
              announcement_title: title.trim(),
            },
          }).catch((err) => console.error('Notification error:', err));
        }
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error saving announcement:', error);
      toast({ variant: 'destructive', title: 'Erro ao salvar aviso', description: error.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editingAnnouncement ? 'Editar Aviso' : 'Novo Aviso'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="announcement-title">Título</Label>
            <Input
              id="announcement-title"
              placeholder="Título do aviso"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="announcement-content">Mensagem</Label>
            <Textarea
              id="announcement-content"
              placeholder="Escreva o aviso para o grupo..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
              maxLength={2000}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div className="flex items-center gap-2">
              <Pin className="w-4 h-4 text-muted-foreground" />
              <Label htmlFor="pin-toggle" className="cursor-pointer">Fixar no topo</Label>
            </div>
            <Switch id="pin-toggle" checked={isPinned} onCheckedChange={setIsPinned} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving || !title.trim() || !content.trim()}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {editingAnnouncement ? 'Salvar' : 'Publicar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
