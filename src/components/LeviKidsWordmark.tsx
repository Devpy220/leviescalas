import { cn } from "@/lib/utils";

interface Props {
  className?: string;
  as?: "span" | "p" | "h1" | "h2" | "h3";
}

const LETTERS: Array<{ ch: string; color: string }> = [
  { ch: "L", color: "#EF4444" },
  { ch: "e", color: "#F59E0B" },
  { ch: "v", color: "#10B981" },
  { ch: "i", color: "#3B82F6" },
  { ch: "K", color: "#8B5CF6" },
  { ch: "i", color: "#EC4899" },
  { ch: "d", color: "#06B6D4" },
  { ch: "s", color: "#F97316" },
];

/**
 * Wordmark colorido oficial do LeviKids.
 * Use sempre este componente ao exibir o nome "LeviKids" na UI.
 */
export function LeviKidsWordmark({ className, as: Tag = "span" }: Props) {
  return (
    <Tag className={cn("font-display font-bold tracking-tight", className)} aria-label="LeviKids">
      {LETTERS.map((l, i) => (
        <span key={i} style={{ color: l.color }}>{l.ch}</span>
      ))}
    </Tag>
  );
}

export default LeviKidsWordmark;
