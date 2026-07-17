import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { Loader2, AlertTriangle, PhoneCall, LogOut, QrCode, Download, FileDown } from "lucide-react";
import { qrToDataUrl, KIDS_JOIN_BASE, downloadPng, downloadPdf } from "@/lib/kidsQr";
import { getKidsPhotoUrl } from "@/lib/kidsStorage";
import { Link } from "react-router-dom";

interface Room { id: string; name: string; color: string; page_id: string; static_qr_token: string; is_inclusion?: boolean; }
interface ActiveChild {
  checkin_id: string; child_id: string; room_id: string; checkin_at: string;
  full_name: string; birth_date: string; allergies: string | null; restrictions: string | null; photo_path: string | null;
}

export default function KidsDashboard() {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [items, setItems] = useState<ActiveChild[]>([]);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [checkoutFor, setCheckoutFor] = useState<ActiveChild | null>(null);
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [pageName, setPageName] = useState<string>("");
  const [linkedDeptId, setLinkedDeptId] = useState<string | null>(null);

  useEffect(() => { if (user) loadRooms(); }, [user]);

  async function loadRooms() {
    if (!user) return;
    const { data, error } = await (supabase.rpc as any)("kids_teacher_rooms_today");
    if (error) { console.error(error); setRooms([]); return; }
    const rs = (data || []) as Room[];
    setRooms(rs);
    if (rs[0]) {
      setCurrentRoom(rs[0]);
      const { data: dept } = await (supabase.rpc as any)("kids_get_linked_department", { _page_id: rs[0].page_id });
      setLinkedDeptId((dept as string) || null);
    } else setCurrentRoom(null);
  }

  useEffect(() => {
    if (!currentRoom) return;
    loadActive();
    loadPageName();
    generateQr();
    const ch = supabase.channel(`kids-room-${currentRoom.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "kids_checkins", filter: `room_id=eq.${currentRoom.id}` },
        () => loadActive())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, [currentRoom]);

  async function loadPageName() {
    if (!currentRoom) return;
    const { data } = await supabase.from("kids_pages").select("name").eq("id", currentRoom.page_id).maybeSingle();
    setPageName(data?.name || "");
  }

  async function generateQr() {
    if (!currentRoom) return;
    const url = `${KIDS_JOIN_BASE}/${currentRoom.static_qr_token}`;
    const dataUrl = await qrToDataUrl(currentRoom.static_qr_token, 400);
    setQrUrl(dataUrl);
    return url;
  }

  async function loadActive() {
    if (!currentRoom) return;
    const { data } = await supabase.from("kids_checkins")
      .select("id, child_id, room_id, checkin_at, kids_children(full_name, birth_date, allergies, restrictions, photo_path)")
      .eq("room_id", currentRoom.id)
      .is("checkout_at", null)
      .order("checkin_at");
    const mapped = (data || []).map((r: any) => ({
      checkin_id: r.id, child_id: r.child_id, room_id: r.room_id, checkin_at: r.checkin_at,
      full_name: r.kids_children?.full_name, birth_date: r.kids_children?.birth_date,
      allergies: r.kids_children?.allergies, restrictions: r.kids_children?.restrictions,
      photo_path: r.kids_children?.photo_path,
    }));
    setItems(mapped);
    for (const it of mapped) {
      if (it.photo_path && !photos[it.child_id]) {
        const u = await getKidsPhotoUrl(it.photo_path);
        if (u) setPhotos(p => ({ ...p, [it.child_id]: u }));
      }
    }
  }

  async function performCheckout() {
    if (!checkoutFor) return;
    const { error } = await (supabase.rpc as any)("kids_perform_checkout", {
      _checkin_id: checkoutFor.checkin_id
    });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    supabase.functions.invoke("kids-notify-whatsapp", {
      body: { event: "checkout", child_id: checkoutFor.child_id, room_id: checkoutFor.room_id }
    }).catch(() => {});
    toast({ title: "Retirada confirmada" });
    setCheckoutFor(null);
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
          <div className="flex gap-2 items-center">
            {currentRoom?.is_inclusion && (
              <Button asChild variant="secondary" className="rounded-xl">
                <Link to="/kids/inclusao">Sala de inclusão · IA</Link>
              </Button>
            )}
            <Button asChild variant="outline" className="rounded-xl">
              <Link to="/kids/mensagens">Mensagens</Link>
            </Button>
            {rooms.length > 1 && (
              <select value={currentRoom?.id || ""} onChange={e => setCurrentRoom(rooms.find(r => r.id === e.target.value) || null)} className="border rounded-xl px-3 py-2">
                {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            )}
          </div>
        </div>

        {linkedDeptId && (
          <Card className="rounded-2xl border-2 border-violet-200 bg-gradient-to-r from-violet-50 to-amber-50">
            <CardContent className="p-3 flex items-center gap-2 flex-wrap">
              <p className="text-xs text-slate-700 flex-1 min-w-[200px]">📌 <b>Área do professor:</b> marque sua disponibilidade, datas de bloqueio e veja os avisos do líder no departamento vinculado.</p>
              <Button asChild size="sm" variant="outline" className="rounded-xl border-violet-300">
                <Link to={`/departments/${linkedDeptId}`}>Abrir Professores Kids →</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {rooms.length === 0 && <Card className="rounded-3xl"><CardContent className="p-8 text-center text-slate-600">Você não está escalado(a) em nenhuma sala hoje. Fale com o líder do LeviKids se precisar acessar.</CardContent></Card>}

        {currentRoom && (
          <>
            <Card className="rounded-3xl border-2" style={{ borderColor: currentRoom.color + "60" }}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2"><QrCode className="w-4 h-4" /> QR fixo da sala (imprimir e colar na porta)</CardTitle>
              </CardHeader>
              <CardContent>
                {qrUrl ? (
                  <div className="text-center space-y-3">
                    <img src={qrUrl} alt="QR fixo" className="mx-auto rounded-2xl border-4" style={{ borderColor: currentRoom.color, maxWidth: 260 }} />
                    <p className="text-xs text-slate-500">Este QR não muda. Válido dentro da janela de horário configurada pelo líder.</p>
                    <div className="flex gap-2 justify-center flex-wrap">
                      <Button variant="outline" size="sm" onClick={() => downloadPng(currentRoom.static_qr_token, `qr-checkin-${currentRoom.name}.png`)} className="rounded-xl">
                        <Download className="w-4 h-4 mr-1" /> PNG
                      </Button>
                      <Button size="sm" onClick={() => downloadPdf(currentRoom.static_qr_token, `qr-checkin-${currentRoom.name}.pdf`, { title: pageName || "LeviKids", subtitle: `Sala: ${currentRoom.name} — Check-in`, footer: "leviescalas.com.br" })} className="rounded-xl">
                        <FileDown className="w-4 h-4 mr-1" /> PDF para imprimir
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 text-center py-4">Gerando QR…</p>
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
                            <Button size="sm" variant="secondary" onClick={() => callGuardian(it)} className="rounded-xl flex-1">
                              <PhoneCall className="w-4 h-4 mr-1" /> Chamar responsável
                            </Button>
                            <Button size="sm" onClick={() => setCheckoutFor(it)} className="rounded-xl flex-1">
                              <LogOut className="w-4 h-4 mr-1" /> Retirar
                            </Button>
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

      <AlertDialog open={!!checkoutFor} onOpenChange={o => !o && setCheckoutFor(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar retirada</AlertDialogTitle>
            <AlertDialogDescription>
              Confirma que <b>{checkoutFor?.full_name}</b> está sendo retirado(a) por um responsável autorizado?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={performCheckout}>Confirmar retirada</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
