import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";

export const WHATSAPP_CONSENT_TEXT =
  "Aceito receber do LEVI, por WhatsApp, avisos de escalas, lembretes e comunicados do meu departamento. Posso cancelar a qualquer momento respondendo SAIR.";

const SKIP = ["/", "/auth", "/join", "/privacidade", "/confirm", "/kids", "/igreja", "/consentimento-responsavel", "/authorize-minor", "/complete-profile"];

/** Records provable WhatsApp opt-in (RGPD / LGPD / Ley 81 Panamá) once per user. */
export function WhatsAppConsentPrompt() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const skipped = SKIP.some((p) => (p === "/" ? pathname === "/" : pathname === p || pathname.startsWith(p + "/")));

  useEffect(() => {
    if (!user || skipped) return;
    let active = true;
    supabase
      .from("profiles")
      .select("whatsapp_opt_in_at, whatsapp_opt_out_at")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (active && data && !data.whatsapp_opt_in_at && !data.whatsapp_opt_out_at) setOpen(true);
      });
    return () => { active = false; };
  }, [user, skipped]);

  const decide = async (action: "opt_in" | "opt_out") => {
    setSaving(true);
    await supabase.rpc("record_whatsapp_consent", {
      _action: action,
      _consent_text: WHATSAPP_CONSENT_TEXT,
      _source: "web_prompt",
      _ua: navigator.userAgent.slice(0, 300),
    });
    setSaving(false);
    setOpen(false);
  };

  if (!user || skipped) return null;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-md [&>button]:hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" /> Mensagens no WhatsApp
          </DialogTitle>
          <DialogDescription className="text-foreground/80 leading-relaxed">
            {WHATSAPP_CONSENT_TEXT}{" "}
            <Link to="/privacidade" className="underline">Aviso de privacidade</Link>
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" disabled={saving} onClick={() => decide("opt_out")}>Não quero receber</Button>
          <Button disabled={saving} onClick={() => decide("opt_in")}>Aceito receber</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
