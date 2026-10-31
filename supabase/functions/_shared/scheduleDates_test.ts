import { assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { serveOnlyBlackouts } from "./scheduleDates.ts";

Deno.test("servir em 3 datas bloqueia os outros 27 dias de novembro (sem limite de 4)", () => {
  const out = serveOnlyBlackouts(2026, 10, ["2026-11-07", "2026-11-14", "2026-11-21"], "2026-10-31");
  assertEquals(out.length, 27);
  assertEquals(out.includes("2026-11-07"), false);
  assertEquals(out.includes("2026-11-30"), true);
});

Deno.test("servir no mês atual não bloqueia dias que já passaram", () => {
  const out = serveOnlyBlackouts(2026, 10, ["2026-11-20"], "2026-11-15");
  assertEquals(out[0], "2026-11-15");
  assertEquals(out.length, 15);
});
