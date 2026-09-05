import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Globe, ChevronDown, Loader2, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import {
  COUNTRY_COMPLIANCE,
  RISK_LABEL,
  detectCountry,
  type CountryCompliance,
} from '@/lib/countryCompliance';

interface CountryStat {
  country: CountryCompliance;
  people: number;
  churches: number;
  examples: string[];
}

export function InternationalComplianceCard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<CountryStat[]>([]);
  const [brazil, setBrazil] = useState(0);

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: profiles }, { data: churches }] = await Promise.all([
        supabase.from('profiles').select('full_name, whatsapp'),
        supabase.from('churches').select('name, phone'),
      ]);

      const map = new Map<string, CountryStat>();
      let br = 0;

      const add = (iso: string | null, country: CountryCompliance | null, label: string, kind: 'people' | 'churches') => {
        if (!country) return;
        if (country.iso === 'BR') { br++; return; }
        const current = map.get(country.iso) || { country, people: 0, churches: 0, examples: [] };
        current[kind] += 1;
        if (current.examples.length < 5 && label) current.examples.push(label);
        map.set(country.iso, current);
      };

      (profiles || []).forEach((p) => add(null, detectCountry(p.whatsapp), p.full_name || '', 'people'));
      (churches || []).forEach((c) => add(null, detectCountry(c.phone), c.name || '', 'churches'));

      setBrazil(br);
      setStats([...map.values()].sort((a, b) => (b.people + b.churches) - (a.people + a.churches)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const critical = stats.filter((s) => s.country.risk === 'critico');

  return (
    <Card>
      <Collapsible>
        <CollapsibleTrigger className="w-full">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Globe className="w-5 h-5 text-primary" />
                Conformidade internacional
                {!loading && stats.length > 0 && (
                  <Badge variant={critical.length ? 'destructive' : 'secondary'}>
                    {stats.length} {stats.length === 1 ? 'país' : 'países'}
                  </Badge>
                )}
              </CardTitle>
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </div>
            <CardDescription className="text-left">
              Detecta cadastros fora do Brasil pelo telefone e mostra as leis de cada país
              para ajustarmos o LEVI e evitar bloqueios.
            </CardDescription>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {loading ? 'Analisando cadastros...' : `${brazil} cadastros no Brasil (LGPD)`}
              </p>
              <Button size="sm" variant="outline" onClick={load} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              </Button>
            </div>

            {!loading && stats.length === 0 && (
              <div className="flex items-start gap-2 rounded-lg border p-3 text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5" />
                <span>
                  Nenhum cadastro internacional detectado. Todos os telefones são brasileiros,
                  então apenas a LGPD se aplica hoje.
                </span>
              </div>
            )}

            {stats.map((s) => (
              <div key={s.country.iso} className="rounded-lg border p-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-lg" aria-hidden>{s.country.flag}</span>
                  <span className="font-semibold">{s.country.name}</span>
                  <Badge variant={s.country.risk === 'critico' ? 'destructive' : 'secondary'}>
                    {RISK_LABEL[s.country.risk]}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {s.people} pessoa(s) · {s.churches} igreja(s)
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">Lei aplicável: {s.country.law}</p>
                <ul className="space-y-1">
                  {s.country.requirements.map((r) => (
                    <li key={r} className="flex items-start gap-2 text-sm">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-1 shrink-0" />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
                {s.examples.length > 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    Ex.: {s.examples.join(', ')}
                  </p>
                )}
              </div>
            ))}

            <details className="rounded-lg border p-3">
              <summary className="cursor-pointer text-sm font-medium">
                Ver todas as leis monitoradas ({COUNTRY_COMPLIANCE.length} países)
              </summary>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {COUNTRY_COMPLIANCE.map((c) => (
                  <li key={c.iso}>
                    {c.flag} <strong>{c.name}</strong> (+{c.dial}) — {c.law}
                  </li>
                ))}
              </ul>
            </details>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

export default InternationalComplianceCard;
