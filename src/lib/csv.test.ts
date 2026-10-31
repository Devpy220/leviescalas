import { describe, expect, it } from "vitest";
import { buildCsv, csvCell } from "./csv";

describe("csvCell", () => {
  it("neutralizes a formula typed in allergies", () => {
    expect(csvCell('=HYPERLINK("http://x")')).toBe(`"'=HYPERLINK(""http://x"")"`);
  });
  it("neutralizes + - @ starts", () => {
    expect(csvCell("+1")).toBe(`"'+1"`);
    expect(csvCell("-1")).toBe(`"'-1"`);
    expect(csvCell("@SUM(A1)")).toBe(`"'@SUM(A1)"`);
  });
  it("keeps normal text", () => {
    expect(csvCell("Amendoim")).toBe(`"Amendoim"`);
  });
});

describe("buildCsv", () => {
  it("builds header and rows", () => {
    expect(buildCsv([{ nome: "Ana", alergia: "=1+1" }])).toBe(`"nome","alergia"\n"Ana","'=1+1"`);
  });
});
