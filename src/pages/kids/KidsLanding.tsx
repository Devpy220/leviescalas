import { LeviKidsWordmark } from "@/components/LeviKidsWordmark";
import { Link } from "react-router-dom";
import { Baby, Sparkles, ShieldCheck, QrCode, Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useMyKidsPage } from "@/hooks/useKidsPage";
import { Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function KidsLanding() {
  const { page, role, loading } = useMyKidsPage();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-amber-50">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-100 text-violet-700 text-sm font-semibold mb-4">
            <Sparkles className="w-4 h-4" /> <LeviKidsWordmark />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-3">Ministério infantil seguro e divertido</h1>
          <p className="text-slate-600 text-lg">Cadastro, check-in por QR code e retirada com código pessoal.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mb-10">
          <Card className="border-2 border-violet-100 rounded-3xl">
            <CardContent className="p-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-violet-100 text-violet-700 flex items-center justify-center mx-auto mb-3"><Baby className="w-7 h-7" /></div>
              <h3 className="font-bold text-slate-900 mb-1">Cadastro simples</h3>
              <p className="text-sm text-slate-600">Responsáveis cadastram seus filhos pelo QR code da sala.</p>
            </CardContent>
          </Card>
          <Card className="border-2 border-amber-100 rounded-3xl">
            <CardContent className="p-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-3"><QrCode className="w-7 h-7" /></div>
              <h3 className="font-bold text-slate-900 mb-1">QR fixo por sala</h3>
              <p className="text-sm text-slate-600">Um QR único colado na porta da sala. Válido apenas na janela de horário do culto.</p>
            </CardContent>
          </Card>
          <Card className="border-2 border-emerald-100 rounded-3xl">
            <CardContent className="p-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-3"><ShieldCheck className="w-7 h-7" /></div>
              <h3 className="font-bold text-slate-900 mb-1">Retirada segura</h3>
              <p className="text-sm text-slate-600">Só sai da sala com código de 4 dígitos.</p>
            </CardContent>
          </Card>
        </div>

        {role === "leader" && page?.static_qr_token && (
          <div className="mb-6 rounded-3xl border-2 border-violet-200 bg-white/80 backdrop-blur p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Baby className="w-4 h-4 text-violet-600" />
              <p className="text-sm font-semibold text-slate-900">Link de cadastro dos responsáveis</p>
            </div>
            <p className="text-xs text-slate-600">Compartilhe com os pais para cadastrarem seus filhos (foto e data de nascimento).</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-slate-50 rounded-lg px-3 py-2 truncate">
                {`${window.location.origin}/kids/join/${page.static_qr_token}`}
              </code>
              <button
                type="button"
                title="Copiar link"
                aria-label="Copiar link"
                className="p-2 rounded-lg bg-violet-600 text-white hover:opacity-90"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/kids/join/${page.static_qr_token}`);
                  toast({ title: "Link copiado!" });
                }}
              >
                <Copy className="w-4 h-4" />
              </button>
              <Link
                to="/kids/admin"
                title="Abrir painel LeviKids"
                aria-label="Abrir painel LeviKids"
                className="p-2 rounded-lg border-2 border-violet-300 text-violet-700 hover:bg-violet-100"
              >
                <ExternalLink className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-3 justify-center">
          {role === "leader" && <Button asChild size="lg" className="rounded-2xl"><Link to="/kids/admin">Painel do líder</Link></Button>}
          {role === "teacher" && <Button asChild size="lg" className="rounded-2xl"><Link to="/kids/dashboard">Dashboard do professor</Link></Button>}
          {role === "guardian" && <Button asChild size="lg" className="rounded-2xl"><Link to="/kids/checkin">Fazer check-in</Link></Button>}
          {!role && page === null && (
            <div className="text-center text-slate-600">
              <p>Peça o link de ativação do LeviKids ao administrador do LEVI, ou o QR code de cadastro na sua sala da igreja.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
