import { useState, useEffect } from 'react';
import { Download, X, Smartphone, Monitor, Share, MoreVertical } from 'lucide-react';
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
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function PWAInstallPrompt({ isFirstLogin = false, open, onOpenChange }: PWAInstallPromptProps) {
  const [internalShowDialog, setInternalShowDialog] = useState(false);
  const { isInstallable, install, dismissInstallPrompt, shouldShowInstallPrompt, isIOS, deviceType } = usePWAInstall();

  // Use controlled or uncontrolled mode
  const showDialog = open !== undefined ? open : internalShowDialog;
  const setShowDialog = onOpenChange || setInternalShowDialog;

  useEffect(() => {
    // Show on first login or if installable and not dismissed (only for uncontrolled mode)
    if (open === undefined && isFirstLogin && shouldShowInstallPrompt()) {
      const timer = setTimeout(() => setInternalShowDialog(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [isFirstLogin, shouldShowInstallPrompt, open]);

  const handleInstall = async () => {
    if (isIOS) {
      // iOS doesn't support programmatic install, just dismiss
      dismissInstallPrompt();
      setShowDialog(false);
      return;
    }
    
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
          {isIOS ? (
            // iOS specific instructions
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Para instalar no seu iPhone/iPad:
              </p>
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/50 border border-border">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Share className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">1. Toque em Compartilhar</p>
                    <p className="text-xs text-muted-foreground">Na barra do Safari (ícone de quadrado com seta)</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/50 border border-border">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-primary text-sm font-bold">+</span>
                  </div>
                  <div>
                    <p className="font-medium text-sm">2. Adicionar à Tela de Início</p>
                    <p className="text-xs text-muted-foreground">Role para baixo e toque nesta opção</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/50 border border-border">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-primary text-sm font-bold">✓</span>
                  </div>
                  <div>
                    <p className="font-medium text-sm">3. Confirme</p>
                    <p className="text-xs text-muted-foreground">Toque em "Adicionar" no canto superior direito</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // Android/Desktop content
            <>
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
            </>
          )}
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={handleDismiss}
            className="flex-1"
          >
            <X className="w-4 h-4 mr-2" />
            {isIOS ? 'Entendi' : 'Agora não'}
          </Button>
          {!isIOS && (
            <Button
              onClick={handleInstall}
              className="flex-1 gradient-vibrant text-white"
            >
              <Download className="w-4 h-4 mr-2" />
              Instalar
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
