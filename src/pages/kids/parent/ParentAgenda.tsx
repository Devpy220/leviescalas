import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PillCard } from "@/components/portal-kids/PillCard";
import { useMyKids } from "@/hooks/useMyKids";
import { Calendar, Loader2 } from "lucide-react";

interface Event {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  location: string | null;
}

export default function ParentAgenda() {
  const { kids } = useMyKids();
  const pageId = kids[0]?.page_id;
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!pageId) { setLoading(false); return; }
    supabase.from("kids_events")
      .select("id, title, description, starts_at, location")
      .eq("page_id", pageId)
      .gte("starts_at", new Date().toISOString())
      .order("starts_at")
      .then(({ data }) => { setEvents((data || []) as Event[]); setLoading(false); });
  }, [pageId]);

  return (
    <div className="max-w-md mx-auto px-4 py-6 pb-24">
      <h1 className="pk-title text-2xl pk-heading-gradient mb-4">Agenda 📅</h1>
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : events.length === 0 ? (
        <PillCard className="text-center">
          <Calendar className="w-10 h-10 mx-auto opacity-60" />
          <p className="mt-2 text-sm">Nenhum evento programado ainda.</p>
        </PillCard>
      ) : (
        <div className="space-y-3">
          {events.map((e) => (
            <PillCard key={e.id} glow="purple">
              <p className="pk-title text-lg">{e.title}</p>
              <p className="text-xs opacity-70 mt-1">
                {new Date(e.event_at).toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short" })}
              </p>
              {e.location && <p className="text-xs mt-1">📍 {e.location}</p>}
              {e.description && <p className="text-sm mt-2 opacity-90">{e.description}</p>}
            </PillCard>
          ))}
        </div>
      )}
    </div>
  );
}
