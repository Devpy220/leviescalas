import { useState } from 'react';
import { Copy, Check, Share2, QrCode, Link2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

interface InviteMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inviteCode: string;
}

export default function InviteMemberDialog({
  open,
  onOpenChange,
  inviteCode
}: InviteMemberDialogProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const inviteUrl = `${window.location.origin}/join/${inviteCode}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    
    toast({
      title: 'Link copiado!',
      description: 'Compartilhe com novos membros.',
    });
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Convite para o Departamento',
          text: 'Você foi convidado para participar de um departamento no LEVI!',
          url: inviteUrl,
        });
      } catch (error) {
        // User cancelled or error
        console.log('Share cancelled');
      }
    } else {
      handleCopy();
    }
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(
      `Você foi convidado para participar de um departamento no LEVI! 📅\n\nAcesse o link para entrar: ${inviteUrl}`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Share2 className="w-5 h-5 text-primary" />
            Convidar Membros
          </DialogTitle>
          <DialogDescription>
            Compartilhe o link abaixo para convidar novos membros para o departamento.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Invite Link */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground flex items-center gap-2">
              <Link2 className="w-4 h-4 text-muted-foreground" />
              Link de Convite
            </label>
            <div className="flex gap-2">
              <Input
                readOnly
                value={inviteUrl}
                className="font-mono text-sm bg-muted/50"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopy}
                className="flex-shrink-0"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-success" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Invite Code */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground flex items-center gap-2">
              <QrCode className="w-4 h-4 text-muted-foreground" />
              Código de Convite
            </label>
            <div className="bg-muted/50 rounded-xl p-4 text-center">
              <span className="font-mono text-2xl font-bold tracking-wider text-primary">
                {inviteCode}
              </span>
            </div>
          </div>

          {/* Share Buttons */}
          <div className="space-y-3">
            <Button
              onClick={handleShareWhatsApp}
              className="w-full bg-[#25D366] hover:bg-[#25D366]/90 text-white"
            >
              <svg
                className="w-5 h-5 mr-2"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
              </svg>
              Compartilhar no WhatsApp
            </Button>

            {navigator.share && (
              <Button
                variant="outline"
                onClick={handleShare}
                className="w-full"
              >
                <Share2 className="w-4 h-4 mr-2" />
                Compartilhar
              </Button>
            )}

            <Button
              variant="ghost"
              onClick={handleCopy}
              className="w-full"
            >
              <Copy className="w-4 h-4 mr-2" />
              Copiar Link
            </Button>
          </div>

          {/* Instructions */}
          <div className="bg-muted/30 rounded-xl p-4">
            <h4 className="font-medium text-sm text-foreground mb-2">
              Como funciona?
            </h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Compartilhe o link com quem deseja convidar</li>
              <li>• A pessoa deve criar uma conta ou fazer login</li>
              <li>• Após acessar o link, ela entrará automaticamente</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
