import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { Navigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, ArrowLeft, Search, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface LogRow {
  id: string;
  phone: string;
  message: string;
  status: string;
  error: string | null;
  origin: string | null;
  created_at: string;
}

const statusVariant: Record<string, { label: string; className: string }> = {
  sent: { label: 'Enviado', className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30' },
  failed: { label: 'Falhou', className: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30' },
  invalid_phone: { label: 'Telefone inválido', className: 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30' },
  invalid_input: { label: 'Entrada inválida', className: 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30' },
  config_error: { label: 'Sem credenciais', className: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30' },
  exception: { label: 'Exceção', className: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30' },
};

export default function WhatsAppLogs() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'sent' | 'failed'>('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    let query = supabase
      .from('whatsapp_logs' as any)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    if (statusFilter === 'sent') query = query.eq('status', 'sent');
    if (statusFilter === 'failed') query = query.in('status', ['failed', 'invalid_phone', 'invalid_input', 'config_error', 'exception']);
    const { data, error } = await query;
    if (!error && data) setLogs(data as any);
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) fetchLogs();
  }, [isAdmin, statusFilter]);

  if (authLoading || adminLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  const filtered = logs.filter(l => {
    if (!filter) return true;
    const f = filter.toLowerCase();
    return l.phone.toLowerCase().includes(f) || l.message.toLowerCase().includes(f) || (l.origin ?? '').toLowerCase().includes(f);
  });

  const stats = {
    total: logs.length,
    sent: logs.filter(l => l.status === 'sent').length,
    failed: logs.filter(l => l.status !== 'sent').length,
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to="/admin"><ArrowLeft className="w-4 h-4 mr-1" /> Admin</Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2"><MessageSquare className="w-6 h-6 text-violet-600" /> Logs WhatsApp</h1>
              <p className="text-sm text-muted-foreground">Status de cada envio para auditoria de entregas</p>
            </div>
          </div>
          <Button onClick={fetchLogs} variant="outline" size="sm" disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Atualizar
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Card><CardHeader className="pb-2"><CardDescription>Total</CardDescription><CardTitle className="text-2xl">{stats.total}</CardTitle></CardHeader></Card>
          <Card><CardHeader className="pb-2"><CardDescription>Enviados</CardDescription><CardTitle className="text-2xl text-emerald-600">{stats.sent}</CardTitle></CardHeader></Card>
          <Card><CardHeader className="pb-2"><CardDescription>Falhas</CardDescription><CardTitle className="text-2xl text-red-600">{stats.failed}</CardTitle></CardHeader></Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Buscar por telefone, mensagem ou origem..." value={filter} onChange={(e) => setFilter(e.target.value)} className="pl-9" />
              </div>
              <div className="flex gap-1">
                {(['all', 'sent', 'failed'] as const).map(s => (
                  <Button key={s} size="sm" variant={statusFilter === s ? 'default' : 'outline'} onClick={() => setStatusFilter(s)}>
                    {s === 'all' ? 'Todos' : s === 'sent' ? 'Enviados' : 'Falhas'}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">Nenhum log encontrado.</div>
            ) : (
              <div className="divide-y">
                {filtered.map(log => {
                  const sv = statusVariant[log.status] ?? { label: log.status, className: 'bg-muted text-muted-foreground' };
                  const isOpen = expanded === log.id;
                  return (
                    <div key={log.id} className="p-3 hover:bg-muted/50 transition cursor-pointer" onClick={() => setExpanded(isOpen ? null : log.id)}>
                      <div className="flex items-center gap-3 flex-wrap">
                        <Badge variant="outline" className={sv.className}>{sv.label}</Badge>
                        <span className="font-mono text-sm">{log.phone || '—'}</span>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1 line-clamp-1">
                        {log.message.split('\n')[0]}
                      </div>
                      {log.origin && <div className="text-xs text-muted-foreground mt-0.5">Origem: {log.origin}</div>}
                      {log.error && !isOpen && <div className="text-xs text-red-600 mt-1 line-clamp-1">⚠ {log.error}</div>}
                      {isOpen && (
                        <div className="mt-3 space-y-2 text-xs">
                          <div>
                            <div className="font-semibold text-muted-foreground mb-1">Mensagem completa:</div>
                            <pre className="whitespace-pre-wrap bg-muted p-2 rounded">{log.message}</pre>
                          </div>
                          {log.error && (
                            <div>
                              <div className="font-semibold text-red-600 mb-1">Erro:</div>
                              <pre className="whitespace-pre-wrap bg-red-500/10 text-red-700 dark:text-red-400 p-2 rounded">{log.error}</pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
