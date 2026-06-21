const BLAND_BASE = "https://api.bland.ai/v1";

export function blandConfigured() {
  return Boolean(process.env.BLAND_API_KEY);
}

export async function startPartInquiryCall({ inquiryId, partName, vehicle, storeName, storePhone, webhookUrl }) {
  const task = [
    `You are calling ${storeName}, an auto parts store, on behalf of a repair shop.`,
    `Ask if they currently have this specific part in stock: "${partName}"`,
    vehicle ? `The part is needed for a ${vehicle}.` : "",
    "Get exactly: (1) whether the part is in stock right now, (2) how many units they have available, (3) the current price, and (4) whether a customer can pick it up today.",
    "Be brief and professional. Say you're calling for a repair shop. Thank them and end the call once you have all four pieces of information.",
  ].filter(Boolean).join(" ");

  const response = await fetch(`${BLAND_BASE}/calls`, {
    method: "POST",
    headers: {
      Authorization: process.env.BLAND_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      phone_number: storePhone,
      task,
      voice: "maya",
      model: "turbo",
      max_duration: 4,
      wait_for_greeting: true,
      record: true,
      amd: true,
      webhook: webhookUrl,
      metadata: { inquiryId },
      analysis_schema: {
        has_part: "boolean — true if the store confirmed the part is in stock",
        quantity: "number — units currently in stock, or null if they did not say",
        price: "string — price quoted by the store (e.g. '$64.99'), or null",
        pickup_today: "boolean — true if the customer can pick it up the same day",
      },
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Bland.ai: ${err.message || response.status}`);
  }

  return response.json();
}

export function parseBlandWebhook(body) {
  return {
    callId: body.call_id,
    inquiryId: body.metadata?.inquiryId,
    status: body.status,           // "completed" | "failed" | "no-answer"
    transcript: body.transcript || "",
    summary: body.summary || "",
    analysis: body.analysis || {},
  };
}

// ── Dev-mode simulation (no BLAND_API_KEY) ───────────────────────────────────
// Resolves after a short delay with randomized realistic results so the
// frontend polling works the same way in development.

const SIM_RESULTS = [
  { has_part: true,  quantity: 8, price: "$64.99", pickup_today: true  },
  { has_part: true,  quantity: 3, price: "$58.49", pickup_today: true  },
  { has_part: true,  quantity: 1, price: "$72.99", pickup_today: true  },
  { has_part: false, quantity: 0, price: null,      pickup_today: false },
  { has_part: true,  quantity: 5, price: "$61.00", pickup_today: true  },
];

let simIndex = 0;
export function simulatedCallResult(inquiryId) {
  const result = SIM_RESULTS[simIndex % SIM_RESULTS.length];
  simIndex++;
  return {
    callId: `sim_${inquiryId}`,
    inquiryId,
    status: "completed",
    transcript: result.has_part
      ? `Agent: Hi, do you have ${result.price} brake pads in stock? Store: Yes we have ${result.quantity} available.`
      : "Agent: Hi, do you have brake pads in stock? Store: Sorry, we're out of stock on that item.",
    summary: result.has_part
      ? `Store confirmed ${result.quantity} units in stock at ${result.price}. Pickup available today.`
      : "Store does not have the part in stock.",
    analysis: result,
  };
}
