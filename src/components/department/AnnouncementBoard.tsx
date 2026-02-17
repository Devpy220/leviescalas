import { useState, useEffect, useCallback } from 'react';
import { Pin, Plus, Pencil, Trash2, Megaphone, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import CreateAnnouncementDialog from './CreateAnnouncementDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Announcement {
  id: string;
  department_id: string;
  author_id: string;
  title: string;
  content: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
  author_name?: string;
  is_read?: boolean;
}

interface AnnouncementBoardProps {
  departmentId: string;
  isLeader: boolean;
  currentUserId: string;
  onUnreadCountChange?: (count: number) => void;
}

export default function AnnouncementBoard({
  departmentId,
  isLeader,
  currentUserId,
  onUnreadCountChange,
}: AnnouncementBoardProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchAnnouncements = useCallback(async () => {
    try {
      // Fetch announcements
      const { data: announcementsData, error } = await supabase
        .from('department_announcements' as any)
        .select('*')
        .eq('department_id', departmentId)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch read status
      const { data: reads } = await supabase
        .from('announcement_reads' as any)
        .select('announcement_id')
        .eq('user_id', currentUserId);

      const readIds = new Set((reads || []).map((r: any) => r.announcement_id));

      // Fetch author names
      const authorIds = [...new Set((announcementsData || []).map((a: any) => a.author_id))];
      const authorNames = new Map<string, string>();
      
      for (const authorId of authorIds) {
        const { data: profile } = await supabase.rpc('get_member_profile', { member_user_id: authorId });
        if (profile && profile.length > 0) {
          authorNames.set(authorId, profile[0].name);
        }
      }

      const enriched = (announcementsData || []).map((a: any) => ({
        ...a,
        author_name: authorNames.get(a.author_id) || 'Líder',
        is_read: readIds.has(a.id),
      }));

      setAnnouncements(enriched);

      const unreadCount = enriched.filter((a: Announcement) => !a.is_read).length;
      onUnreadCountChange?.(unreadCount);

      // Mark all as read
      const unreadIds = enriched.filter((a: Announcement) => !a.is_read).map((a: Announcement) => a.id);
      if (unreadIds.length > 0) {
        const inserts = unreadIds.map((announcement_id: string) => ({
          announcement_id,
          user_id: currentUserId,
        }));
        await supabase.from('announcement_reads' as any).insert(inserts as any);
        // Update local state
        setAnnouncements(prev => prev.map(a => ({ ...a, is_read: true })));
        onUnreadCountChange?.(0);
      }
    } catch (error) {
      console.error('Error fetching announcements:', error);
    } finally {
      setLoading(false);
    }
  }, [departmentId, currentUserId, onUnreadCountChange]);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      const { error } = await supabase
        .from('department_announcements' as any)
        .delete()
        .eq('id', deletingId);
      if (error) throw error;
      toast({ title: 'Aviso excluído' });
      setDeletingId(null);
      fetchAnnouncements();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro ao excluir', description: error.message });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-primary" />
          Mural de Avisos
        </h3>
        {isLeader && (
          <Button size="sm" onClick={() => { setEditingAnnouncement(null); setShowCreate(true); }}>
            <Plus className="w-4 h-4 mr-1" />
            Novo Aviso
          </Button>
        )}
      </div>

      {announcements.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Megaphone className="w-10 h-10 text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground font-medium">Nenhum aviso publicado</p>
            <p className="text-sm text-muted-foreground/70">
              {isLeader ? 'Publique avisos para o seu grupo.' : 'O líder ainda não publicou avisos.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {announcements.map((announcement) => (
            <Card 
              key={announcement.id} 
              className={announcement.is_pinned ? 'border-primary/30 bg-primary/5' : ''}
            >
              <CardHeader className="pb-2 pt-4 px-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {announcement.is_pinned && (
                      <Pin className="w-4 h-4 text-primary shrink-0" />
                    )}
                    <CardTitle className="text-base truncate">{announcement.title}</CardTitle>
                  </div>
                  {isLeader && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => { setEditingAnnouncement(announcement); setShowCreate(true); }}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => setDeletingId(announcement.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-sm text-foreground/90 whitespace-pre-wrap">{announcement.content}</p>
                <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                  <span>{announcement.author_name}</span>
                  <span>•</span>
                  <span>
                    {formatDistanceToNow(new Date(announcement.created_at), { addSuffix: true, locale: ptBR })}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateAnnouncementDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        departmentId={departmentId}
        editingAnnouncement={editingAnnouncement}
        onSuccess={fetchAnnouncements}
      />

      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir aviso?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O aviso será removido para todos os membros.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
