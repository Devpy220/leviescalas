import { useState, useEffect } from 'react';
import { Copy, Check, Share2, Link2, Users, Eye, RefreshCw } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface InviteMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inviteCode: string;
  departmentId?: string;
  coordinatorInviteCode?: string;
}

export default function InviteMemberDialog({
  open,
  onOpenChange,
  inviteCode,
  departmentId,
  coordinatorInviteCode: initialCoordCode,
}: InviteMemberDialogProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [coordCode, setCoordCode] = useState(initialCoordCode || '');
  const [loadingCoord, setLoadingCoord] = useState(false);
  const [rotating, setRotating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setCoordCode(initialCoordCode || '');
  }, [initialCoordCode]);

  // Fetch coordinator code if not provided
  useEffect(() => {
    if (!open || coordCode || !departmentId) return;
    setLoadingCoord(true);
    (supabase as any)
      .rpc('get_department_secure', { dept_id: departmentId })
      .then(({ data }: any) => {
        if (data && data[0]?.coordinator_invite_code) {
          setCoordCode(data[0].coordinator_invite_code);
        }
      })
      .finally(() => setLoadingCoord(false));
  }, [open, departmentId, coordCode]);

  const memberUrl = `${window.location.origin}/join/${inviteCode}`;
  const coordUrl = coordCode ? `${window.location.origin}/join-coordinator/${coordCode}` : '';

  const copy = async (url: string, key: string, msg: string) => {
    await navigator.clipboard.writeText(url);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
    toast({ title: 'Link copiado!', description: msg });
  };

  const shareWhatsApp = (url: string, text: string) => {
    const encoded = encodeURIComponent(`${text}\n\n${url}`);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  const handleRotateCoord = async () => {
    if (!departmentId) return;
    setRotating(true);
    try {
      const { data, error } = await (supabase as any)
        .rpc('rotate_coordinator_invite_code', { dept_id: departmentId });
      if (error) throw error;
      setCoordCode(data);
      toast({ title: 'Novo link gerado', description: 'O link anterior foi invalidado.' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro', description: e?.message || 'Tente novamente.' });
    } finally {
      setRotating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Share2 className="w-5 h-5 text-primary" />
            Convidar para o departamento
          </DialogTitle>
          <DialogDescription>
            Escolha o tipo de convite que deseja compartilhar.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="member" className="mt-2">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="member" className="gap-2">
              <Users className="w-4 h-4" /> Membro
            </TabsTrigger>
            <TabsTrigger value="coordinator" className="gap-2">
              <Eye className="w-4 h-4" /> Coordenador
            </TabsTrigger>
          </TabsList>

          {/* MEMBER TAB */}
          <TabsContent value="member" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              O membro entra na equipe, recebe notificações no WhatsApp, marca disponibilidade e pode ser escalado.
            </p>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Link2 className="w-4 h-4 text-muted-foreground" />
                Link de convite
              </label>
              <div className="flex gap-2">
                <Input readOnly value={memberUrl} className="font-mono text-xs bg-muted/50" />
                <Button variant="outline" size="icon" onClick={() => copy(memberUrl, 'member', 'Compartilhe com novos membros.')}>
                  {copiedKey === 'member' ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            <Button
              onClick={() => shareWhatsApp(memberUrl, 'Você foi convidado para participar de um departamento no LEVI! 📅')}
              className="w-full bg-[#25D366] hover:bg-[#25D366]/90 text-white"
            >
              Compartilhar no WhatsApp
            </Button>
          </TabsContent>

          {/* COORDINATOR TAB */}
          <TabsContent value="coordinator" className="space-y-4 mt-4">
            <div className="rounded-xl bg-primary/5 border border-primary/15 p-3 text-sm">
              <p className="font-medium text-foreground mb-1 flex items-center gap-2">
                <Eye className="w-4 h-4 text-primary" /> Acesso somente leitura
              </p>
              <ul className="text-xs text-muted-foreground space-y-0.5">
                <li>• Vê escalas, datas, horários e quem está escalado</li>
                <li>• Não pode editar nem criar escalas</li>
                <li>• Não recebe notificações nem aparece em escalas</li>
              </ul>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Link2 className="w-4 h-4 text-muted-foreground" />
                Link de coordenador
              </label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={loadingCoord ? 'Carregando...' : coordUrl}
                  className="font-mono text-xs bg-muted/50"
                />
                <Button
                  variant="outline"
                  size="icon"
                  disabled={!coordUrl}
                  onClick={() => copy(coordUrl, 'coord', 'Compartilhe com o coordenador.')}
                >
                  {copiedKey === 'coord' ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => shareWhatsApp(coordUrl, 'Você foi convidado como coordenador (somente leitura) de um departamento no LEVI 👀')}
                disabled={!coordUrl}
                className="flex-1 bg-[#25D366] hover:bg-[#25D366]/90 text-white"
              >
                WhatsApp
              </Button>
              <Button
                variant="outline"
                onClick={handleRotateCoord}
                disabled={rotating || !departmentId}
                title="Gerar novo link e invalidar o anterior"
              >
                <RefreshCw className={`w-4 h-4 ${rotating ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
