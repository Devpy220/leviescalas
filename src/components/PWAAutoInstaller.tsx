import { useEffect, useRef, useState } from 'react';
import { Share, Plus, Check } from 'lucide-react';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const IOS_INSTRUCTIONS_SHOWN_KEY = 'pwa-ios-instructions-shown';

/**
 * Invisible component that auto-triggers PWA installation prompt
 * - Android/Desktop: Triggers native browser prompt automatically
 * - iOS: Shows instruction modal once on first visit
 */
export function PWAAutoInstaller() {
  const { autoInstall, isInstalled, isIOS, isInstallable } = usePWAInstall();
  const hasTriedRef = useRef(false);
  const [showIOSModal, setShowIOSModal] = useState(false);

  // Handle iOS: show instructions modal once
  useEffect(() => {
    if (!isIOS || isInstalled) return;

    // Check if we've already shown the instructions
    const hasShown = localStorage.getItem(IOS_INSTRUCTIONS_SHOWN_KEY);
    if (hasShown) return;

    // Wait a bit before showing
    const timer = setTimeout(() => {
      setShowIOSModal(true);
    }, 3000);

    return () => clearTimeout(timer);
  }, [isIOS, isInstalled]);

  // Handle Android/Desktop: auto-install
  useEffect(() => {
    if (isIOS || isInstalled || !isInstallable || hasTriedRef.current) return;

    const timer = setTimeout(async () => {
      hasTriedRef.current = true;
      try {
        await autoInstall();
      } catch (error) {
        console.error('[PWAAutoInstaller] Error:', error);
      }
    }, 4000);

    return () => clearTimeout(timer);
  }, [isIOS, isInstalled, isInstallable, autoInstall]);

  const handleIOSClose = () => {
    localStorage.setItem(IOS_INSTRUCTIONS_SHOWN_KEY, 'true');
    setShowIOSModal(false);
  };

  // iOS instruction modal
  if (isIOS) {
    return (
      <Dialog open={showIOSModal} onOpenChange={(open) => !open && handleIOSClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
                <Share className="w-5 h-5 text-primary-foreground" />
              </div>
              Instalar LEVI no seu iPhone
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Adicione o app à sua tela inicial para acesso rápido!
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
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
                <Plus className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">2. Adicionar à Tela de Início</p>
                <p className="text-xs text-muted-foreground">Role para baixo e toque nesta opção</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/50 border border-border">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Check className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">3. Confirme</p>
                <p className="text-xs text-muted-foreground">Toque em "Adicionar" no canto superior direito</p>
              </div>
            </div>
          </div>

          <Button onClick={handleIOSClose} className="w-full">
            Entendi
          </Button>
        </DialogContent>
      </Dialog>
    );
  }

  // Android/Desktop: component renders nothing
  return null;
}
