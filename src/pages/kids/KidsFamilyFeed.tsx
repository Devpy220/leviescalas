import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMyKidsPage } from "@/hooks/useKidsPage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { Loader2, MessageCircle, Send, Trash2, Plus } from "lucide-react";
import { Link } from "react-router-dom";

interface Msg {
  id: string; page_id: string; room_id: string | null; sender_id: string; sender_role: "leader"|"teacher";
  title: string; body: string; media_url: string | null; notify_whatsapp: boolean; created_at: string;
}
interface Room { id: string; name: string; page_id: string; }

export default function KidsFamilyFeed() {
  const { user } = useAuth();
  const { role } = useMyKidsPage();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ title: "", body: "", room_id: "", media_url: "", notify_whatsapp: false });
  const [busy, setBusy] = useState(false);

  const canPost = role === "leader" || role === "teacher";

  useEffect(() => { if (user) { load(); loadRooms(); } /* eslint-disable-next-line */ }, [user]);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("kids_messages" as any)
      .select("*").order("created_at", { ascending: false }).limit(100);
    setMsgs((data || []) as any);
    setLoading(false);
  }

  async function loadRooms() {
    if (role === "leader") {
      const { data } = await supabase.from("kids_pages").select("id, kids_rooms(id, name, page_id)");
      const rs: Room[] = [];
      (data || []).forEach((p: any) => (p.kids_rooms || []).forEach((r: any) => rs.push(r)));
      setRooms(rs);
    } else if (role === "teacher") {
      const { data } = await supabase.from("kids_teacher_rooms").select("kids_rooms(id, name, page_id)").eq("user_id", user!.id);
      setRooms(((data || []).map((r: any) => r.kids_rooms).filter(Boolean)) as any);
    }
  }

  async function send() {
    if (!form.title.trim() || !form.body.trim() || !user) return;
    setBusy(true);
    let page_id: string | null = null;
    let room_id: string | null = form.room_id || null;
    if (room_id) {
      const r = rooms.find(x => x.id === room_id);
      page_id = r?.page_id || null;
    } else if (role === "leader") {
      // broadcast: pega page_id do primeiro room
      page_id = rooms[0]?.page_id || null;
    }
    if (!page_id) { setBusy(false); toast({ title: "Página não identificada", variant: "destructive" }); return; }

    const payload = {
      page_id, room_id: role === "teacher" ? room_id : (form.room_id || null),
      sender_id: user.id, sender_role: role,
      title: form.title.trim(), body: form.body.trim(),
      media_url: form.media_url.trim() || null,
      notify_whatsapp: form.notify_whatsapp,
    };
    const { error } = await (supabase.from as any)("kids_messages").insert(payload);
    setBusy(false);
    if (error) { toast({ title: "Erro ao enviar", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Mensagem enviada" });
    setShowNew(false); setForm({ title:"", body:"", room_id:"", media_url:"", notify_whatsapp:false });
    load();
  }

  async function del(id: string) {
    if (!confirm("Excluir esta mensagem?")) return;
    await (supabase.from as any)("kids_messages").delete().eq("id", id);
    load();
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-amber-50 p-4">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><MessageCircle className="w-6 h-6 text-violet-600"/> Mensagens <LeviKidsWordmark /></h1>
            <p className="text-sm text-slate-600">Comunicação da equipe kids com as famílias.</p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" className="rounded-xl"><Link to="/kids">← Kids</Link></Button>
            {canPost && <Button onClick={()=>setShowNew(true)} className="rounded-xl"><Plus className="w-4 h-4 mr-1"/>Nova mensagem</Button>}
          </div>
        </div>

        {loading ? <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto"/></div> :
         msgs.length === 0 ? (
          <Card className="rounded-3xl"><CardContent className="p-8 text-center text-slate-600">Nenhuma mensagem ainda.</CardContent></Card>
        ) : msgs.map(m => (
          <Card key={m.id} className="rounded-2xl border-2">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">{m.title}</CardTitle>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">{m.sender_role === "leader" ? "Líder" : "Professor"}</Badge>
                    {m.room_id ? <Badge variant="secondary" className="text-[10px]">Sala</Badge> : <Badge className="text-[10px] bg-violet-100 text-violet-700 border-violet-200">Página inteira</Badge>}
                    <span className="text-[10px] text-slate-500">{new Date(m.created_at).toLocaleString("pt-BR")}</span>
                  </div>
                </div>
                {canPost && m.sender_id === user?.id && (
                  <Button size="sm" variant="ghost" onClick={()=>del(m.id)}><Trash2 className="w-4 h-4 text-red-500"/></Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{m.body}</p>
              {m.media_url && <a href={m.media_url} target="_blank" rel="noreferrer" className="text-xs text-violet-600 underline block mt-2 break-all">📎 {m.media_url}</a>}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova mensagem</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Título</Label><Input value={form.title} onChange={e=>setForm({...form, title:e.target.value})} /></div>
            <div><Label>Mensagem</Label><Textarea rows={5} value={form.body} onChange={e=>setForm({...form, body:e.target.value})} /></div>
            <div>
              <Label>{role === "leader" ? "Sala (opcional — vazio = página inteira)" : "Sala"}</Label>
              <select className="w-full border rounded-md h-10 px-3 bg-background" value={form.room_id} onChange={e=>setForm({...form, room_id:e.target.value})}>
                {role === "leader" && <option value="">— Enviar para a página inteira —</option>}
                {rooms.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div><Label>Link de mídia (opcional — vídeo, PDF, imagem)</Label><Input value={form.media_url} onChange={e=>setForm({...form, media_url:e.target.value})} placeholder="https://…" /></div>
            {role === "leader" && (
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={form.notify_whatsapp} onCheckedChange={v=>setForm({...form, notify_whatsapp: !!v})} />
                <span className="text-sm">Notificar responsáveis por WhatsApp</span>
              </label>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setShowNew(false)}>Cancelar</Button>
            <Button onClick={send} disabled={busy || !form.title.trim() || !form.body.trim()}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin"/> : <><Send className="w-4 h-4 mr-1"/>Enviar</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
