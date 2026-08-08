// Pure-function tests for the ELM327 DTC decoding logic in src/obdBluetooth.js.
// The GATT connection itself (requestDevice/connectObdAdapter) genuinely cannot be
// tested without real physical hardware and a live user gesture - Web Bluetooth
// enforces this, and it's a known, accepted limitation of this feature, not something
// mocked around here. What IS fully verifiable without hardware is the byte-level DTC
// decoding, which follows the fixed SAE J1979/ISO 15031 Mode 03 encoding spec.
import { describe, expect, it } from "vitest";
import { parseElm327DtcResponse, obdBluetoothSupported } from "../src/obdBluetooth.js";

describe("parseElm327DtcResponse", () => {
  it("decodes a single generic code (P0133 - O2 sensor slow response)", () => {
    expect(parseElm327DtcResponse("43 01 33\r\r>")).toEqual(["P0133"]);
  });

  it("decodes P0420 (the most commonly cited real-world code)", () => {
    expect(parseElm327DtcResponse("43 04 20\r\r>")).toEqual(["P0420"]);
  });

  it("decodes multiple codes in one response", () => {
    expect(parseElm327DtcResponse("43 01 33 04 20\r\r>")).toEqual(["P0133", "P0420"]);
  });

  it("decodes non-generic prefixes (C/B/U) from the top 2 bits", () => {
    // C0123: prefix bits 01, digit1=0 -> b1 = 0b01000001 = 0x41; digit3=2,digit4=3 -> b2=0x23
    expect(parseElm327DtcResponse("43 41 23\r\r>")).toEqual(["C0123"]);
    // B0123: prefix bits 10 -> b1 = 0b10000001 = 0x81
    expect(parseElm327DtcResponse("43 81 23\r\r>")).toEqual(["B0123"]);
    // U0123: prefix bits 11 -> b1 = 0b11000001 = 0xC1
    expect(parseElm327DtcResponse("43 C1 23\r\r>")).toEqual(["U0123"]);
  });

  it("skips zero-padding byte pairs (no code in that slot)", () => {
    expect(parseElm327DtcResponse("43 01 33 00 00\r\r>")).toEqual(["P0133"]);
  });

  it("returns an empty array for NO DATA", () => {
    expect(parseElm327DtcResponse("NO DATA\r\r>")).toEqual([]);
  });

  it("returns an empty array for a genuinely empty response", () => {
    expect(parseElm327DtcResponse("")).toEqual([]);
    expect(parseElm327DtcResponse(undefined)).toEqual([]);
  });

  it("finds the 0x43 marker even with a leading echo/prefix from the adapter", () => {
    // Some adapters echo the sent command ("03") before the actual response.
    expect(parseElm327DtcResponse("03\r43 01 33\r\r>")).toEqual(["P0133"]);
  });

  it("handles lowercase hex bytes the same as uppercase", () => {
    expect(parseElm327DtcResponse("43 c1 23\r\r>")).toEqual(["U0123"]);
  });
});

describe("obdBluetoothSupported", () => {
  it("reflects whether navigator.bluetooth exists", () => {
    // In the vitest/node environment there's no navigator.bluetooth, matching every
    // real browser that lacks Web Bluetooth support (all of iOS Safari, for instance).
    expect(obdBluetoothSupported()).toBe(false);
  });
});
