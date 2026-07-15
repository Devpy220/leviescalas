import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Loader2, AlertTriangle, PhoneCall, KeyRound, Eye, EyeOff, QrCode, RefreshCw, BookOpen } from "lucide-react";
import { qrToDataUrl, KIDS_CHECKIN_BASE } from "@/lib/kidsQr";
import { getKidsPhotoUrl } from "@/lib/kidsStorage";

interface Room { id: string; name: string; color: string; page_id: string; }
interface ActiveChild {
  checkin_id: string; child_id: string; room_id: string; pickup_code: string; checkin_at: string;
  full_name: string; birth_date: string; allergies: string | null; restrictions: string | null; photo_path: string | null;
}

export default function KidsDashboard() {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [items, setItems] = useState<ActiveChild[]>([]);
  const [reveal, setReveal] = useState<Set<string>>(new Set());
  const [dynQr, setDynQr] = useState<{ url: string; expiresAt: number } | null>(null);
  const [checkoutFor, setCheckoutFor] = useState<ActiveChild | null>(null);
  const [checkoutCode, setCheckoutCode] = useState("");
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const timerRef = useRef<number | null>(null);

  useEffect(() => { if (user) loadRooms(); }, [user]);

  async function loadRooms() {
    if (!user) return;
    const { data } = await supabase.from("kids_teacher_rooms").select("kids_rooms(id, name, color, page_id)").eq("user_id", user.id);
    const rs = (data || []).map((r: any) => r.kids_rooms).filter(Boolean);
    setRooms(rs);
    if (rs[0]) setCurrentRoom(rs[0]);
  }

  useEffect(() => {
    if (!currentRoom) return;
    loadActive();
    const ch = supabase.channel(`kids-room-${currentRoom.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "kids_checkins", filter: `room_id=eq.${currentRoom.id}` },
        () => loadActive())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [currentRoom]);

  async function loadActive() {
    if (!currentRoom) return;
    const { data } = await supabase.from("kids_checkins")
      .select("id, child_id, room_id, pickup_code, checkin_at, kids_children(full_name, birth_date, allergies, restrictions, photo_path)")
      .eq("room_id", currentRoom.id)
      .is("checkout_at", null)
      .order("checkin_at");
    const mapped = (data || []).map((r: any) => ({
      checkin_id: r.id, child_id: r.child_id, room_id: r.room_id, pickup_code: r.pickup_code, checkin_at: r.checkin_at,
      full_name: r.kids_children?.full_name, birth_date: r.kids_children?.birth_date,
      allergies: r.kids_children?.allergies, restrictions: r.kids_children?.restrictions,
      photo_path: r.kids_children?.photo_path,
    }));
    setItems(mapped);
    // load photos
    for (const it of mapped) {
      if (it.photo_path && !photos[it.child_id]) {
        const u = await getKidsPhotoUrl(it.photo_path);
        if (u) setPhotos(p => ({ ...p, [it.child_id]: u }));
      }
    }
  }

  async function rotateQr() {
    if (!currentRoom) return;
    const { data, error } = await supabase.rpc("kids_get_or_create_dyn_token", { _room_id: currentRoom.id });
    if (error || !data?.[0]) { toast({ title: "Erro no token", description: error?.message, variant: "destructive" }); return; }
    const url = `${KIDS_CHECKIN_BASE}?t=${data[0].token}`;
    // Use raw token so scanner reads only token
    const qr = await qrToDataUrl(data[0].token, 400);
    setDynQr({ url: qr, expiresAt: new Date(data[0].expires_at).getTime() });
  }

  // Auto-rotate every 55s
  useEffect(() => {
    if (!currentRoom || !dynQr) return;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    const ms = Math.max(1000, dynQr.expiresAt - Date.now() - 3000);
    timerRef.current = window.setTimeout(rotateQr, ms);
    return () => { if (timerRef.current) window.clearTimeout(timerRef.current); };
  }, [dynQr, currentRoom]);

  async function performCheckout() {
    if (!checkoutFor || !checkoutCode) return;
    const { error } = await supabase.rpc("kids_perform_checkout", {
      _checkin_id: checkoutFor.checkin_id, _pickup_code: checkoutCode
    });
    if (error) { toast({ title: "Código inválido", description: error.message, variant: "destructive" }); return; }
    supabase.functions.invoke("kids-notify-whatsapp", {
      body: { event: "checkout", child_id: checkoutFor.child_id, room_id: checkoutFor.room_id }
    }).catch(() => {});
    toast({ title: "Retirada confirmada" });
    setCheckoutFor(null); setCheckoutCode("");
    loadActive();
  }

  async function callGuardian(it: ActiveChild) {
    const { error } = await supabase.functions.invoke("kids-notify-whatsapp", {
      body: { event: "teacher_call", child_id: it.child_id, room_id: it.room_id }
    });
    if (error) { toast({ title: "Falha ao chamar", variant: "destructive" }); return; }
    toast({ title: "Responsável chamado por WhatsApp" });
  }

  if (!user) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-amber-50 p-4">
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex justify-between items-center flex-wrap gap-3">
          <h1 className="text-2xl font-bold text-slate-900">Dashboard do professor</h1>
          {rooms.length > 1 && (
            <select value={currentRoom?.id || ""} onChange={e => setCurrentRoom(rooms.find(r => r.id === e.target.value) || null)} className="border rounded-xl px-3 py-2">
              {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          )}
        </div>

        {rooms.length === 0 && <Card className="rounded-3xl"><CardContent className="p-8 text-center text-slate-600">Você ainda não foi adicionado como professor de nenhuma sala.</CardContent></Card>}

        {currentRoom && (
          <>
            <Card className="rounded-3xl border-2" style={{ borderColor: currentRoom.color + "60" }}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2"><QrCode className="w-4 h-4" /> QR de check-in (rotativo 60s)</CardTitle>
                <Button size="sm" variant="outline" onClick={rotateQr} className="rounded-xl"><RefreshCw className="w-4 h-4 mr-1" /> {dynQr ? "Rotacionar" : "Gerar"}</Button>
              </CardHeader>
              <CardContent>
                {dynQr ? (
                  <div className="text-center">
                    <img src={dynQr.url} alt="QR dinâmico" className="mx-auto rounded-2xl border-4" style={{ borderColor: currentRoom.color, maxWidth: 260 }} />
                    <p className="text-xs text-slate-500 mt-2">Expira em ~60s. Mostre este QR no tablet da entrada.</p>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 text-center py-4">Clique em "Gerar" para exibir o QR de check-in.</p>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-2">
              <CardHeader><CardTitle>Crianças presentes ({items.length})</CardTitle></CardHeader>
              <CardContent>
                {items.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-6">Nenhuma criança em check-in.</p>
                ) : (
                  <div className="grid md:grid-cols-2 gap-3">
                    {items.map(it => {
                      const age = Math.floor((Date.now() - new Date(it.birth_date).getTime()) / (365.25 * 24 * 3600 * 1000));
                      const revealed = reveal.has(it.checkin_id);
                      return (
                        <div key={it.checkin_id} className="p-4 rounded-2xl border-2 bg-white">
                          <div className="flex gap-3">
                            {photos[it.child_id] ? (
                              <img src={photos[it.child_id]} alt="" className="w-16 h-16 rounded-2xl object-cover border-2 border-violet-200" />
                            ) : (
                              <div className="w-16 h-16 rounded-2xl bg-violet-100 text-violet-700 font-bold flex items-center justify-center text-xl">{it.full_name?.[0]}</div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-slate-900 truncate">{it.full_name}</p>
                              <p className="text-xs text-slate-500">{age} anos</p>
                              {it.allergies && (
                                <Badge className="mt-1 bg-red-100 text-red-700 hover:bg-red-100 border-red-200">
                                  <AlertTriangle className="w-3 h-3 mr-1" /> Alergia: {it.allergies}
                                </Badge>
                              )}
                              {it.restrictions && <p className="text-[11px] text-amber-700 mt-1">⚠ {it.restrictions}</p>}
                            </div>
                          </div>

                          <div className="flex gap-2 mt-3">
                            <button onClick={() => { const s = new Set(reveal); revealed ? s.delete(it.checkin_id) : s.add(it.checkin_id); setReveal(s); }}
                              className="flex-1 px-3 py-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1">
                              {revealed ? <><EyeOff className="w-3 h-3" /> {it.pickup_code}</> : <><Eye className="w-3 h-3" /> Ver código</>}
                            </button>
                            <Button size="sm" variant="secondary" onClick={() => callGuardian(it)} className="rounded-xl"><PhoneCall className="w-4 h-4" /></Button>
                            <Button size="sm" onClick={() => setCheckoutFor(it)} className="rounded-xl"><KeyRound className="w-4 h-4 mr-1" /> Sair</Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Dialog open={!!checkoutFor} onOpenChange={o => !o && setCheckoutFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Check-out de {checkoutFor?.full_name}</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-600">Peça ao responsável o código de 4 dígitos.</p>
          <Input value={checkoutCode} onChange={e => setCheckoutCode(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="0000" className="text-center text-2xl tracking-[0.5em] font-bold" maxLength={4} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckoutFor(null)}>Cancelar</Button>
            <Button onClick={performCheckout} disabled={checkoutCode.length !== 4}>Confirmar retirada</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
