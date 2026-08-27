import { afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

const { default: app } = await import("../server/app.js");

afterEach(() => vi.unstubAllEnvs());

describe("private local worker API", () => {
  it("fails closed when no worker token is configured", async () => {
    vi.stubEnv("LOCAL_WORKER_TOKEN", "");
    const response = await request(app).post("/api/local-worker/claim").send({ workerId: "test" });
    expect(response.status).toBe(401);
  });

  it("rejects an incorrect bearer token", async () => {
    vi.stubEnv("LOCAL_WORKER_TOKEN", "correct-token-that-is-long-enough");
    const response = await request(app)
      .post("/api/local-worker/claim")
      .set("authorization", "Bearer wrong-token-that-is-long-enoughxx")
      .send({ workerId: "test" });
    expect(response.status).toBe(401);
  });
});
