import { ArrowLeftRight, Loader2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ScheduleSwap } from '@/hooks/useScheduleSwaps';
import { useAuth } from '@/hooks/useAuth';

interface PendingSwapBadgeProps {
  swap: ScheduleSwap;
  onCancel?: (swapId: string) => Promise<boolean>;
  onRespond?: (swap: ScheduleSwap) => void;
  compact?: boolean;
  cancelling?: boolean;
}

export function PendingSwapBadge({
  swap,
  onCancel,
  onRespond,
  compact = false,
  cancelling = false,
}: PendingSwapBadgeProps) {
  const { user } = useAuth();
  const isRequester = user?.id === swap.requester_user_id;
  const isTarget = user?.id === swap.target_user_id;

  if (compact) {
    return (
      <Badge 
        variant="outline" 
        className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-300 dark:border-amber-700 gap-1"
      >
        <ArrowLeftRight className="w-3 h-3" />
        Troca pendente
      </Badge>
    );
  }

  return (
    <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mt-2">
      <div className="flex items-start gap-2">
        <ArrowLeftRight className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
            Troca Pendente
          </p>
          <p className="text-xs text-amber-600 dark:text-amber-400">
            {isRequester ? (
              <>Aguardando {swap.target_name} aceitar</>
            ) : isTarget ? (
              <>{swap.requester_name} quer trocar com você</>
            ) : (
              <>{swap.requester_name} ↔ {swap.target_name}</>
            )}
          </p>
        </div>
        
        {isRequester && onCancel && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onCancel(swap.id)}
            disabled={cancelling}
            className="h-7 px-2 text-amber-700 hover:text-amber-900 hover:bg-amber-100 dark:text-amber-400 dark:hover:bg-amber-900/50"
          >
            {cancelling ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <X className="w-3 h-3" />
            )}
          </Button>
        )}
        
        {isTarget && onRespond && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRespond(swap)}
            className="h-7 px-2 text-amber-700 hover:text-amber-900 hover:bg-amber-100 dark:text-amber-400 dark:hover:bg-amber-900/50"
          >
            Responder
          </Button>
        )}
      </div>
    </div>
  );
}
