import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Campo de data de nascimento simplificado.
 * O usuário digita apenas números (DDMMAAAA) e a máscara DD/MM/AAAA é aplicada.
 * O valor emitido no onChange é sempre ISO (AAAA-MM-DD) ou "" quando incompleto/inválido.
 */
interface BirthDateInputProps {
  value: string; // ISO yyyy-mm-dd
  onChange: (iso: string) => void;
  id?: string;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}

function isoToBr(iso: string) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function maskBr(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function brToIso(br: string): string {
  const digits = br.replace(/\D/g, "");
  if (digits.length !== 8) return "";
  const d = Number(digits.slice(0, 2));
  const m = Number(digits.slice(2, 4));
  const y = Number(digits.slice(4));
  if (m < 1 || m > 12 || d < 1 || d > 31) return "";
  if (y < 1900 || y > new Date().getFullYear()) return "";
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCDate() !== d || dt.getUTCMonth() !== m - 1) return "";
  if (dt.getTime() > Date.now()) return "";
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function BirthDateInput({ value, onChange, id, className, placeholder = "DD/MM/AAAA", disabled }: BirthDateInputProps) {
  const [text, setText] = useState(() => isoToBr(value));

  useEffect(() => {
    const iso = brToIso(text);
    if (value !== iso) setText(isoToBr(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const complete = text.replace(/\D/g, "").length === 8;
  const invalid = complete && !brToIso(text);

  return (
    <div className="space-y-1">
      <Input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="bday"
        placeholder={placeholder}
        disabled={disabled}
        value={text}
        aria-invalid={invalid || undefined}
        onChange={(e) => {
          const masked = maskBr(e.target.value);
          setText(masked);
          onChange(brToIso(masked));
        }}
        className={cn(invalid && "border-destructive", className)}
      />
      {invalid && <p className="text-xs text-destructive">Data inválida. Use DD/MM/AAAA.</p>}
    </div>
  );
}

export default BirthDateInput;
