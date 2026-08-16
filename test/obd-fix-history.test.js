// Tests for GET /api/obd/fix-history — merges the static generic code definition
// (server/obd-codes.js) with real confirmed fixes other users reported for that
// exact code on that exact make/model (server/database.js's findConfirmedOutcomes).
// Only findConfirmedOutcomes is mocked; everything else in database.js stays real
// (it falls back to the in-memory store in test env since DATABASE_URL is unset).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

const findConfirmedOutcomesMock = vi.hoisted(() => vi.fn());

vi.mock("../server/database.js", async () => {
  const actual = await vi.importActual("../server/database.js");
  return { ...actual, findConfirmedOutcomes: findConfirmedOutcomesMock };
});

const { default: app } = await import("../server/app.js");

beforeEach(() => {
  findConfirmedOutcomesMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/obd/fix-history — validation", () => {
  it("returns 400 when codes are missing", async () => {
    const response = await request(app).get("/api/obd/fix-history?make=Honda&model=Accord");
    expect(response.status).toBe(400);
    expect(findConfirmedOutcomesMock).not.toHaveBeenCalled();
  });

  it("returns 400 when make/model are missing", async () => {
    const response = await request(app).get("/api/obd/fix-history?codes=P0420");
    expect(response.status).toBe(400);
    expect(findConfirmedOutcomesMock).not.toHaveBeenCalled();
  });
});

describe("GET /api/obd/fix-history — happy path", () => {
  it("merges the generic definition with confirmed fixes for a known code", async () => {
    findConfirmedOutcomesMock.mockResolvedValue([
      { id: "o1", causeTitle: "Catalytic converter below threshold", trustTier: "shop_confirmed" },
    ]);

    const response = await request(app)
      .get("/api/obd/fix-history?codes=P0420&make=Honda&model=Accord&year=2015");

    expect(response.status).toBe(200);
    expect(response.body.vehicleMatch).toEqual({ make: "Honda", model: "Accord", year: "2015" });
    expect(response.body.byCode.P0420.definition).toBeTruthy();
    expect(response.body.byCode.P0420.fixes).toHaveLength(1);
    expect(findConfirmedOutcomesMock).toHaveBeenCalledWith(
      expect.objectContaining({ make: "Honda", model: "Accord", year: "2015", obdCodes: ["P0420"], limit: 5 }),
    );
  });

  it("still returns confirmed fixes for a code with no generic definition", async () => {
    findConfirmedOutcomesMock.mockResolvedValue([
      { id: "o2", causeTitle: "Manufacturer-specific issue", trustTier: "admin_reviewed" },
    ]);

    const response = await request(app)
      .get("/api/obd/fix-history?codes=P9999&make=Toyota&model=Camry");

    expect(response.status).toBe(200);
    expect(response.body.byCode.P9999.definition).toBeNull();
    expect(response.body.byCode.P9999.fixes).toHaveLength(1);
  });

  it("returns 502 when the confirmed-fix lookup fails", async () => {
    findConfirmedOutcomesMock.mockRejectedValue(new Error("db unreachable"));

    const response = await request(app)
      .get("/api/obd/fix-history?codes=P0420&make=Honda&model=Accord");

    expect(response.status).toBe(502);
  });
});
