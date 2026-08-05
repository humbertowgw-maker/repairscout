import crypto from "node:crypto";

export const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

export function generateOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

function twilioConfig() {
  return {
    sid: process.env.TWILIO_ACCOUNT_SID,
    token: process.env.TWILIO_AUTH_TOKEN,
    from: process.env.TWILIO_FROM_NUMBER,
  };
}

export function otpConfigured() {
  const { sid, token, from } = twilioConfig();
  return Boolean(sid && token && from);
}

export async function sendOtpSms(phone, code) {
  const body = `Your RepairScout verification code is: ${code}. Expires in 10 minutes.`;
  const { sid, token, from } = twilioConfig();

  if (!sid || !token || !from) {
    const error = new Error("RepairScout SMS delivery is not configured.");
    error.code = "SMS_NOT_CONFIGURED";
    throw error;
  }

  const encoded = new URLSearchParams({ To: phone, From: from, Body: body });
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: encoded.toString(),
    }
  );

  if (!res.ok) {
    const providerError = await res.json().catch(() => ({}));
    const message = providerError?.message || `Twilio returned HTTP ${res.status}`;
    const error = new Error(message);
    error.code = providerError?.code || "SMS_PROVIDER_ERROR";
    throw error;
  }

  return res.json();
}

export function normalizePhone(raw) {
  const digits = String(raw).replace(/\D/g, "");
  return digits.startsWith("1") ? `+${digits}` : `+1${digits}`;
}
