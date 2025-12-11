import { useState, useEffect } from 'react';
import { Download, X, Smartphone, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { usePWAInstall } from '@/hooks/usePWAInstall';

interface PWAInstallPromptProps {
  isFirstLogin?: boolean;
}

export function PWAInstallPrompt({ isFirstLogin = false }: PWAInstallPromptProps) {
  const [showDialog, setShowDialog] = useState(false);
  const { isInstallable, install, dismissInstallPrompt, shouldShowInstallPrompt } = usePWAInstall();

  useEffect(() => {
    // Show on first login or if installable and not dismissed
    if (isFirstLogin && shouldShowInstallPrompt()) {
      const timer = setTimeout(() => setShowDialog(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [isFirstLogin, shouldShowInstallPrompt]);

  const handleInstall = async () => {
    const success = await install();
    if (success) {
      setShowDialog(false);
    }
  };

  const handleDismiss = () => {
    dismissInstallPrompt();
    setShowDialog(false);
  };

  if (!isInstallable) return null;

  return (
    <Dialog open={showDialog} onOpenChange={setShowDialog}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <div className="w-10 h-10 rounded-xl gradient-vibrant flex items-center justify-center">
              <Download className="w-5 h-5 text-white" />
            </div>
            Instalar LEVI
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Instale o app para acesso rápido e experiência otimizada!
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border">
              <Smartphone className="w-6 h-6 text-primary" />
              <div>
                <p className="font-medium text-sm">Celular</p>
                <p className="text-xs text-muted-foreground">iOS & Android</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border">
              <Monitor className="w-6 h-6 text-primary" />
              <div>
                <p className="font-medium text-sm">Desktop</p>
                <p className="text-xs text-muted-foreground">Windows & Mac</p>
              </div>
            </div>
          </div>

          <div className="space-y-2 text-sm text-muted-foreground">
            <p>✓ Acesso rápido pela tela inicial</p>
            <p>✓ Funciona offline</p>
            <p>✓ Notificações de escalas</p>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={handleDismiss}
            className="flex-1"
          >
            <X className="w-4 h-4 mr-2" />
            Agora não
          </Button>
          <Button
            onClick={handleInstall}
            className="flex-1 gradient-vibrant text-white"
          >
            <Download className="w-4 h-4 mr-2" />
            Instalar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
