import { useEffect, useRef, useState } from "react";
import { BrowserQRCodeReader } from "@zxing/browser";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { Loader2, Camera, ShieldCheck, KeyRound, AlertTriangle } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";

interface Child { id: string; full_name: string; birth_date: string; photo_path: string | null; }
interface ActiveCheckin { id: string; child_id: string; pickup_code: string; checkin_at: string; kids_children: { full_name: string } | null; kids_rooms: { name: string } | null; }

export default function KidsCheckin() {
  const { user, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readerRef = useRef<BrowserQRCodeReader | null>(null);
  const [scanning, setScanning] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [tokenMode, setTokenMode] = useState<"page" | "room" | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Array<{ name: string; code: string; room?: string }>>([]);
  const [active, setActive] = useState<ActiveCheckin[]>([]);

  useEffect(() => {
    if (!user) return;
    loadChildren();
    loadActive();
    const ch = supabase.channel("kids-checkins-mine")
      .on("postgres_changes", { event: "*", schema: "public", table: "kids_checkins" }, () => loadActive())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  async function loadChildren() {
    if (!user) return;
    const { data: g } = await supabase.from("kids_guardians").select("id").eq("user_id", user.id).maybeSingle();
    if (!g) return;
    const { data } = await supabase.from("kids_guardian_children").select("kids_children(id, full_name, birth_date, photo_path)").eq("guardian_id", g.id);
    const list = (data || []).map((r: any) => r.kids_children).filter(Boolean);
    setChildren(list);
  }

  async function loadActive() {
    if (!user) return;
    const { data } = await supabase.from("kids_checkins")
      .select("id, child_id, pickup_code, checkin_at, kids_children(full_name), kids_rooms(name)")
      .is("checkout_at", null)
      .order("checkin_at", { ascending: false });
    setActive((data || []) as any);
  }

  async function startScan() {
    setScanning(true);
    try {
      readerRef.current = new BrowserQRCodeReader();
      const devices = await BrowserQRCodeReader.listVideoInputDevices();
      const back = devices.find(d => /back|rear|environment/i.test(d.label)) || devices[0];
      if (!back || !videoRef.current) { toast({ title: "Câmera indisponível", variant: "destructive" }); setScanning(false); return; }
      await readerRef.current.decodeFromVideoDevice(back.deviceId, videoRef.current, (result) => {
        if (result) {
          let text = result.getText();
          // se veio uma URL completa /kids/join/<token>, extrai o token final
          const m = text.match(/\/kids\/join\/([A-Za-z0-9_-]+)/);
          if (m) text = m[1];
          setToken(text);
          stopScan();
          toast({ title: "QR lido!" });
        }
      });
    } catch (e) {
      toast({ title: "Erro ao ler QR", variant: "destructive" });
      setScanning(false);
    }
  }

  function stopScan() {
    setScanning(false);
    try {
      const v = videoRef.current;
      if (v && v.srcObject) {
        (v.srcObject as MediaStream).getTracks().forEach(t => t.stop());
        v.srcObject = null;
      }
    } catch {}
  }

  useEffect(() => () => stopScan(), []);

  const missingPhoto = children.filter(c => selected.has(c.id) && (!c.photo_path || c.photo_path.trim() === ""));

  async function confirmCheckin() {
    if (!token || selected.size === 0) return;
    if (missingPhoto.length > 0) {
      toast({ title: "Foto obrigatória", description: `Adicione foto de: ${missingPhoto.map(m=>m.full_name).join(", ")}`, variant: "destructive" });
      return;
    }
    setBusy(true);
    const { data, error } = await (supabase.rpc as any)("kids_perform_checkin_static", {
      _static_token: token,
      _child_ids: Array.from(selected),
    });
    setBusy(false);
    if (error) { toast({ title: "Falha no check-in", description: error.message, variant: "destructive" }); return; }
    const rows = (data || []) as Array<{ child_id: string; pickup_code: string; checkin_id: string }>;
    const names = children.reduce((acc, c) => ({ ...acc, [c.id]: c.full_name }), {} as Record<string, string>);
    setResults(rows.map(r => ({ name: names[r.child_id] || "", code: r.pickup_code })));

    for (const r of rows) {
      supabase.functions.invoke("kids-notify-whatsapp", {
        body: { event: "checkin", child_id: r.child_id, room_id: "", pickup_code: r.pickup_code }
      }).catch(() => {});
    }

    setSelected(new Set()); setToken(null);
    loadActive();
  }

  if (authLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  if (!user) {
    return <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md w-full rounded-3xl border-2">
        <CardContent className="p-6 text-center space-y-3">
          <p>Entre para fazer o check-in.</p>
          <Button onClick={() => nav("/auth", { state: { returnUrl: "/kids/checkin" } })} className="rounded-xl">Entrar</Button>
        </CardContent>
      </Card>
    </div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-amber-50 p-4">
      <div className="max-w-xl mx-auto space-y-5">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900">Check-in LeviKids</h1>
          <p className="text-sm text-slate-600">Aponte o celular para o QR fixo colado na porta da sala.</p>
        </div>

        {active.length > 0 && (
          <Card className="rounded-3xl border-2 border-emerald-200 bg-emerald-50/50">
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><KeyRound className="w-4 h-4" /> Sessões ativas</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {active.map(a => (
                <div key={a.id} className="p-3 bg-white rounded-xl flex justify-between items-center">
                  <div>
                    <p className="font-semibold text-sm">{a.kids_children?.full_name}</p>
                    <p className="text-xs text-slate-500">{a.kids_rooms?.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase text-slate-500">código</p>
                    <p className="font-bold text-xl tracking-widest text-emerald-700">{a.pickup_code}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {results.length > 0 && (
          <Card className="rounded-3xl border-2 border-violet-300 bg-violet-50">
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-emerald-600" /> Check-in confirmado</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {results.map((r, i) => (
                <div key={i} className="p-3 bg-white rounded-xl text-center">
                  <p className="text-sm font-semibold">{r.name}</p>
                  <p className="text-[11px] uppercase text-slate-500 mt-1">Código de retirada</p>
                  <p className="text-4xl font-bold tracking-[0.5em] text-violet-700">{r.code}</p>
                </div>
              ))}
              <p className="text-xs text-center text-slate-600 mt-2">Guarde bem — este código é necessário na retirada.</p>
              <Button variant="outline" onClick={() => setResults([])} className="w-full rounded-xl">OK</Button>
            </CardContent>
          </Card>
        )}

        {!token && results.length === 0 && (
          <Card className="rounded-3xl border-2">
            <CardContent className="p-6 text-center space-y-3">
              {scanning ? (
                <>
                  <video ref={videoRef} className="w-full rounded-2xl border-2 border-violet-300" autoPlay playsInline muted />
                  <Button variant="outline" onClick={stopScan} className="rounded-xl">Cancelar</Button>
                </>
              ) : (
                <Button onClick={startScan} size="lg" className="rounded-2xl w-full h-16 text-lg">
                  <Camera className="w-6 h-6 mr-2" /> Escanear QR da sala
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {token && (
          <Card className="rounded-3xl border-2">
            <CardHeader><CardTitle className="text-base">Selecione quem está entrando</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {children.length === 0 ? (
                <p className="text-sm text-slate-500 text-center">Nenhum filho cadastrado.</p>
              ) : children.map(c => {
                const noPhoto = !c.photo_path || c.photo_path.trim() === "";
                return (
                  <label key={c.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer hover:bg-slate-50 ${noPhoto ? "opacity-60" : ""}`}>
                    <Checkbox checked={selected.has(c.id)} onCheckedChange={v => {
                      const s = new Set(selected);
                      if (v) { s.add(c.id); } else { s.delete(c.id); }
                      setSelected(s);
                    }} />
                    <span className="font-medium flex-1">{c.full_name}</span>
                    {noPhoto && <span className="text-[10px] text-red-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> sem foto</span>}
                  </label>
                );
              })}
              {missingPhoto.length > 0 && (
                <p className="text-xs text-red-600 flex items-start gap-1 mt-2">
                  <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" /> Adicione a foto no cadastro do(a) filho(a) antes de fazer check-in.
                </p>
              )}
              <Button onClick={confirmCheckin} disabled={busy || selected.size === 0 || missingPhoto.length > 0} className="w-full rounded-xl mt-3">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar check-in"}
              </Button>
              <Button variant="ghost" onClick={() => setToken(null)} className="w-full rounded-xl">Cancelar</Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
