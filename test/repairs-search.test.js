// Tests for GET /api/repairs/search — symptom + vehicle search over confirmed
// fixes (Identifix "Direct-Hit" style). Only findConfirmedOutcomes is mocked;
// everything else in database.js stays real via vi.importActual, same
// approach as test/obd-fix-history.test.js.

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

describe("GET /api/repairs/search — validation", () => {
  it("returns 400 when make/model are missing", async () => {
    const response = await request(app).get("/api/repairs/search?symptom=grinding noise");
    expect(response.status).toBe(400);
    expect(findConfirmedOutcomesMock).not.toHaveBeenCalled();
  });

  it("returns 400 when symptom is under 3 characters", async () => {
    const response = await request(app).get("/api/repairs/search?make=Honda&model=Accord&symptom=hi");
    expect(response.status).toBe(400);
    expect(findConfirmedOutcomesMock).not.toHaveBeenCalled();
  });
});

describe("GET /api/repairs/search — happy path", () => {
  it("splits the symptom into keywords and passes them through, along with optional year/engine", async () => {
    findConfirmedOutcomesMock.mockResolvedValue([
      { id: "o1", causeTitle: "Brake pad wear", trustTier: "shop_confirmed" },
    ]);

    const response = await request(app)
      .get("/api/repairs/search?make=Honda&model=Accord&year=2019&engine=1.5L&symptom=grinding+noise+when+braking");

    expect(response.status).toBe(200);
    expect(response.body.count).toBe(1);
    expect(response.body.results).toHaveLength(1);
    expect(findConfirmedOutcomesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        make: "Honda",
        model: "Accord",
        year: "2019",
        engine: "1.5L",
        symptomKeywords: expect.arrayContaining(["grinding", "noise", "braking"]),
      }),
    );
  });

  it("passes year/engine through as undefined when omitted, never as empty strings", async () => {
    findConfirmedOutcomesMock.mockResolvedValue([]);

    await request(app).get("/api/repairs/search?make=Honda&model=Accord&symptom=grinding+noise");

    expect(findConfirmedOutcomesMock).toHaveBeenCalledWith(
      expect.objectContaining({ year: undefined, engine: undefined }),
    );
  });

  it("returns an honest empty result set when nothing matches", async () => {
    findConfirmedOutcomesMock.mockResolvedValue([]);

    const response = await request(app)
      .get("/api/repairs/search?make=Toyota&model=Camry&symptom=strange rattling sound");

    expect(response.status).toBe(200);
    expect(response.body.count).toBe(0);
    expect(response.body.results).toEqual([]);
  });

  it("returns 502 when the confirmed-fix lookup fails", async () => {
    findConfirmedOutcomesMock.mockRejectedValue(new Error("db unreachable"));

    const response = await request(app)
      .get("/api/repairs/search?make=Honda&model=Accord&symptom=grinding noise");

    expect(response.status).toBe(502);
  });
});
