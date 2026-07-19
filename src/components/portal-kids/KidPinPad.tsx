import { useState } from "react";
import { cn } from "@/lib/utils";
import { Delete } from "lucide-react";

interface Props {
  onComplete: (pin: string) => void;
  disabled?: boolean;
  title?: string;
}

export function KidPinPad({ onComplete, disabled, title = "Digite seu PIN" }: Props) {
  const [pin, setPin] = useState("");

  const push = (d: string) => {
    if (disabled) return;
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 4) onComplete(next);
  };
  const back = () => setPin((p) => p.slice(0, -1));

  return (
    <div className="space-y-6">
      <p className="text-center text-lg font-bold pk-title">{title}</p>
      <div className="flex justify-center gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={cn(
              "w-14 h-14 rounded-2xl border-2 flex items-center justify-center text-2xl font-black transition-all",
              pin[i]
                ? "bg-gradient-to-br from-pink-400 to-purple-500 text-white border-transparent scale-105"
                : "bg-white/60 border-purple-200 dark:bg-slate-800/60 dark:border-purple-800",
            )}
          >
            {pin[i] ? "•" : ""}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button
            key={d}
            onClick={() => push(d)}
            disabled={disabled}
            className="pk-pill h-16 text-2xl font-black hover:scale-105 active:scale-95 transition-transform"
          >
            {d}
          </button>
        ))}
        <div />
        <button
          onClick={() => push("0")}
          disabled={disabled}
          className="pk-pill h-16 text-2xl font-black hover:scale-105 active:scale-95 transition-transform"
        >
          0
        </button>
        <button
          onClick={back}
          disabled={disabled}
          className="pk-pill h-16 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
        >
          <Delete className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}
