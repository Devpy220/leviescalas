import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeftRight, ArrowRight, Calendar, Clock, User, Check, X } from 'lucide-react';
import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { ScheduleSwap } from '@/hooks/useScheduleSwaps';

interface SwapResponseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  swap: ScheduleSwap | null;
  onAccept: (swapId: string) => Promise<boolean>;
  onReject: (swapId: string) => Promise<boolean>;
}

export function SwapResponseDialog({
  open,
  onOpenChange,
  swap,
  onAccept,
  onReject,
}: SwapResponseDialogProps) {
  const [loading, setLoading] = useState<'accept' | 'reject' | null>(null);

  const handleAccept = async () => {
    if (!swap) return;
    setLoading('accept');
    const success = await onAccept(swap.id);
    setLoading(null);
    if (success) onOpenChange(false);
  };

  const handleReject = async () => {
    if (!swap) return;
    setLoading('reject');
    const success = await onReject(swap.id);
    setLoading(null);
    if (success) onOpenChange(false);
  };

  if (!swap) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 text-amber-500" />
            Solicitação de Troca
          </DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">{swap.requester_name}</span> quer trocar de escala com você.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {swap.reason && (
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-sm text-muted-foreground">Motivo:</p>
              <p className="text-sm">{swap.reason}</p>
            </div>
          )}

          <div className="grid gap-4">
            {/* Requester's schedule */}
            <div className="border rounded-lg p-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <User className="w-4 h-4" />
                <span>{swap.requester_name} tem:</span>
              </div>
              {swap.requester_schedule && (
                <>
                  <div className="flex items-center gap-2 font-medium">
                    <Calendar className="w-4 h-4 text-primary" />
                    {format(parseISO(swap.requester_schedule.date), "EEEE, d 'de' MMMM", { locale: ptBR })}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                    <Clock className="w-4 h-4" />
                    {swap.requester_schedule.time_start.slice(0, 5)} - {swap.requester_schedule.time_end.slice(0, 5)}
                    {swap.requester_schedule.sector_name && (
                      <span className="ml-2 text-xs bg-muted px-1.5 py-0.5 rounded">
                        {swap.requester_schedule.sector_name}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-center">
              <div className="bg-primary/10 rounded-full p-2">
                <ArrowLeftRight className="w-5 h-5 text-primary" />
              </div>
            </div>

            {/* Target's schedule (yours) */}
            <div className="border border-primary/50 rounded-lg p-3 bg-primary/5">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <User className="w-4 h-4" />
                <span>Você tem:</span>
              </div>
              {swap.target_schedule && (
                <>
                  <div className="flex items-center gap-2 font-medium">
                    <Calendar className="w-4 h-4 text-primary" />
                    {format(parseISO(swap.target_schedule.date), "EEEE, d 'de' MMMM", { locale: ptBR })}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                    <Clock className="w-4 h-4" />
                    {swap.target_schedule.time_start.slice(0, 5)} - {swap.target_schedule.time_end.slice(0, 5)}
                    {swap.target_schedule.sector_name && (
                      <span className="ml-2 text-xs bg-muted px-1.5 py-0.5 rounded">
                        {swap.target_schedule.sector_name}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <strong>Se você aceitar:</strong>
              <br />
              • Você ficará com a escala de {swap.requester_name}
              <br />
              • {swap.requester_name} ficará com a sua escala
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={handleReject}
            disabled={loading !== null}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            {loading === 'reject' ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <X className="w-4 h-4 mr-2" />
            )}
            Recusar
          </Button>
          <Button
            onClick={handleAccept}
            disabled={loading !== null}
            className="bg-green-600 hover:bg-green-700"
          >
            {loading === 'accept' ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Check className="w-4 h-4 mr-2" />
            )}
            Aceitar Troca
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
