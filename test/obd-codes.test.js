import { describe, expect, it } from "vitest";
import { extractCodesFromText, lookupCodes, GENERIC_OBD_CODES } from "../server/obd-codes.js";

describe("extractCodesFromText", () => {
  it("finds a code embedded in a free-text description", () => {
    expect(extractCodesFromText("my scanner showed P0420 and the light won't turn off"))
      .toEqual(["P0420"]);
  });

  it("normalizes lowercase input to uppercase", () => {
    expect(extractCodesFromText("code was p0301")).toEqual(["P0301"]);
  });

  it("finds multiple distinct codes and de-duplicates repeats", () => {
    expect(extractCodesFromText("P0420, P0430, and P0420 again")).toEqual(["P0420", "P0430"]);
  });

  it("returns an empty array when there's no code-shaped text", () => {
    expect(extractCodesFromText("it makes a squealing noise when braking")).toEqual([]);
  });

  it("matches B/C/U prefixes too, not just P", () => {
    expect(extractCodesFromText("codes B0001 and U0100 both came up")).toEqual(["B0001", "U0100"]);
  });

  it("handles empty/undefined input without throwing", () => {
    expect(extractCodesFromText("")).toEqual([]);
    expect(extractCodesFromText(undefined)).toEqual([]);
  });
});

describe("lookupCodes", () => {
  it("returns the verified definition for a known generic code", () => {
    const { found, unknown } = lookupCodes(["P0420"]);
    expect(found).toEqual({ P0420: GENERIC_OBD_CODES.P0420 });
    expect(unknown).toEqual([]);
  });

  it("separates known from unknown codes in the same call", () => {
    const { found, unknown } = lookupCodes(["P0301", "P1234"]);
    expect(found).toEqual({ P0301: GENERIC_OBD_CODES.P0301 });
    expect(unknown).toEqual(["P1234"]);
  });

  it("normalizes case and whitespace before lookup", () => {
    const { found } = lookupCodes([" p0420 "]);
    expect(found).toEqual({ P0420: GENERIC_OBD_CODES.P0420 });
  });

  it("ignores empty strings without crashing", () => {
    const { found, unknown } = lookupCodes(["", "  "]);
    expect(found).toEqual({});
    expect(unknown).toEqual([]);
  });
});
