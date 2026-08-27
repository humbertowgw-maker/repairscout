// Tests for the multi-provider AI diagnosis fallback chain in server/diagnosis.js.
//
// The module tries providers in a configurable order (default:
// groq,gemini,openrouter,ollama,ai-gateway,openai), coercing every response
// through one Zod schema, and falls back to rule-based diagnosis when
// nothing is configured or every provider fails. These tests mock all
// network/SDK calls (fetch for Groq/Gemini/OpenRouter/Ollama, the `ai`
// package for the Vercel AI Gateway, and the `openai` SDK) so nothing here
// ever calls a real provider.
//
// Ollama is opt-out, not opt-in (no API key needed — it's our own hardware),
// so unlike every other provider it stays "configured" even with a fully
// cleared env. Tests that specifically need zero configured providers stub
// OLLAMA_DIAGNOSIS_ENABLED=false explicitly.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const openaiParseMock = vi.hoisted(() => vi.fn());
const generateTextMock = vi.hoisted(() => vi.fn());
const findConfirmedOutcomesMock = vi.hoisted(() => vi.fn());

// database.js pulls in `pg`, which has no place in a unit test for prompt-building
// logic — mocked the same way openai/ai are, so groundedOutcomesSection's DB dependency
// never touches a real database or the local JSON-file fallback store.
vi.mock("../server/database.js", () => ({
  findConfirmedOutcomes: findConfirmedOutcomesMock,
}));

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
  // Pure passthrough is enough here: Output.object is already mocked to just forward its
  // config, so the schema is never actually consumed/validated in this test.
  jsonSchema: vi.fn((schema) => schema),
}));

const { diagnoseVehicle, getDiagnosisProviderStatus, groundedCodesSection, groundedOutcomesSection } = await import("../server/diagnosis.js");

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
  "OLLAMA_DIAGNOSIS_ENABLED",
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
  // Default to "no confirmed outcomes yet" — matches the real cold-start state and
  // means existing tests that don't care about outcomes grounding aren't affected.
  findConfirmedOutcomesMock.mockReset().mockResolvedValue([]);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("diagnoseVehicle — no providers configured", () => {
  it("skips every network/SDK call and returns the rule-based fallback", async () => {
    vi.stubEnv("OLLAMA_DIAGNOSIS_ENABLED", "false");
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
    vi.stubEnv("OLLAMA_DIAGNOSIS_ENABLED", "false");
    const status = getDiagnosisProviderStatus();
    expect(status.configured).toEqual([]);
    expect(status.preferredOrder).toEqual([]);
  });
});

describe("Ollama production isolation", () => {
  it("does not expose the private Ollama fleet from Vercel unless explicitly enabled", () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("OLLAMA_DIAGNOSIS_ENABLED", "");
    expect(getDiagnosisProviderStatus().configured).not.toContain("ollama");
  });

  it("allows the authenticated local worker to opt in explicitly", () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("OLLAMA_DIAGNOSIS_ENABLED", "true");
    expect(getDiagnosisProviderStatus().configured).toContain("ollama");
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
      "http://100.72.213.92:11435/v1/chat/completions",
    ]);
    expect(generateTextMock).toHaveBeenCalledTimes(1);
    // ai SDK v7 regression check: v6 used `system`, v7 renamed it to
    // `instructions` — a silently-wrong key here would mean the gateway
    // model gets no system prompt at all, not a loud failure.
    const gatewayCallArgs = generateTextMock.mock.calls[0][0];
    expect(gatewayCallArgs).toHaveProperty("instructions");
    expect(gatewayCallArgs).not.toHaveProperty("system");
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

describe("groundedCodesSection", () => {
  it("returns an empty string when no codes are present anywhere", () => {
    expect(groundedCodesSection({ description: "makes a strange noise", obdCodes: [] }, "en")).toBe("");
  });

  it("includes the verified definition for a known code from the structured field", () => {
    const section = groundedCodesSection({ description: "check engine light", obdCodes: ["P0420"] }, "en");
    expect(section).toContain("P0420");
    expect(section).toContain("Catalyst System Efficiency Below Threshold");
  });

  it("also picks up a code typed directly into the free-text description", () => {
    const section = groundedCodesSection({ description: "scanner showed P0301, misfiring", obdCodes: [] }, "en");
    expect(section).toContain("P0301");
    expect(section).toContain("Cylinder 1 Misfire Detected");
  });

  it("flags unrecognized codes explicitly instead of staying silent about them", () => {
    const section = groundedCodesSection({ description: "code P1234 appeared", obdCodes: [] }, "en");
    expect(section).toContain("P1234");
    expect(section.toLowerCase()).toContain("manufacturer-specific");
  });

  it("writes the unknown-code note in Spanish when language is es", () => {
    const section = groundedCodesSection({ description: "salió el código P1234", obdCodes: [] }, "es");
    expect(section).toContain("específicos del fabricante");
  });
});

describe("groundedOutcomesSection", () => {
  it("returns empty string without a DB call when vehicle make/model are missing", async () => {
    const section = await groundedOutcomesSection({ description: "brake noise", vehicle: {} }, "en");
    expect(section).toBe("");
    expect(findConfirmedOutcomesMock).not.toHaveBeenCalled();
  });

  it("returns empty string when no confirmed outcomes are found", async () => {
    findConfirmedOutcomesMock.mockResolvedValue([]);
    const section = await groundedOutcomesSection(
      { description: "brake noise", vehicle: { make: "Honda", model: "Accord" } }, "en",
    );
    expect(section).toBe("");
  });

  it("formats confirmed outcomes into the prompt with vehicle, cause, and fix", async () => {
    findConfirmedOutcomesMock.mockResolvedValue([
      { vehicle: { year: "2018", make: "Honda", model: "Accord" }, causeTitle: "Worn front brake pads", fixDescription: "Replaced front brake pads", notes: "Squealing stopped immediately" },
    ]);
    const section = await groundedOutcomesSection(
      { description: "squealing when braking", vehicle: { make: "Honda", model: "Accord" } }, "en",
    );
    expect(section).toContain("2018 Honda Accord");
    expect(section).toContain("Worn front brake pads");
    expect(section).toContain("Replaced front brake pads");
    expect(section).toContain("Squealing stopped immediately");
  });

  it("passes the description's OBD codes and regex-derived keywords through to the lookup", async () => {
    findConfirmedOutcomesMock.mockResolvedValue([]);
    await groundedOutcomesSection(
      { description: "brake squeal", obdCodes: ["P0420"], vehicle: { make: "Toyota", model: "Camry" } }, "en",
    );
    expect(findConfirmedOutcomesMock).toHaveBeenCalledWith(expect.objectContaining({
      make: "Toyota", model: "Camry", obdCodes: ["P0420"], symptomKeywords: expect.arrayContaining(["brake"]),
    }));
  });

  it("writes the Spanish intro line when language is es", async () => {
    findConfirmedOutcomesMock.mockResolvedValue([
      { vehicle: { make: "Honda", model: "Accord" }, causeTitle: "Pastillas desgastadas", fixDescription: "Reemplazo de pastillas" },
    ]);
    const section = await groundedOutcomesSection(
      { description: "frenos", vehicle: { make: "Honda", model: "Accord" } }, "es",
    );
    expect(section).toContain("Reparaciones confirmadas");
  });

  it("propagates a DB failure to the caller rather than swallowing it silently — the call site in diagnoseVehicle is what's responsible for degrading gracefully", async () => {
    findConfirmedOutcomesMock.mockRejectedValue(new Error("connection refused"));
    await expect(
      groundedOutcomesSection({ description: "brake noise", vehicle: { make: "Honda", model: "Accord" } }, "en"),
    ).rejects.toThrow("connection refused");
  });
});

describe("diagnoseVehicle — outcomes grounding integration", () => {
  it("degrades silently when the outcomes lookup fails, and the diagnosis still succeeds", async () => {
    vi.stubEnv("GROQ_API_KEY", "groq-key");
    findConfirmedOutcomesMock.mockRejectedValue(new Error("connection refused"));
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true, status: 200,
      json: async () => ({ choices: [{ message: { content: JSON.stringify(fullyValidDiagnosis({ summary: "still works" })) } }] }),
    })));

    const result = await diagnoseVehicle({
      vehicle: { make: "Honda", model: "Accord", year: "2018" },
      description: "brake noise",
      mileage: "50000",
      zip: "10001",
      language: "en",
    });

    expect(result.source).toBe("groq");
    expect(result.summary).toBe("still works");
  });
});
