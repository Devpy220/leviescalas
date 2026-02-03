import { Check } from 'lucide-react';

export function AvailabilityStep() {
  const availability = [true, false, true, true, false, true, true];
  
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-7 gap-1 text-center text-xs mb-2">
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d, i) => (
          <div key={i} className="py-1 text-muted-foreground font-medium">{d}</div>
        ))}
        {availability.map((available, i) => (
          <div 
            key={i} 
            className={`py-3 rounded-lg flex items-center justify-center ${
              available 
                ? 'bg-emerald-500/20 border border-emerald-500/30' 
                : 'bg-muted/50 border border-border'
            }`}
          >
            {available && <Check className="w-4 h-4 text-emerald-500" />}
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground text-center">
        Clique nos dias para marcar sua disponibilidade
      </p>
    </div>
  );
}
