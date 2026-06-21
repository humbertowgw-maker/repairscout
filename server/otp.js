import crypto from "node:crypto";

export const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

export function generateOtp() {
  // Cryptographically random 6-digit code
  return String(100000 + (crypto.randomBytes(3).readUIntBE(0, 3) % 900000)).padStart(6, "0");
}

const TWILIO_SID   = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM  = process.env.TWILIO_FROM_NUMBER;

export async function sendOtpSms(phone, code) {
  const body = `Your RepairScout verification code is: ${code}. Expires in 10 minutes.`;

  if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM) {
    console.log(`[otp] SMS simulation → ${phone}: "${body}"`);
    return { simulated: true };
  }

  const encoded = new URLSearchParams({ To: phone, From: TWILIO_FROM, Body: body });
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: encoded.toString(),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Twilio OTP error ${res.status}: ${err}`);
  }
  return res.json();
}

export function normalizePhone(raw) {
  const digits = String(raw).replace(/\D/g, "");
  return digits.startsWith("1") ? `+${digits}` : `+1${digits}`;
}
