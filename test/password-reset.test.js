// Tests for password reset: server/database.js's createPasswordReset/
// consumePasswordReset/setUserPassword, plus the POST /api/auth/forgot-password
// and POST /api/auth/reset-password routes.

import { afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import crypto from "node:crypto";

const sendPasswordResetEmailMock = vi.hoisted(() => vi.fn().mockResolvedValue({}));

vi.mock("../server/notify.js", async () => {
  const actual = await vi.importActual("../server/notify.js");
  return { ...actual, sendPasswordResetEmail: sendPasswordResetEmailMock };
});

vi.stubEnv("AUTH_SECRET", "test-auth-secret-at-least-32-characters-long");

const { default: app } = await import("../server/app.js");
const { createPasswordReset, consumePasswordReset, createUser } = await import("../server/database.js");
const { hashPassword } = await import("../server/auth.js");

afterEach(() => {
  vi.clearAllMocks();
});

async function makeTestUser(emailSuffix) {
  const id = crypto.randomUUID();
  const email = `reset-test-${emailSuffix}@example.com`;
  await createUser({
    id,
    name: "Reset Test",
    email,
    passwordHash: await hashPassword("OldPass123!"),
    role: "driver",
    shopName: null,
    createdAt: new Date().toISOString(),
  });
  return { id, email };
}

describe("createPasswordReset / consumePasswordReset", () => {
  it("a valid token can be consumed exactly once", async () => {
    const { id } = await makeTestUser(`unit-${Date.now()}`);
    const token = await createPasswordReset(id);

    const first = await consumePasswordReset(token);
    expect(first.ok).toBe(true);
    expect(first.userId).toBe(id);

    const second = await consumePasswordReset(token);
    expect(second.ok).toBe(false);
    expect(second.reason).toBe("invalid");
  });

  it("rejects an unknown token", async () => {
    const result = await consumePasswordReset("not-a-real-token");
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("invalid");
  });
});

describe("POST /api/auth/forgot-password", () => {
  it("returns the same generic message whether or not the account exists", async () => {
    const { email } = await makeTestUser(`exists-${Date.now()}`);

    const existsResponse = await request(app).post("/api/auth/forgot-password").send({ email });
    const missingResponse = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "definitely-not-registered@example.com" });

    expect(existsResponse.status).toBe(200);
    expect(missingResponse.status).toBe(200);
    expect(existsResponse.body.message).toBe(missingResponse.body.message);
  });

  it("sends a reset email only when the account exists", async () => {
    const { email } = await makeTestUser(`sends-${Date.now()}`);
    sendPasswordResetEmailMock.mockClear();

    await request(app).post("/api/auth/forgot-password").send({ email: "nope-not-here@example.com" });
    expect(sendPasswordResetEmailMock).not.toHaveBeenCalled();

    await request(app).post("/api/auth/forgot-password").send({ email });
    expect(sendPasswordResetEmailMock).toHaveBeenCalledTimes(1);
  });
});

describe("POST /api/auth/reset-password", () => {
  it("changes the password, and the old password stops working", async () => {
    const { id, email } = await makeTestUser(`change-${Date.now()}`);
    const token = await createPasswordReset(id);

    const resetResponse = await request(app)
      .post("/api/auth/reset-password")
      .send({ token, password: "NewPass456!" });
    expect(resetResponse.status).toBe(200);

    const oldLoginResponse = await request(app)
      .post("/api/auth/login")
      .send({ email, password: "OldPass123!" });
    expect(oldLoginResponse.status).toBe(401);

    const newLoginResponse = await request(app)
      .post("/api/auth/login")
      .send({ email, password: "NewPass456!" });
    expect(newLoginResponse.status).toBe(200);
  });

  it("rejects an already-used token", async () => {
    const { id } = await makeTestUser(`reused-${Date.now()}`);
    const token = await createPasswordReset(id);

    await request(app).post("/api/auth/reset-password").send({ token, password: "FirstReset1!" });
    const secondAttempt = await request(app)
      .post("/api/auth/reset-password")
      .send({ token, password: "SecondReset2!" });

    expect(secondAttempt.status).toBe(400);
  });

  it("rejects a short password before even touching the token", async () => {
    const response = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: "irrelevant", password: "short" });
    expect(response.status).toBe(400);
  });
});
