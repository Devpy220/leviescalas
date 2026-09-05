import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, FileCheck2, Loader2, RefreshCw } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface Row {
  id: string;
  email: string | null;
  kind: string;
  status: string;
  requested_at: string;
  deadline: string;
  resolved_at: string | null;
}

export function DataSubjectRequestsCard() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('data_subject_requests')
      .select('id, email, kind, status, requested_at, deadline, resolved_at')
      .order('requested_at', { ascending: false })
      .limit(100);
    setRows((data as Row[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const resolve = async (id: string) => {
    const { error } = await supabase
      .from('data_subject_requests')
      .update({ status: 'concluido', resolved_at: new Date().toISOString() })
      .eq('id', id);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Pedido concluído' });
    load();
  };

  const pending = rows.filter((r) => r.status !== 'concluido');
  const late = pending.filter((r) => new Date(r.deadline) < new Date());

  return (
    <Card>
      <Collapsible>
        <CollapsibleTrigger className="w-full">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-primary" />
                Pedidos de titulares (RGPD)
                {!loading && (
                  <Badge variant={late.length ? 'destructive' : 'secondary'}>
                    {pending.length} pendente(s)
                  </Badge>
                )}
              </CardTitle>
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </div>
            <CardDescription className="text-left">
              Acesso, retificação, portabilidade e apagamento. Prazo legal de resposta: 30 dias.
            </CardDescription>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {loading ? 'A carregar...' : `${rows.length} pedido(s) registados · ${late.length} fora do prazo`}
              </p>
              <Button size="sm" variant="outline" onClick={load} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              </Button>
            </div>

            {!loading && rows.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum pedido registado até agora.</p>
            )}

            {rows.map((r) => (
              <div key={r.id} className="rounded-lg border p-3 flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium capitalize">{r.kind}</span>
                <span className="text-xs text-muted-foreground">{r.email || 'sem e-mail'}</span>
                <span className="text-xs text-muted-foreground">
                  pedido {new Date(r.requested_at).toLocaleDateString('pt-PT')} · prazo {new Date(r.deadline).toLocaleDateString('pt-PT')}
                </span>
                <Badge variant={r.status === 'concluido' ? 'secondary' : new Date(r.deadline) < new Date() ? 'destructive' : 'outline'}>
                  {r.status}
                </Badge>
                {r.status !== 'concluido' && (
                  <Button size="sm" variant="outline" className="ml-auto" onClick={() => resolve(r.id)}>
                    Marcar concluído
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

export default DataSubjectRequestsCard;
