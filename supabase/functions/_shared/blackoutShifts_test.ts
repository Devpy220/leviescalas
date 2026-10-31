import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { applyBlock, applyUnblock, isBlockedAt } from "./blackoutShifts.ts";

const SUN = "2026-11-01";

Deno.test("bloquear domingo de manhã não bloqueia a noite", () => {
  const b = applyBlock({ dates: [], shifts: [] }, SUN, "M");
  assert(isBlockedAt(b.dates, b.shifts, SUN, "08:00"));
  assert(!isBlockedAt(b.dates, b.shifts, SUN, "18:00"));
});

Deno.test("bloquear manhã e noite vira o domingo inteiro", () => {
  const b = applyBlock(applyBlock({ dates: [], shifts: [] }, SUN, "M"), SUN, "N");
  assertEquals(b, { dates: [SUN], shifts: [] });
});

Deno.test("desbloquear domingo à noite num domingo inteiro mantém a manhã bloqueada", () => {
  const b = applyUnblock({ dates: [SUN], shifts: [] }, SUN, "N");
  assert(isBlockedAt(b.dates, b.shifts, SUN, "08:00"));
  assert(!isBlockedAt(b.dates, b.shifts, SUN, "18:00"));
});

Deno.test("desbloquear domingo sem turno libera os dois turnos", () => {
  const b = applyUnblock({ dates: [], shifts: [`${SUN}|M`, `${SUN}|N`] }, SUN);
  assertEquals(b, { dates: [], shifts: [] });
});
