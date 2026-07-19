import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface PillCardProps {
  children: ReactNode;
  className?: string;
  glow?: "pink" | "purple" | "green" | "none";
  onClick?: () => void;
  as?: "div" | "button";
}

export function PillCard({ children, className, glow = "none", onClick, as = "div" }: PillCardProps) {
  const Comp: any = as;
  return (
    <Comp
      onClick={onClick}
      className={cn(
        "pk-pill p-5",
        glow === "pink" && "pk-glow-pink",
        glow === "purple" && "pk-glow-purple",
        glow === "green" && "pk-glow-green",
        as === "button" && "text-left w-full transition-transform active:scale-[0.98]",
        className,
      )}
    >
      {children}
    </Comp>
  );
}
