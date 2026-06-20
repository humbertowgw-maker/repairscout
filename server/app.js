import "dotenv/config";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import { z } from "zod";
import { authConfigured, createToken, hashPassword, optionalAuth, requireAuth, verifyPassword } from "./auth.js";
import {
  createQuoteRequest,
  createUser,
  createVehicle,
  databaseMode,
  findUserByEmail,
  getShopProfile,
  listQuoteRequests,
  listVehicles,
  saveDiagnosis,
  updateQuoteRequestStatus,
  upsertShopProfile,
} from "./database.js";
import { diagnoseVehicle } from "./diagnosis.js";
import { searchRepairShops } from "./shops.js";

const app = express();
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(currentDir, "..");

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.set("trust proxy", 1);
app.use((_request, response, next) => {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});

const rateWindows = new Map();

function rateLimit({ key, windowMs, max }) {
  return (request, response, next) => {
    const identity = request.ip || request.get("x-forwarded-for") || "unknown";
    const bucketKey = `${key}:${identity}`;
    const now = Date.now();
    const current = rateWindows.get(bucketKey);

    if (!current || current.resetAt <= now) {
      rateWindows.set(bucketKey, { count: 1, resetAt: now + windowMs });
      return next();
    }

    current.count += 1;
    if (current.count > max) {
      const retryAfter = Math.ceil((current.resetAt - now) / 1000);
      response.setHeader("Retry-After", String(retryAfter));
      return response.status(429).json({
        error: "Demasiadas solicitudes. Intenta de nuevo en unos minutos.",
      });
    }

    return next();
  };
}

app.use("/api", rateLimit({ key: "api", windowMs: 15 * 60 * 1000, max: 240 }));
app.use("/api/auth", rateLimit({ key: "auth", windowMs: 15 * 60 * 1000, max: 25 }));
app.use("/api/diagnose", rateLimit({ key: "diagnose", windowMs: 15 * 60 * 1000, max: 30 }));
app.use("/api/quote-requests", rateLimit({ key: "quotes", windowMs: 15 * 60 * 1000, max: 60 }));
app.use("/api/shop-profile", rateLimit({ key: "shop-profile", windowMs: 15 * 60 * 1000, max: 60 }));
app.use(optionalAuth);

app.get("/api/health", (_request, response) => {
  response.json({
    ok: true,
    aiConfigured: Boolean(
      process.env.OPENAI_API_KEY ||
      process.env.AI_GATEWAY_API_KEY ||
      process.env.VERCEL === "1",
    ),
    database: databaseMode(),
    authConfigured: authConfigured(),
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

app.post("/api/auth/register", async (request, response) => {
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

  response.status(201).json({ user, token: createToken(user) });
});

app.post("/api/auth/login", async (request, response) => {
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
  response.json({ user, token: createToken(user) });
});

app.get("/api/auth/me", requireAuth, (request, response) => {
  response.json({ user: request.user });
});

app.get("/api/vehicle/decode", async (request, response) => {
  const vin = String(request.query.vin || "").trim().toUpperCase();
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) {
    return response.status(400).json({ error: "Ingresa un VIN válido de 17 caracteres." });
  }
  try {
    const nhtsaResponse = await fetch(
      `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/${encodeURIComponent(vin)}?format=json`,
    );
    if (!nhtsaResponse.ok) throw new Error("NHTSA request failed");
    const payload = await nhtsaResponse.json();
    const result = payload.Results?.[0];
    if (!result || (!result.Make && !result.Model)) {
      return response.status(404).json({ error: "No encontramos información para ese VIN." });
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
    return response.status(502).json({ error: "El servicio de VIN no está disponible en este momento." });
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

app.get("/api/quote-requests", async (request, response) => {
  const shopName = request.user?.role === "shop" ? request.user.shopName : undefined;
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

  response.json({ quoteRequest: updated });
});

if (process.env.VERCEL !== "1") {
  app.use(express.static(path.join(projectDir, "dist")));
  app.get("*", (request, response, next) => {
    if (request.path.startsWith("/api/")) return next();
    response.sendFile(path.join(projectDir, "dist", "index.html"));
  });
}

export default app;
