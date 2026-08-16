// Tests for GET /api/vehicle/recalls and a regression smoke-test for
// GET /api/vehicle/decode after extracting its NHTSA fetch logic into
// server/nhtsa.js (server/app.js's inline body was replaced with
// decodeVinFromNhtsa/getRecallsForVehicle calls — this guards that refactor
// didn't change its response shape, since VIN decode is a live production
// endpoint per PRODUCTION_CHECKLIST.md).
//
// Both endpoints call NHTSA's free, no-key public APIs (vpic.nhtsa.dot.gov for
// decode, api.nhtsa.gov for recalls) — real network calls are mocked here via
// global fetch, matching test/otp.test.js's approach for an outbound provider.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

afterEach(() => {
  vi.unstubAllGlobals();
});

const { default: app } = await import("../server/app.js");

const VALID_VIN = "1HGCM82633A004352";

function decodeResponse(overrides = {}) {
  return {
    ok: true,
    json: async () => ({
      Results: [{
        ModelYear: "2003", Make: "HONDA", Model: "Accord", Trim: "EX-V6",
        DisplacementL: "3.0", FuelTypePrimary: "Gasoline", BodyClass: "Coupe", DriveType: "",
        ...overrides,
      }],
    }),
  };
}

describe("GET /api/vehicle/decode — regression after nhtsa.js extraction", () => {
  it("returns the same response shape as before for a valid VIN", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(decodeResponse()));

    const response = await request(app).get(`/api/vehicle/decode?vin=${VALID_VIN}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      vin: VALID_VIN, year: "2003", make: "HONDA", model: "Accord", trim: "EX-V6",
      engine: "3.0L", fuelType: "Gasoline", bodyClass: "Coupe", driveType: "",
    });
  });

  it("still 400s on an invalid VIN format", async () => {
    const response = await request(app).get("/api/vehicle/decode?vin=TOOSHORT");
    expect(response.status).toBe(400);
  });
});

describe("GET /api/vehicle/recalls", () => {
  it("returns 400 on an invalid VIN format, never calling fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await request(app).get("/api/vehicle/recalls?vin=TOOSHORT");

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 404 when the VIN doesn't decode, never fetching recalls", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ Results: [] }) });
    vi.stubGlobal("fetch", fetchMock);

    const response = await request(app).get(`/api/vehicle/recalls?vin=${VALID_VIN}`);

    expect(response.status).toBe(404);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns an empty recalls array honestly when NHTSA reports none", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(decodeResponse())
      .mockResolvedValueOnce({ ok: true, json: async () => ({ Count: 0, results: [] }) });
    vi.stubGlobal("fetch", fetchMock);

    const response = await request(app).get(`/api/vehicle/recalls?vin=${VALID_VIN}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      vin: VALID_VIN, year: "2003", make: "HONDA", model: "Accord", recallCount: 0, recalls: [],
    });
  });

  it("maps real recall fields correctly when present", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(decodeResponse())
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          Count: 1,
          results: [{
            NHTSACampaignNumber: "19V182000", Manufacturer: "Honda", Component: "AIR BAGS",
            Summary: "Inflator may rupture.", Consequence: "Injury risk.", Remedy: "Free replacement.",
            ReportReceivedDate: "06/03/2019", parkIt: false, parkOutSide: true,
          }],
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const response = await request(app).get(`/api/vehicle/recalls?vin=${VALID_VIN}`);

    expect(response.status).toBe(200);
    expect(response.body.recallCount).toBe(1);
    expect(response.body.recalls[0]).toEqual({
      campaignNumber: "19V182000", manufacturer: "Honda", component: "AIR BAGS",
      summary: "Inflator may rupture.", consequence: "Injury risk.", remedy: "Free replacement.",
      reportedDate: "06/03/2019", parkIt: false, parkOutside: true,
    });
  });

  it("returns 502 when the recalls fetch itself fails", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(decodeResponse())
      .mockResolvedValueOnce({ ok: false });
    vi.stubGlobal("fetch", fetchMock);

    const response = await request(app).get(`/api/vehicle/recalls?vin=${VALID_VIN}`);

    expect(response.status).toBe(502);
  });
});
