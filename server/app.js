import "dotenv/config";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { z } from "zod";
import { authConfigured, createToken, hashPassword, optionalAuth, requireAuth, verifyPassword } from "./auth.js";
import {
  adminMigrate,
  workOrderMigrate,
  approveQuoteByToken,
  completePartsInquiry,
  createItemizedQuote,
  createPartsInquiries,
  createPendingDiagnosis,
  createQuoteRequest,
  createUser,
  createVehicle,
  databaseMode,
  findUserByEmail,
  getAdminStats,
  getPortfolioMetrics,
  getItemizedQuoteByToken,
  getItemizedQuoteById,
  getPartsInquiryBatch,
  getPartsInquiryById,
  getPendingDiagnosis,
  getPhoneVerification,
  getShopProfile,
  listAllUsers,
  listPlans,
  listQuoteRequests,
  listSentQuotes,
  listVehicles,
  markPhoneUsedFree,
  markPhoneVerified,
  saveDiagnosis,
  setUserRole,
  updatePlan,
  setTrackingInfo,
  setInvoiceSent,
  setPendingDiagnosisPaid,
  setPendingDiagnosisResult,
  updateBlandCallId,
  updateQuoteRequestStatus,
  updateRepairStage,
  upsertPhoneVerification,
  upsertShopProfile,
} from "./database.js";
import { diagnoseVehicle, getDiagnosisProviderStatus } from "./diagnosis.js";
import { buildQuoteFromDiagnosis } from "./parts.js";
import { sendQuoteNotification, sendShopApprovalNotification, sendInvoiceNotification, sendStageUpdateNotification } from "./notify.js";
import { searchRepairShops } from "./shops.js";
import { generateOtp, normalizePhone, OTP_TTL_MS, sendOtpSms } from "./otp.js";
import { constructWebhookEvent, createDiagnosisCheckout } from "./stripe.js";
import { blandConfigured, parseBlandWebhook, simulatedCallResult, startPartInquiryCall } from "./bland.js";

const app = express();
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(currentDir, "..");

app.disable("x-powered-by");
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", "https://vpic.nhtsa.dot.gov"],
      imgSrc: ["'self'", "data:", "blob:"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));

app.use(cors({
  origin: process.env.APP_URL || "http://localhost:4311",
  credentials: true,
}));
// Capture raw body for Stripe webhook signature verification
app.use(express.json({
  limit: "1mb",
  verify: (req, _res, buf) => { req.rawBody = buf; },
}));

app.set("trust proxy", 1);
app.use((_request, response, next) => {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});

const limiter = (windowMs, max) => rateLimit({
  windowMs,
  limit: max,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Demasiadas solicitudes. Intenta de nuevo en unos minutos." },
});

app.use("/api", limiter(15 * 60 * 1000, 240));
app.use("/api/auth", limiter(15 * 60 * 1000, 25));
app.use("/api/diagnose", limiter(15 * 60 * 1000, 30));
app.use("/api/quote-requests", limiter(15 * 60 * 1000, 60));
app.use("/api/shop-profile", limiter(15 * 60 * 1000, 60));
app.use(optionalAuth);

app.get("/api/health", rateLimit({ windowMs: 60 * 1000, limit: 60 }), (_request, response) => {
  const aiProviders = getDiagnosisProviderStatus();
  response.json({
    ok: true,
    aiConfigured: aiProviders.configured.length > 0,
    aiProviders,
    database: databaseMode(),
    authConfigured: authConfigured(),
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/portfolio-metrics", async (_request, response) => {
  try {
    const metrics = await getPortfolioMetrics();
    response.set("Cache-Control", "public, max-age=0, s-maxage=300, stale-while-revalidate=600");
    response.json({
      metric: "verified_quote_requests_weekly",
      windowDays: 7,
      verifiedQuoteRequestsWeekly: Number(metrics.verified_quote_requests_weekly || 0),
      quoteRequestsTotal: Number(metrics.quote_requests_total || 0),
      progressedQuoteRequestsWeekly: Number(metrics.progressed_quote_requests_weekly || 0),
      latestQuoteRequestAt: metrics.latest_quote_request_at || null,
      observedAt: new Date().toISOString(),
      privacy: "aggregate_only",
    });
  } catch {
    response.status(500).json({ error: "Unable to read portfolio metrics" });
  }
});

const authInput = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(128),
  role: z.enum(["driver", "shop"]).optional(),
  shopName: z.string().trim().min(2).max(120).optional(),
});

app.post("/api/auth/register", rateLimit({ windowMs: 15 * 60 * 1000, limit: 10 }), async (request, response) => {
  const parsed = authInput.safeParse(request.body);
  if (!parsed.success || !parsed.data.name || !parsed.data.role) {
    return response.status(400).json({ error: "Completa el nombre, correo, contraseÃ±a y tipo de cuenta." });
  }
  if (parsed.data.role === "shop" && !parsed.data.shopName) {
    return response.status(400).json({ error: "Ingresa el nombre del taller." });
  }
  if (await findUserByEmail(parsed.data.email)) {
    return response.status(409).json({ error: "Ya existe una cuenta con ese correo." });
  }

  const user = await createUser({
    id: crypto.randomUUID(),
    name: parsed.data.name,
    email: parsed.data.email,
    passwordHash: await hashPassword(parsed.data.password),
    role: parsed.data.role,
    shopName: parsed.data.role === "shop" ? parsed.data.shopName : null,
    createdAt: new Date().toISOString(),
  });

  response.status(201).json({ user, token: createToken(user) });
});

app.post("/api/auth/login", rateLimit({ windowMs: 15 * 60 * 1000, limit: 10 }), async (request, response) => {
  const parsed = authInput.pick({ email: true, password: true }).safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ error: "Ingresa un correo y una contraseÃ±a vÃ¡lidos." });
  }
  const storedUser = await findUserByEmail(parsed.data.email);
  const passwordHash = storedUser?.password_hash || storedUser?.passwordHash;
  if (!storedUser || !(await verifyPassword(parsed.data.password, passwordHash))) {
    return response.status(401).json({ error: "El correo o la contraseÃ±a no son correctos." });
  }
  const user = {
    id: storedUser.id,
    name: storedUser.name,
    email: storedUser.email,
    role: storedUser.role,
    shopName: storedUser.shop_name || storedUser.shopName,
    createdAt: storedUser.created_at || storedUser.createdAt,
  };
  response.json({ user, token: createToken(user) });
});

app.get("/api/auth/me", requireAuth, (request, response) => {
  response.json({ user: request.user });
});

app.get("/api/vehicle/decode", async (request, response) => {
  const vin = String(request.query.vin || "").trim().toUpperCase();
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) {
    return response.status(400).json({ error: "Ingresa un VIN vÃ¡lido de 17 caracteres." });
  }
  try {
    const nhtsaResponse = await fetch(
      `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/${encodeURIComponent(vin)}?format=json`,
    );
    if (!nhtsaResponse.ok) throw new Error("NHTSA request failed");
    const payload = await nhtsaResponse.json();
    const result = payload.Results?.[0];
    if (!result || (!result.Make && !result.Model)) {
      return response.status(404).json({ error: "No encontramos informaciÃ³n para ese VIN." });
    }
    return response.json({
      vin,
      year: result.ModelYear,
      make: result.Make,
      model: result.Model,
      trim: result.Trim || result.Series,
      engine: result.DisplacementL ? `${Number(result.DisplacementL).toFixed(1)}L` : result.EngineModel,
      fuelType: result.FuelTypePrimary,
      bodyClass: result.BodyClass,
      driveType: result.DriveType,
    });
  } catch {
    return response.status(502).json({ error: "El servicio de VIN no estÃ¡ disponible en este momento." });
  }
});

const vehicleInput = z.object({
  vin: z.string().max(17).optional(),
  year: z.string().max(4),
  make: z.string().min(1).max(80),
  model: z.string().min(1).max(80),
  trim: z.string().max(80).optional(),
  engine: z.string().max(80).optional(),
  mileage: z.string().max(30).optional(),
});

app.get("/api/vehicles", requireAuth, async (request, response) => {
  response.json({ vehicles: await listVehicles(request.user.id) });
});

app.post("/api/vehicles", requireAuth, async (request, response) => {
  const parsed = vehicleInput.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: "Los datos del vehÃ­culo estÃ¡n incompletos." });
  const vehicle = await createVehicle({
    id: crypto.randomUUID(),
    userId: request.user.id,
    ...parsed.data,
    createdAt: new Date().toISOString(),
  });
  response.status(201).json({ vehicle });
});

const diagnosisInput = z.object({
  vehicle: z.record(z.string(), z.any()).optional(),
  mileage: z.string().max(30).optional(),
  description: z.string().min(8).max(2000),
  obdCodes: z.array(z.string()).max(10).optional(),
  zip: z.string().min(5).max(10),
  language: z.string().max(5).optional(),
});

app.post("/api/diagnose", async (request, response) => {
  const parsed = diagnosisInput.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: "Faltan datos para crear la evaluaciÃ³n." });
  try {
    const result = await diagnoseVehicle(parsed.data);
    await saveDiagnosis({
      id: crypto.randomUUID(),
      userId: request.user?.id || null,
      vehicle: parsed.data.vehicle || {},
      description: parsed.data.description,
      zip: parsed.data.zip,
      result,
      createdAt: new Date().toISOString(),
    });
    return response.json(result);
  } catch (error) {
    console.error("Diagnosis failed:", error);
    return response.status(502).json({ error: "No pudimos generar la evaluaciÃ³n en este momento." });
  }
});

app.get("/api/shops/search", async (request, response) => {
  const zip = String(request.query.zip || "").trim();
  const radius = Number(request.query.radius || 25);
  if (!/^\d{5}(-\d{4})?$/.test(zip)) {
    return response.status(400).json({ error: "Ingresa un cÃ³digo postal vÃ¡lido." });
  }
  response.json(await searchRepairShops(zip, radius));
});

const shopProfileInput = z.object({
  shopName: z.string().trim().min(2).max(120),
  contactName: z.string().trim().max(120).optional().default(""),
  phone: z.string().trim().max(40).optional().default(""),
  email: z.string().trim().email().optional().or(z.literal("")).default(""),
  address: z.string().trim().max(180).optional().default(""),
  city: z.string().trim().max(80).optional().default(""),
  state: z.string().trim().max(30).optional().default(""),
  zip: z.string().trim().max(10).optional().default(""),
  specialties: z.array(z.string().trim().min(1).max(60)).max(8).optional().default([]),
  laborRate: z.string().trim().max(20).optional().default(""),
  warranty: z.string().trim().max(180).optional().default(""),
  availability: z.string().trim().max(120).optional().default(""),
});

app.get("/api/shop-profile", requireAuth, async (request, response) => {
  if (request.user.role !== "shop") {
    return response.status(403).json({ error: "Esta vista es solo para talleres." });
  }

  const profile = await getShopProfile(request.user.id);
  response.json({
    profile: profile || {
      shopName: request.user.shopName || "",
      contactName: request.user.name || "",
      email: request.user.email || "",
      specialties: [],
      laborRate: "",
      warranty: "",
      availability: "",
      claimed: false,
    },
  });
});

app.put("/api/shop-profile", requireAuth, async (request, response) => {
  if (request.user.role !== "shop") {
    return response.status(403).json({ error: "Solo una cuenta de taller puede configurar un perfil." });
  }

  const parsed = shopProfileInput.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ error: "Completa el nombre del taller y revisa los datos del perfil." });
  }

  const now = new Date().toISOString();
  const profile = await upsertShopProfile({
    id: crypto.randomUUID(),
    userId: request.user.id,
    ...parsed.data,
    claimed: true,
    createdAt: now,
    updatedAt: now,
  });

  response.json({ profile });
});

const quoteInput = z.object({
  shopName: z.string().min(2).max(120),
  customer: z.string().min(2).max(120).default("Cliente de RepairScout"),
  vehicle: z.string().min(2).max(160),
  issue: z.string().min(8).max(2000),
  zip: z.string().min(5).max(10),
  estimate: z.string().max(80),
  diagnosisSummary: z.string().max(1000).optional(),
});

app.get("/api/quote-requests", requireAuth, async (request, response) => {
  const shopName = request.user.role === "shop" ? request.user.shopName : undefined;
  response.json({ quoteRequests: await listQuoteRequests(shopName) });
});

app.post("/api/quote-requests", async (request, response) => {
  const parsed = quoteInput.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: "La solicitud de cotizaciÃ³n estÃ¡ incompleta." });
  const customer = request.user?.name || parsed.data.customer;
  const quoteRequest = {
    id: crypto.randomUUID(),
    userId: request.user?.id || null,
    ...parsed.data,
    customer,
    status: "Solicitud nueva",
    createdAt: new Date().toISOString(),
    initials: customer.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join(""),
  };
  await createQuoteRequest(quoteRequest);
  response.status(201).json({ quoteRequest });
});

const quoteStatusInput = z.object({
  status: z.enum(["Solicitud nueva", "Requiere revisiÃ³n", "En revisiÃ³n", "Cotizada", "Declinada", "Cita solicitada"]),
});

app.patch("/api/quote-requests/:id/status", requireAuth, async (request, response) => {
  if (request.user.role !== "shop") {
    return response.status(403).json({ error: "Solo el taller puede actualizar esta solicitud." });
  }

  const parsed = quoteStatusInput.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ error: "Selecciona un estado vÃ¡lido." });
  }

  const updated = await updateQuoteRequestStatus({
    id: request.params.id,
    shopName: request.user.shopName,
    status: parsed.data.status,
  });

  if (!updated) {
    return response.status(404).json({ error: "No encontramos esa solicitud para tu taller." });
  }

  response.json({ quoteRequest: updated });
});

// â”€â”€ Itemized quotes: list (shop) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

app.get("/api/quotes/sent", requireAuth, async (request, response) => {
  const quotes = await listSentQuotes(request.user.id).catch(() => []);
  response.json({ quotes });
});

// â”€â”€ Itemized quotes: build â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const quoteBuildInput = z.object({
  diagnosis: z.record(z.string(), z.any()),
  vehicle: z.record(z.string(), z.any()).optional(),
  language: z.string().max(5).optional(),
});

app.post("/api/quotes/build", async (request, response) => {
  const parsed = quoteBuildInput.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: "Faltan datos de diagnÃ³stico." });
  try {
    const result = await buildQuoteFromDiagnosis({
      diagnosis: parsed.data.diagnosis,
      vehicle: parsed.data.vehicle || {},
      language: parsed.data.language || "es",
    });
    return response.json(result);
  } catch (e) {
    console.error("Quote build error:", e);
    return response.status(502).json({ error: "No se pudo generar la cotizaciÃ³n." });
  }
});

// â”€â”€ Itemized quotes: send â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const quoteSendInput = z.object({
  diagnosis: z.record(z.string(), z.any()),
  vehicle: z.record(z.string(), z.any()).optional(),
  quoteCombo: z.record(z.string(), z.any()).optional(),
  quoteSingle: z.record(z.string(), z.any()).optional(),
  customer: z.object({
    name: z.string().min(1).max(120),
    email: z.string().email().optional().or(z.literal("")),
    phone: z.string().max(30).optional().or(z.literal("")),
  }),
  quoteRequestId: z.string().uuid().optional(),
  language: z.string().max(5).optional(),
});

app.post("/api/quotes/send", requireAuth, async (request, response) => {
  const parsed = quoteSendInput.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ error: "Faltan datos para enviar la cotizaciÃ³n." });
  }
  if (!parsed.data.customer.email && !parsed.data.customer.phone) {
    return response.status(400).json({ error: "Proporciona un correo o telÃ©fono del cliente." });
  }
  const { diagnosis, vehicle, quoteCombo, quoteSingle, customer, quoteRequestId, language } = parsed.data;

  // Build the quote if not provided
  let combo = quoteCombo;
  let single = quoteSingle;
  if (!combo || !single) {
    const built = await buildQuoteFromDiagnosis({ diagnosis, vehicle: vehicle || {}, language: language || "es" });
    combo = built.quotes.combo;
    single = built.quotes.single;
  }

  const id = crypto.randomUUID();
  const token = crypto.randomBytes(20).toString("hex");
  const now = new Date().toISOString();

  const quote = await createItemizedQuote({
    id,
    token,
    quoteRequestId: quoteRequestId || null,
    userId: request.user?.id || null,
    customerName: customer.name,
    customerEmail: customer.email || null,
    customerPhone: customer.phone || null,
    vehicle: vehicle || {},
    diagnosis,
    quoteCombo: combo,
    quoteSingle: single,
    repairStage: "Quote Sent",
    sentAt: now,
    createdAt: now,
  });

  const notifyResult = await sendQuoteNotification({
    quote: { combo, single },
    customer,
    quoteId: id,
    token,
    language: language || "es",
  }).catch((e) => ({ error: e.message }));

  return response.status(201).json({
    quoteId: id,
    token,
    trackUrl: `${process.env.APP_URL || "http://localhost:4311"}/track/${token}`,
    notifyResult,
  });
});

// â”€â”€ Itemized quotes: track (cust…4306 tokens truncated…    const session = event.data.object;
    const { pendingId, phone } = session.metadata || {};
    if (pendingId) {
      await setPendingDiagnosisPaid(pendingId, session.id).catch(console.error);
      const pending = await getPendingDiagnosis(pendingId).catch(() => null);
      if (pending && !pending.result) {
        try {
          const result = await diagnoseVehicle({
            vehicle: pending.vehicle || {},
            mileage: pending.mileage,
            description: pending.description,
            zip: pending.zip,
            language: pending.language || "es",
          });
          await setPendingDiagnosisResult(pendingId, result);
          await saveDiagnosis({ id: crypto.randomUUID(), userId: null, vehicle: pending.vehicle || {}, description: pending.description, zip: pending.zip, result, createdAt: new Date().toISOString() });
        } catch (e) {
          console.error("[stripe/webhook] diagnosis error:", e.message);
        }
      }
    }
  }

  response.json({ received: true });
});

// â”€â”€ Pending diagnosis result (poll after Stripe) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

app.get("/api/diagnose/result/:id", async (request, response) => {
  const id = request.params.id?.trim();
  if (!id) return response.status(400).json({ error: "ID invÃ¡lido." });
  const pending = await getPendingDiagnosis(id).catch(() => null);
  if (!pending) return response.status(404).json({ error: "No encontramos ese diagnÃ³stico." });
  if (!pending.paid) return response.status(402).json({ error: "Pago pendiente.", pending: true });
  if (!pending.result) return response.json({ ready: false, paid: true });
  return response.json({ ready: true, paid: true, result: pending.result, vehicle: pending.vehicle });
});

// â”€â”€ Parts search (AI-generated local + online results) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function buildSearchUrl(store, partNumber, query) {
  const q = encodeURIComponent(query);
  const pn = encodeURIComponent(partNumber || query);
  switch (store) {
    case "eBay Motors":      return `https://www.ebay.com/sch/i.html?_nkw=${q}&_sacat=6030`;
    case "Amazon":           return `https://www.amazon.com/s?k=${q}&i=automotive`;
    case "RockAuto":         return `https://www.rockauto.com/en/partsearch/?query=${q}`;
    case "CarParts.com":     return `https://www.carparts.com/search?q=${q}`;
    case "PartsGeek":        return `https://www.partsgeek.com/search?q=${q}`;
    default:                 return `https://www.google.com/search?q=${q}+auto+parts`;
  }
}

async function callAI(systemPrompt, userPrompt) {
  const providerOrder = (process.env.AI_PROVIDER_ORDER || "groq,gemini,openrouter").split(",").map(s => s.trim());
  for (const provider of providerOrder) {
    try {
      if (provider === "groq" && process.env.GROQ_API_KEY) {
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: process.env.GROQ_MODEL || "llama-3.1-8b-instant",
            messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
            temperature: 0.3, max_tokens: 1200, response_format: { type: "json_object" },
          }),
        });
        const data = await res.json();
        const raw = data?.choices?.[0]?.message?.content;
        if (raw) return raw;
      } else if (provider === "gemini" && (process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY)) {
        const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
        const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 1200, responseMimeType: "application/json" },
          }),
        });
        const data = await res.json();
        const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (raw) return raw;
      } else if (provider === "openrouter" && process.env.OPENROUTER_API_KEY) {
        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: process.env.OPENROUTER_MODEL || "openrouter/free",
            messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
            temperature: 0.3, max_tokens: 1200,
          }),
        });
        const data = await res.json();
        const raw = data?.choices?.[0]?.message?.content;
        if (raw) return raw;
      }
    } catch { continue; }
  }
  return null;
}

app.post("/api/parts/search", limiter(60 * 1000, 20), async (request, response) => {
  const { query, lang, zip, state, gasPrice, mpg } = request.body || {};
  if (!query || typeof query !== "string" || query.trim().length < 2) {
    return response.status(400).json({ error: "Query required." });
  }

  const isEs = lang === "es";
  const q = query.trim();
  const location = [zip, state].filter(Boolean).join(", ") || "the local area";
  const gasPriceNum = parseFloat(gasPrice) || 4.00;
  const mpgNum = parseFloat(mpg) || 25;

  const systemPrompt = isEs
    ? `Eres un experto en autopartes. Devuelve SOLO JSON vÃ¡lido con resultados realistas para tiendas locales y en lÃ­nea.`
    : `You are an auto parts expert. Return ONLY valid JSON with realistic results for both local stores and online retailers.`;

  const userPrompt = isEs
    ? `BÃºsqueda: "${q}"
UbicaciÃ³n: ${location}
Precio de gasolina: $${gasPriceNum.toFixed(2)}/galÃ³n Â· Rendimiento del vehÃ­culo: ${mpgNum} mpg

Devuelve un objeto JSON con TRES elementos:

"local": array de resultados para AutoZone, O'Reilly Auto Parts, NAPA Auto Parts, Advance Auto Parts, AutoQuest cerca de ${location}. Cada entrada:
- part, seller, price ("$XX.XX"), stock (nÃºmero), phone, warranty, partNumber
- distanceMiles: millas estimadas desde ${location} hasta esta tienda (nÃºmero realista, 1-15)
- driveMinutes: tiempo de manejo estimado en minutos de ida (nÃºmero realista, 5-30)

"online": array para eBay Motors, Amazon, RockAuto, CarParts.com, PartsGeek. Cada entrada:
- part, seller, price ("$XX.XX"), partNumber, warranty
- shipping: tiempo de envÃ­o
- inStock: true o false

"selfSource": objeto con anÃ¡lisis de conveniencia de compra propia:
- cheapestStore: nombre de la tienda mÃ¡s barata con existencias
- cheapestPrice: precio mÃ¡s bajo disponible localmente como nÃºmero (sin $)
- cheapestPartNumber: nÃºmero de parte de la opciÃ³n mÃ¡s barata
- roundTripMiles: millas de ida y vuelta a la tienda mÃ¡s barata
- roundTripMinutes: minutos de ida y vuelta
- gasCost: costo de gasolina del viaje (roundTripMiles / ${mpgNum} * ${gasPriceNum.toFixed(2)}) como nÃºmero con 2 decimales
- worthIt: true si el cliente ahorrarÃ­a dinero comprando las piezas Ã©l mismo (considerando gasolina y tiempo)
- verdict: oraciÃ³n corta explicando la recomendaciÃ³n en espaÃ±ol`
    : `Search: "${q}"
Location: ${location}
Gas price: $${gasPriceNum.toFixed(2)}/gal Â· Vehicle MPG: ${mpgNum}

Return a JSON object with THREE elements:

"local": array of results for AutoZone, O'Reilly Auto Parts, NAPA Auto Parts, Advance Auto Parts, AutoQuest near ${location}. Each entry:
- part, seller, price ("$XX.XX"), stock (number), phone, warranty, partNumber
- distanceMiles: estimated miles from ${location} to this store (realistic number, 1-15)
- driveMinutes: estimated one-way drive time in minutes (realistic number, 5-30)

"online": array for eBay Motors, Amazon, RockAuto, CarParts.com, PartsGeek. Each entry:
- part, seller, price ("$XX.XX"), partNumber, warranty
- shipping: shipping time
- inStock: true or false

"selfSource": object with buy-it-yourself analysis:
- cheapestStore: name of cheapest in-stock local store
- cheapestPrice: lowest available local price as a number (no $)
- cheapestPartNumber: part number for cheapest option
- roundTripMiles: round trip miles to cheapest store
- roundTripMinutes: round trip drive time in minutes
- gasCost: gas cost for the trip (roundTripMiles / ${mpgNum} * ${gasPriceNum.toFixed(2)}) as number rounded to 2 decimals
- worthIt: true if customer would save money buying the part themselves (accounting for gas and time)
- verdict: one short sentence explaining the recommendation`;

  try {
    const raw = await callAI(systemPrompt, userPrompt);
    if (!raw) return response.status(503).json({ error: "AI provider unavailable." });

    let parsed;
    try {
      const match = raw.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(match ? match[0] : raw);
    } catch {
      return response.status(500).json({ error: "Failed to parse AI response." });
    }

    const results = (parsed.local || []).map((r) => ({
      part: r.part || q,
      seller: r.seller || "Unknown",
      price: r.price || "â€”",
      stock: r.stock ?? null,
      phone: r.phone || null,
      warranty: r.warranty || "â€”",
      partNumber: r.partNumber || null,
      distanceMiles: r.distanceMiles ?? null,
      driveMinutes: r.driveMinutes ?? null,
      url: null,
    }));

    const online = (parsed.online || []).slice(0, 5).map((r) => ({
      part: r.part || q,
      seller: r.seller || "Unknown",
      price: r.price || "â€”",
      partNumber: r.partNumber || null,
      warranty: r.warranty || "â€”",
      shipping: r.shipping || "Varies",
      inStock: r.inStock !== false,
      url: buildSearchUrl(r.seller, r.partNumber, q),
    }));

    const ss = parsed.selfSource || {};
    const selfSource = ss.cheapestStore ? {
      cheapestStore: ss.cheapestStore,
      cheapestPrice: parseFloat(ss.cheapestPrice) || null,
      cheapestPartNumber: ss.cheapestPartNumber || null,
      roundTripMiles: ss.roundTripMiles ?? null,
      roundTripMinutes: ss.roundTripMinutes ?? null,
      gasCost: parseFloat(ss.gasCost) || null,
      worthIt: Boolean(ss.worthIt),
      verdict: ss.verdict || null,
      gasPrice: gasPriceNum,
      mpg: mpgNum,
    } : null;

    return response.json({ results, online, selfSource });
  } catch (err) {
    console.error("[parts-search]", err.message);
    return response.status(500).json({ error: "Search failed." });
  }
});

// â”€â”€ Bland.ai parts verification â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const verifySchema = z.object({
  lang: z.enum(["en", "es"]).optional().default("en"),
  parts: z.array(z.object({
    partName: z.string().min(1),
    vehicle: z.string().optional(),
    stores: z.array(z.object({
      name: z.string(),
      phone: z.string(),
    })).min(1).max(10),
  })).min(1).max(5),
});

app.post("/api/parts/verify", limiter(60 * 1000, 10), async (request, response) => {
  const parsed = verifySchema.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: "Invalid request." });

  const batchId = crypto.randomUUID();
  const webhookUrl = `${process.env.APP_URL || "https://repairscout-smoky.vercel.app"}/api/bland/webhook`;

  // Build all inquiry records upfront
  const records = [];
  for (const part of parsed.data.parts) {
    for (const store of part.stores) {
      records.push({
        id: crypto.randomUUID(),
        batchId,
        partName: part.partName,
        vehicle: part.vehicle || null,
        storeName: store.name,
        storePhone: store.phone,
      });
    }
  }

  await createPartsInquiries(records);

  // Fire calls in background â€” don't await, respond immediately
  (async () => {
    for (const rec of records) {
      try {
        if (blandConfigured()) {
          const call = await startPartInquiryCall({
            inquiryId: rec.id,
            partName: rec.partName,
            vehicle: rec.vehicle,
            storeName: rec.storeName,
            storePhone: rec.storePhone,
            webhookUrl,
            lang: parsed.data.lang || "en",
          });
          await updateBlandCallId(rec.id, call.call_id);
        } else {
          // Dev simulation: update immediately after short delay
          await updateBlandCallId(rec.id, `sim_${rec.id}`);
          const delay = 3000 + Math.random() * 5000;
          setTimeout(async () => {
            const sim = simulatedCallResult(rec.id);
            await completePartsInquiry(rec.id, {
              status: "completed",
              hasPart: sim.analysis.has_part,
              quantity: sim.analysis.quantity,
              price: sim.analysis.price,
              pickupToday: sim.analysis.pickup_today,
              transcript: sim.transcript,
              summary: sim.summary,
            });
          }, delay);
        }
      } catch (err) {
        console.error(`[bland] call failed for ${rec.storeName}:`, err.message);
        await completePartsInquiry(rec.id, { status: "failed" });
      }
    }
  })();

  response.json({ batchId, total: records.length });
});

// Bland.ai webhook â€” called when each call finishes
app.post("/api/bland/webhook", async (request, response) => {
  const webhookSecret = process.env.BLAND_WEBHOOK_SECRET;
  const providedSecret = request.headers["x-bland-secret"] || request.query.secret;
  if (!webhookSecret || providedSecret !== webhookSecret) {
    return response.status(401).json({ error: "Unauthorized" });
  }
  response.json({ received: true }); // respond fast

  try {
    const parsed = parseBlandWebhook(request.body);
    if (!parsed.inquiryId) return;

    const inquiry = await getPartsInquiryById(parsed.inquiryId).catch(() => null);
    if (!inquiry) return;

    const a = parsed.analysis;
    await completePartsInquiry(parsed.inquiryId, {
      status: parsed.status === "completed" ? "completed" : "failed",
      hasPart: a.has_part ?? null,
      quantity: typeof a.quantity === "number" ? a.quantity : null,
      price: a.price || null,
      pickupToday: a.pickup_today ?? null,
      transcript: parsed.transcript,
      summary: parsed.summary,
    });
  } catch (err) {
    console.error("[bland/webhook] error:", err.message);
  }
});

// Poll batch status
app.get("/api/parts/inquiry-batch/:batchId", async (request, response) => {
  const { batchId } = request.params;
  if (!batchId) return response.status(400).json({ error: "Missing batchId." });
  const inquiries = await getPartsInquiryBatch(batchId).catch(() => []);
  const done = inquiries.filter((i) => i.status === "completed" || i.status === "failed").length;
  response.json({ inquiries, done, total: inquiries.length, complete: done === inquiries.length });
});

// â”€â”€ Admin routes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function requireAdmin(request, response, next) {
  if (!request.user) return response.status(401).json({ error: "Unauthorized." });
  if (request.user.role !== "admin") return response.status(403).json({ error: "Admin only." });
  next();
}

// Run on startup: widen role constraint + promote admin email + work order columns
adminMigrate().catch((err) => console.error("[admin migrate]", err.message));
workOrderMigrate().catch((err) => console.error("[work order migrate]", err.message));

app.get("/api/admin/stats", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const stats = await getAdminStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/admin/users", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const users = await listAllUsers();
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch("/api/admin/users/:id/role", requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { role } = req.body || {};
  if (!["driver", "shop", "admin"].includes(role)) return res.status(400).json({ error: "Invalid role." });
  try {
    const user = await setUserRole(id, role);
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/admin/quotes", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const quotes = await listQuoteRequests(null);
    res.json({ quotes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const adminPlanInput = z.object({
  audience: z.enum(["driver", "shop"]),
  name: z.string().trim().min(2).max(80),
  priceMonthly: z.coerce.number().min(0).max(9999),
  requestLimit: z.coerce.number().int().min(0).max(100000),
  diagnosisLimit: z.coerce.number().int().min(0).max(100000),
  quoteLimit: z.coerce.number().int().min(0).max(100000),
  active: z.boolean(),
  description: z.string().trim().max(500).optional().default(""),
  features: z.array(z.string().trim().min(1).max(120)).max(12).optional().default([]),
});

app.get("/api/admin/plans", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const plans = await listPlans();
    res.json({ plans });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/admin/plans/:id", requireAuth, requireAdmin, async (req, res) => {
  const parsed = adminPlanInput.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: "Invalid plan settings." });
  try {
    const plan = await updatePlan(req.params.id, parsed.data);
    if (!plan) return res.status(404).json({ error: "Plan not found." });
    res.json({ plan });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

if (process.env.VERCEL !== "1") {
  app.use(express.static(path.join(projectDir, "dist")));
  // SPA fallback â€” also handles /track/:token and /diagnose/result routes
  app.get("*", limiter(60 * 1000, 300), (request, response, next) => {
    if (request.path.startsWith("/api/")) return next();
    response.sendFile(path.join(projectDir, "dist", "index.html"));
  });
}

export default app;

