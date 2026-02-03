import { FileText } from 'lucide-react';

export function ExportStep() {
  return (
    <div className="flex flex-col items-center justify-center h-full py-4 space-y-4">
      <div className="flex gap-4">
        <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-background border border-border hover:border-primary/50 cursor-pointer transition-colors">
          <FileText className="w-10 h-10 text-red-500" />
          <span className="text-sm font-medium">PDF</span>
        </div>
        <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-background border border-border hover:border-primary/50 cursor-pointer transition-colors">
          <FileText className="w-10 h-10 text-green-500" />
          <span className="text-sm font-medium">Excel</span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground text-center">
        Exporte para imprimir ou compartilhar com a equipe
      </p>
    </div>
  );
}
