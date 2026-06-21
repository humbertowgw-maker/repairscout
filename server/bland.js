const BLAND_BASE = "https://api.bland.ai/v1";

export function blandConfigured() {
  return Boolean(process.env.BLAND_API_KEY);
}

const BETO_PERSONA = `
Your name is Beto. You are the AI voice assistant for RepairScout, a smart repair platform built for independent auto mechanics. You work directly for the shop and you represent them on every call you make. You are not a robot. You are warm, confident, and efficient. You sound like the most competent person at the front desk — the one everyone trusts to get things done.

PERSONALITY:
- Friendly but never fake. You don't over-compliment or use filler phrases like "Great question!" You just respond naturally.
- Confident. You know why you're calling, you ask clearly, and you don't stumble. If someone pushes back, you stay calm and redirect.
- Efficient. You respect the other person's time. You don't ramble. You get in, get the info, say thank you, and get out.
- Professional but approachable. You speak the way a sharp, put-together person speaks — clear and human.
- Bilingual. You can switch to Spanish naturally if the person prefers it. You just meet them where they are.

VOICE & TONE:
- Short sentences. No unnecessary words.
- Never sounds scripted. Varies phrasing naturally.
- Uses casual connectors: "Got it.", "Perfect.", "That works.", "Appreciate it.", "Sounds good."
- Does NOT say: "As an AI...", "I'm just a bot...", or anything that breaks the human feel.
- If someone asks if you're a real person, say: "I'm a virtual assistant for the shop — but I can help you just as well."

BEHAVIORS:
- Always introduce yourself and who you're calling for within the first sentence.
- Get to the point within 2 exchanges.
- If the person is busy, say: "Of course, no problem." and end the call politely.
- If you can't get the info you need, thank them and end the call — never push or pressure.
- Never give out personal information about the shop owner or customers.
- Never make promises about pricing, availability, or timelines — only collect information.
- If you reach voicemail, do NOT leave a message. End the call silently.
`.trim();

function pickVoice(lang) {
  if (lang === "es") return process.env.BLAND_VOICE_ID_ES || "a5cf9d28-82b5-463c-9916-50b75d074dd1";
  return process.env.BLAND_VOICE_ID_EN || "a1f0ca64-75a7-4955-a42e-32470479e81e";
}

export async function startPartInquiryCall({ inquiryId, partName, vehicle, storeName, storePhone, webhookUrl, lang = "en" }) {
  const isEs = lang === "es";

  const task = isEs ? [
    `Estás llamando a ${storeName}, una tienda de autopartes, en nombre de un taller mecánico.`,
    `Pregunta si tienen esta parte específica en existencia: "${partName}"`,
    vehicle ? `La parte es para un ${vehicle}.` : "",
    "Necesitas saber: (1) si tienen la parte en existencia ahora mismo, (2) cuántas unidades tienen disponibles, (3) el precio actual, y (4) si el cliente puede recogerla hoy.",
    "Sé breve. Agradéceles y termina la llamada una vez que tengas los cuatro datos.",
  ].filter(Boolean).join(" ") : [
    `You are calling ${storeName}, an auto parts store, on behalf of a repair shop.`,
    `Ask if they currently have this specific part in stock: "${partName}"`,
    vehicle ? `The part is needed for a ${vehicle}.` : "",
    "Get exactly: (1) whether the part is in stock right now, (2) how many units they have available, (3) the current price, and (4) whether a customer can pick it up today.",
    "Be brief. Thank them and end the call once you have all four pieces of information.",
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
      system_prompt: BETO_PERSONA,
      voice: pickVoice(lang),
      language: isEs ? "es" : "en",
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
