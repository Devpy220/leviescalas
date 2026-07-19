import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface DailyVerse {
  id: string;
  reference: string;
  text_simple: string;
  illustration_url: string | null;
  audio_url: string | null;
  family_devotional_text: string | null;
  age_track: string;
}

function pickForToday<T>(items: T[]): T | null {
  if (items.length === 0) return null;
  const day = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
  return items[day % items.length];
}

export function useDailyVerse(pageId?: string | null, ageTrack?: string) {
  const [verse, setVerse] = useState<DailyVerse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      let q = supabase
        .from("kids_verses")
        .select("id, reference, text_simple, illustration_url, audio_url, family_devotional_text, age_track")
        .eq("is_published", true);
      if (pageId) q = q.or(`page_id.eq.${pageId},is_global.eq.true`);
      else q = q.eq("is_global", true);
      if (ageTrack) q = q.eq("age_track", ageTrack as any);
      const { data } = await q;
      if (cancelled) return;
      setVerse(pickForToday((data || []) as DailyVerse[]));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [pageId, ageTrack]);

  return { verse, loading };
}
