import { useEffect, useState } from "react";
import { Fingerprint, Loader2, Trash2, Plus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  isWebAuthnSupported,
  isPlatformAuthenticatorAvailable,
  registerBiometric,
} from "@/lib/webauthn";

interface Credential {
  id: string;
  device_name: string;
  created_at: string;
  last_used_at: string | null;
}

export function BiometricLoginCard() {
  const { toast } = useToast();
  const [supported, setSupported] = useState(false);
  const [creds, setCreds] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("webauthn_credentials")
      .select("id, device_name, created_at, last_used_at")
      .order("created_at", { ascending: false });
    setCreds((data as Credential[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    (async () => {
      if (!isWebAuthnSupported()) {
        setSupported(false);
        setLoading(false);
        return;
      }
      const platform = await isPlatformAuthenticatorAvailable();
      setSupported(platform);
      await load();
    })();
  }, []);

  const handleAdd = async () => {
    setRegistering(true);
    try {
      await registerBiometric();
      toast({ title: "Biometria cadastrada", description: "Agora você pode entrar com Face ID/digital." });
      await load();
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Não foi possível cadastrar",
        description: e?.message || "Tente novamente.",
      });
    } finally {
      setRegistering(false);
    }
  };

  const handleRemove = async (id: string) => {
    const { error } = await supabase.from("webauthn_credentials").delete().eq("id", id);
    if (error) {
      toast({ variant: "destructive", title: "Erro", description: "Não foi possível remover." });
      return;
    }
    toast({ title: "Removido", description: "Dispositivo removido com sucesso." });
    await load();
  };

  if (!supported && !loading) {
    return (
      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-muted text-muted-foreground">
              <Fingerprint className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-lg">Entrar com Face ID / digital</CardTitle>
              <CardDescription>Disponível em dispositivos com biometria (iPhone, Android, Mac, Windows Hello).</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Este dispositivo/navegador não oferece suporte a biometria.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-violet-500/10 text-violet-500">
            <Fingerprint className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-lg">Entrar com Face ID / digital</CardTitle>
            <CardDescription>Cadastre seus aparelhos para entrar sem digitar a senha.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        ) : creds.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum dispositivo cadastrado ainda.</p>
        ) : (
          <ul className="space-y-2">
            {creds.map((c) => (
              <li key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="font-medium text-sm">{c.device_name}</p>
                  <p className="text-xs text-muted-foreground">
                    Cadastrado em {new Date(c.created_at).toLocaleDateString("pt-BR")}
                    {c.last_used_at && ` · Último uso: ${new Date(c.last_used_at).toLocaleDateString("pt-BR")}`}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleRemove(c.id)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <Button onClick={handleAdd} disabled={registering} className="gap-2">
          {registering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Adicionar este dispositivo
        </Button>
      </CardContent>
    </Card>
  );
}
