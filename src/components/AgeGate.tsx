import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, ShieldAlert, CalendarDays, AlertTriangle } from "lucide-react";
import { toast } from "@/hooks/use-toast";

// Public / bypass paths: age gate should not block these
const BYPASS_PREFIXES = [
  "/", "/auth", "/join", "/church-setup", "/apoiar", "/confirm", "/tutorial",
  "/complete-profile", "/authorize-minor", "/kids", "/igreja", "/oauth",
  "/.lovable", "/admin", "/admin-login", "/login", "/entrar", "/acessar",
];

function isBypass(pathname: string) {
  if (pathname === "/") return true;
  return BYPASS_PREFIXES.some((p) => p !== "/" && (pathname === p || pathname.startsWith(p + "/")));
}

function calcAge(iso: string): number {
  const bd = new Date(iso);
  const diff = Date.now() - bd.getTime();
  return diff / (365.25 * 24 * 3600 * 1000);
}

export function AgeGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);
  const [profile, setProfile] = useState<{ birth_date: string | null; guardian_authorized_by: string | null } | null>(null);
  const [saving, setSaving] = useState(false);
  const [birth, setBirth] = useState("");

  const bypass = isBypass(location.pathname);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (loading) return;
      if (!user) { setChecked(true); setProfile(null); return; }
      setChecked(false);
      const { data } = await supabase
        .from("profiles")
        .select("birth_date, guardian_authorized_by")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      setProfile((data as any) || { birth_date: null, guardian_authorized_by: null });
      setChecked(true);
    }
    load();
    return () => { cancelled = true; };
  }, [user, loading, location.pathname]);

  async function saveBirth() {
    if (!user || !birth) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ birth_date: birth } as any).eq("id", user.id);
    setSaving(false);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setProfile((p) => ({ ...(p as any), birth_date: birth }));
  }

  // Always render children; overlay dialogs on top when needed.
  const showBirthPrompt = !bypass && user && checked && profile && !profile.birth_date;
  const isMinor = !!profile?.birth_date && calcAge(profile.birth_date) < 18;
  const showMinorBlock = !bypass && user && checked && isMinor && !profile?.guardian_authorized_by;

  return (
    <>
      {children}

      {/* Ask birth date */}
      <Dialog open={!!showBirthPrompt}>
        <DialogContent className="max-w-md" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-primary" /> Complete seu perfil
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Para continuar usando o LEVI/LeviKids precisamos da sua data de nascimento.
              Menores de 18 anos precisam de autorização de um responsável.
            </p>
            <div>
              <Label>Data de nascimento *</Label>
              <Input type="date" value={birth} max={new Date().toISOString().slice(0,10)} onChange={(e) => setBirth(e.target.value)} />
            </div>
            <Button onClick={saveBirth} disabled={!birth || saving} className="w-full">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Block minor without guardian authorization */}
      <Dialog open={!!showMinorBlock}>
        <DialogContent className="max-w-md" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="w-5 h-5" /> Autorização necessária
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Alert>
              <AlertDescription className="text-sm">
                Você é menor de 18 anos. Para servir como voluntário(a) ou auxiliar de sala,
                seu <strong>pai, mãe ou responsável legal</strong> precisa autorizar seu cadastro
                e você deve sempre atuar junto de um professor adulto (16+).
              </AlertDescription>
            </Alert>
            <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground space-y-1">
              <p><strong>Como autorizar:</strong></p>
              <ol className="list-decimal ml-4 space-y-0.5">
                <li>Peça ao seu responsável para acessar o LEVI com a conta dele.</li>
                <li>Ele deve abrir a página <code>/authorize-minor</code>.</li>
                <li>Informar seu e-mail e confirmar a autorização.</li>
              </ol>
              <p className="pt-1">Em caso de dúvida, fale com o líder da sua igreja.</p>
            </div>
            <Button variant="outline" className="w-full" onClick={async () => { await supabase.auth.signOut(); navigate("/"); }}>
              Sair
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
