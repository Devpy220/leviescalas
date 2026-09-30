import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Globe } from 'lucide-react';

interface LogRow { id: string; church_name: string | null; country: string; status: string; created_at: string }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export function ComplianceAlertSettingsCard() {
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [logs, setLogs] = useState<LogRow[]>([]);

  useEffect(() => {
    db.from('admin_settings').select('value').eq('key', 'compliance_alert_phone').maybeSingle()
      .then(({ data }: { data: { value: string } | null }) => setPhone(data?.value ?? ''));
    db.from('compliance_alert_logs').select('id, church_name, country, status, created_at')
      .order('created_at', { ascending: false }).limit(10)
      .then(({ data }: { data: LogRow[] | null }) => setLogs(data ?? []));
  }, []);

  const save = async () => {
    setSaving(true);
    const { error } = await db.from('admin_settings')
      .upsert({ key: 'compliance_alert_phone', value: phone.trim(), updated_at: new Date().toISOString() });
    setSaving(false);
    toast(error ? { title: 'Erro ao salvar', description: error.message, variant: 'destructive' } : { title: 'Número salvo' });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Globe className="w-5 h-5" /> Configurações — Alerta de igrejas fora do Brasil</CardTitle>
        <CardDescription>WhatsApp da equipe ELS Digital que recebe o levantamento de leis de proteção de dados. Nunca é enviado à igreja.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2 items-end">
          <div className="flex-1 space-y-2">
            <Label htmlFor="compliance-phone">Número de destino (com DDI)</Label>
            <Input id="compliance-phone" placeholder="+55 11 99999-9999" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <Button onClick={save} disabled={saving}>Salvar</Button>
        </div>
        {logs.length > 0 && (
          <div className="space-y-1 text-sm">
            <p className="font-medium">Últimos envios</p>
            {logs.map((l) => (
              <div key={l.id} className="flex justify-between gap-2 text-muted-foreground">
                <span>{l.church_name} · {l.country}</span>
                <span className="flex gap-2 items-center">
                  {new Date(l.created_at).toLocaleString('pt-BR')}
                  <Badge variant={l.status === 'sent' ? 'default' : 'destructive'}>{l.status}</Badge>
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
