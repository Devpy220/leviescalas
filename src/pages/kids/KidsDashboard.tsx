import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Loader2, AlertTriangle, PhoneCall, LogOut, QrCode, Download, FileDown, ExternalLink } from "lucide-react";
import { qrToDataUrl, KIDS_JOIN_BASE, downloadPng, downloadPdf } from "@/lib/kidsQr";
import { getKidsPhotoUrl } from "@/lib/kidsStorage";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

interface Room { id: string; name: string; color: string; page_id: string; static_qr_token: string; is_inclusion?: boolean; }
interface PickupCandidate { guardian_id: string; full_name: string; relationship: string | null; }
const OTHER = "__other__";

interface ActiveChild {
  checkin_id: string; child_id: string; room_id: string; checkin_at: string;
  full_name: string; birth_date: string; allergies: string | null; restrictions: string | null; photo_path: string | null;
}

export default function KidsDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [items, setItems] = useState<ActiveChild[]>([]);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [checkoutFor, setCheckoutFor] = useState<ActiveChild | null>(null);
  const [guardians, setGuardians] = useState<PickupCandidate[]>([]);
  const [guardiansLoading, setGuardiansLoading] = useState(false);
  const [pickupChoice, setPickupChoice] = useState<string>(""); // guardian_id | OTHER
  const [pickupOtherName, setPickupOtherName] = useState("");
  const [checkoutBusy, setCheckoutBusy] = useState(false);
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

  async function openCheckout(it: ActiveChild) {
    setCheckoutFor(it);
    setPickupChoice("");
    setPickupOtherName("");
    setGuardians([]);
    setGuardiansLoading(true);
    const { data, error } = await (supabase.rpc as any)("kids_checkout_candidates", { _checkin_id: it.checkin_id });
    setGuardiansLoading(false);
    if (error) { toast({ title: t("kidsTeacher.error"), description: error.message, variant: "destructive" }); return; }
    const list = (data || []) as PickupCandidate[];
    setGuardians(list);
    // Sem responsáveis cadastrados: só resta "outra pessoa".
    if (list.length === 0) setPickupChoice(OTHER);
  }

  const pickupValid = pickupChoice === OTHER
    ? pickupOtherName.trim().length >= 2
    : pickupChoice !== "";

  async function performCheckout() {
    if (!checkoutFor || !pickupValid || checkoutBusy) return;
    setCheckoutBusy(true);
    const isOther = pickupChoice === OTHER;
    const { error } = await (supabase.rpc as any)("kids_perform_checkout", {
      _checkin_id: checkoutFor.checkin_id,
      _pickup_guardian_id: isOther ? null : pickupChoice,
      _pickup_person_name: isOther ? pickupOtherName.trim() : null,
    });
    setCheckoutBusy(false);
    if (error) { toast({ title: t("kidsTeacher.error"), description: error.message, variant: "destructive" }); return; }
    supabase.functions.invoke("kids-notify-whatsapp", {
      body: { event: "checkout", checkin_id: checkoutFor.checkin_id }
    }).catch(() => {});
    toast({ title: t("kidsTeacher.checkoutDone") });
    setCheckoutFor(null);
    loadActive();
  }

  async function callGuardian(it: ActiveChild) {
    const { error } = await supabase.functions.invoke("kids-notify-whatsapp", {
      body: { event: "teacher_call", checkin_id: it.checkin_id }
    });
    if (error) { toast({ title: t("kidsTeacher.callFailed"), variant: "destructive" }); return; }
    toast({ title: t("kidsTeacher.guardianCalled") });
  }

  if (!user) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-amber-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-4">
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex justify-between items-center flex-wrap gap-3">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{t("kidsTeacher.title")}</h1>
          <div className="flex gap-2 items-center">
            {currentRoom?.is_inclusion && (
              <Button asChild variant="secondary" className="rounded-xl">
                <Link to="/kids/inclusao">{t("kidsTeacher.inclusion")}</Link>
              </Button>
            )}
            <Button asChild variant="outline" className="rounded-xl">
              <Link to="/kids/mensagens">{t("kidsTeacher.messages")}</Link>
            </Button>
            {rooms.length > 1 && (
              <select value={currentRoom?.id || ""} onChange={e => setCurrentRoom(rooms.find(r => r.id === e.target.value) || null)} className="border rounded-xl px-3 py-2">
                {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            )}
          </div>
        </div>

        {linkedDeptId && (
          <Card className="rounded-2xl border-2 border-violet-200 bg-gradient-to-r from-violet-50 to-amber-50 dark:from-violet-950/40 dark:to-amber-950/30">
            <CardContent className="p-3 flex items-center gap-2 flex-wrap">
              <p className="text-xs text-slate-700 dark:text-slate-200 flex-1 min-w-[200px]">📌 {t("kidsTeacher.teacherArea")}</p>
              <Button asChild size="icon" variant="outline" className="rounded-xl border-violet-300" title={t("kidsTeacher.openTeachers")} aria-label={t("kidsTeacher.openTeachers")}>
                <Link to={`/departments/${linkedDeptId}`}><ExternalLink className="w-4 h-4" /></Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {rooms.length === 0 && <Card className="rounded-3xl"><CardContent className="p-8 text-center text-slate-600 dark:text-slate-300">{t("kidsTeacher.notScheduled")}</CardContent></Card>}

        {currentRoom && (
          <>
            <Card className="rounded-3xl border-2" style={{ borderColor: currentRoom.color + "60" }}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2"><QrCode className="w-4 h-4" /> {t("kidsTeacher.roomQr")}</CardTitle>
              </CardHeader>
              <CardContent>
                {qrUrl ? (
                  <div className="text-center space-y-3">
                    <img src={qrUrl} alt="Código QR fixo para check-in das crianças na sala" className="mx-auto rounded-2xl border-4" style={{ borderColor: currentRoom.color, maxWidth: 260 }} />
                    <p className="text-xs text-slate-500 dark:text-slate-400">{t("kidsTeacher.qrDetail")}</p>
                    <div className="flex gap-2 justify-center flex-wrap">
                      <Button variant="outline" size="sm" onClick={() => downloadPng(currentRoom.static_qr_token, `qr-checkin-${currentRoom.name}.png`)} className="rounded-xl">
                        <Download className="w-4 h-4 mr-1" /> PNG
                      </Button>
                      <Button size="sm" onClick={() => downloadPdf(currentRoom.static_qr_token, `qr-checkin-${currentRoom.name}.pdf`, { title: pageName || "LeviKids", subtitle: `Sala: ${currentRoom.name} — Check-in`, footer: "leviescalas.com.br" })} className="rounded-xl">
                        <FileDown className="w-4 h-4 mr-1" /> {t("kidsTeacher.printingPdf")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">{t("kidsTeacher.generatingQr")}</p>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-2">
              <CardHeader><CardTitle>{t("kidsTeacher.present", { count: items.length })}</CardTitle></CardHeader>
              <CardContent>
                {items.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-6">{t("kidsTeacher.nonePresent")}</p>
                ) : (
                  <div className="grid md:grid-cols-2 gap-3">
                    {items.map(it => {
                      const age = Math.floor((Date.now() - new Date(it.birth_date).getTime()) / (365.25 * 24 * 3600 * 1000));
                      return (
                        <div key={it.checkin_id} className="p-4 rounded-2xl border-2 bg-white dark:bg-slate-900">
                          <div className="flex gap-3">
                            {photos[it.child_id] ? (
                              <img src={photos[it.child_id]} alt="" className="w-16 h-16 rounded-2xl object-cover border-2 border-violet-200" />
                            ) : (
                              <div className="w-16 h-16 rounded-2xl bg-violet-100 text-violet-700 font-bold flex items-center justify-center text-xl">{it.full_name?.[0]}</div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-slate-900 dark:text-slate-100 truncate">{it.full_name}</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">{t("kidsTeacher.years", { count: age })}</p>
                              {it.allergies && (
                                <Badge className="mt-1 bg-red-100 text-red-700 hover:bg-red-100 border-red-200">
                                  <AlertTriangle className="w-3 h-3 mr-1" /> {t("kidsTeacher.allergy", { value: it.allergies })}
                                </Badge>
                              )}
                              {it.restrictions && <p className="text-[11px] text-amber-700 mt-1">⚠ {it.restrictions}</p>}
                            </div>
                          </div>

                          <div className="flex gap-2 mt-3">
                            <Button size="sm" variant="secondary" onClick={() => callGuardian(it)} className="rounded-xl flex-1">
                              <PhoneCall className="w-4 h-4 mr-1" /> {t("kidsTeacher.callGuardian")}
                            </Button>
                            <Button size="sm" onClick={() => openCheckout(it)} className="rounded-xl flex-1">
                              <LogOut className="w-4 h-4 mr-1" /> {t("kidsTeacher.checkout")}
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

      <Dialog open={!!checkoutFor} onOpenChange={o => { if (!o && !checkoutBusy) setCheckoutFor(null); }}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>{t("kidsTeacher.confirmCheckout")}</DialogTitle>
            <DialogDescription>
              {t("kidsTeacher.confirmDetail", { name: checkoutFor?.full_name })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <p className="text-sm font-semibold">{t("kidsTeacher.pickupWho")}</p>
            {guardiansLoading ? (
              <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin" /></div>
            ) : (
              <RadioGroup value={pickupChoice} onValueChange={setPickupChoice} className="gap-2">
                {guardians.map(g => (
                  <Label key={g.guardian_id} htmlFor={`pk-${g.guardian_id}`} className="flex items-center gap-3 rounded-xl border-2 p-3 cursor-pointer font-normal">
                    <RadioGroupItem id={`pk-${g.guardian_id}`} value={g.guardian_id} />
                    <span className="flex-1">{g.full_name}{g.relationship ? <span className="text-xs text-muted-foreground"> · {g.relationship}</span> : null}</span>
                  </Label>
                ))}
                <Label htmlFor="pk-other" className="flex items-center gap-3 rounded-xl border-2 border-amber-300 p-3 cursor-pointer font-normal">
                  <RadioGroupItem id="pk-other" value={OTHER} />
                  <span className="flex-1">{t("kidsTeacher.pickupOther")}</span>
                </Label>
              </RadioGroup>
            )}

            {pickupChoice === OTHER && (
              <div className="space-y-2">
                <Input
                  value={pickupOtherName}
                  onChange={e => setPickupOtherName(e.target.value)}
                  maxLength={120}
                  placeholder={t("kidsTeacher.pickupOtherName")}
                  aria-label={t("kidsTeacher.pickupOtherName")}
                  autoFocus
                />
                <p className="text-xs text-amber-700 dark:text-amber-400 flex gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {t("kidsTeacher.pickupOtherWarning")}
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCheckoutFor(null)} disabled={checkoutBusy}>{t("kidsTeacher.cancel")}</Button>
            <Button onClick={performCheckout} disabled={!pickupValid || checkoutBusy}>
              {checkoutBusy && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}{t("kidsTeacher.confirmCheckout")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
