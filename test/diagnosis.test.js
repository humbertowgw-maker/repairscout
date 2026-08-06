// Tests for the multi-provider AI diagnosis fallback chain in server/diagnosis.js.
//
// The module tries providers in a configurable order (default:
// groq,gemini,openrouter,ai-gateway,openai), coercing every response through
// one Zod schema, and falls back to rule-based diagnosis when nothing is
// configured or every provider fails. These tests mock all network/SDK calls
// (fetch for Groq/Gemini/OpenRouter, the `ai` package for the Vercel AI
// Gateway, and the `openai` SDK) so nothing here ever calls a real provider.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const openaiParseMock = vi.hoisted(() => vi.fn());
const generateTextMock = vi.hoisted(() => vi.fn());

vi.mock("openai", () => ({
  // `openai` is imported and instantiated with `new OpenAI(...)`, so the
  // mock default export must itself be a constructor, not an arrow function.
  default: class MockOpenAI {
    constructor() {
      this.responses = { parse: openaiParseMock };
    }
  },
}));

vi.mock("ai", () => ({
  generateText: generateTextMock,
  Output: { object: vi.fn((config) => config) },
}));

const { diagnoseVehicle, getDiagnosisProviderStatus } = await import("../server/diagnosis.js");

const ALL_PROVIDER_ENV_KEYS = [
  "GROQ_API_KEY",
  "GEMINI_API_KEY",
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "OPENROUTER_API_KEY",
  "AI_GATEWAY_API_KEY",
  "VERCEL_OIDC_TOKEN",
  "VERCEL",
  "OPENAI_API_KEY",
  "AI_PROVIDER_ORDER",
];

function fullyValidDiagnosis(overrides = {}) {
  return {
    summary: "Test summary",
    safetyLevel: "moderado",
    safetyMessage: "Test safety message",
    possibleCauses: [
      {
        probability: 50,
        title: "Test cause",
        reason: "Test reason",
        test: "Test test",
        urgency: "Test urgency",
        tone: "neutral",
      },
    ],
    estimate: {
      low: 100,
      high: 200,
      partsLow: 50,
      partsHigh: 100,
      laborLow: 50,
      laborHigh: 100,
      laborHoursLow: 1,
      laborHoursHigh: 2,
      confidence: "Media",
      repairLabel: "Test repair label",
    },
    questions: ["Test question?"],
    ...overrides,
  };
}

function chatCompletionResponse(body) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content: JSON.stringify(body) } }] }),
  };
}

function geminiResponse(body) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(body) } ] } }] }),
  };
}

// Every test forces a clean slate for every env var that affects provider
// configuration/order, so ambient developer env (e.g. a real GROQ_API_KEY
// exported in the shell) can never leak into a test's expectations.
beforeEach(() => {
  for (const key of ALL_PROVIDER_ENV_KEYS) {
    vi.stubEnv(key, "");
  }
  // openaiParseMock/generateTextMock are module-level (vi.hoisted) so they
  // survive across tests; reset explicitly rather than relying on global
  // mock-restoring config to clear their call history and queued values.
  openaiParseMock.mockReset();
  generateTextMock.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("diagnoseVehicle — no providers configured", () => {
  it("skips every network/SDK call and returns the rule-based fallback", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await diagnoseVehicle({
      vehicle: { make: "Honda", model: "Civic", year: "2015" },
      description: "no enciende, la batería suena baja",
      mileage: "80000",
      zip: "90210",
      language: "es",
    });

    expect(result.source).toBe("fallback");
    expect(result.safetyLevel).toBe("moderado");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(generateTextMock).not.toHaveBeenCalled();
    expect(openaiParseMock).not.toHaveBeenCalled();
  });

  it("reports no configured providers via getDiagnosisProviderStatus", () => {
    const status = getDiagnosisProviderStatus();
    expect(status.configured).toEqual([]);
    expect(status.preferredOrder).toEqual([]);
  });
});

describe("diagnoseVehicle — fallback chain ordering", () => {
  it("tries providers in the documented default order and stops at the first success", async () => {
    // All five providers configured; a neutral description (no brake/OBD
    // keywords) keeps the domain-based "preferred provider" at its default
    // (groq), so the documented order groq,gemini,openrouter,ai-gateway,openai
    // applies unmodified.
    vi.stubEnv("GROQ_API_KEY", "groq-key");
    vi.stubEnv("GEMINI_API_KEY", "gemini-key");
    vi.stubEnv("OPENROUTER_API_KEY", "openrouter-key");
    vi.stubEnv("AI_GATEWAY_API_KEY", "gateway-key");
    vi.stubEnv("OPENAI_API_KEY", "openai-key");

    const calledUrls = [];
    const fetchMock = vi.fn(async (url) => {
      calledUrls.push(url);
      throw new Error(`simulated network failure for ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    generateTextMock.mockRejectedValueOnce(new Error("gateway unavailable"));
    openaiParseMock.mockResolvedValueOnce({ output_parsed: fullyValidDiagnosis({ summary: "from openai" }) });

    const result = await diagnoseVehicle({
      vehicle: { make: "Toyota", model: "Corolla", year: "2018" },
      description: "makes a strange noise sometimes, not sure why",
      mileage: "50000",
      zip: "10001",
      language: "en",
    });

    expect(calledUrls).toEqual([
      "https://api.groq.com/openai/v1/chat/completions",
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      "https://openrouter.ai/api/v1/chat/completions",
    ]);
    expect(generateTextMock).toHaveBeenCalledTimes(1);
    expect(openaiParseMock).toHaveBeenCalledTimes(1);
    expect(result.source).toBe("openai");
    expect(result.summary).toBe("from openai");
  });

  it("falls through a failing higher-priority provider to the next configured one", async () => {
    vi.stubEnv("AI_PROVIDER_ORDER", "groq,openai");
    vi.stubEnv("GROQ_API_KEY", "groq-key");
    vi.stubEnv("OPENAI_API_KEY", "openai-key");

    const fetchMock = vi.fn(async () => {
      throw new Error("groq is down");
    });
    vi.stubGlobal("fetch", fetchMock);
    openaiParseMock.mockResolvedValueOnce({ output_parsed: fullyValidDiagnosis({ summary: "openai saved it" }) });

    const result = await diagnoseVehicle({
      vehicle: {},
      description: "engine sputters at highway speed",
      mileage: "30000",
      zip: "94105",
      language: "en",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(openaiParseMock).toHaveBeenCalledTimes(1);
    expect(result.source).toBe("openai");
    expect(result.summary).toBe("openai saved it");
  });

  it("falls back to rule-based diagnosis when every configured provider fails", async () => {
    vi.stubEnv("AI_PROVIDER_ORDER", "groq,openai");
    vi.stubEnv("GROQ_API_KEY", "groq-key");
    vi.stubEnv("OPENAI_API_KEY", "openai-key");

    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("groq is down");
    }));
    openaiParseMock.mockRejectedValueOnce(new Error("openai is down"));

    const result = await diagnoseVehicle({
      vehicle: {},
      description: "brakes squeal when stopping",
      mileage: "60000",
      zip: "73301",
      language: "en",
    });

    expect(result.source).toBe("fallback");
    // Rule-based fallback still recognizes brake-related symptoms.
    expect(result.safetyLevel).toBe("alto");
  });

  it("prioritizes a domain-matched provider ahead of the default order when both are configured", async () => {
    // "brake" symptoms route to Gemini per preferredProvider(); with both
    // groq and gemini configured, gemini should be tried first even though
    // groq leads the documented default order.
    vi.stubEnv("GROQ_API_KEY", "groq-key");
    vi.stubEnv("GEMINI_API_KEY", "gemini-key");

    const calledUrls = [];
    const fetchMock = vi.fn(async (url) => {
      calledUrls.push(url);
      return geminiResponse(fullyValidDiagnosis({ summary: "from gemini" }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await diagnoseVehicle({
      vehicle: {},
      description: "brakes are grinding badly",
      mileage: "45000",
      zip: "60601",
      language: "en",
    });

    expect(calledUrls).toEqual([
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    ]);
    expect(result.source).toBe("gemini");
    expect(result.summary).toBe("from gemini");
  });
});

describe("diagnoseVehicle — response coercion through the shared schema", () => {
  it("normalizes a sparse/malformed provider response into the full DiagnosisSchema shape", async () => {
    vi.stubEnv("GROQ_API_KEY", "groq-key");

    vi.stubGlobal("fetch", vi.fn(async () => chatCompletionResponse({
      // Deliberately missing/invalid fields the extractJson() normalizer
      // must repair: no possibleCauses, bogus safetyLevel, no estimate.
      summary: "Sparse response",
      safetyLevel: "not-a-real-level",
    })));

    const result = await diagnoseVehicle({
      vehicle: {},
      description: "weird rattle",
      mileage: "10000",
      zip: "12345",
      language: "en",
    });

    expect(result.source).toBe("groq");
    expect(result.safetyLevel).toBe("moderado"); // invalid level coerced to default
    expect(result.possibleCauses.length).toBeGreaterThan(0); // backfilled
    expect(result.estimate).toMatchObject({ low: 0, high: 0 });
  });
});
