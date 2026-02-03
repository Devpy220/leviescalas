import { Layers, Plus } from 'lucide-react';
import { mockSectors } from '../tourSteps';

export function SectorsStep() {
  return (
    <div className="space-y-2">
      {mockSectors.map((sector, i) => (
        <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-background border border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Layers className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">{sector.name}</p>
              <p className="text-xs text-muted-foreground">{sector.members} membros</p>
            </div>
          </div>
        </div>
      ))}
      <div className="flex items-center gap-2 p-3 rounded-lg border border-dashed border-primary/30 text-primary text-sm cursor-pointer hover:bg-primary/5">
        <Plus className="w-4 h-4" />
        <span>Adicionar setor</span>
      </div>
    </div>
  );
}
