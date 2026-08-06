// Regression coverage for the OTP send endpoint (POST /api/otp/send).
//
// Fixed in cf7fa36 ("Stop false-success SMS verification"): previously this
// endpoint returned `{ sent: true }` even when Twilio wasn't configured — it
// silently logged the code to the console instead of texting anyone, but
// told the client it succeeded. It now returns a distinct 503 with
// `code: "SMS_NOT_CONFIGURED"`. These tests guard against that exact bug
// class recurring, and confirm the happy path still reports `sent: true`
// when Twilio is actually configured and the provider call succeeds.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

const TWILIO_ENV_KEYS = ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM_NUMBER"];

beforeEach(() => {
  for (const key of TWILIO_ENV_KEYS) {
    vi.stubEnv(key, "");
  }
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const { default: app } = await import("../server/app.js");

describe("POST /api/otp/send — SMS not configured", () => {
  it("returns 503 with code SMS_NOT_CONFIGURED, never a false sent:true", async () => {
    // No network call should even be attempted when Twilio isn't configured.
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await request(app)
      .post("/api/otp/send")
      .send({ phone: "5551234567" });

    expect(response.status).toBe(503);
    expect(response.body.code).toBe("SMS_NOT_CONFIGURED");
    expect(response.body.sent).not.toBe(true);
    expect(response.body).not.toHaveProperty("sent");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/otp/send — SMS configured and delivered", () => {
  it("returns 200 with sent:true once Twilio is configured and accepts the message", async () => {
    vi.stubEnv("TWILIO_ACCOUNT_SID", "AC_test_sid");
    vi.stubEnv("TWILIO_AUTH_TOKEN", "test_token");
    vi.stubEnv("TWILIO_FROM_NUMBER", "+15005550006");

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ sid: "SM_test_message_sid", status: "queued" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await request(app)
      .post("/api/otp/send")
      .send({ phone: "5559876543" });

    expect(response.status).toBe(200);
    expect(response.body.sent).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain("api.twilio.com");
  });
});

describe("POST /api/otp/send — provider rejects the message", () => {
  it("returns 502 with code SMS_DELIVERY_FAILED (distinct from the not-configured case)", async () => {
    vi.stubEnv("TWILIO_ACCOUNT_SID", "AC_test_sid");
    vi.stubEnv("TWILIO_AUTH_TOKEN", "test_token");
    vi.stubEnv("TWILIO_FROM_NUMBER", "+15005550006");

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ code: 21211, message: "Invalid 'To' Phone Number" }),
    }));

    const response = await request(app)
      .post("/api/otp/send")
      .send({ phone: "5551112222" });

    expect(response.status).toBe(502);
    expect(response.body.code).toBe("SMS_DELIVERY_FAILED");
    expect(response.body.sent).not.toBe(true);
  });
});

describe("POST /api/otp/send — input validation", () => {
  it("returns 400 when phone is missing", async () => {
    const response = await request(app).post("/api/otp/send").send({});
    expect(response.status).toBe(400);
    expect(response.body.sent).not.toBe(true);
  });
});
