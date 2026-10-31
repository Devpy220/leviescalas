import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { parseUnblockTargets } from "./unblockTargets.ts";

Deno.test("desbloquear domingo de manha mira o domingo e avisa que é o dia inteiro", () => {
  const t = parseUnblockTargets("desbloquear domingo de manha");
  assertEquals([...t.dows], [0]);
  assert(t.partOfDay);
});

Deno.test("desbloquear domingo a noite mira o domingo", () => {
  const t = parseUnblockTargets("desbloquear domingo a noite");
  assertEquals([...t.dows], [0]);
  assert(t.partOfDay);
});

Deno.test("desbloquear todos os dias da semana mira os 7 dias", () => {
  assertEquals(parseUnblockTargets("desbloquear todos os dias da semana").dows.size, 7);
});

Deno.test("desbloquear terca e sabado mira os dois dias", () => {
  assertEquals([...parseUnblockTargets("desbloquear terca e sabado").dows].sort(), [2, 6]);
});
