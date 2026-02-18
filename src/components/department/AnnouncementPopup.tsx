import { useState, useEffect, useCallback, useRef } from 'react';
import { Megaphone, X, Pin } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Announcement {
  id: string;
  title: string;
  content: string;
  author_id: string;
  is_pinned: boolean;
  created_at: string;
  author_name?: string;
}

interface AnnouncementPopupProps {
  departmentId: string;
  currentUserId: string;
}

const THREE_HOURS_MS = 3 * 60 * 60 * 1000;
const POPUP_DURATION_MS = 15_000;
const POPUP_INTERVAL_MS = 50; // update progress every 50ms

function getPopupKey(announcementId: string) {
  return `levi_popup_seen_${announcementId}`;
}

function shouldShowPopup(announcementId: string, createdAt: string): boolean {
  const now = Date.now();
  const createdTime = new Date(createdAt).getTime();

  // Only show popups for announcements created within the last 3 hours
  if (now - createdTime > THREE_HOURS_MS) return false;

  const stored = localStorage.getItem(getPopupKey(announcementId));
  if (!stored) return true; // Never seen

  const firstSeen = new Date(stored).getTime();
  // Still within 3h window from first seen
  return now - firstSeen < THREE_HOURS_MS;
}

function markAsSeen(announcementId: string) {
  const key = getPopupKey(announcementId);
  if (!localStorage.getItem(key)) {
    localStorage.setItem(key, new Date().toISOString());
  }
}

export default function AnnouncementPopup({ departmentId, currentUserId }: AnnouncementPopupProps) {
  const [pendingAnnouncements, setPendingAnnouncements] = useState<Announcement[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState(100);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  const fetchPendingAnnouncements = useCallback(async () => {
    try {
      const threeHoursAgo = new Date(Date.now() - THREE_HOURS_MS).toISOString();

      const { data, error } = await supabase
        .from('department_announcements' as any)
        .select('*')
        .eq('department_id', departmentId)
        .gte('created_at', threeHoursAgo)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch author names
      const authorIds = [...new Set((data || []).map((a: any) => a.author_id))];
      const authorNames = new Map<string, string>();
      for (const authorId of authorIds) {
        const { data: profile } = await supabase.rpc('get_member_profile', { member_user_id: authorId });
        if (profile && profile.length > 0) {
          authorNames.set(authorId, profile[0].name);
        }
      }

      const filtered = (data || [])
        .filter((a: any) => shouldShowPopup(a.id, a.created_at))
        .map((a: any) => ({
          ...a,
          author_name: authorNames.get(a.author_id) || 'Líder',
        }));

      if (filtered.length > 0) {
        setPendingAnnouncements(filtered);
        setCurrentIndex(0);
        setOpen(true);
      }
    } catch (error) {
      console.error('Error fetching popup announcements:', error);
    }
  }, [departmentId]);

  useEffect(() => {
    fetchPendingAnnouncements();
  }, [fetchPendingAnnouncements]);

  // Timer logic
  useEffect(() => {
    if (!open) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    startTimeRef.current = Date.now();
    setProgress(100);

    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const remaining = Math.max(0, 100 - (elapsed / POPUP_DURATION_MS) * 100);
      setProgress(remaining);

      if (remaining <= 0) {
        handleClose();
      }
    }, POPUP_INTERVAL_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [open, currentIndex]);

  const handleClose = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    const current = pendingAnnouncements[currentIndex];
    if (current) markAsSeen(current.id);

    if (currentIndex < pendingAnnouncements.length - 1) {
      setCurrentIndex(prev => prev + 1);
      // Timer will restart via useEffect
    } else {
      setOpen(false);
    }
  }, [currentIndex, pendingAnnouncements]);

  if (!open || pendingAnnouncements.length === 0) return null;

  const announcement = pendingAnnouncements[currentIndex];
  const hasMultiple = pendingAnnouncements.length > 1;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent
        className="max-w-md animate-in zoom-in-95 announcement-popup-glow"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-primary" />
            <DialogTitle className="text-base flex items-center gap-2">
              {announcement.is_pinned && <Pin className="w-4 h-4 text-primary" />}
              {announcement.title}
            </DialogTitle>
          </div>
          {hasMultiple && (
            <p className="text-xs text-muted-foreground mt-1">
              Aviso {currentIndex + 1} de {pendingAnnouncements.length}
            </p>
          )}
        </DialogHeader>

        <DialogDescription className="sr-only">
          Aviso do departamento
        </DialogDescription>

        <div className="space-y-3">
          <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
            {announcement.content}
          </p>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{announcement.author_name}</span>
            <span>•</span>
            <span>
              {formatDistanceToNow(new Date(announcement.created_at), {
                addSuffix: true,
                locale: ptBR,
              })}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <Progress value={progress} className="h-1 mt-2" />

        {hasMultiple && (
          <div className="flex justify-end mt-1">
            <Button size="sm" variant="ghost" onClick={handleClose}>
              Próximo →
            </Button>
          </div>
        )}
      </DialogContent>

      <style>{`
        .announcement-popup-glow {
          box-shadow: 0 0 0 2px hsl(var(--primary) / 0.4), 0 0 20px 4px hsl(var(--primary) / 0.15);
          backdrop-filter: blur(8px);
        }
      `}</style>
    </Dialog>
  );
}
