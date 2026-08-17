// Tests for DELETE /api/auth/me and server/database.js's deleteUserAccount.
//
// Two groups: (1) the file-store fallback path (no DATABASE_URL — same as every
// other test in this suite) covers the actual redaction logic end-to-end; (2) a
// mocked `pg` Pool covers the real Postgres transaction path specifically, since
// that code never runs without DATABASE_URL set and this is the one piece of
// this whole feature set that most needs proof it's actually atomic.

import { afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import crypto from "node:crypto";

vi.stubEnv("AUTH_SECRET", "test-auth-secret-at-least-32-characters-long");

const { default: app } = await import("../server/app.js");
const {
  createUser, deleteUserAccount, createVehicle, saveDiagnosis,
  createQuoteRequest, createItemizedQuote, upsertShopProfile, findUserById,
} = await import("../server/database.js");
const { hashPassword } = await import("../server/auth.js");
const { readStore } = await import("../server/store.js");

afterEach(() => {
  vi.clearAllMocks();
});

async function makeTestUser(emailSuffix) {
  const id = crypto.randomUUID();
  const email = `delete-test-${emailSuffix}@example.com`;
  await createUser({
    id, name: "Delete Test", email,
    passwordHash: await hashPassword("DeleteMe123!"),
    role: "driver", shopName: null, createdAt: new Date().toISOString(),
  });
  return { id, email };
}

describe("DELETE /api/auth/me — password gate", () => {
  it("requires auth", async () => {
    const response = await request(app).delete("/api/auth/me").send({ password: "whatever" });
    expect(response.status).toBe(401);
  });

  it("rejects a wrong password and deletes nothing", async () => {
    const { id, email } = await makeTestUser(`wrongpw-${Date.now()}`);
    const loginResponse = await request(app).post("/api/auth/login").send({ email, password: "DeleteMe123!" });
    const token = loginResponse.body.token;

    const response = await request(app)
      .delete("/api/auth/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ password: "TotallyWrongPassword!" });

    expect(response.status).toBe(403);
    expect(await findUserById(id)).toBeTruthy();
  });
});

describe("deleteUserAccount — file-store redaction (real end-to-end, no DATABASE_URL)", () => {
  it("redacts PII in diagnoses/quote_requests/itemized_quotes and removes the user + owned vehicles", async () => {
    const { id: userId } = await makeTestUser(`redact-${Date.now()}`);

    await createVehicle({
      id: crypto.randomUUID(), userId, vin: "1HGCM82633A004352",
      year: "2019", make: "Honda", model: "Accord", trim: "Sport", engine: "1.5L",
      mileage: "50000", createdAt: new Date().toISOString(),
    });
    await saveDiagnosis({
      id: crypto.randomUUID(), userId, vehicle: "2019 Honda Accord",
      description: "Real customer complaint text", zip: "95814",
      result: { summary: "real diagnosis result" }, createdAt: new Date().toISOString(),
    });
    await createQuoteRequest({
      id: crypto.randomUUID(), userId, shopName: "Some Shop", customer: "Delete Test",
      vehicle: "2019 Honda Accord", issue: "Real issue description", zip: "95814",
      estimate: "$200", status: "Solicitud nueva", initials: "DT", createdAt: new Date().toISOString(),
    });
    await createItemizedQuote({
      id: crypto.randomUUID(), token: crypto.randomUUID(), userId,
      customerName: "Delete Test", customerEmail: "delete-test@example.com", customerPhone: "5551234567",
      vehicle: {}, diagnosis: {}, quoteCombo: {}, quoteSingle: {},
    });

    await deleteUserAccount(userId);

    expect(await findUserById(userId)).toBeNull();

    const store = await readStore();
    expect(store.vehicles.some((v) => v.userId === userId)).toBe(false);

    const diagnosis = store.diagnoses.find((d) => d.userId === userId);
    expect(diagnosis.description).toBe("[deleted]");
    expect(diagnosis.result).toEqual({});

    const quoteRequest = store.quoteRequests.find((q) => q.userId === userId);
    expect(quoteRequest.customer).toBe("[deleted]");
    expect(quoteRequest.vehicle).toBe("[deleted]");
    expect(quoteRequest.issue).toBe("[deleted]");

    const itemizedQuote = store.itemizedQuotes.find((q) => q.userId === userId);
    expect(itemizedQuote.customerName).toBe("[deleted]");
    expect(itemizedQuote.customerEmail).toBeNull();
    expect(itemizedQuote.customerPhone).toBeNull();
  });

  it("removes an owned shop profile too", async () => {
    const { id: userId } = await makeTestUser(`shop-${Date.now()}`);
    await upsertShopProfile({
      id: crypto.randomUUID(), userId, shopName: "Test Shop", contactName: "Delete Test",
      phone: "5551234567", email: "shop@example.com", address: "123 Main St", city: "Sacramento",
      state: "CA", zip: "95814", specialties: [], laborRate: null, warranty: null,
      availability: null, claimed: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });

    await deleteUserAccount(userId);

    const store = await readStore();
    expect(store.shopProfiles.some((p) => p.userId === userId)).toBe(false);
  });
});

describe("DELETE /api/auth/me — full route happy path", () => {
  it("deletes the account with the correct password and the token no longer works", async () => {
    const { email } = await makeTestUser(`route-${Date.now()}`);
    const loginResponse = await request(app).post("/api/auth/login").send({ email, password: "DeleteMe123!" });
    const token = loginResponse.body.token;

    const deleteResponse = await request(app)
      .delete("/api/auth/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ password: "DeleteMe123!" });
    expect(deleteResponse.status).toBe(200);

    const meResponse = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    expect(meResponse.status).toBe(401);
  });
});

describe("deleteUserAccount — real Postgres transaction path (mocked pg client)", () => {
  it("runs BEGIN, all four statements, then COMMIT, and releases the client", async () => {
    vi.resetModules();
    const queryMock = vi.fn().mockResolvedValue({ rows: [] });
    const releaseMock = vi.fn();
    const client = { query: queryMock, release: releaseMock };
    const connectMock = vi.fn().mockResolvedValue(client);

    class MockPool {
      connect() { return connectMock(); }
      query() { return Promise.resolve({ rows: [] }); }
    }
    vi.doMock("pg", () => ({ default: { Pool: MockPool } }));
    vi.stubEnv("DATABASE_URL", "postgres://fake-host/fake-db");

    const { deleteUserAccount: pgDeleteUserAccount } = await import("../server/database.js?pg-happy-path");
    await pgDeleteUserAccount("fake-user-id");

    const calls = queryMock.mock.calls.map((call) => call[0]);
    expect(calls[0]).toMatch(/^BEGIN$/);
    expect(calls[1]).toMatch(/update diagnoses/i);
    expect(calls[2]).toMatch(/update quote_requests/i);
    expect(calls[3]).toMatch(/update itemized_quotes/i);
    expect(calls[4]).toMatch(/delete from users/i);
    expect(calls[5]).toMatch(/^COMMIT$/);
    expect(releaseMock).toHaveBeenCalledTimes(1);

    vi.doUnmock("pg");
    vi.unstubAllEnvs();
  });

  it("rolls back and never commits if a statement mid-transaction fails", async () => {
    vi.resetModules();
    const queryMock = vi.fn().mockImplementation((sql) => {
      if (/update quote_requests/i.test(sql)) return Promise.reject(new Error("simulated failure"));
      return Promise.resolve({ rows: [] });
    });
    const releaseMock = vi.fn();
    const client = { query: queryMock, release: releaseMock };
    const connectMock = vi.fn().mockResolvedValue(client);

    class MockPool {
      connect() { return connectMock(); }
      query() { return Promise.resolve({ rows: [] }); }
    }
    vi.doMock("pg", () => ({ default: { Pool: MockPool } }));
    vi.stubEnv("DATABASE_URL", "postgres://fake-host/fake-db");

    const { deleteUserAccount: pgDeleteUserAccount } = await import("../server/database.js?pg-rollback-path");
    await expect(pgDeleteUserAccount("fake-user-id")).rejects.toThrow("simulated failure");

    const calls = queryMock.mock.calls.map((call) => call[0]);
    expect(calls).toContain("ROLLBACK");
    expect(calls).not.toContain("COMMIT");
    expect(releaseMock).toHaveBeenCalledTimes(1);

    vi.doUnmock("pg");
    vi.unstubAllEnvs();
  });
});
