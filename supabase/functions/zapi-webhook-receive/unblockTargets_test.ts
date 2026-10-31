import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { parseUnblockTargets } from "./unblockTargets.ts";

Deno.test("desbloquear domingo de manha mira só o turno da manhã", () => {
  const t = parseUnblockTargets("desbloquear domingo de manha");
  assertEquals([...t.dows], [0]);
  assertEquals(t.shift, "M");
});

Deno.test("desbloquear domingo a noite mira só o turno da noite", () => {
  const t = parseUnblockTargets("desbloquear domingo a noite");
  assertEquals([...t.dows], [0]);
  assertEquals(t.shift, "N");
});

Deno.test("desbloquear domingo sem turno libera o dia inteiro", () => {
  assertEquals(parseUnblockTargets("desbloquear domingo").shift, undefined);
});

Deno.test("desbloquear todos os dias da semana mira os 7 dias", () => {
  assertEquals(parseUnblockTargets("desbloquear todos os dias da semana").dows.size, 7);
});

Deno.test("desbloquear terca e sabado mira os dois dias", () => {
  assertEquals([...parseUnblockTargets("desbloquear terca e sabado").dows].sort(), [2, 6]);
});
