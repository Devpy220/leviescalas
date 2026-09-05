import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LeviKidsWordmark } from "@/components/LeviKidsWordmark";

interface KidsNoAccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Shown when someone opens the LeviKids area but has no access.
 * Explains they must talk to the church leader, and offers the
 * contact form (LEVI admin) as fallback.
 */
export function KidsNoAccessDialog({ open, onOpenChange }: KidsNoAccessDialogProps) {
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-left">
            Acesso ao <LeviKidsWordmark /> não liberado
          </DialogTitle>
          <DialogDescription className="text-left space-y-2 pt-2">
            <span className="block">
              A sua conta ainda não está vinculada a nenhuma igreja no <LeviKidsWordmark />.
            </span>
            <span className="block font-medium text-foreground">
              Fale primeiro com o responsável (líder) da sua igreja e peça o link de acesso.
            </span>
            <span className="block">
              Se o responsável não tiver o link, envie uma mensagem pelo formulário de contato
              pedindo o link do <LeviKidsWordmark />.
            </span>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-col gap-2">
          <Button className="w-full" onClick={() => navigate("/?contato=1")}>
            Pedir o link pelo formulário de contato
          </Button>
          <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
            Voltar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
