import { useTranslation } from "react-i18next";
import { useEffect, useState } from 'react';
import { Megaphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';

type Notice = { id: string; message: string };

export function LeviChangeNotice({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.from('notifications')
      .select('id, message')
      .eq('user_id', userId)
      .eq('type', 'admin_broadcast')
      .is('read_at', null)
      .order('created_at', { ascending: true })
      .limit(20)
      .then(({ data, error }) => {
        if (error) console.error('Unable to load LEVI notices:', error);
        if (active && data) setNotices(data);
      });
    return () => { active = false; };
  }, [userId]);

  const current = notices[0];
  const acknowledge = async () => {
    if (!current || saving) return;
    setSaving(true);
    const { error } = await supabase.from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', current.id).eq('user_id', userId);
    if (error) console.error('Unable to acknowledge LEVI notice:', error);
    else setNotices((items) => items.slice(1));
    setSaving(false);
  };

  return (
    <Dialog open={Boolean(current)}>
      <DialogContent className="max-w-md" onEscapeKeyDown={(event) => event.preventDefault()} onPointerDownOutside={(event) => event.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Megaphone className="h-5 w-5 text-primary" />{t("interface.noticeTitle")}</DialogTitle>
          <DialogDescription className="whitespace-pre-wrap text-left text-foreground pt-3">{current?.message}</DialogDescription>
        </DialogHeader>
        <DialogFooter><Button onClick={acknowledge} disabled={saving}>{t("interface.understood")}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}