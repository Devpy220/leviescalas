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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Loader2, Plus, QrCode, Download, FileDown, Trash2, Users, Copy, UserPlus, BookOpen, ShieldCheck, Search, Clock, ArrowLeftRight, BarChart3, Sparkles } from "lucide-react";
import { KIDS_JOIN_BASE, downloadPng, downloadPdf, qrToDataUrl } from "@/lib/kidsQr";
import { Checkbox } from "@/components/ui/checkbox";
import { Link } from "react-router-dom";

interface Room { id: string; name: string; color: string; age_min: number; age_max: number; static_qr_token: string; active: boolean; is_inclusion?: boolean; }
interface KidsLeader { id: string; user_id: string; created_at: string; profile?: { name: string; email: string } | null; }
interface KidsTeacher { id: string; user_id: string; room_id: string; scope: string; profile?: { name: string; email: string } | null; room?: { name: string } | null; }
interface KidsContent { id: string; content_date: string; title: string; body: string | null; room_id: string | null; }
interface ChildRow { id: string; full_name: string; birth_date: string; current_room_id: string | null; }

export default function KidsAdmin() {
  const { user } = useAuth();
  const { page, loading, reload } = useMyKidsPage();
  const [newPageName, setNewPageName] = useState("");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [leaders, setLeaders] = useState<KidsLeader[]>([]);
  const [teachers, setTeachers] = useState<KidsTeacher[]>([]);
  const [contents, setContents] = useState<KidsContent[]>([]);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [roomForm, setRoomForm] = useState({ name: "", color: "#F59E0B", age_min: 0, age_max: 12, is_inclusion: false });
  const [qrPreview, setQrPreview] = useState<{ room: Room; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [kids, setKids] = useState<ChildRow[]>([]);
  const [activeCheckins, setActiveCheckins] = useState<Set<string>>(new Set());
  const [transferChild, setTransferChild] = useState<ChildRow | null>(null);
  const [transferTargetRoom, setTransferTargetRoom] = useState("");
  const [scheduleForm, setScheduleForm] = useState({ start: "18:30", end: "20:30", days: [0,3] as number[], tz: "America/Sao_Paulo" });

  // invite / promotion modals
  const [showLeaderModal, setShowLeaderModal] = useState(false);
  const [showTeacherModal, setShowTeacherModal] = useState(false);
  const [emailQuery, setEmailQuery] = useState("");
  const [teacherRoomId, setTeacherRoomId] = useState<string>("");
  const [teacherScope, setTeacherScope] = useState<"kids_only" | "kids_and_schedules">("kids_only");

  // content modal
  const [showContentModal, setShowContentModal] = useState(false);
  const [contentForm, setContentForm] = useState<{ id?: string; content_date: string; title: string; body: string; room_id: string }>(
    { content_date: new Date().toISOString().slice(0, 10), title: "", body: "", room_id: "" }
  );

  useEffect(() => {
    if (page) {
      loadRooms(); loadLeaders(); loadTeachers(); loadContent(); loadKids();
      setScheduleForm({
        start: ((page as any).checkin_start_time || "18:30").slice(0,5),
        end:   ((page as any).checkin_end_time   || "20:30").slice(0,5),
        days:  (page as any).checkin_days || [0,3],
        tz:    (page as any).checkin_timezone || "America/Sao_Paulo",
      });
    }
  }, [page]);

  async function loadKids() {
    if (!page) return;
    const { data } = await supabase.from("kids_children").select("id, full_name, birth_date, current_room_id").eq("page_id", page.id).order("full_name");
    setKids((data || []) as any);
    const kidIds = (data || []).map((k: any) => k.id);
    if (kidIds.length) {
      const { data: ac } = await supabase.from("kids_checkins").select("child_id").in("child_id", kidIds).is("checkout_at", null);
      setActiveCheckins(new Set((ac || []).map((r: any) => r.child_id)));
    } else {
      setActiveCheckins(new Set());
    }
  }

  async function saveSchedule() {
    if (!page) return;
    setBusy(true);
    const { error } = await (supabase.from as any)("kids_pages").update({
      checkin_start_time: scheduleForm.start,
      checkin_end_time: scheduleForm.end,
      checkin_days: scheduleForm.days,
      checkin_timezone: scheduleForm.tz,
    }).eq("id", page.id);
    setBusy(false);
    if (error) { toast({ title:"Erro", description: error.message, variant:"destructive" }); return; }
    toast({ title: "Horário salvo" });
    reload();
  }

  async function doTransfer() {
    if (!transferChild || !transferTargetRoom) return;
    setBusy(true);
    const { error } = await (supabase.rpc as any)("kids_transfer_child", { _child_id: transferChild.id, _new_room_id: transferTargetRoom });
    setBusy(false);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Criança transferida" });
    setTransferChild(null); setTransferTargetRoom("");
    loadKids();
  }

  async function loadRooms() {
    if (!page) return;
    const { data } = await supabase.from("kids_rooms").select("*").eq("page_id", page.id).order("name");
    setRooms((data || []) as Room[]);
  }

  async function loadLeaders() {
    if (!page) return;
    const { data } = await supabase.from("kids_leaders").select("id, user_id, created_at").eq("page_id", page.id);
    const rows = (data || []) as KidsLeader[];
    if (rows.length) {
      const ids = rows.map(r => r.user_id);
      const { data: profs } = await supabase.from("profiles").select("id,name,email").in("id", ids);
      const map = new Map((profs || []).map(p => [p.id, p]));
      rows.forEach(r => { r.profile = (map.get(r.user_id) as any) || null; });
    }
    setLeaders(rows);
  }

  async function loadTeachers() {
    if (!page) return;
    const roomIds = rooms.map(r => r.id);
    if (!roomIds.length) { setTeachers([]); return; }
    const { data } = await supabase.from("kids_teacher_rooms").select("id, user_id, room_id, scope").in("room_id", roomIds);
    const rows = (data || []) as KidsTeacher[];
    if (rows.length) {
      const ids = Array.from(new Set(rows.map(r => r.user_id)));
      const { data: profs } = await supabase.from("profiles").select("id,name,email").in("id", ids);
      const pmap = new Map((profs || []).map(p => [p.id, p]));
      const rmap = new Map(rooms.map(r => [r.id, r]));
      rows.forEach(r => {
        r.profile = (pmap.get(r.user_id) as any) || null;
        r.room = { name: rmap.get(r.room_id)?.name || "—" };
      });
    }
    setTeachers(rows);
  }

  async function loadContent() {
    if (!page) return;
    const { data } = await supabase.from("kids_content").select("id, content_date, title, body, room_id").eq("page_id", page.id).order("content_date", { ascending: false }).limit(50);
    setContents((data || []) as KidsContent[]);
  }

  useEffect(() => { if (page && rooms.length) loadTeachers(); /* eslint-disable-next-line */ }, [rooms]);

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
    setNewPageName(""); await reload();
    toast({ title: "Página Kids criada!" });
  }

  async function createRoom() {
    if (!page) return;
    setBusy(true);
    const { error } = await supabase.from("kids_rooms").insert({ page_id: page.id, ...roomForm });
    setBusy(false);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setShowRoomModal(false); setRoomForm({ name: "", color: "#F59E0B", age_min: 0, age_max: 12, is_inclusion: false });
    loadRooms();
  }

  async function deleteRoom(id: string) {
    if (!confirm("Excluir esta sala? Todo conteúdo será removido.")) return;
    await supabase.from("kids_rooms").delete().eq("id", id);
    loadRooms();
  }

  async function findUserByEmail(email: string) {
    const { data } = await supabase.from("profiles").select("id,name,email").ilike("email", email.trim()).maybeSingle();
    return data as { id: string; name: string; email: string } | null;
  }

  async function promoteLeader() {
    if (!page || !emailQuery.trim()) return;
    setBusy(true);
    const prof = await findUserByEmail(emailQuery);
    if (!prof) { toast({ title: "Usuário não encontrado no LEVI", variant: "destructive" }); setBusy(false); return; }
    const { error } = await supabase.from("kids_leaders").insert({ page_id: page.id, user_id: prof.id, invited_by: user!.id });
    setBusy(false);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: `${prof.name} promovido a Líder Kids` });
    setShowLeaderModal(false); setEmailQuery(""); loadLeaders();
  }

  async function removeLeader(id: string) {
    if (!confirm("Remover este líder Kids?")) return;
    await supabase.from("kids_leaders").delete().eq("id", id);
    loadLeaders();
  }

  async function inviteTeacher() {
    if (!page || !emailQuery.trim() || !teacherRoomId) return;
    setBusy(true);
    const prof = await findUserByEmail(emailQuery);
    if (!prof) { toast({ title: "Usuário não encontrado no LEVI", variant: "destructive" }); setBusy(false); return; }
    const { error } = await supabase.from("kids_teacher_rooms").insert({ room_id: teacherRoomId, user_id: prof.id, scope: teacherScope, invited_by: user!.id });
    setBusy(false);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: `${prof.name} adicionado como professor(a)` });
    setShowTeacherModal(false); setEmailQuery(""); setTeacherRoomId(""); loadTeachers();
  }

  async function removeTeacher(id: string) {
    if (!confirm("Remover este professor da sala?")) return;
    await supabase.from("kids_teacher_rooms").delete().eq("id", id);
    loadTeachers();
  }

  async function saveContent() {
    if (!page || !contentForm.title.trim()) return;
    setBusy(true);
    const payload: any = {
      page_id: page.id,
      content_date: contentForm.content_date,
      title: contentForm.title.trim(),
      body: contentForm.body.trim() || null,
      room_id: contentForm.room_id || null,
      author_id: user!.id,
    };
    const q = contentForm.id
      ? supabase.from("kids_content").update(payload).eq("id", contentForm.id)
      : supabase.from("kids_content").insert(payload);
    const { error } = await q;
    setBusy(false);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setShowContentModal(false);
    setContentForm({ content_date: new Date().toISOString().slice(0, 10), title: "", body: "", room_id: "" });
    loadContent();
  }

  async function deleteContent(id: string) {
    if (!confirm("Excluir esta lição?")) return;
    await supabase.from("kids_content").delete().eq("id", id);
    loadContent();
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
          <div className="flex gap-2 flex-wrap">
            <Button asChild variant="outline" className="rounded-xl"><Link to="/dashboard">← LEVI</Link></Button>
            <Button asChild variant="secondary" className="rounded-xl"><Link to="/kids/relatorios"><BarChart3 className="w-4 h-4 mr-1"/>Relatórios</Link></Button>
            <Button asChild variant="secondary" className="rounded-xl"><Link to="/kids/mensagens">Mensagens</Link></Button>
          </div>
        </div>

        <Tabs defaultValue="rooms" className="w-full">
          <TabsList className="w-full grid grid-cols-3 md:grid-cols-7 rounded-2xl">
            <TabsTrigger value="rooms" className="rounded-xl"><QrCode className="w-4 h-4 mr-1" /> Salas</TabsTrigger>
            <TabsTrigger value="schedule" className="rounded-xl"><Clock className="w-4 h-4 mr-1" /> Horário</TabsTrigger>
            <TabsTrigger value="kids" className="rounded-xl"><ArrowLeftRight className="w-4 h-4 mr-1" /> Crianças</TabsTrigger>
            <TabsTrigger value="leaders" className="rounded-xl"><ShieldCheck className="w-4 h-4 mr-1" /> Líderes</TabsTrigger>
            <TabsTrigger value="teachers" className="rounded-xl"><Users className="w-4 h-4 mr-1" /> Professores</TabsTrigger>
            <TabsTrigger value="content" className="rounded-xl"><BookOpen className="w-4 h-4 mr-1" /> Lição</TabsTrigger>
            <TabsTrigger value="consent" className="rounded-xl">Termo</TabsTrigger>
          </TabsList>

          {/* HORÁRIO DE CHECK-IN */}
          <TabsContent value="schedule">
            <Card className="rounded-3xl border-2">
              <CardHeader><CardTitle>Janela de check-in</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-slate-500">O QR fixo da sala só permite check-in dentro deste horário e nos dias selecionados. Fora disso, a família recebe um aviso educado.</p>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Início</Label><Input type="time" value={scheduleForm.start} onChange={e => setScheduleForm({...scheduleForm, start: e.target.value})} /></div>
                  <div><Label>Fim</Label><Input type="time" value={scheduleForm.end} onChange={e => setScheduleForm({...scheduleForm, end: e.target.value})} /></div>
                </div>
                <div>
                  <Label>Dias da semana</Label>
                  <div className="flex gap-2 flex-wrap mt-1">
                    {["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map((label, idx) => {
                      const on = scheduleForm.days.includes(idx);
                      return (
                        <button key={idx} type="button"
                          onClick={() => setScheduleForm(s => ({ ...s, days: on ? s.days.filter(d=>d!==idx) : [...s.days, idx].sort() }))}
                          className={`px-3 py-1.5 rounded-xl text-sm font-semibold border-2 ${on ? "bg-violet-600 text-white border-violet-600" : "bg-white text-slate-600 border-slate-200"}`}>
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div><Label>Fuso horário</Label><Input value={scheduleForm.tz} onChange={e => setScheduleForm({...scheduleForm, tz: e.target.value})} /></div>
                <Button onClick={saveSchedule} disabled={busy} className="rounded-xl">{busy ? <Loader2 className="w-4 h-4 animate-spin"/> : "Salvar horário"}</Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* CRIANÇAS + TRANSFERÊNCIA */}
          <TabsContent value="kids">
            <Card className="rounded-3xl border-2">
              <CardHeader><CardTitle>Crianças cadastradas</CardTitle></CardHeader>
              <CardContent>
                {kids.length === 0 ? <p className="text-sm text-slate-500 text-center py-6">Nenhuma criança cadastrada ainda.</p> : (
                  <div className="space-y-2">
                    {kids.map(c => {
                      const age = Math.floor((Date.now() - new Date(c.birth_date).getTime()) / (365.25*24*3600*1000));
                      const room = rooms.find(r => r.id === c.current_room_id)
                        || rooms.find(r => age >= r.age_min && age <= r.age_max);
                      const isActive = activeCheckins.has(c.id);
                      return (
                        <div key={c.id} className="flex items-center justify-between p-3 rounded-xl border bg-white">
                          <div>
                            <p className="font-semibold text-sm">{c.full_name}</p>
                            <p className="text-xs text-slate-500">{age} anos · Sala: <b>{room?.name || "—"}</b></p>
                            <div className="mt-1">
                              {isActive ? (
                                <Badge className="text-[10px] bg-emerald-100 text-emerald-800 border-emerald-200">Check-in ativo</Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] text-slate-600">Aguardando check-in</Badge>
                              )}
                            </div>
                          </div>
                          <Button size="sm" variant="outline" onClick={() => { setTransferChild(c); setTransferTargetRoom(c.current_room_id || rooms[0]?.id || ""); }} className="rounded-xl">
                            <ArrowLeftRight className="w-4 h-4 mr-1"/>Transferir
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>


          {/* SALAS */}
          <TabsContent value="rooms">
            <div className="space-y-4">
              {/* QR ÚNICO DA IGREJA */}
              <Card className="rounded-3xl border-2 border-violet-300 bg-gradient-to-br from-violet-50 to-white">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><QrCode className="w-5 h-5 text-violet-600" /> QR único da igreja (todas as salas)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-slate-600">
                    Imprima e coloque na entrada do Kids. Os pais escaneiam <b>uma única vez</b> — no primeiro acesso fazem cadastro (com CPF) e nos próximos check-ins o sistema escolhe a sala automaticamente pela idade da criança.
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    <Button variant="outline" onClick={() => { const url = `${KIDS_JOIN_BASE}/${(page as any).static_qr_token}`; navigator.clipboard.writeText(url); toast({ title: "Link copiado" }); }} className="rounded-xl">
                      <Copy className="w-4 h-4 mr-1" /> Copiar link
                    </Button>
                    <Button variant="outline" onClick={() => downloadPng(`${KIDS_JOIN_BASE}/${(page as any).static_qr_token}`, `qr-${page.name}.png`)} className="rounded-xl">
                      <Download className="w-4 h-4 mr-1" /> PNG
                    </Button>
                    <Button onClick={() => downloadPdf(`${KIDS_JOIN_BASE}/${(page as any).static_qr_token}`, `qr-${page.name}.pdf`, { title: page.name, subtitle: "Cadastro e Check-in LeviKids", footer: "leviescalas.com.br" })} className="rounded-xl">
                      <FileDown className="w-4 h-4 mr-1" /> PDF para imprimir
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-3xl border-2">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Salas por faixa etária</CardTitle>
                    <p className="text-xs text-slate-500 mt-1">Defina a idade mínima e máxima. O check-in usa isso para escolher a sala automaticamente.</p>
                  </div>
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
                              <div className="flex gap-1 flex-wrap mt-1">
                                <Badge variant="outline" className="text-xs">
                                  <Users className="w-3 h-3 mr-1" /> {r.age_min}–{r.age_max} anos
                                </Badge>
                                {r.is_inclusion && <Badge className="text-xs bg-violet-100 text-violet-700 border-violet-200"><Sparkles className="w-3 h-3 mr-1"/>Inclusão</Badge>}
                              </div>
                            </div>
                            <button onClick={() => deleteRoom(r.id)} title="Excluir sala" className="text-slate-400 hover:text-red-600 p-1"><Trash2 className="w-4 h-4" /></button>
                          </div>
                          <div className="flex gap-2 mt-3">
                            <Button size="sm" variant="ghost" onClick={() => deleteRoom(r.id)} className="rounded-lg text-red-600 hover:bg-red-50 ml-auto">
                              <Trash2 className="w-4 h-4 mr-1" /> Excluir
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* LÍDERES KIDS */}
          <TabsContent value="leaders">
            <Card className="rounded-3xl border-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Líderes Kids</CardTitle>
                <Button onClick={() => { setEmailQuery(""); setShowLeaderModal(true); }} className="rounded-xl"><UserPlus className="w-4 h-4 mr-2" /> Promover membro</Button>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-slate-500 mb-3">O líder da igreja no LEVI é sempre líder da Página Kids. Aqui você promove outros membros a co-líderes.</p>
                {leaders.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-6">Nenhum co-líder promovido ainda.</p>
                ) : (
                  <div className="space-y-2">
                    {leaders.map(l => (
                      <div key={l.id} className="flex items-center justify-between p-3 rounded-xl border bg-white">
                        <div>
                          <p className="font-medium text-sm">{l.profile?.name || "Usuário"}</p>
                          <p className="text-xs text-slate-500">{l.profile?.email}</p>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => removeLeader(l.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* PROFESSORES */}
          <TabsContent value="teachers">
            <Card className="rounded-3xl border-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Professores por sala</CardTitle>
                <Button onClick={() => { setEmailQuery(""); setTeacherRoomId(rooms[0]?.id || ""); setShowTeacherModal(true); }} disabled={rooms.length === 0} className="rounded-xl">
                  <UserPlus className="w-4 h-4 mr-2" /> Adicionar professor
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {(page as any)?.static_qr_token && (
                  <div className="rounded-xl border-2 border-violet-200 bg-violet-50/50 p-3 space-y-2">
                    <p className="text-xs font-semibold text-violet-900 flex items-center gap-1">
                      <Copy className="w-3.5 h-3.5" /> Link único para professores (reutilizável)
                    </p>
                    <p className="text-[11px] text-slate-600">
                      Envie este link para os professores da igreja. Cada um entra, escolhe a sala e fica cadastrado.
                      <strong> Menores de 18 anos</strong> precisam da autorização de um responsável (o link avisa e bloqueia até a autorização).
                    </p>
                    <div className="flex gap-2 items-center">
                      <Input
                        readOnly
                        value={`${window.location.origin}/kids/teacher-join/${(page as any).static_qr_token}`}
                        className="text-xs font-mono"
                      />
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          const url = `${window.location.origin}/kids/teacher-join/${(page as any).static_qr_token}`;
                          navigator.clipboard.writeText(url);
                          toast({ title: "Link copiado!" });
                        }}
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
                {teachers.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-6">Nenhum professor cadastrado.</p>
                ) : (
                  <div className="space-y-2">
                    {teachers.map(t => (
                      <div key={t.id} className="flex items-center justify-between p-3 rounded-xl border bg-white">
                        <div>
                          <p className="font-medium text-sm">{t.profile?.name || "Usuário"}</p>
                          <p className="text-xs text-slate-500">{t.profile?.email} · Sala: <b>{t.room?.name}</b> · <span className="uppercase">{t.scope === "kids_and_schedules" ? "Kids + Escalas" : "Só Kids"}</span></p>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => removeTeacher(t.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* LIÇÃO DO DIA */}
          <TabsContent value="content">
            <Card className="rounded-3xl border-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Lição do dia</CardTitle>
                <Button onClick={() => { setContentForm({ content_date: new Date().toISOString().slice(0, 10), title: "", body: "", room_id: "" }); setShowContentModal(true); }} className="rounded-xl">
                  <Plus className="w-4 h-4 mr-2" /> Nova lição
                </Button>
              </CardHeader>
              <CardContent>
                {contents.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-6">Nenhuma lição publicada ainda.</p>
                ) : (
                  <div className="space-y-2">
                    {contents.map(c => (
                      <div key={c.id} className="p-3 rounded-xl border bg-white">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className="text-xs">{c.content_date}</Badge>
                              {c.room_id && <Badge variant="secondary" className="text-xs">{rooms.find(r => r.id === c.room_id)?.name || "sala"}</Badge>}
                            </div>
                            <p className="font-semibold text-sm mt-1">{c.title}</p>
                            {c.body && <p className="text-xs text-slate-600 mt-1 line-clamp-2">{c.body}</p>}
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button size="sm" variant="ghost" onClick={() => { setContentForm({ id: c.id, content_date: c.content_date, title: c.title, body: c.body || "", room_id: c.room_id || "" }); setShowContentModal(true); }}>Editar</Button>
                            <Button size="sm" variant="ghost" onClick={() => deleteContent(c.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TERMO */}
          <TabsContent value="consent">
            <Card className="rounded-3xl border-2">
              <CardHeader><CardTitle className="text-base">Termo de consentimento</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-slate-700 mb-2">Versão atual: <b>{page.consent_version}</b></p>
                <pre className="p-4 bg-white border-2 border-slate-200 rounded-xl text-sm leading-relaxed text-slate-900 whitespace-pre-wrap max-h-96 overflow-auto font-sans">{page.consent_text}</pre>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
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
            <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg bg-violet-50 border border-violet-200">
              <Checkbox checked={roomForm.is_inclusion} onCheckedChange={v => setRoomForm({ ...roomForm, is_inclusion: !!v })} />
              <span className="text-sm"><Sparkles className="w-3 h-3 inline mr-1 text-violet-600"/> Sala de inclusão (habilita assistente IA)</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRoomModal(false)}>Cancelar</Button>
            <Button onClick={createRoom} disabled={busy || !roomForm.name.trim()}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer modal */}
      <Dialog open={!!transferChild} onOpenChange={o => !o && setTransferChild(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Transferir {transferChild?.full_name} de sala</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label>Nova sala</Label>
            <select className="w-full border rounded-md h-10 px-3 bg-background" value={transferTargetRoom} onChange={e => setTransferTargetRoom(e.target.value)}>
              {rooms.map(r => <option key={r.id} value={r.id}>{r.name} ({r.age_min}–{r.age_max} anos){r.is_inclusion ? " · inclusão" : ""}</option>)}
            </select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferChild(null)}>Cancelar</Button>
            <Button onClick={doTransfer} disabled={busy || !transferTargetRoom}>{busy ? <Loader2 className="w-4 h-4 animate-spin"/> : "Transferir"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Leader promotion modal */}
      <Dialog open={showLeaderModal} onOpenChange={setShowLeaderModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Promover a Líder Kids</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-slate-500">A pessoa precisa já ter conta no LEVI. Informe o e-mail cadastrado.</p>
            <div><Label>E-mail</Label><Input type="email" value={emailQuery} onChange={e => setEmailQuery(e.target.value)} placeholder="nome@igreja.com" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLeaderModal(false)}>Cancelar</Button>
            <Button onClick={promoteLeader} disabled={busy || !emailQuery.trim()}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : (<><Search className="w-4 h-4 mr-1" />Promover</>)}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Teacher invite modal */}
      <Dialog open={showTeacherModal} onOpenChange={setShowTeacherModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar professor(a)</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-slate-500">A pessoa precisa já ter conta no LEVI.</p>
            <div><Label>E-mail</Label><Input type="email" value={emailQuery} onChange={e => setEmailQuery(e.target.value)} placeholder="professora@igreja.com" /></div>
            <div>
              <Label>Sala</Label>
              <select className="w-full border rounded-md h-10 px-3 bg-background" value={teacherRoomId} onChange={e => setTeacherRoomId(e.target.value)}>
                {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div>
              <Label>Escopo de acesso</Label>
              <select className="w-full border rounded-md h-10 px-3 bg-background" value={teacherScope} onChange={e => setTeacherScope(e.target.value as any)}>
                <option value="kids_only">Somente Kids</option>
                <option value="kids_and_schedules">Kids + Escalas do LEVI</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTeacherModal(false)}>Cancelar</Button>
            <Button onClick={inviteTeacher} disabled={busy || !emailQuery.trim() || !teacherRoomId}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Adicionar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Content modal */}
      <Dialog open={showContentModal} onOpenChange={setShowContentModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>{contentForm.id ? "Editar lição" : "Nova lição do dia"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Data</Label><Input type="date" value={contentForm.content_date} onChange={e => setContentForm({ ...contentForm, content_date: e.target.value })} /></div>
              <div>
                <Label>Sala (opcional)</Label>
                <select className="w-full border rounded-md h-10 px-3 bg-background" value={contentForm.room_id} onChange={e => setContentForm({ ...contentForm, room_id: e.target.value })}>
                  <option value="">Todas as salas</option>
                  {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
            </div>
            <div><Label>Título</Label><Input value={contentForm.title} onChange={e => setContentForm({ ...contentForm, title: e.target.value })} placeholder="Ex.: Davi e Golias" /></div>
            <div><Label>Texto / versículo / atividade</Label><Textarea rows={6} value={contentForm.body} onChange={e => setContentForm({ ...contentForm, body: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowContentModal(false)}>Cancelar</Button>
            <Button onClick={saveContent} disabled={busy || !contentForm.title.trim()}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}</Button>
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
