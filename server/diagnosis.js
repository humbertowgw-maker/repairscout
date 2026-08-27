import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { generateText, Output, jsonSchema } from "ai";
import { z } from "zod";
import { extractCodesFromText, lookupCodes } from "./obd-codes.js";
import { findConfirmedOutcomes } from "./database.js";
import { REPAIR_GUIDES } from "./repair-guides.js";

const REPAIR_GUIDE_IDS = Object.keys(REPAIR_GUIDES);

const ScenarioSchema = z.object({
  scenario: z.string(),
  estimatedCost: z.string(),
  outcome: z.string(),
  timeframe: z.string(),
});

const DiagnosisSchema = z.object({
  summary: z.string(),
  safetyLevel: z.enum(["bajo", "moderado", "alto", "crítico"]),
  safetyMessage: z.string(),
  possibleCauses: z.array(
    z.object({
      probability: z.number().min(1).max(99),
      title: z.string(),
      reason: z.string(),
      test: z.string(),
      urgency: z.string(),
      tone: z.enum(["danger", "warn", "neutral"]),
      // Lets the AI point straight at a known step-by-step repair guide instead of
      // relying on matchGuideForCause's regex over free-form title/reason text, which
      // misses plenty of real phrasing. .nullable() alongside .optional() for the same
      // reason bestCase/worstCase need it above — OpenAI structured outputs reject an
      // optional field that isn't also nullable.
      guideCategory: z.enum(REPAIR_GUIDE_IDS).nullable().optional(),
    }),
  ).min(1).max(4),
  estimate: z.object({
    low: z.number().nonnegative(),
    high: z.number().nonnegative(),
    partsLow: z.number().nonnegative(),
    partsHigh: z.number().nonnegative(),
    laborLow: z.number().nonnegative(),
    laborHigh: z.number().nonnegative(),
    laborHoursLow: z.number().nonnegative(),
    laborHoursHigh: z.number().nonnegative(),
    confidence: z.enum(["Baja", "Media", "Alta"]),
    repairLabel: z.string(),
  }),
  // .nullable() is required alongside .optional() here: OpenAI's structured
  // outputs (zodTextFormat, used by diagnoseWithOpenAI) reject any optional
  // field that isn't also nullable — without it, the OpenAI provider throws
  // before it ever makes a request, for every single diagnosis.
  bestCase: ScenarioSchema.nullable().optional(),
  worstCase: ScenarioSchema.nullable().optional(),
  questions: z.array(z.string()).max(4),
});

const PROVIDER_LABELS = {
  groq: "Groq",
  gemini: "Google Gemini",
  openrouter: "OpenRouter",
  ollama: "Local (Ollama)",
  "ai-gateway": "Vercel AI Gateway",
  openai: "OpenAI",
};

function configuredProviders() {
  return {
    groq: Boolean(process.env.GROQ_API_KEY),
    gemini: Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY),
    openrouter: Boolean(process.env.OPENROUTER_API_KEY),
    // Serverless production must enqueue work for the pull worker instead of
    // reaching into the private fleet. Local workers opt in explicitly.
    ollama: process.env.OLLAMA_DIAGNOSIS_ENABLED === "true"
      || (process.env.VERCEL !== "1" && process.env.OLLAMA_DIAGNOSIS_ENABLED !== "false"),
    "ai-gateway": Boolean(
      process.env.AI_GATEWAY_API_KEY ||
      process.env.VERCEL_OIDC_TOKEN ||
      process.env.VERCEL === "1",
    ),
    openai: Boolean(process.env.OPENAI_API_KEY),
  };
}

function providerOrder() {
  const configured = configuredProviders();
  // Interactive/serverless routes use free cloud providers. Paid and free
  // customer jobs are queued separately and handled local-first by the pull
  // worker, which forces AI_PROVIDER_ORDER=ollama.
  const requested = String(
    process.env.AI_PROVIDER_ORDER || "groq,gemini,openrouter,ollama,ai-gateway,openai",
  )
    .split(",")
    .map((provider) => provider.trim().toLowerCase())
    .filter((provider) => Object.hasOwn(PROVIDER_LABELS, provider));

  return [...new Set(requested)].filter((provider) => configured[provider]);
}

function preferredProvider(input) {
  const symptoms = [
    input.description,
    ...(input.obdCodes || []),
  ].join(" ").toLowerCase();

  if (/(fren|brake|sobrecal|overheat|temperatura|humo|combustible|fuel|dirección|steering)/.test(symptoms)) {
    return "gemini";
  }

  // Previously routed OBD-code-related queries to OpenRouter's free tier — the weakest
  // model in the chain, for exactly the kind of query that most needs to get a specific
  // technical fact right. Grounding the prompt with verified code definitions (see
  // groundedCodesSection below) matters more here than which model handles it, so this
  // no longer special-cases code-related queries into a weaker provider.

  return "groq";
}

/**
 * Look up any OBD-II codes the user provided (either the structured obdCodes field or
 * codes typed directly into the free-text description) against the generic-code
 * dictionary, and build a section for the prompt that gives the model verified ground
 * truth instead of relying on its own recall — recall is exactly what was producing
 * wrong answers before.
 */
export function groundedCodesSection(input, language) {
  const isEn = language === "en";
  const candidates = [
    ...(input.obdCodes || []),
    ...extractCodesFromText(input.description),
  ];
  if (candidates.length === 0) return "";

  const { found, unknown } = lookupCodes(candidates);
  const lines = [];

  if (Object.keys(found).length > 0) {
    lines.push(isEn ? "Verified OBD-II code definitions (use these exact definitions, do not guess a different meaning):" : "Definiciones verificadas de códigos OBD-II (usa exactamente estas definiciones, no adivines un significado distinto):");
    for (const [code, meaning] of Object.entries(found)) {
      lines.push(`- ${code}: ${meaning}`);
    }
  }

  if (unknown.length > 0) {
    lines.push(
      isEn
        ? `The following codes were provided but are not in the verified generic-code dataset (likely manufacturer-specific): ${unknown.join(", ")}. Say explicitly that these need to be looked up against the vehicle manufacturer's specific code list rather than guessing a definition.`
        : `Los siguientes códigos fueron proporcionados pero no están en el conjunto de códigos genéricos verificados (probablemente específicos del fabricante): ${unknown.join(", ")}. Indica explícitamente que deben buscarse en la lista de códigos específica del fabricante en lugar de adivinar una definición.`
    );
  }

  return lines.length ? `\n\n${lines.join("\n")}` : "";
}

// Same symptom categories fallbackDiagnosis() already hand-recognizes below (brake,
// starting) — kept intentionally small rather than trying to cover every possible
// symptom, since these keywords drive an ILIKE match against real repair_outcomes rows,
// not free-form NLP.
function extractSymptomKeywords(description) {
  const normalized = String(description || "").toLowerCase();
  const keywords = [];
  if (/(fren|brake|rechin|grind|pastilla|pad)/.test(normalized)) keywords.push("brake", "freno", "brake pad", "pastilla");
  if (/(no enciende|no arranca|won't start|bater)/.test(normalized)) keywords.push("start", "arranque", "battery", "bateria");
  return keywords;
}

/**
 * Grounds the AI prompt with real, admin/shop-confirmed repair outcomes from similar
 * vehicles — the actual differentiator this exists for: RepairScout's own growing record
 * of what really worked, not scraped content. Mirrors groundedCodesSection's shape
 * exactly (look up verified facts, format a labeled block) but needs a DB round-trip, so
 * every caller must await it and the call site already wraps it in .catch(() => "") —
 * a database hiccup must never fail a diagnosis, it should just mean less grounding.
 */
export async function groundedOutcomesSection(input, language) {
  const vehicle = input.vehicle || {};
  if (!vehicle.make || !vehicle.model) return "";

  const isEn = language === "en";
  const keywords = extractSymptomKeywords(input.description);
  const outcomes = await findConfirmedOutcomes({
    make: vehicle.make,
    model: vehicle.model,
    symptomKeywords: keywords,
    obdCodes: input.obdCodes || [],
    limit: 3,
  });
  if (!outcomes.length) return "";

  const lines = [
    isEn
      ? `Confirmed fixes from real RepairScout repairs on similar vehicles (verified by the repair shop or reviewed by RepairScout — use these as real evidence, not just a suggestion):`
      : `Reparaciones confirmadas de casos reales de RepairScout en vehículos similares (verificadas por el taller o revisadas por RepairScout — úsalas como evidencia real, no solo como sugerencia):`,
  ];
  for (const o of outcomes) {
    const veh = [o.vehicle?.year, o.vehicle?.make, o.vehicle?.model].filter(Boolean).join(" ");
    lines.push(`- ${veh}: "${o.causeTitle}" → ${o.fixDescription || (isEn ? "fix not recorded" : "reparación no registrada")}${o.notes ? ` (${o.notes})` : ""}`);
  }
  return `\n\n${lines.join("\n")}`;
}

function orderedProviders(input) {
  const available = providerOrder();
  const preferred = preferredProvider(input);
  return [preferred, ...available].filter(
    (provider, index, providers) => available.includes(provider) && providers.indexOf(provider) === index,
  );
}

export function getDiagnosisProviderStatus() {
  const providers = configuredProviders();
  return {
    configured: Object.keys(providers).filter((provider) => providers[provider]),
    preferredOrder: providerOrder(),
  };
}

function extractJson(text, language = "es") {
  const raw = String(text || "").trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < start) {
    throw new Error("The provider did not return a JSON object.");
  }

  const parsed = JSON.parse(raw.slice(start, end + 1));
  const number = (value, fallback = 0) => {
    const result = Number(value);
    return Number.isFinite(result) ? Math.max(0, result) : fallback;
  };
  const safetyLevels = ["bajo", "moderado", "alto", "crítico"];
  const tones = ["danger", "warn", "neutral"];
  const confidences = ["Baja", "Media", "Alta"];
  const causes = Array.isArray(parsed.possibleCauses) ? parsed.possibleCauses : [];
  const estimate = parsed.estimate || {};
  const isEn = language === "en";
  const normalized = {
    summary: String(parsed.summary || (isEn ? "A professional inspection is required to confirm the cause." : "Se requiere una inspección profesional para confirmar la causa.")),
    safetyLevel: safetyLevels.includes(parsed.safetyLevel) ? parsed.safetyLevel : "moderado",
    safetyMessage: String(parsed.safetyMessage || (isEn ? "Stop driving if the symptom worsens or affects safe operation." : "Detén el vehículo si el síntoma empeora o afecta la conducción segura.")),
    possibleCauses: causes.slice(0, 4).map((cause) => ({
      probability: Math.min(99, Math.max(1, Math.round(number(cause?.probability, 25)))),
      title: String(cause?.title || (isEn ? "Possible cause" : "Causa posible")),
      reason: String(cause?.reason || (isEn ? "Must be verified with a physical inspection." : "Debe verificarse con una inspección física.")),
      test: String(cause?.test || (isEn ? "Inspect and test the related system." : "Realizar inspección y pruebas del sistema relacionado.")),
      urgency: String(cause?.urgency || (isEn ? "Verify" : "Verificar")),
      tone: tones.includes(cause?.tone) ? cause.tone : "neutral",
      // Never trust the raw string as a valid id — text-JSON providers (Groq, Gemini,
      // OpenRouter) aren't schema-enforced like the OpenAI/Gateway paths, so a
      // hallucinated or outdated id must fall back to null (and matchGuideForCause's
      // regex) rather than crash a lookup downstream.
      guideCategory: REPAIR_GUIDE_IDS.includes(cause?.guideCategory) ? cause.guideCategory : null,
    })),
    estimate: {
      low: number(estimate.low),
      high: number(estimate.high),
      partsLow: number(estimate.partsLow),
      partsHigh: number(estimate.partsHigh),
      laborLow: number(estimate.laborLow),
      laborHigh: number(estimate.laborHigh),
      laborHoursLow: number(estimate.laborHoursLow),
      laborHoursHigh: number(estimate.laborHoursHigh),
      confidence: confidences.includes(estimate.confidence) ? estimate.confidence : "Baja",
      repairLabel: String(estimate.repairLabel || (isEn ? "Diagnosis and initial inspection" : "Diagnóstico e inspección inicial")),
    },
    bestCase: parsed.bestCase ? {
      scenario: String(parsed.bestCase.scenario || ""),
      estimatedCost: String(parsed.bestCase.estimatedCost || ""),
      outcome: String(parsed.bestCase.outcome || ""),
      timeframe: String(parsed.bestCase.timeframe || ""),
    } : undefined,
    worstCase: parsed.worstCase ? {
      scenario: String(parsed.worstCase.scenario || ""),
      estimatedCost: String(parsed.worstCase.estimatedCost || ""),
      outcome: String(parsed.worstCase.outcome || ""),
      timeframe: String(parsed.worstCase.timeframe || ""),
    } : undefined,
    questions: (Array.isArray(parsed.questions) ? parsed.questions : [])
      .slice(0, 4)
      .map((question) => String(question)),
  };

  if (!normalized.possibleCauses.length) {
    normalized.possibleCauses.push({
      probability: 25,
      title: isEn ? "Cause pending confirmation" : "Causa pendiente de confirmación",
      reason: isEn ? "The response requires an inspection to identify the exact component." : "La respuesta requiere una inspección para identificar el componente exacto.",
      test: isEn ? "Perform visual inspection, OBD-II scan, and tests on the related system." : "Realizar inspección visual, escaneo OBD-II y pruebas del sistema relacionado.",
      urgency: isEn ? "Diagnose" : "Diagnosticar",
      tone: "warn",
    });
  }

  const diagnosis = DiagnosisSchema.safeParse(normalized);
  if (!diagnosis.success) {
    throw new Error("The provider returned an invalid diagnosis structure.");
  }
  return diagnosis.data;
}

async function requestJson(url, options, provider, timeoutMs = 25_000) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(timeoutMs),
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = payload?.error?.message || payload?.message || `HTTP ${response.status}`;
    throw new Error(`${provider} request failed: ${message}`);
  }

  return payload;
}

function jsonInstruction(systemPrompt) {
  return `${systemPrompt}
Return only valid JSON, no Markdown. Use exactly this structure:
{
  "summary": "string",
  "safetyLevel": "bajo|moderado|alto|crítico",
  "safetyMessage": "string",
  "possibleCauses": [{"probability": 1, "title": "string", "reason": "string — explain WHY this is likely in 2-3 sentences with specific technical detail", "test": "string — specific diagnostic test or measurement to confirm/rule out", "urgency": "string", "tone": "danger|warn|neutral", "guideCategory": "string or null — one of the fixed ids below if a step-by-step guide exists for this exact repair, else null"}],
  "estimate": {"low": 0, "high": 0, "partsLow": 0, "partsHigh": 0, "laborLow": 0, "laborHigh": 0, "laborHoursLow": 0, "laborHoursHigh": 0, "confidence": "Baja|Media|Alta", "repairLabel": "string"},
  "bestCase": {"scenario": "string — the mildest/cheapest likely repair", "estimatedCost": "$X–$Y", "outcome": "string — what gets resolved", "timeframe": "string — e.g. same day"},
  "worstCase": {"scenario": "string — the most extensive repair needed if all related components failed", "estimatedCost": "$X–$Y", "outcome": "string — what could happen if ignored", "timeframe": "string — e.g. 2-3 days"},
  "questions": ["string — specific question to get more info that would change the diagnosis or estimate"]
}
IMPORTANT: safetyLevel must always be one of: bajo, moderado, alto, crítico (these are fixed codes, not translated).
IMPORTANT: confidence must always be one of: Baja, Media, Alta (fixed codes, not translated).
IMPORTANT: guideCategory must be exactly one of these fixed ids (never invent a new one) or null: ${REPAIR_GUIDE_IDS.join(", ")}.
possibleCauses reason fields must be detailed and explain the technical connection between symptoms and the cause.
questions must be targeted follow-up questions that would meaningfully narrow down the diagnosis.
All other text fields must be written in the language specified in the system prompt.`;
}

async function diagnoseWithOpenAiCompatible({
  apiKey,
  model,
  url,
  systemPrompt,
  userPrompt,
  provider,
  language = "es",
  headers = {},
}) {
  const payload = await requestJson(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: jsonInstruction(systemPrompt) },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 1_800,
      response_format: { type: "json_object" },
    }),
  }, provider);

  return extractJson(payload?.choices?.[0]?.message?.content, language);
}

async function diagnoseWithGroq(systemPrompt, userPrompt, language) {
  return diagnoseWithOpenAiCompatible({
    apiKey: process.env.GROQ_API_KEY,
    model: process.env.GROQ_MODEL || "llama-3.1-8b-instant",
    url: "https://api.groq.com/openai/v1/chat/completions",
    systemPrompt,
    userPrompt,
    provider: "Groq",
    language,
  });
}

async function diagnoseWithOpenRouter(systemPrompt, userPrompt, language) {
  return diagnoseWithOpenAiCompatible({
    apiKey: process.env.OPENROUTER_API_KEY,
    model: process.env.OPENROUTER_MODEL || "openrouter/free",
    url: "https://openrouter.ai/api/v1/chat/completions",
    systemPrompt,
    userPrompt,
    provider: "OpenRouter",
    language,
    headers: {
      "HTTP-Referer": process.env.APP_URL || "https://repairscout-smoky.vercel.app",
      "X-Title": "RepairScout",
    },
  });
}

async function diagnoseWithOllama(systemPrompt, userPrompt, language) {
  // Measured 2026-08-09: a full 4-cause detailed response takes ~11-20s on
  // this hardware, close to the 25s default other (much faster) providers
  // use. This is a fallback tier only reached after free-tier options are
  // exhausted, so a longer wait for a genuinely free result is the right
  // tradeoff over failing fast into the generic hardcoded fallback.
  const payload = await requestJson(
    `${process.env.OLLAMA_DIAGNOSIS_URL || "http://birdsstudio-1:11435"}/v1/chat/completions`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OLLAMA_DIAGNOSIS_MODEL || "qwen2.5:7b",
        messages: [
          { role: "system", content: jsonInstruction(systemPrompt) },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
        response_format: { type: "json_object" },
      }),
    },
    "Ollama",
    60_000,
  );

  return extractJson(payload?.choices?.[0]?.message?.content, language);
}

async function diagnoseWithGemini(systemPrompt, userPrompt, language) {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const payload = await requestJson(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: jsonInstruction(systemPrompt) }],
        },
        contents: [{
          role: "user",
          parts: [{ text: userPrompt }],
        }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1_800,
          responseMimeType: "application/json",
        },
      }),
    },
    "Gemini",
  );

  return extractJson(payload?.candidates?.[0]?.content?.parts?.[0]?.text, language);
}

// AI SDK's own Zod->JSON-Schema conversion (used when passing a raw Zod schema straight
// to Output.object) does not reliably include nullable+optional fields (bestCase/
// worstCase) in the resulting `required` array — OpenAI models routed through the Gateway
// with strict structured-output mode then reject the schema outright ("Missing 'bestCase'"),
// even though the exact same schema works fine via zodTextFormat on the direct OpenAI path
// below. Reusing zodTextFormat's proven-correct conversion here, instead of debugging the
// SDK's internal converter, sidesteps the bug without a second schema to keep in sync.
const gatewayDiagnosisSchema = jsonSchema(zodTextFormat(DiagnosisSchema, "vehicle_diagnosis").schema);

async function diagnoseWithGateway(systemPrompt, userPrompt) {
  const { output } = await generateText({
    model: process.env.AI_GATEWAY_MODEL || "openai/gpt-5.4",
    instructions: systemPrompt,
    prompt: userPrompt,
    output: Output.object({ schema: gatewayDiagnosisSchema }),
    providerOptions: {
      gateway: {
        tags: ["app:repairscout", "feature:diagnosis"],
      },
    },
  });
  return output;
}

async function diagnoseWithOpenAI(systemPrompt, userPrompt) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.responses.parse({
    model: process.env.OPENAI_MODEL || "gpt-5.5",
    input: [
      {
        role: "system",
        content: [{ type: "input_text", text: systemPrompt }],
      },
      {
        role: "user",
        content: [{ type: "input_text", text: userPrompt }],
      },
    ],
    text: {
      format: zodTextFormat(DiagnosisSchema, "vehicle_diagnosis"),
    },
  });
  return response.output_parsed;
}

function fallbackDiagnosis(description, language = "es") {
  const normalized = description.toLowerCase();
  const brakeConcern = /(fren|brake|rechin|grind)/.test(normalized);
  const startingConcern = /(no enciende|no arranca|won't start|bater)/.test(normalized);
  const en = language === "en";

  if (startingConcern) {
    return {
      summary: en
        ? "The issue appears related to the starting system or electrical power supply."
        : "El problema parece estar relacionado con el sistema de arranque o la alimentación eléctrica.",
      safetyLevel: "moderado",
      safetyMessage: en
        ? "Do not attempt to start the vehicle repeatedly if you notice burning smells, smoke, or hot wires."
        : "No intentes arrancar repetidamente si notas olor a quemado, humo o cables calientes.",
      possibleCauses: [
        {
          probability: 72,
          title: en ? "Weak or failed battery" : "Batería descargada o deteriorada",
          reason: en ? "A battery with low voltage is one of the most common causes when the engine won't start." : "Una batería con bajo voltaje es una de las causas más comunes cuando el motor no arranca.",
          test: en ? "Measure resting voltage and voltage during the start attempt." : "Medir el voltaje en reposo y durante el intento de arranque.",
          urgency: en ? "Check first" : "Revisar primero",
          tone: "warn",
          guideCategory: "battery-and-terminals",
        },
        {
          probability: 38,
          title: en ? "Poor electrical connection" : "Conexión eléctrica deficiente",
          reason: en ? "Loose or corroded terminals can prevent enough current from reaching the starter motor." : "Terminales flojos o corroídos pueden impedir que llegue suficiente corriente al motor de arranque.",
          test: en ? "Inspect terminals, grounds, and voltage drop across cables." : "Inspeccionar terminales, tierras y caída de voltaje en los cables.",
          urgency: en ? "Verify" : "Verificar",
          tone: "neutral",
          guideCategory: "battery-and-terminals",
        },
      ],
      estimate: {
        low: 120, high: 480, partsLow: 80, partsHigh: 310,
        laborLow: 40, laborHigh: 170, laborHoursLow: 0.5, laborHoursHigh: 1.5,
        confidence: "Media",
        repairLabel: en ? "Starting system diagnosis and possible battery replacement" : "Diagnóstico del sistema de arranque y posible reemplazo de batería",
      },
      questions: en
        ? ["Do the dashboard lights come on?", "Do you hear a click when turning the key?"]
        : ["¿Las luces del tablero encienden?", "¿Escuchas un clic al girar la llave?"],
    };
  }

  if (brakeConcern) {
    return {
      summary: en
        ? "Symptoms point first to the front brake system."
        : "Los síntomas apuntan primero al sistema de frenos delantero.",
      safetyLevel: "alto",
      safetyMessage: en
        ? "Limit vehicle use until the brakes have been inspected."
        : "Limita el uso del vehículo hasta que los frenos sean inspeccionados.",
      possibleCauses: [
        {
          probability: 78,
          title: en ? "Worn front brake pads" : "Pastillas de freno delanteras desgastadas",
          reason: en ? "Squealing when braking usually appears when very little friction material remains." : "El rechinido al frenar suele aparecer cuando queda muy poco material de fricción.",
          test: en ? "Inspect pad thickness and rotor surface condition." : "Inspeccionar el grosor de las pastillas y la superficie de los rotores.",
          urgency: en ? "Don't delay" : "No lo pospongas",
          tone: "danger",
          guideCategory: "front-brake-pads",
        },
        {
          probability: 54,
          title: en ? "Scored front rotors" : "Rotores delanteros rayados",
          reason: en ? "Metal-to-metal contact can create grooves, noise, and vibration." : "El contacto de metal con metal puede producir surcos, ruido y vibración.",
          test: en ? "Measure rotor thickness and lateral runout." : "Medir el grosor y la desviación lateral de los rotores.",
          urgency: en ? "Inspect today" : "Inspeccionar hoy",
          tone: "warn",
          guideCategory: "front-brake-pads",
        },
        {
          probability: 21,
          title: en ? "Worn wheel bearing" : "Rodamiento de rueda desgastado",
          reason: en ? "A damaged bearing can produce a squeal that changes with vehicle speed." : "Un rodamiento dañado puede producir un rechinido que cambia con la velocidad.",
          test: en ? "Lift the vehicle and check for wheel play and bearing noise." : "Elevar el vehículo y revisar juego y ruido en la rueda.",
          urgency: en ? "Rule out" : "Descartar",
          tone: "neutral",
          guideCategory: "wheel-bearing",
        },
      ],
      estimate: {
        low: 230, high: 540, partsLow: 40, partsHigh: 220,
        laborLow: 174, laborHigh: 261, laborHoursLow: 1.2, laborHoursHigh: 1.8,
        confidence: "Alta",
        repairLabel: en ? "Front brake inspection and possible replacement" : "Inspección y posible reemplazo de frenos delanteros",
      },
      questions: en
        ? ["Do you feel vibration in the pedal?", "Does the noise happen only when braking?"]
        : ["¿Sientes vibración en el pedal?", "¿El ruido ocurre solamente al frenar?"],
    };
  }

  return {
    summary: en
      ? "More information and a physical inspection are needed to narrow down the cause."
      : "Se requiere más información y una inspección física para acotar la causa.",
    safetyLevel: "moderado",
    safetyMessage: en
      ? "Stop driving if you notice smoke, fuel smell, brake failure, overheating, or red warning lights."
      : "Deja de conducir si aparecen humo, olor a combustible, pérdida de frenos, sobrecalentamiento o luces rojas.",
    possibleCauses: [
      {
        probability: 45,
        title: en ? "Failure related to the reported symptom" : "Falla relacionada con el síntoma reportado",
        reason: en ? "The description helps guide the inspection but doesn't yet identify a system with enough certainty." : "La descripción permite orientar la inspección, pero todavía no identifica un sistema con suficiente certeza.",
        test: en ? "Perform OBD-II scan, visual inspection, and a controlled test drive." : "Realizar escaneo OBD-II, inspección visual y prueba de manejo controlada.",
        urgency: en ? "Diagnose" : "Diagnosticar",
        tone: "warn",
      },
    ],
    estimate: {
      low: 120, high: 650, partsLow: 0, partsHigh: 400,
      laborLow: 120, laborHigh: 250, laborHoursLow: 1, laborHoursHigh: 2,
      confidence: "Baja",
      repairLabel: en ? "Initial vehicle diagnosis" : "Diagnóstico inicial del vehículo",
    },
    questions: en
      ? ["When did it start?", "Are there any warning lights or OBD-II codes?"]
      : ["¿Cuándo comenzó?", "¿Hay luces de advertencia o códigos OBD-II?"],
  };
}

export async function diagnoseVehicle(input) {
  const vehicle = input.vehicle || {};
  const language = input.language === "en" ? "en" : "es";
  const langLabel = language === "en" ? "English" : "Spanish";

  const basePrompt = language === "en"
    ? `You are a senior ASE-certified automotive technician assistant for RepairScout. Respond in English.
Your assessment is preliminary and must never be presented as a confirmed diagnosis.
Prioritize safety above all. Clearly indicate when the vehicle should not be driven.
Do not invent technical service bulletins, recalls, exact prices, parts availability, or OEM procedures.
Probabilities are rough estimates and do not need to sum to 100.
Costs must be conservative ranges in US dollars based on general independent repair.
For each possible cause, explain the technical reason WHY the described symptoms point to that cause — be specific about the mechanical or electrical relationship. Include how to confirm or rule it out.
Always provide a realistic best-case and worst-case scenario so the driver knows the cost range they are facing.
Generate 3–4 targeted follow-up questions that, if answered, would significantly narrow down the diagnosis.`
    : `Eres un técnico automotriz senior certificado por ASE asistente para RepairScout. Responde en español.
Tu evaluación es preliminar y nunca debe presentarse como un diagnóstico confirmado.
Prioriza la seguridad por encima de todo. Indica claramente cuándo no se debe conducir.
No inventes boletines técnicos, retiros, precios exactos, disponibilidad de piezas ni procedimientos OEM.
Las probabilidades son estimaciones orientativas y no deben sumar necesariamente 100.
Los costos deben ser rangos prudentes en dólares estadounidenses basados en reparación independiente general.
Para cada posible causa, explica la razón técnica de POR QUÉ los síntomas descritos apuntan a esa causa — sé específico sobre la relación mecánica o eléctrica. Incluye cómo confirmar o descartar la causa.
Siempre proporciona un escenario realista de mejor y peor caso para que el conductor conozca el rango de costos que enfrenta.
Genera 3–4 preguntas de seguimiento específicas que, si se responden, reducirían significativamente el diagnóstico.`;

  const systemPrompt = basePrompt
    + groundedCodesSection(input, language)
    + (await groundedOutcomesSection(input, language).catch(() => ""));

  const userPrompt = JSON.stringify({
    vehicle,
    mileage: input.mileage,
    description: input.description,
    obdCodes: input.obdCodes || [],
    zip: input.zip,
    language: langLabel,
  });

  const handlers = {
    groq: (sp, up) => diagnoseWithGroq(sp, up, language),
    gemini: (sp, up) => diagnoseWithGemini(sp, up, language),
    openrouter: (sp, up) => diagnoseWithOpenRouter(sp, up, language),
    ollama: (sp, up) => diagnoseWithOllama(sp, up, language),
    "ai-gateway": diagnoseWithGateway,
    openai: diagnoseWithOpenAI,
  };

  for (const provider of orderedProviders(input)) {
    try {
      const output = await handlers[provider](systemPrompt, userPrompt);
      return { ...output, source: provider };
    } catch (error) {
      console.error(`${PROVIDER_LABELS[provider]} diagnosis failed:`, error?.message || "Unknown error");
    }
  }

  return { ...fallbackDiagnosis(input.description, language), source: "fallback" };
}
