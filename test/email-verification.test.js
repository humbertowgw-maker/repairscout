// Tests for email verification: server/database.js's createEmailVerification/
// verifyEmailToken (tested directly against the file-store fallback, since
// DATABASE_URL isn't set in test env — same precedent as test/otp.test.js) plus
// the GET /api/auth/verify-email and POST /api/auth/resend-verification routes.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import crypto from "node:crypto";

const sendVerificationEmailMock = vi.hoisted(() => vi.fn().mockResolvedValue({}));

vi.mock("../server/notify.js", async () => {
  const actual = await vi.importActual("../server/notify.js");
  return { ...actual, sendVerificationEmail: sendVerificationEmailMock };
});

// AUTH_SECRET isn't set in the base test env (only routes that call createToken
// need it — register/login) — stub a valid 32+ char value for this file.
vi.stubEnv("AUTH_SECRET", "test-auth-secret-at-least-32-characters-long");

const { default: app } = await import("../server/app.js");
const { createEmailVerification, verifyEmailToken, createUser, findUserById } = await import("../server/database.js");
const { hashPassword } = await import("../server/auth.js");

afterEach(() => {
  vi.clearAllMocks();
});

async function makeTestUser(emailSuffix) {
  const id = crypto.randomUUID();
  await createUser({
    id,
    name: "Verify Test",
    email: `verify-test-${emailSuffix}@example.com`,
    passwordHash: await hashPassword("TestPass123!"),
    role: "driver",
    shopName: null,
    createdAt: new Date().toISOString(),
  });
  return id;
}

describe("createEmailVerification / verifyEmailToken", () => {
  it("a valid token flips email_verified and can't be reused", async () => {
    const userId = await makeTestUser(`unit-${Date.now()}`);
    const token = await createEmailVerification(userId);

    const result = await verifyEmailToken(token);
    expect(result.ok).toBe(true);
    const user = await findUserById(userId);
    expect(user.emailVerified).toBe(true);

    const secondAttempt = await verifyEmailToken(token);
    expect(secondAttempt.ok).toBe(false);
    expect(secondAttempt.reason).toBe("invalid");
  });

  it("rejects an unknown token as invalid", async () => {
    const result = await verifyEmailToken("not-a-real-token");
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("invalid");
  });
});

describe("GET /api/auth/verify-email", () => {
  it("returns 400 when the token is missing", async () => {
    const response = await request(app).get("/api/auth/verify-email");
    expect(response.status).toBe(400);
  });

  it("returns 200 and verifies with a real token", async () => {
    const userId = await makeTestUser(`route-${Date.now()}`);
    const token = await createEmailVerification(userId);

    const response = await request(app).get(`/api/auth/verify-email?token=${token}`);
    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
  });

  it("returns 400 for an invalid token", async () => {
    const response = await request(app).get("/api/auth/verify-email?token=garbage");
    expect(response.status).toBe(400);
  });
});

describe("POST /api/auth/register — still works with verification wired in", () => {
  it("registration still returns 201 with a user and token", async () => {
    const response = await request(app).post("/api/auth/register").send({
      name: "New Driver",
      email: `new-driver-${Date.now()}@example.com`,
      password: "TestPass123!",
      role: "driver",
    });
    expect(response.status).toBe(201);
    expect(response.body.user.email).toContain("new-driver-");
    expect(response.body.token).toBeTruthy();
  });
});

describe("POST /api/auth/resend-verification", () => {
  it("requires auth", async () => {
    const response = await request(app).post("/api/auth/resend-verification").send({});
    expect(response.status).toBe(401);
  });

  it("sends a new verification email for the logged-in user", async () => {
    const registerResponse = await request(app).post("/api/auth/register").send({
      name: "Resend Test",
      email: `resend-test-${Date.now()}@example.com`,
      password: "TestPass123!",
      role: "driver",
    });
    const token = registerResponse.body.token;

    const response = await request(app)
      .post("/api/auth/resend-verification")
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(response.status).toBe(200);
    expect(sendVerificationEmailMock).toHaveBeenCalled();
  });
});
