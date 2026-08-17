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
  accountHardeningMigrate,
  createEmailVerification,
  verifyEmailToken,
  createPasswordReset,
  consumePasswordReset,
  setUserPassword,
  recordAuditLog,
  deleteUserAccount,
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
  createOutcomeSurvey,
  findConfirmedOutcomes,
  getOutcomeByToken,
  respondToOutcomeSurvey,
  shopConfirmOutcome,
  listOutcomesForReview,
  adminReviewOutcome,
  getGuideStats,
  listOutcomesNeedingReminder,
  markOutcomeReminderSent,
} from "./database.js";
import { diagnoseVehicle, getDiagnosisProviderStatus } from "./diagnosis.js";
import { REPAIR_GUIDES } from "./repair-guides.js";
import { lookupCodes } from "./obd-codes.js";
import { decodeVinFromNhtsa, getRecallsForVehicle } from "./nhtsa.js";
import { extractSearchKeywords } from "./symptom-search.js";
import { buildQuoteFromDiagnosis } from "./parts.js";
import { sendQuoteNotification, sendShopApprovalNotification, sendInvoiceNotification, sendStageUpdateNotification, sendOutcomeReminderNotification, sendVerificationEmail, sendPasswordResetEmail } from "./notify.js";
import { searchRepairShops } from "./shops.js";
import { generateOtp, normalizePhone, otpConfigured, OTP_TTL_MS, sendOtpSms } from "./otp.js";
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
app.use("/api/obd/fix-history", limiter(15 * 60 * 1000, 120));
app.use("/api/vehicle/recalls", limiter(15 * 60 * 1000, 30));
app.use("/api/repairs/search", limiter(15 * 60 * 1000, 60));
app.use(optionalAuth);

app.get("/api/health", rateLimit({ windowMs: 60 * 1000, limit: 60 }), (_request, response) => {
  const aiProviders = getDiagnosisProviderStatus();
  response.json({
    ok: true,
    aiConfigured: aiProviders.configured.length > 0,
    aiProviders,
    database: databaseMode(),
    authConfigured: authConfigured(),
    smsConfigured: otpConfigured(),
    timestamp: new Date().toISOString(),
  });
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
    return response.status(400).json({ error: "Completa el nombre, correo, contraseña y tipo de cuenta." });
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

  recordAuditLog(user.id, "register", { email: user.email, role: user.role }).catch((e) => console.error("[audit]", e.message));

  createEmailVerification(user.id)
    .then((token) => sendVerificationEmail({ to: user.email, name: user.name, token, language: request.body?.language }))
    .catch((e) => console.error("[notify] verification email failed:", e.message));

  response.status(201).json({ user, token: createToken(user) });
});

app.get("/api/auth/verify-email", async (request, response) => {
  const token = String(request.query.token || "").trim();
  if (!token) return response.status(400).json({ error: "Falta el token de verificación." });
  const result = await verifyEmailToken(token);
  if (!result.ok) {
    return response.status(result.reason === "expired" ? 410 : 400).json({
      error: result.reason === "expired" ? "El enlace de verificación expiró." : "El enlace de verificación no es válido.",
    });
  }
  response.json({ ok: true });
});

app.post("/api/auth/resend-verification", requireAuth, rateLimit({ windowMs: 15 * 60 * 1000, limit: 5 }), async (request, response) => {
  const token = await createEmailVerification(request.user.id);
  await sendVerificationEmail({ to: request.user.email, name: request.user.name, token, language: request.body?.language });
  response.json({ ok: true });
});

app.post("/api/auth/login", rateLimit({ windowMs: 15 * 60 * 1000, limit: 10 }), async (request, response) => {
  const parsed = authInput.pick({ email: true, password: true }).safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ error: "Ingresa un correo y una contraseña válidos." });
  }
  const storedUser = await findUserByEmail(parsed.data.email);
  const passwordHash = storedUser?.password_hash || storedUser?.passwordHash;
  if (!storedUser || !(await verifyPassword(parsed.data.password, passwordHash))) {
    return response.status(401).json({ error: "El correo o la contraseña no son correctos." });
  }
  const user = {
    id: storedUser.id,
    name: storedUser.name,
    email: storedUser.email,
    role: storedUser.role,
    shopName: storedUser.shop_name || storedUser.shopName,
    createdAt: storedUser.created_at || storedUser.createdAt,
  };
  recordAuditLog(user.id, "login", {}).catch((e) => console.error("[audit]", e.message));
  response.json({ user, token: createToken(user) });
});

app.get("/api/auth/me", requireAuth, (request, response) => {
  response.json({ user: request.user });
});

app.post("/api/auth/forgot-password", rateLimit({ windowMs: 15 * 60 * 1000, limit: 10 }), async (request, response) => {
  const email = String(request.body?.email || "").trim().toLowerCase();
  // Always return the same generic success message, whether or not the account
  // exists — confirming/denying account existence here is a real info leak.
  const genericResponse = { ok: true, message: "Si existe una cuenta con ese correo, enviamos un enlace para restablecer la contraseña." };
  if (!email) return response.json(genericResponse);
  const storedUser = await findUserByEmail(email);
  if (storedUser) {
    const token = await createPasswordReset(storedUser.id);
    await sendPasswordResetEmail({ to: storedUser.email, name: storedUser.name, token, language: request.body?.language });
    recordAuditLog(storedUser.id, "password_reset_requested", {}).catch((e) => console.error("[audit]", e.message));
  }
  response.json(genericResponse);
});

app.post("/api/auth/reset-password", rateLimit({ windowMs: 15 * 60 * 1000, limit: 10 }), async (request, response) => {
  const token = String(request.body?.token || "").trim();
  const parsedPassword = authInput.pick({ password: true }).safeParse({ password: request.body?.password });
  if (!token || !parsedPassword.success) {
    return response.status(400).json({ error: "Ingresa un token válido y una contraseña de al menos 8 caracteres." });
  }
  const result = await consumePasswordReset(token);
  if (!result.ok) {
    return response.status(result.reason === "expired" ? 410 : 400).json({
      error: result.reason === "expired" ? "El enlace para restablecer la contraseña expiró." : "El enlace para restablecer la contraseña no es válido.",
    });
  }
  await setUserPassword(result.userId, await hashPassword(parsedPassword.data.password));
  recordAuditLog(result.userId, "password_reset_completed", {}).catch((e) => console.error("[audit]", e.message));
  response.json({ ok: true });
});

app.delete("/api/auth/me", requireAuth, rateLimit({ windowMs: 15 * 60 * 1000, limit: 10 }), async (request, response) => {
  const password = String(request.body?.password || "");
  const storedUser = await findUserByEmail(request.user.email);
  const passwordHash = storedUser?.password_hash || storedUser?.passwordHash;
  if (!password || !storedUser || !(await verifyPassword(password, passwordHash))) {
    return response.status(403).json({ error: "La contraseña no es correcta." });
  }
  await recordAuditLog(request.user.id, "account_deletion", { email: request.user.email }).catch((e) => console.error("[audit]", e.message));
  await deleteUserAccount(request.user.id);
  response.json({
    ok: true,
    message: "Tu cuenta y los datos vinculados a ella fueron eliminados. Nota: los registros de verificación telefónica y diagnósticos pendientes ligados solo a tu número de teléfono no están vinculados a tu cuenta y no pueden eliminarse automáticamente por esta vía.",
  });
});

app.get("/api/vehicle/decode", async (request, response) => {
  const vin = String(request.query.vin || "").trim().toUpperCase();
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) {
    return response.status(400).json({ error: "Ingresa un VIN válido de 17 caracteres." });
  }
  try {
    const decoded = await decodeVinFromNhtsa(vin);
    return response.json({ vin, ...decoded });
  } catch (error) {
    if (error.code === "NOT_FOUND") {
      return response.status(404).json({ error: "No encontramos información para ese VIN." });
    }
    return response.status(502).json({ error: "El servicio de VIN no está disponible en este momento." });
  }
});

// Federally-mandated safety recalls only, via NHTSA's free public API — NOT
// manufacturer TSBs, which aren't freely available from any source. Keep that
// distinction explicit in any consuming UI copy.
app.get("/api/vehicle/recalls", async (request, response) => {
  const vin = String(request.query.vin || "").trim().toUpperCase();
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) {
    return response.status(400).json({ error: "Ingresa un VIN válido de 17 caracteres." });
  }
  try {
    const { year, make, model } = await decodeVinFromNhtsa(vin);
    const recalls = await getRecallsForVehicle({ year, make, model });
    return response.json({ vin, year, make, model, recallCount: recalls.length, recalls });
  } catch (error) {
    if (error.code === "NOT_FOUND") {
      return response.status(404).json({ error: "No encontramos información para ese VIN." });
    }
    return response.status(502).json({ error: "El servicio de retiros de NHTSA no está disponible en este momento." });
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
  if (!parsed.success) return response.status(400).json({ error: "Los datos del vehículo están incompletos." });
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
  if (!parsed.success) return response.status(400).json({ error: "Faltan datos para crear la evaluación." });
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
    return response.status(502).json({ error: "No pudimos generar la evaluación en este momento." });
  }
});

app.get("/api/shops/search", async (request, response) => {
  const zip = String(request.query.zip || "").trim();
  const radius = Number(request.query.radius || 25);
  if (!/^\d{5}(-\d{4})?$/.test(zip)) {
    return response.status(400).json({ error: "Ingresa un código postal válido." });
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
  if (!parsed.success) return response.status(400).json({ error: "La solicitud de cotización está incompleta." });
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
  status: z.enum(["Solicitud nueva", "Requiere revisión", "En revisión", "Cotizada", "Declinada", "Cita solicitada"]),
});

app.patch("/api/quote-requests/:id/status", requireAuth, async (request, response) => {
  if (request.user.role !== "shop") {
    return response.status(403).json({ error: "Solo el taller puede actualizar esta solicitud." });
  }

  const parsed = quoteStatusInput.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ error: "Selecciona un estado válido." });
  }

  const updated = await updateQuoteRequestStatus({
    id: request.params.id,
    shopName: request.user.shopName,
    status: parsed.data.status,
  });

  if (!updated) {
    return response.status(404).json({ error: "No encontramos esa solicitud para tu taller." });
  }

  recordAuditLog(request.user.id, "quote_request_status_changed", { quoteRequestId: request.params.id, status: parsed.data.status })
    .catch((e) => console.error("[audit]", e.message));

  response.json({ quoteRequest: updated });
});

// ── Itemized quotes: list (shop) ───────────────────────────────────────────

app.get("/api/quotes/sent", requireAuth, async (request, response) => {
  const quotes = await listSentQuotes(request.user.id).catch(() => []);
  response.json({ quotes });
});

// ── Itemized quotes: build ─────────────────────────────────────────────────

const quoteBuildInput = z.object({
  diagnosis: z.record(z.string(), z.any()),
  vehicle: z.record(z.string(), z.any()).optional(),
  language: z.string().max(5).optional(),
});

app.post("/api/quotes/build", async (request, response) => {
  const parsed = quoteBuildInput.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: "Faltan datos de diagnóstico." });
  try {
    const result = await buildQuoteFromDiagnosis({
      diagnosis: parsed.data.diagnosis,
      vehicle: parsed.data.vehicle || {},
      language: parsed.data.language || "es",
    });
    return response.json(result);
  } catch (e) {
    console.error("Quote build error:", e);
    return response.status(502).json({ error: "No se pudo generar la cotización." });
  }
});

// ── Itemized quotes: send ──────────────────────────────────────────────────

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
    return response.status(400).json({ error: "Faltan datos para enviar la cotización." });
  }
  if (!parsed.data.customer.email && !parsed.data.customer.phone) {
    return response.status(400).json({ error: "Proporciona un correo o teléfono del cliente." });
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

// ── Itemized quotes: track (customer facing) ───────────────────────────────

app.get("/api/track/:token", async (request, response) => {
  const token = request.params.token?.trim();
  if (!token || token.length < 10) return response.status(400).json({ error: "Token inválido." });
  const quote = await getItemizedQuoteByToken(token).catch(() => null);
  if (!quote) return response.status(404).json({ error: "No encontramos esa cotización." });
  response.json({ quote });
});

app.post("/api/track/:token/approve", async (request, response) => {
  const token = request.params.token?.trim();
  if (!token) return response.status(400).json({ error: "Token inválido." });
  const updated = await approveQuoteByToken(token).catch(() => null);
  if (!updated) return response.status(404).json({ error: "No encontramos esa cotización." });

  // Notify the shop mechanic via SMS + email that the customer approved
  if (updated.userId) {
    try {
      const shopProfile = await getShopProfile(updated.userId);
      if (shopProfile) {
        const veh = updated.vehicle || {};
        const vehicleStr = [veh.year, veh.make, veh.model].filter(Boolean).join(" ") || "Vehicle";
        await sendShopApprovalNotification({
          shopPhone: shopProfile.phone,
          shopEmail: shopProfile.email,
          customerName: updated.customerName,
          vehicle: vehicleStr,
          appUrl: process.env.APP_URL || "https://repairscout.app",
        });
      }
    } catch (e) {
      console.error("[approve] notify shop error:", e.message);
    }
  }

  response.json({ quote: updated });
});

// ── Get single quote by ID (shop only) ───────────────────────────────────

app.get("/api/quotes/:id", requireAuth, async (request, response) => {
  if (!["shop", "admin"].includes(request.user.role)) {
    return response.status(403).json({ error: "Acceso no autorizado." });
  }
  const quote = await getItemizedQuoteById(request.params.id).catch(() => null);
  if (!quote) return response.status(404).json({ error: "Cotización no encontrada." });
  if (request.user.role === "shop" && quote.userId !== request.user.id) {
    return response.status(403).json({ error: "Acceso no autorizado." });
  }
  response.json({ quote });
});

// ── Set tracking number (shop only) ──────────────────────────────────────

app.patch("/api/quotes/:id/tracking", requireAuth, async (request, response) => {
  if (request.user.role !== "shop") {
    return response.status(403).json({ error: "Solo el taller puede actualizar el seguimiento." });
  }
  const ownerCheck = await getItemizedQuoteById(request.params.id).catch(() => null);
  if (!ownerCheck) return response.status(404).json({ error: "Cotización no encontrada." });
  if (ownerCheck.userId !== request.user.id) return response.status(403).json({ error: "Acceso no autorizado." });
  const { trackingNumber, carrier } = request.body || {};
  if (!trackingNumber?.trim()) return response.status(400).json({ error: "Ingresa un número de rastreo." });
  const updated = await setTrackingInfo(request.params.id, trackingNumber.trim(), (carrier || "").trim());
  if (!updated) return response.status(404).json({ error: "Cotización no encontrada." });
  response.json({ quote: updated });
});

// ── Send invoice (shop only) ──────────────────────────────────────────────

app.post("/api/quotes/:id/invoice", requireAuth, async (request, response) => {
  if (request.user.role !== "shop") {
    return response.status(403).json({ error: "Solo el taller puede enviar facturas." });
  }
  const ownerCheckInv = await getItemizedQuoteById(request.params.id).catch(() => null);
  if (!ownerCheckInv) return response.status(404).json({ error: "Cotización no encontrada." });
  if (ownerCheckInv.userId !== request.user.id) return response.status(403).json({ error: "Acceso no autorizado." });
  const { paymentType, depositPct, invoiceTotal } = request.body || {};
  const paymentAmount = paymentType === "deposit"
    ? (invoiceTotal * (depositPct || 50) / 100)
    : invoiceTotal;

  const updated = await setInvoiceSent(request.params.id, "invoiced", paymentAmount || null);
  if (!updated) return response.status(404).json({ error: "Cotización no encontrada." });

  // Notify customer via SMS/email about the invoice
  const veh = updated.vehicle || {};
  const vehicleStr = [veh.year, veh.make, veh.model].filter(Boolean).join(" ") || "Vehicle";
  if (updated.customerEmail || updated.customerPhone) {
    try {
      await sendInvoiceNotification({
        customerEmail: updated.customerEmail,
        customerPhone: updated.customerPhone,
        customerName: updated.customerName,
        vehicle: vehicleStr,
        invoiceTotal: paymentAmount || invoiceTotal || 0,
        trackUrl: `${process.env.APP_URL || "https://repairscout.app"}/track/${updated.token}`,
      });
    } catch (e) {
      console.error("[invoice] notify customer error:", e.message);
    }
  }

  response.json({ quote: updated });
});

// ── Repair stage update (shop only) ───────────────────────────────────────

const repairStageInput = z.object({
  stage: z.enum([
    "Quote Sent", "Approved", "Parts Ordered", "Parts In Transit",
    "Parts Arrived", "In Progress", "Quality Check",
    "Ready for Pickup", "Completed", "Invoice Sent", "Paid",
  ]),
});

app.patch("/api/quotes/:id/repair-stage", requireAuth, async (request, response) => {
  if (request.user.role !== "shop") {
    return response.status(403).json({ error: "Solo el taller puede actualizar el estado de la reparación." });
  }
  const ownerCheckStage = await getItemizedQuoteById(request.params.id).catch(() => null);
  if (!ownerCheckStage) return response.status(404).json({ error: "Cotización no encontrada." });
  if (ownerCheckStage.userId !== request.user.id) return response.status(403).json({ error: "Acceso no autorizado." });
  const parsed = repairStageInput.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: "Estado de reparación no válido." });
  const updated = await updateRepairStage({ id: request.params.id, stage: parsed.data.stage });
  if (!updated) return response.status(404).json({ error: "No encontramos esa cotización." });

  // On completion, seed a confirmed-fix outcome survey so we can ask "did this fix it?"
  // in the same notification that already fires below — see repair_outcomes in database.js.
  let surveyUrl = null;
  if (parsed.data.stage === "Completed") {
    try {
      const outcome = await createOutcomeSurvey(updated);
      surveyUrl = `${process.env.APP_URL || "https://repairscout.app"}/outcome/${outcome.surveyToken}`;
    } catch (e) {
      console.error("[outcome-survey] failed to create:", e.message);
    }
  }

  // Notify customer of stage change (fire-and-forget)
  if (updated.customerEmail || updated.customerPhone) {
    const veh = updated.vehicle || {};
    const vehicleStr = [veh.year, veh.make, veh.model].filter(Boolean).join(" ") || "Vehicle";
    sendStageUpdateNotification({
      customerEmail: updated.customerEmail,
      customerPhone: updated.customerPhone,
      customerName: updated.customerName,
      vehicle: vehicleStr,
      stage: parsed.data.stage,
      trackUrl: `${process.env.APP_URL || "https://repairscout.app"}/track/${updated.token}`,
      surveyUrl,
    }).catch((e) => console.error("[stage-notify]", e.message));
  }

  response.json({ quote: updated });
});

// ── Repair guide real-world confirmed-cost stats (public, read-only, no PII) ──

app.get("/api/guides/:id/stats", async (request, response) => {
  if (!REPAIR_GUIDES[request.params.id]) return response.status(404).json({ error: "Guía no encontrada." });
  const stats = await getGuideStats(request.params.id).catch(() => ({ count: 0, costCount: 0, costLow: null, costHigh: null, costMedian: null, sampleFixes: [] }));
  response.json({ stats });
});

// ── Confirmed-fix outcome survey (public, token-gated) ─────────────────────

app.get("/api/outcomes/:token", async (request, response) => {
  const outcome = await getOutcomeByToken(request.params.token).catch(() => null);
  if (!outcome) return response.status(404).json({ error: "Encuesta no encontrada." });
  response.json({ outcome });
});

const outcomeResponseInput = z.object({
  worked: z.boolean(),
  notes: z.string().max(2000).optional(),
  costActual: z.number().nonnegative().optional(),
});

app.post("/api/outcomes/:token/respond", async (request, response) => {
  const parsed = outcomeResponseInput.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: "Respuesta no válida." });
  const outcome = await respondToOutcomeSurvey(request.params.token, parsed.data);
  if (!outcome) return response.status(404).json({ error: "Encuesta no encontrada." });
  response.json({ outcome });
});

// ── Shop confirms an outcome (moderation step 1 of 2 before it's trusted) ──

app.patch("/api/quotes/:id/outcome", requireAuth, async (request, response) => {
  if (request.user.role !== "shop") {
    return response.status(403).json({ error: "Solo el taller puede confirmar el resultado." });
  }
  const ownerCheckOutcome = await getItemizedQuoteById(request.params.id).catch(() => null);
  if (!ownerCheckOutcome) return response.status(404).json({ error: "Cotización no encontrada." });
  if (ownerCheckOutcome.userId !== request.user.id) return response.status(403).json({ error: "Acceso no autorizado." });

  const outcomes = await listOutcomesForReview({}).catch(() => []);
  const outcome = outcomes.find((o) => o.itemizedQuoteId === request.params.id);
  if (!outcome) return response.status(404).json({ error: "No hay encuesta de resultado para esta cotización." });

  const confirmed = await shopConfirmOutcome(outcome.id);
  response.json({ outcome: confirmed });
});

// ── Admin: review outcomes (moderation step 2 — the SureTrack-style editorial gate) ──

app.get("/api/admin/outcomes", requireAuth, requireAdmin, async (request, response) => {
  const tier = request.query.tier;
  const outcomes = await listOutcomesForReview(tier ? { tier } : {});
  response.json({ outcomes });
});

const adminReviewInput = z.object({
  approve: z.boolean(),
  // Validated against real guide IDs rather than a free-text field, so an admin can't
  // typo a category that will never match anything in the guide library on the frontend.
  guideCategory: z.enum(Object.keys(REPAIR_GUIDES)).optional(),
});

app.patch("/api/admin/outcomes/:id/review", requireAuth, requireAdmin, async (request, response) => {
  const parsed = adminReviewInput.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: "Datos de revisión no válidos." });
  const outcome = await adminReviewOutcome(request.params.id, request.user.id, parsed.data);
  if (!outcome) return response.status(404).json({ error: "Resultado no encontrado." });
  recordAuditLog(request.user.id, "admin_outcome_reviewed", { outcomeId: request.params.id, approve: parsed.data.approve })
    .catch((e) => console.error("[audit]", e.message));
  response.json({ outcome });
});

// ── Cron: check tracking status 3x/day ───────────────────────────────────
// Called by Vercel Cron at 8am, 12pm, 4pm UTC. Updates "Parts In Transit"
// orders to "Parts Arrived" when the tracking carrier confirms delivery.

app.get("/api/cron/check-tracking", async (request, response) => {
  const authHeader = request.headers["authorization"] || "";
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return response.status(401).json({ error: "Unauthorized." });
  }
  // Fetch all In Transit work orders
  const allQuotes = await listSentQuotes(null).catch(() => []);
  const inTransit = allQuotes.filter((q) => q.repairStage === "Parts In Transit" && q.trackingNumber);
  const results = [];
  for (const q of inTransit) {
    // Placeholder: in a real implementation, query a tracking API here
    // e.g. 17track, AfterShip, or the carrier API
    console.log(`[cron/tracking] Checking ${q.trackingCarrier} ${q.trackingNumber} for order ${q.id}`);
    results.push({ id: q.id, tracking: q.trackingNumber, status: "checked" });
  }
  response.json({ checked: results.length, results });
});

// ── Cron: nudge unanswered confirmed-fix surveys once/day ─────────────────
// Nobody is forced to open the "did this fix it?" link sent on completion — this
// sends exactly one reminder per outcome, 48h after the original survey, to the
// customers who never responded. Real crowd-sourced fix data is the entire point of
// the confirmed-outcomes feature, so leaving this reminder unsent was leaving data on
// the table.

app.get("/api/cron/nudge-outcome-surveys", async (request, response) => {
  const authHeader = request.headers["authorization"] || "";
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return response.status(401).json({ error: "Unauthorized." });
  }
  const pending = await listOutcomesNeedingReminder({ olderThanHours: 48 }).catch(() => []);
  const results = [];
  for (const outcome of pending) {
    const quote = await getItemizedQuoteById(outcome.itemizedQuoteId).catch(() => null);
    if (!quote || (!quote.customerEmail && !quote.customerPhone)) {
      await markOutcomeReminderSent(outcome.id).catch(() => {});
      results.push({ id: outcome.id, sent: false, reason: "no contact info" });
      continue;
    }
    const veh = outcome.vehicle || {};
    const vehicleStr = [veh.year, veh.make, veh.model].filter(Boolean).join(" ") || "Vehicle";
    const surveyUrl = `${process.env.APP_URL || "https://repairscout.app"}/outcome/${outcome.surveyToken}`;
    await sendOutcomeReminderNotification({
      customerEmail: quote.customerEmail,
      customerPhone: quote.customerPhone,
      customerName: quote.customerName,
      vehicle: vehicleStr,
      surveyUrl,
    }).catch((e) => console.error("[cron/outcome-reminder]", e.message));
    await markOutcomeReminderSent(outcome.id).catch(() => {});
    results.push({ id: outcome.id, sent: true });
  }
  response.json({ nudged: results.length, results });
});

// ── OTP: send code ────────────────────────────────────────────────────────────

app.use("/api/otp", limiter(15 * 60 * 1000, 10));

app.post("/api/otp/send", async (request, response) => {
  const raw = String(request.body?.phone || "").trim();
  if (!raw) return response.status(400).json({ error: "Ingresa un número de teléfono." });

  const phone = normalizePhone(raw);
  if (phone.length < 10) return response.status(400).json({ error: "Número de teléfono inválido." });

  const code = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

  await upsertPhoneVerification({ phone, code, expiresAt });

  try {
    await sendOtpSms(phone, code);
  } catch (e) {
    console.error("[otp/send] error:", e.message);
    if (e.code === "SMS_NOT_CONFIGURED") {
      return response.status(503).json({
        error: "La verificación por texto no está disponible todavía. No se envió ningún mensaje. Intenta de nuevo más tarde o inicia sesión para guardar tu progreso.",
        code: "SMS_NOT_CONFIGURED",
      });
    }
    return response.status(502).json({
      error: "El proveedor de mensajes no pudo entregar el código. Verifica el número e inténtalo de nuevo.",
      code: "SMS_DELIVERY_FAILED",
    });
  }

  return response.json({ sent: true, phone });
});

// ── OTP: verify code ──────────────────────────────────────────────────────────

app.post("/api/otp/verify", async (request, response) => {
  const raw   = String(request.body?.phone || "").trim();
  const code  = String(request.body?.code  || "").trim();
  if (!raw || !code) return response.status(400).json({ error: "Faltan datos." });

  const phone = normalizePhone(raw);
  const record = await getPhoneVerification(phone);

  if (!record) return response.status(404).json({ error: "Envía el código primero." });
  if (new Date(record.codeExpiresAt) < new Date()) return response.status(410).json({ error: "El código expiró. Solicita uno nuevo." });
  if (record.code !== code) return response.status(422).json({ error: "Código incorrecto." });

  await markPhoneVerified(phone);

  return response.json({
    verified: true,
    phone,
    freeEligible: !record.usedFree,
  });
});

// ── Checkout: start Stripe session ───────────────────────────────────────────

app.use("/api/checkout", limiter(15 * 60 * 1000, 20));

const checkoutStartInput = z.object({
  phone: z.string().min(7).max(20),
  vehicle: z.record(z.string(), z.any()).optional(),
  mileage: z.string().max(30).optional(),
  description: z.string().min(8).max(2000),
  zip: z.string().min(5).max(10),
  language: z.string().max(5).optional(),
});

app.post("/api/checkout/start", async (request, response) => {
  const parsed = checkoutStartInput.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: "Faltan datos para iniciar el pago." });

  const { phone, vehicle, mileage, description, zip, language } = parsed.data;
  const normalizedPhone = normalizePhone(phone);

  const verification = await getPhoneVerification(normalizedPhone);
  if (!verification?.verified) {
    return response.status(403).json({ error: "Verifica tu teléfono primero." });
  }

  const id = crypto.randomUUID();
  await createPendingDiagnosis({ id, phone: normalizedPhone, vehicle: vehicle || {}, mileage, description, zip, language: language || "es" });

  try {
    const session = await createDiagnosisCheckout({ pendingId: id, phone: normalizedPhone });
    return response.json({ url: session.url, pendingId: id });
  } catch (e) {
    console.error("[checkout/start] Stripe error:", e.message);
    return response.status(502).json({ error: "No pudimos iniciar el pago. Intenta de nuevo." });
  }
});

// ── Free diagnosis: run immediately after OTP (first-time only) ───────────────

const freeDiagInput = z.object({
  phone: z.string().min(7).max(20),
  vehicle: z.record(z.string(), z.any()).optional(),
  mileage: z.string().max(30).optional(),
  description: z.string().min(8).max(2000),
  obdCodes: z.array(z.string()).max(10).optional(),
  zip: z.string().min(5).max(10),
  language: z.string().max(5).optional(),
});

app.post("/api/diagnose/free", limiter(15 * 60 * 1000, 30), async (request, response) => {
  const parsed = freeDiagInput.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: "Faltan datos para el diagnóstico." });

  const { phone, vehicle, mileage, description, obdCodes, zip, language } = parsed.data;
  const normalizedPhone = normalizePhone(phone);

  const verification = await getPhoneVerification(normalizedPhone);
  if (!verification?.verified) return response.status(403).json({ error: "Verifica tu teléfono primero." });
  if (verification.usedFree) return response.status(402).json({ error: "Ya usaste tu diagnóstico gratuito.", requiresPayment: true });

  try {
    await markPhoneUsedFree(normalizedPhone);
    const result = await diagnoseVehicle({ vehicle: vehicle || {}, mileage, description, obdCodes, zip, language: language || "es" });
    await saveDiagnosis({ id: crypto.randomUUID(), userId: request.user?.id || null, vehicle: vehicle || {}, description, zip, result, createdAt: new Date().toISOString() });
    return response.json({ result, free: true });
  } catch (e) {
    console.error("[diagnose/free] error:", e.message);
    return response.status(502).json({ error: "No pudimos generar el diagnóstico." });
  }
});

// ── Stripe webhook ────────────────────────────────────────────────────────────

app.post("/api/stripe/webhook", async (request, response) => {
  const sig = request.headers["stripe-signature"];
  let event;
  try {
    event = constructWebhookEvent(request.rawBody, sig);
  } catch (e) {
    console.error("[stripe/webhook] signature error:", e.message);
    return response.status(400).json({ error: `Webhook error: ${e.message}` });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
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

// ── Pending diagnosis result (poll after Stripe) ──────────────────────────────

app.get("/api/diagnose/result/:id", async (request, response) => {
  const id = request.params.id?.trim();
  if (!id) return response.status(400).json({ error: "ID inválido." });
  const pending = await getPendingDiagnosis(id).catch(() => null);
  if (!pending) return response.status(404).json({ error: "No encontramos ese diagnóstico." });
  if (!pending.paid) return response.status(402).json({ error: "Pago pendiente.", pending: true });
  if (!pending.result) return response.json({ ready: false, paid: true });
  return response.json({ ready: true, paid: true, result: pending.result, vehicle: pending.vehicle });
});

// ── OBD-II code lookup (used right after a Bluetooth scan, before submitting) ─

app.get("/api/obd/lookup", (request, response) => {
  const codes = String(request.query.codes || "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
  if (!codes.length) return response.status(400).json({ error: "No codes provided." });
  const { found, unknown } = lookupCodes(codes);
  return response.json({ found, unknown });
});

// Vehicle-specific confirmed-fix history for a scanned OBD code — same generic
// definitions as /api/obd/lookup, plus real confirmed fixes other users reported
// for this exact code on this exact make/model (Identifix "Direct-Hit" style).
app.get("/api/obd/fix-history", async (request, response) => {
  const codes = String(request.query.codes || "")
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 10);
  const make = String(request.query.make || "").trim();
  const model = String(request.query.model || "").trim();
  const year = String(request.query.year || "").trim() || undefined;
  const engine = String(request.query.engine || "").trim() || undefined;
  if (!codes.length || !make || !model) {
    return response.status(400).json({ error: "Faltan códigos, marca o modelo del vehículo." });
  }
  try {
    const { found } = lookupCodes(codes);
    const byCode = {};
    for (const code of codes) {
      const fixes = await findConfirmedOutcomes({ make, model, year, engine, obdCodes: [code], limit: 5 });
      byCode[code] = { definition: found[code] || null, fixes };
    }
    return response.json({ vehicleMatch: { make, model, year: year || null }, byCode });
  } catch (error) {
    console.error("OBD fix history failed:", error);
    return response.status(502).json({ error: "No pudimos buscar el historial de reparaciones en este momento." });
  }
});

// Symptom + vehicle search over confirmed fixes other users reported —
// Identifix "Direct-Hit" style. Make+model are the only hard filter (see
// findConfirmedOutcomes); year/engine only affect ranking, never exclude a
// result, since repair_outcomes.vehicle has no schema-enforced keys and
// outcome volume is still early/sparse.
app.get("/api/repairs/search", async (request, response) => {
  const make = String(request.query.make || "").trim();
  const model = String(request.query.model || "").trim();
  const symptom = String(request.query.symptom || "").trim();
  const year = String(request.query.year || "").trim() || undefined;
  const engine = String(request.query.engine || "").trim() || undefined;
  const limit = Math.min(Number.parseInt(request.query.limit, 10) || 10, 25);
  if (!make || !model || symptom.length < 3) {
    return response.status(400).json({ error: "Ingresa marca, modelo y una descripción del síntoma (mínimo 3 caracteres)." });
  }
  try {
    const keywords = extractSearchKeywords(symptom);
    const results = await findConfirmedOutcomes({ make, model, year, engine, symptomKeywords: keywords, limit });
    return response.json({ query: { make, model, year: year || null, engine: engine || null, symptom }, count: results.length, results });
  } catch (error) {
    console.error("Repair search failed:", error);
    return response.status(502).json({ error: "No pudimos buscar reparaciones confirmadas en este momento." });
  }
});

// ── Parts search (AI-generated local + online results) ────────────────────────

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
    ? `Eres un experto en autopartes. Devuelve SOLO JSON válido con resultados realistas para tiendas locales y en línea.`
    : `You are an auto parts expert. Return ONLY valid JSON with realistic results for both local stores and online retailers.`;

  const userPrompt = isEs
    ? `Búsqueda: "${q}"
Ubicación: ${location}
Precio de gasolina: $${gasPriceNum.toFixed(2)}/galón · Rendimiento del vehículo: ${mpgNum} mpg

Devuelve un objeto JSON con TRES elementos:

"local": array de resultados para AutoZone, O'Reilly Auto Parts, NAPA Auto Parts, Advance Auto Parts, AutoQuest cerca de ${location}. Cada entrada:
- part, seller, price ("$XX.XX"), stock (número), phone, warranty, partNumber
- distanceMiles: millas estimadas desde ${location} hasta esta tienda (número realista, 1-15)
- driveMinutes: tiempo de manejo estimado en minutos de ida (número realista, 5-30)

"online": array para eBay Motors, Amazon, RockAuto, CarParts.com, PartsGeek. Cada entrada:
- part, seller, price ("$XX.XX"), partNumber, warranty
- shipping: tiempo de envío
- inStock: true o false

"selfSource": objeto con análisis de conveniencia de compra propia:
- cheapestStore: nombre de la tienda más barata con existencias
- cheapestPrice: precio más bajo disponible localmente como número (sin $)
- cheapestPartNumber: número de parte de la opción más barata
- roundTripMiles: millas de ida y vuelta a la tienda más barata
- roundTripMinutes: minutos de ida y vuelta
- gasCost: costo de gasolina del viaje (roundTripMiles / ${mpgNum} * ${gasPriceNum.toFixed(2)}) como número con 2 decimales
- worthIt: true si el cliente ahorraría dinero comprando las piezas él mismo (considerando gasolina y tiempo)
- verdict: oración corta explicando la recomendación en español`
    : `Search: "${q}"
Location: ${location}
Gas price: $${gasPriceNum.toFixed(2)}/gal · Vehicle MPG: ${mpgNum}

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
      price: r.price || "—",
      stock: r.stock ?? null,
      phone: r.phone || null,
      warranty: r.warranty || "—",
      partNumber: r.partNumber || null,
      distanceMiles: r.distanceMiles ?? null,
      driveMinutes: r.driveMinutes ?? null,
      url: null,
    }));

    const online = (parsed.online || []).slice(0, 5).map((r) => ({
      part: r.part || q,
      seller: r.seller || "Unknown",
      price: r.price || "—",
      partNumber: r.partNumber || null,
      warranty: r.warranty || "—",
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

// ── Bland.ai parts verification ───────────────────────────────────────────────

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

  // Fire calls in background — don't await, respond immediately
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

// Bland.ai webhook — called when each call finishes
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

// ── Admin routes ──────────────────────────────────────────────────────────────

function requireAdmin(request, response, next) {
  if (!request.user) return response.status(401).json({ error: "Unauthorized." });
  if (request.user.role !== "admin") return response.status(403).json({ error: "Admin only." });
  next();
}

// Run on startup: widen role constraint + promote admin email + work order columns
adminMigrate().catch((err) => console.error("[admin migrate]", err.message));
workOrderMigrate().catch((err) => console.error("[work order migrate]", err.message));
accountHardeningMigrate().catch((err) => console.error("[account hardening migrate]", err.message));

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
  // SPA fallback — also handles /track/:token and /diagnose/result routes
  app.get("/*splat", limiter(60 * 1000, 300), (request, response, next) => {
    if (request.path.startsWith("/api/")) return next();
    response.sendFile(path.join(projectDir, "dist", "index.html"));
  });
}

export default app;
