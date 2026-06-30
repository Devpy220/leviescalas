import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Gauge, RefreshCw, Smartphone, Monitor, ExternalLink } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface Scores {
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
}
interface Metrics {
  fcp: string; lcp: string; tbt: string; cls: string; si: string; tti: string;
}
interface StrategyResult {
  strategy: 'mobile' | 'desktop';
  fetchedUrl: string;
  fetchedAt: string;
  scores: Scores;
  metrics: Metrics;
}
interface StrategyError {
  error: string;
  message?: string;
  fallback: true;
}
type StrategyOutcome = StrategyResult | StrategyError;
interface Report {
  url: string;
  mobile: StrategyOutcome;
  desktop: StrategyOutcome;
  fallback?: boolean;
}
const isStrategyError = (r: StrategyOutcome): r is StrategyError =>
  (r as StrategyError).error !== undefined || !(r as StrategyResult).scores;

const scoreColor = (n: number) => {
  if (n >= 90) return 'text-emerald-500';
  if (n >= 50) return 'text-amber-500';
  return 'text-destructive';
};
const scoreBg = (n: number) => {
  if (n >= 90) return 'bg-emerald-500/10 border-emerald-500/30';
  if (n >= 50) return 'bg-amber-500/10 border-amber-500/30';
  return 'bg-destructive/10 border-destructive/30';
};

function ScoreTile({ label, value }: { label: string; value: number }) {
  return (
    <div className={`rounded-2xl border p-4 flex flex-col items-center justify-center ${scoreBg(value)}`}>
      <div className={`text-3xl font-bold ${scoreColor(value)}`}>{value}</div>
      <div className="text-xs text-muted-foreground mt-1 text-center">{label}</div>
    </div>
  );
}

function StrategyCard({ result, icon }: { result: StrategyResult; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-card/50 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-medium capitalize">
          {icon} {result.strategy}
        </div>
        <span className="text-xs text-muted-foreground">
          {new Date(result.fetchedAt).toLocaleString('pt-BR')}
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <ScoreTile label="Performance" value={result.scores.performance} />
        <ScoreTile label="Acessibilidade" value={result.scores.accessibility} />
        <ScoreTile label="Boas práticas" value={result.scores.bestPractices} />
        <ScoreTile label="SEO" value={result.scores.seo} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
        <div className="rounded-lg bg-muted/40 p-2"><span className="text-muted-foreground">FCP:</span> <b>{result.metrics.fcp}</b></div>
        <div className="rounded-lg bg-muted/40 p-2"><span className="text-muted-foreground">LCP:</span> <b>{result.metrics.lcp}</b></div>
        <div className="rounded-lg bg-muted/40 p-2"><span className="text-muted-foreground">TBT:</span> <b>{result.metrics.tbt}</b></div>
        <div className="rounded-lg bg-muted/40 p-2"><span className="text-muted-foreground">CLS:</span> <b>{result.metrics.cls}</b></div>
        <div className="rounded-lg bg-muted/40 p-2"><span className="text-muted-foreground">Speed Index:</span> <b>{result.metrics.si}</b></div>
        <div className="rounded-lg bg-muted/40 p-2"><span className="text-muted-foreground">TTI:</span> <b>{result.metrics.tti}</b></div>
      </div>
    </div>
  );
}

export function LighthouseReportCard() {
  const [url, setUrl] = useState('https://leviescalas.com.br');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<Report | null>(null);

  const run = async () => {
    setLoading(true);
    setReport(null);
    try {
      const { data, error } = await supabase.functions.invoke('lighthouse-report', {
        body: { url },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setReport(data as Report);
      toast({ title: 'Relatório gerado', description: 'Lighthouse executado com sucesso.' });
    } catch (e: any) {
      toast({
        title: 'Falha ao gerar relatório',
        description: e?.message ?? 'Tente novamente em alguns segundos.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gauge className="w-5 h-5 text-primary" />
          Relatório Lighthouse
        </CardTitle>
        <CardDescription>
          Roda o Google PageSpeed Insights (Lighthouse real) para Mobile e Desktop. Performance, Acessibilidade, Boas práticas e SEO.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://leviescalas.com.br"
            disabled={loading}
          />
          <Button onClick={run} disabled={loading || !url} className="gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {loading ? 'Analisando…' : 'Rodar análise'}
          </Button>
        </div>

        {loading && (
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Pode levar 20–60s. Estamos aguardando o Google rodar o Lighthouse…
          </div>
        )}

        {report && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">URL analisada:</span>
              <a href={report.url} target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                {report.url} <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <StrategyCard result={report.mobile} icon={<Smartphone className="w-4 h-4" />} />
              <StrategyCard result={report.desktop} icon={<Monitor className="w-4 h-4" />} />
            </div>
            <a
              href={`https://pagespeed.web.dev/analysis?url=${encodeURIComponent(report.url)}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1"
            >
              Abrir relatório completo no PageSpeed Insights <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
