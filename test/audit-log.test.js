// Tests for server/database.js's recordAuditLog, and that the auth routes it's
// wired into (register/login) don't fail even if audit logging itself would —
// every call site uses .catch() so a logging failure can't break the real request.

import { afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import crypto from "node:crypto";

vi.stubEnv("AUTH_SECRET", "test-auth-secret-at-least-32-characters-long");

const { default: app } = await import("../server/app.js");
const { recordAuditLog } = await import("../server/database.js");
const { readStore } = await import("../server/store.js");

afterEach(() => {
  vi.clearAllMocks();
});

describe("recordAuditLog", () => {
  it("inserts a record with the given action and metadata", async () => {
    const userId = crypto.randomUUID();
    await recordAuditLog(userId, "test_action", { note: "hello" });

    const store = await readStore();
    const entry = store.auditLogs.find((log) => log.userId === userId && log.action === "test_action");
    expect(entry).toBeTruthy();
    expect(entry.metadata).toEqual({ note: "hello" });
    expect(entry.createdAt).toBeTruthy();
  });

  it("accepts a null userId (e.g. for actions after a user row no longer exists)", async () => {
    await expect(recordAuditLog(null, "orphan_action", {})).resolves.not.toThrow();
  });
});

describe("register/login still succeed even though they trigger audit logging", () => {
  it("register returns 201 (audit log call is fire-and-forget, never blocks the response)", async () => {
    const response = await request(app).post("/api/auth/register").send({
      name: "Audit Test",
      email: `audit-test-${Date.now()}@example.com`,
      password: "TestPass123!",
      role: "driver",
    });
    expect(response.status).toBe(201);
  });

  it("a successful login eventually records a login audit entry", async () => {
    const email = `audit-login-${Date.now()}@example.com`;
    await request(app).post("/api/auth/register").send({
      name: "Audit Login Test", email, password: "TestPass123!", role: "driver",
    });
    const loginResponse = await request(app).post("/api/auth/login").send({ email, password: "TestPass123!" });
    expect(loginResponse.status).toBe(200);

    // recordAuditLog is fire-and-forget from the route's perspective; give the
    // microtask queue a tick to let it land before reading the store back.
    await new Promise((resolve) => setTimeout(resolve, 50));
    const store = await readStore();
    const entry = store.auditLogs.find((log) => log.userId === loginResponse.body.user.id && log.action === "login");
    expect(entry).toBeTruthy();
  });
});
