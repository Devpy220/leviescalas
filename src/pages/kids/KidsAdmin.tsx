import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMyKidsPage } from "@/hooks/useKidsPage";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Loader2, Plus, QrCode, Download, FileDown, Trash2, Users, Copy } from "lucide-react";
import { KIDS_JOIN_BASE, downloadPng, downloadPdf, qrToDataUrl } from "@/lib/kidsQr";
import { Link } from "react-router-dom";

interface Room {
  id: string; name: string; color: string; age_min: number; age_max: number;
  static_qr_token: string; active: boolean;
}

export default function KidsAdmin() {
  const { user } = useAuth();
  const { page, loading, reload } = useMyKidsPage();
  const [creating, setCreating] = useState(false);
  const [newPageName, setNewPageName] = useState("");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [roomForm, setRoomForm] = useState({ name: "", color: "#F59E0B", age_min: 0, age_max: 12 });
  const [qrPreview, setQrPreview] = useState<{ room: Room; url: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (page) loadRooms(); }, [page]);

  async function loadRooms() {
    if (!page) return;
    const { data } = await supabase.from("kids_rooms").select("*").eq("page_id", page.id).order("name");
    setRooms((data || []) as Room[]);
  }

  async function createPage() {
    if (!user || !newPageName.trim()) return;
    setBusy(true);
    const { data: church } = await supabase.from("churches").select("id").eq("leader_id", user.id).maybeSingle();
    if (!church) { toast({ title: "Somente líderes de igreja podem criar a Página Kids", variant: "destructive" }); setBusy(false); return; }
    const { data: consent } = await supabase.rpc("kids_default_consent_text");
    const slug = newPageName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40) + "-" + Math.random().toString(36).slice(2, 6);
    const { error } = await supabase.from("kids_pages").insert({
      church_id: church.id, name: newPageName.trim(), slug,
      consent_version: "1.0", consent_text: (consent as string) || "Termo v1.0",
      created_by: user.id,
    });
    setBusy(false);
    if (error) { toast({ title: "Erro ao criar", description: error.message, variant: "destructive" }); return; }
    setCreating(false); setNewPageName(""); await reload();
    toast({ title: "Página Kids criada!" });
  }

  async function createRoom() {
    if (!page) return;
    setBusy(true);
    const { error } = await supabase.from("kids_rooms").insert({ page_id: page.id, ...roomForm });
    setBusy(false);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setShowRoomModal(false); setRoomForm({ name: "", color: "#F59E0B", age_min: 0, age_max: 12 });
    loadRooms();
  }

  async function deleteRoom(id: string) {
    if (!confirm("Excluir esta sala? Todo conteúdo será removido.")) return;
    await supabase.from("kids_rooms").delete().eq("id", id);
    loadRooms();
  }

  async function showQr(room: Room) {
    const url = `${KIDS_JOIN_BASE}/${room.static_qr_token}`;
    const dataUrl = await qrToDataUrl(url, 400);
    setQrPreview({ room, url: dataUrl });
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  if (!page) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 to-amber-50 p-6">
        <div className="max-w-xl mx-auto">
          <Card className="rounded-3xl border-2">
            <CardHeader><CardTitle>Criar Página Kids da sua igreja</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-slate-600">Escolha um nome amigável para o ministério infantil da sua igreja (ex.: "Connect Kids", "Geração Kids").</p>
              <div>
                <Label>Nome</Label>
                <Input value={newPageName} onChange={e => setNewPageName(e.target.value)} placeholder="Ex.: Connect Kids" />
              </div>
              <Button onClick={createPage} disabled={busy || !newPageName.trim()} className="w-full rounded-xl">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Criar Página Kids"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-amber-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{page.name}</h1>
            <p className="text-slate-600 text-sm">Painel do líder — LeviKids</p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" className="rounded-xl"><Link to="/dashboard">← LEVI</Link></Button>
          </div>
        </div>

        <Card className="rounded-3xl border-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Salas</CardTitle>
            <Button onClick={() => setShowRoomModal(true)} className="rounded-xl"><Plus className="w-4 h-4 mr-2" /> Nova sala</Button>
          </CardHeader>
          <CardContent>
            {rooms.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">Nenhuma sala ainda. Crie a primeira!</p>
            ) : (
              <div className="grid md:grid-cols-2 gap-3">
                {rooms.map(r => (
                  <div key={r.id} className="p-4 rounded-2xl border-2" style={{ borderColor: r.color + "40", background: r.color + "10" }}>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-bold text-slate-900">{r.name}</h3>
                        <Badge variant="outline" className="mt-1 text-xs">
                          <Users className="w-3 h-3 mr-1" /> {r.age_min}–{r.age_max} anos
                        </Badge>
                      </div>
                      <button onClick={() => deleteRoom(r.id)} className="text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" variant="secondary" onClick={() => showQr(r)} className="rounded-lg flex-1">
                        <QrCode className="w-4 h-4 mr-1" /> QR de cadastro
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-2">
          <CardHeader><CardTitle className="text-base">Termo de consentimento</CardTitle></CardHeader>
          <CardContent>
            <p className="text-xs text-slate-500 mb-2">Versão atual: <b>{page.consent_version}</b></p>
            <details>
              <summary className="text-sm text-violet-700 cursor-pointer">Ver texto do termo</summary>
              <pre className="mt-3 p-3 bg-slate-50 rounded-xl text-xs whitespace-pre-wrap max-h-64 overflow-auto">{page.consent_text}</pre>
            </details>
          </CardContent>
        </Card>
      </div>

      {/* Room modal */}
      <Dialog open={showRoomModal} onOpenChange={setShowRoomModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova sala</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={roomForm.name} onChange={e => setRoomForm({ ...roomForm, name: e.target.value })} placeholder="Ex.: Berçário" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Idade mínima</Label><Input type="number" min={0} max={17} value={roomForm.age_min} onChange={e => setRoomForm({ ...roomForm, age_min: +e.target.value })} /></div>
              <div><Label>Idade máxima</Label><Input type="number" min={0} max={17} value={roomForm.age_max} onChange={e => setRoomForm({ ...roomForm, age_max: +e.target.value })} /></div>
            </div>
            <div><Label>Cor</Label><Input type="color" value={roomForm.color} onChange={e => setRoomForm({ ...roomForm, color: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRoomModal(false)}>Cancelar</Button>
            <Button onClick={createRoom} disabled={busy || !roomForm.name.trim()}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR preview */}
      <Dialog open={!!qrPreview} onOpenChange={o => !o && setQrPreview(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>QR de cadastro — {qrPreview?.room.name}</DialogTitle></DialogHeader>
          {qrPreview && (
            <div className="space-y-4">
              <img src={qrPreview.url} alt="QR" className="mx-auto rounded-xl border" />
              <p className="text-xs text-center text-slate-600 break-all">
                {KIDS_JOIN_BASE}/{qrPreview.room.static_qr_token}
              </p>
              <div className="flex gap-2 justify-center flex-wrap">
                <Button variant="outline" onClick={() => { navigator.clipboard.writeText(`${KIDS_JOIN_BASE}/${qrPreview.room.static_qr_token}`); toast({ title: "Link copiado" }); }}>
                  <Copy className="w-4 h-4 mr-1" /> Copiar link
                </Button>
                <Button variant="outline" onClick={() => downloadPng(`${KIDS_JOIN_BASE}/${qrPreview.room.static_qr_token}`, `qr-${qrPreview.room.name}.png`)}>
                  <Download className="w-4 h-4 mr-1" /> PNG
                </Button>
                <Button onClick={() => downloadPdf(`${KIDS_JOIN_BASE}/${qrPreview.room.static_qr_token}`, `qr-${qrPreview.room.name}.pdf`, { title: page.name, subtitle: `Sala: ${qrPreview.room.name}`, footer: "leviescalas.com.br" })}>
                  <FileDown className="w-4 h-4 mr-1" /> PDF para imprimir
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
