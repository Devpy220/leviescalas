import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, ShieldCheck, ArrowLeft } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { SEO } from "@/components/SEO";

export default function AuthorizeMinor() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [me, setMe] = useState<{ birth_date: string | null } | null>(null);
  const [found, setFound] = useState<{ id: string; name: string; email: string; birth_date: string | null; guardian_authorized_by: string | null } | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("birth_date").eq("id", user.id).maybeSingle()
      .then(({ data }) => setMe((data as any) || null));
  }, [user]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  if (!user) { nav("/auth", { state: { returnUrl: "/authorize-minor" } }); return null; }

  const adult = me?.birth_date && (Date.now() - new Date(me.birth_date).getTime()) / (365.25 * 864e5) >= 18;

  async function search() {
    if (!email.trim()) return;
    setBusy(true); setFound(null);
    const { data } = await supabase
      .from("profiles")
      .select("id,name,email,birth_date,guardian_authorized_by")
      .ilike("email", email.trim())
      .maybeSingle();
    setBusy(false);
    if (!data) { toast({ title: "Usuário não encontrado", variant: "destructive" }); return; }
    setFound(data as any);
  }

  async function authorize() {
    if (!found) return;
    setBusy(true);
    const { error } = await (supabase.rpc as any)("authorize_minor", { _minor_id: found.id });
    setBusy(false);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Autorização concedida", description: `${found.name} agora pode servir como voluntário(a).` });
    setFound({ ...found, guardian_authorized_by: user!.id });
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <SEO title="Autorizar Menor — LEVI" description="Autorize seu filho(a) menor de 18 anos a servir como voluntário no LEVI/LeviKids." path="/authorize-minor" />
      <div className="max-w-lg mx-auto space-y-4">
        <Button variant="ghost" asChild><Link to="/dashboard"><ArrowLeft className="w-4 h-4 mr-1" /> Voltar</Link></Button>
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-primary" /> Autorizar filho(a) menor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!adult && (
              <Alert variant="destructive">
                <AlertDescription>Apenas usuários com 18 anos ou mais podem autorizar um menor. Complete sua data de nascimento primeiro.</AlertDescription>
              </Alert>
            )}
            <p className="text-sm text-muted-foreground">
              Informe o e-mail que seu filho(a) usa no LEVI. Ao autorizar, ele(a) poderá atuar como voluntário(a) ou auxiliar,
              sempre junto de um professor adulto (16+).
            </p>

            <div className="flex gap-2">
              <div className="flex-1">
                <Label>E-mail do menor</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="filho@email.com" />
              </div>
              <Button onClick={search} disabled={!adult || busy || !email.trim()} className="self-end">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Buscar"}
              </Button>
            </div>

            {found && (
              <div className="rounded-xl border p-3 space-y-2">
                <p className="font-medium">{found.name}</p>
                <p className="text-xs text-muted-foreground">{found.email}</p>
                <p className="text-xs">Nascimento: {found.birth_date || <em>não informado</em>}</p>
                {found.guardian_authorized_by ? (
                  <Alert><AlertDescription>Este usuário já está autorizado.</AlertDescription></Alert>
                ) : (
                  <Button onClick={authorize} disabled={busy || !found.birth_date} className="w-full">
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Autorizar este menor"}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
