import { Church } from 'lucide-react';

export function ChurchStep() {
  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl bg-background border border-border">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-xl gradient-vibrant flex items-center justify-center">
            <Church className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="font-semibold">Igreja Batista Central</p>
            <p className="text-sm text-muted-foreground">3 departamentos • 25 membros</p>
          </div>
        </div>
        <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 text-sm">
          <span className="text-muted-foreground">Código:</span>
          <code className="font-mono font-semibold text-primary">ABC123</code>
        </div>
      </div>
      <p className="text-xs text-muted-foreground text-center">
        Digite o código da igreja para acessar todos os departamentos
      </p>
    </div>
  );
}
