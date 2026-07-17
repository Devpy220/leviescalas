import { LeviKidsWordmark } from "@/components/LeviKidsWordmark";
import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Calendar, Baby, ArrowRight, AlertCircle, Church } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface HubInfo {
  church_id: string;
  church_name: string;
  has_kids_page: boolean;
}

export default function ChurchJoinHub() {
  const { code = "" } = useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [info, setInfo] = useState<HubInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creatingKids, setCreatingKids] = useState(false);
  const [kidsName, setKidsName] = useState("LeviKids");
  const [showKidsForm, setShowKidsForm] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc("church_hub_info" as any, { _code: code });
      if (error || !data || (Array.isArray(data) && data.length === 0)) {
        setError("Código de igreja inválido ou não encontrado.");
      } else {
        setInfo(Array.isArray(data) ? (data[0] as HubInfo) : (data as HubInfo));
      }
      setLoading(false);
    })();
  }, [code]);

  const goAuth = () => {
    const redirect = encodeURIComponent(`/igreja/join/${code}`);
    navigate(`/auth?tab=register&redirect=${redirect}`);
  };

  const goCreateDept = () => {
    navigate(`/departments/new?churchCode=${code.toUpperCase()}`);
  };

  const handleCreateKidsPage = async () => {
    if (!kidsName.trim()) {
      toast({ variant: "destructive", title: "Informe um nome para a página" });
      return;
    }
    setCreatingKids(true);
    const { data, error } = await supabase.rpc("kids_create_page_by_church_code" as any, {
      _code: code,
      _name: kidsName.trim(),
    });
    setCreatingKids(false);
    if (error) {
      toast({ variant: "destructive", title: "Erro ao criar página", description: error.message });
      return;
    }
    toast({ title: "Página LeviKids criada!", description: "Você agora é o líder Kids desta igreja." });
    navigate("/kids/admin");
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !info) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
            <p className="text-lg font-semibold">{error || "Igreja não encontrada"}</p>
            <Link to="/"><Button variant="outline">Voltar</Button></Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-2">
            <Church className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold">{info.church_name}</h1>
          <p className="text-muted-foreground">
            Escolha o que deseja criar para esta igreja
          </p>
          <p className="text-xs font-mono text-muted-foreground">Código: {code.toUpperCase()}</p>
        </div>

        {!user && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Faça login para continuar</AlertTitle>
            <AlertDescription>
              Você precisa de uma conta para criar um departamento ou a página LeviKids.
              <div className="mt-3">
                <Button onClick={goAuth}>Entrar / Cadastrar</Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          {/* Departamento */}
          <Card className="border-2 hover:border-primary/50 transition-colors">
            <CardHeader>
              <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center mb-2">
                <Calendar className="w-6 h-6 text-primary-foreground" />
              </div>
              <CardTitle>Criar Departamento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Louvor, Mídia, Recepção, Diaconia... Crie um ministério para escalar voluntários.
              </p>
              <p className="text-xs text-muted-foreground">
                Você pode criar quantos departamentos quiser.
              </p>
              <Button
                className="w-full"
                onClick={user ? goCreateDept : goAuth}
              >
                {user ? "Criar Departamento" : "Entrar para criar"}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>

          {/* LeviKids */}
          <Card className={`border-2 ${info.has_kids_page ? "opacity-70" : "hover:border-amber-500/50"} transition-colors`}>
            <CardHeader>
              <div className="w-12 h-12 rounded-xl bg-amber-500 flex items-center justify-center mb-2">
                <Baby className="w-6 h-6 text-white" />
              </div>
              <CardTitle>Criar Página <LeviKidsWordmark /></CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Área infantil: salas por faixa etária, professores, check-in/out com QR code e mensagens aos pais.
              </p>
              <Alert className="border-amber-500/30 bg-amber-500/5 py-2">
                <AlertDescription className="text-xs">
                  ⚠️ <strong>Uma página <LeviKidsWordmark /> por igreja.</strong> Quem criar vira o líder Kids automaticamente.
                </AlertDescription>
              </Alert>

              {info.has_kids_page ? (
                <Button variant="outline" className="w-full" disabled>
                  Já existe uma página <LeviKidsWordmark />
                </Button>
              ) : !user ? (
                <Button variant="outline" className="w-full" onClick={goAuth}>
                  Entrar para criar
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              ) : !showKidsForm ? (
                <Button
                  className="w-full bg-amber-500 hover:bg-amber-600 text-white"
                  onClick={() => setShowKidsForm(true)}
                >
                  Criar Página <LeviKidsWordmark />
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="kidsName">Nome da página</Label>
                  <Input
                    id="kidsName"
                    value={kidsName}
                    onChange={(e) => setKidsName(e.target.value)}
                    placeholder="Ex: LeviKids Igreja X"
                  />
                  <Button
                    className="w-full bg-amber-500 hover:bg-amber-600 text-white"
                    onClick={handleCreateKidsPage}
                    disabled={creatingKids}
                  >
                    {creatingKids ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Criando...</>
                    ) : (
                      "Confirmar e criar"
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="text-center">
          <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
            Ir para o Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
