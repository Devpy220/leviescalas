import { RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePWAUpdate } from '@/hooks/usePWAUpdate';
import { motion, AnimatePresence } from 'framer-motion';

export function PWAUpdatePrompt() {
  const { showUpdatePrompt, applyUpdate, dismissUpdate } = usePWAUpdate();

  return (
    <AnimatePresence>
      {showUpdatePrompt && (
        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 100 }}
          className="fixed bottom-4 left-4 right-4 z-50 sm:left-auto sm:right-4 sm:max-w-sm"
        >
          <div className="bg-card border border-border rounded-xl shadow-lg p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <RefreshCw className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm">Nova versão disponível!</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Atualize para obter as últimas melhorias
                </p>
              </div>
              <button
                onClick={dismissUpdate}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex gap-2 mt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={dismissUpdate}
                className="flex-1"
              >
                Depois
              </Button>
              <Button
                size="sm"
                onClick={applyUpdate}
                className="flex-1"
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                Atualizar
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
