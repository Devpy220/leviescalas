import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-left">
            {t("kids.accessTo")} <LeviKidsWordmark /> {t("kids.notEnabled")}
          </DialogTitle>
          <DialogDescription className="text-left space-y-2 pt-2">
            <span className="block">
              {t("kids.accountUnlinked")} <LeviKidsWordmark />.
            </span>
            <span className="block font-medium text-foreground">
              {t("kids.askLeaderLink")}
            </span>
            <span className="block">
              {t("kids.askContact")} <LeviKidsWordmark />.
            </span>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-col gap-2">
          <Button className="w-full" onClick={() => navigate("/?contato=1")}>
            {t("kids.requestLink")}
          </Button>
          <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
            {t("common.back")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
