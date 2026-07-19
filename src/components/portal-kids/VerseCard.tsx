import { PillCard } from "./PillCard";
import iconBible from "@/assets/portal-kids/icon-bible.png";
import { Volume2, Sparkles } from "lucide-react";

interface Verse {
  id: string;
  reference: string;
  text_simple: string;
  illustration_url?: string | null;
  audio_url?: string | null;
  family_devotional_text?: string | null;
}

interface Props {
  verse: Verse | null;
  showDevotional?: boolean;
  action?: React.ReactNode;
}

export function VerseCard({ verse, showDevotional, action }: Props) {
  if (!verse) {
    return (
      <PillCard glow="purple" className="text-center">
        <div className="flex flex-col items-center gap-2 py-4">
          <Sparkles className="w-8 h-8 text-purple-500" />
          <p className="text-sm opacity-70">Nenhum versículo disponível ainda 💜</p>
        </div>
      </PillCard>
    );
  }
  return (
    <PillCard glow="pink" className="overflow-hidden">
      <div className="flex items-start gap-3">
        <img
          src={verse.illustration_url || iconBible}
          alt=""
          loading="lazy"
          width={72}
          height={72}
          className="w-16 h-16 shrink-0 pk-float"
        />
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <span className="pk-chip">✨ Versículo do dia</span>
          </div>
          <p className="pk-title text-xl leading-snug">"{verse.text_simple}"</p>
          <p className="text-sm font-bold pk-heading-gradient">{verse.reference}</p>
        </div>
      </div>
      {verse.audio_url && (
        <button
          onClick={() => new Audio(verse.audio_url!).play()}
          className="mt-3 flex items-center gap-2 text-sm font-bold text-purple-700 dark:text-purple-300"
        >
          <Volume2 className="w-4 h-4" /> Ouvir
        </button>
      )}
      {showDevotional && verse.family_devotional_text && (
        <p className="mt-3 pt-3 border-t border-white/40 text-sm opacity-90">
          🙏 <span className="font-bold">Em família:</span> {verse.family_devotional_text}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </PillCard>
  );
}
