import pg from "pg";
import { readStore, updateStore } from "./store.js";

const { Pool } = pg;
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
    })
  : null;

let initialized = false;

async function ensureDatabase() {
  if (!pool || initialized) return;

  await pool.query(`
    create table if not exists users (
      id uuid primary key,
      name text not null,
      email text unique not null,
      password_hash text not null,
      role text not null check (role in ('driver', 'shop')),
      shop_name text,
      created_at timestamptz not null default now()
    );

    create table if not exists vehicles (
      id uuid primary key,
      user_id uuid not null references users(id) on delete cascade,
      vin text,
      year text,
      make text,
      model text,
      trim text,
      engine text,
      mileage text,
      created_at timestamptz not null default now()
    );

    create table if not exists diagnoses (
      id uuid primary key,
      user_id uuid references users(id) on delete set null,
      vehicle jsonb not null default '{}'::jsonb,
      description text not null,
      zip text not null,
      result jsonb not null,
      created_at timestamptz not null default now()
    );

    create table if not exists quote_requests (
      id uuid primary key,
      user_id uuid references users(id) on delete set null,
      shop_name text not null,
      customer text not null,
      vehicle text not null,
      issue text not null,
      zip text not null,
      estimate text not null,
      diagnosis_summary text,
      status text not null,
      initials text,
      created_at timestamptz not null default now()
    );

    create table if not exists shop_profiles (
      id uuid primary key,
      user_id uuid unique references users(id) on delete cascade,
      shop_name text not null,
      contact_name text,
      phone text,
      email text,
      address text,
      city text,
      state text,
      zip text,
      specialties text[] not null default '{}',
      labor_rate numeric(8,2),
      warranty text,
      availability text,
      claimed boolean not null default false,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists itemized_quotes (
      id uuid primary key,
      token text unique not null,
      quote_request_id uuid references quote_requests(id) on delete set null,
      user_id uuid references users(id) on delete set null,
      customer_name text not null,
      customer_email text,
      customer_phone text,
      vehicle jsonb not null default '{}',
      diagnosis jsonb not null default '{}',
      quote_combo jsonb not null default '{}',
      quote_single jsonb not null default '{}',
      repair_stage text not null default 'Quote Sent',
      customer_approved boolean not null default false,
      approved_at timestamptz,
      sent_at timestamptz,
      created_at timestamptz not null default now()
    );

    create table if not exists phone_verifications (
      phone text primary key,
      code text not null,
      code_expires_at timestamptz not null,
      verified boolean not null default false,
      used_free boolean not null default false,
      free_used_at timestamptz,
      created_at timestamptz not null default now()
    );

    create table if not exists pending_diagnoses (
      id uuid primary key,
      phone text not null,
      vehicle jsonb not null default '{}',
      mileage text,
      description text not null,
      zip text not null,
      language text not null default 'es',
      stripe_session_id text,
      paid boolean not null default false,
      paid_at timestamptz,
      result jsonb,
      completed_at timestamptz,
      created_at timestamptz not null default now()
    );

    create table if not exists parts_inquiries (
      id uuid primary key,
      batch_id uuid not null,
      part_name text not null,
      vehicle text,
      store_name text not null,
      store_phone text not null,
      bland_call_id text,
      status text not null default 'pending',
      has_part boolean,
      quantity int,
      price text,
      pickup_today boolean,
      transcript text,
      summary text,
      created_at timestamptz not null default now(),
      completed_at timestamptz
    );

    create index if not exists parts_inquiries_batch_id on parts_inquiries(batch_id);
  `);

  initialized = true;
}

function mapQuoteRow(row) {
  return {
    id: row.id,
    userId: row.user_id,
    shopName: row.shop_name,
    customer: row.customer,
    vehicle: row.vehicle,
    issue: row.issue,
    zip: row.zip,
    estimate: row.estimate,
    diagnosisSummary: row.diagnosis_summary,
    status: row.status,
    initials: row.initials,
    createdAt: row.created_at,
  };
}

function mapShopProfileRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    shopName: row.shop_name,
    contactName: row.contact_name,
    phone: row.phone,
    email: row.email,
    address: row.address,
    city: row.city,
    state: row.state,
    zip: row.zip,
    specialties: row.specialties || [],
    laborRate: row.labor_rate === null || row.labor_rate === undefined ? "" : String(row.labor_rate),
    warranty: row.warranty,
    availability: row.availability,
    claimed: row.claimed,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function databaseMode() {
  return pool ? "postgres" : "local";
}

export async function findUserByEmail(email) {
  if (pool) {
    await ensureDatabase();
    const result = await pool.query("select * from users where email = $1 limit 1", [email]);
    return result.rows[0] || null;
  }
  const store = await readStore();
  return (store.users || []).find((user) => user.email === email) || null;
}

export async function findUserById(id) {
  if (pool) {
    await ensureDatabase();
    const result = await pool.query(
      "select id, name, email, role, shop_name, created_at from users where id = $1 limit 1",
      [id],
    );
    const user = result.rows[0];
    return user
      ? { ...user, shopName: user.shop_name, createdAt: user.created_at }
      : null;
  }
  const store = await readStore();
  const user = (store.users || []).find((item) => item.id === id);
  if (!user) return null;
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

export async function createUser(user) {
  if (pool) {
    await ensureDatabase();
    await pool.query(
      `insert into users (id, name, email, password_hash, role, shop_name, created_at)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [user.id, user.name, user.email, user.passwordHash, user.role, user.shopName, user.createdAt],
    );
    return findUserById(user.id);
  }

  await updateStore((store) => ({
    ...store,
    users: [...(store.users || []), user],
  }));
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

export async function getShopProfile(userId) {
  if (pool) {
    await ensureDatabase();
    const result = await pool.query("select * from shop_profiles where user_id = $1 limit 1", [userId]);
    return mapShopProfileRow(result.rows[0]);
  }
  const store = await readStore();
  return (store.shopProfiles || []).find((profile) => profile.userId === userId) || null;
}

export async function upsertShopProfile(profile) {
  if (pool) {
    await ensureDatabase();
    const result = await pool.query(
      `insert into shop_profiles
       (id, user_id, shop_name, contact_name, phone, email, address, city, state, zip, specialties, labor_rate, warranty, availability, claimed, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       on conflict (user_id) do update set
         shop_name = excluded.shop_name,
         contact_name = excluded.contact_name,
         phone = excluded.phone,
         email = excluded.email,
         address = excluded.address,
         city = excluded.city,
         state = excluded.state,
         zip = excluded.zip,
         specialties = excluded.specialties,
         labor_rate = excluded.labor_rate,
         warranty = excluded.warranty,
         availability = excluded.availability,
         claimed = excluded.claimed,
         updated_at = excluded.updated_at
       returning *`,
      [
        profile.id,
        profile.userId,
        profile.shopName,
        profile.contactName,
        profile.phone,
        profile.email,
        profile.address,
        profile.city,
        profile.state,
        profile.zip,
        profile.specialties,
        profile.laborRate === "" || profile.laborRate === null || profile.laborRate === undefined ? null : Number(profile.laborRate),
        profile.warranty,
        profile.availability,
        profile.claimed,
        profile.createdAt,
        profile.updatedAt,
      ],
    );
    return mapShopProfileRow(result.rows[0]);
  }

  let savedProfile;
  await updateStore((store) => {
    const existing = store.shopProfiles || [];
    const current = existing.find((item) => item.userId === profile.userId);
    savedProfile = {
      ...current,
      ...profile,
      id: current?.id || profile.id,
      createdAt: current?.createdAt || profile.createdAt,
    };
    return {
      ...store,
      shopProfiles: [savedProfile, ...existing.filter((item) => item.userId !== profile.userId)],
    };
  });
  return savedProfile;
}

export async function createVehicle(vehicle) {
  if (pool) {
    await ensureDatabase();
    await pool.query(
      `insert into vehicles (id, user_id, vin, year, make, model, trim, engine, mileage, created_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [vehicle.id, vehicle.userId, vehicle.vin, vehicle.year, vehicle.make, vehicle.model, vehicle.trim, vehicle.engine, vehicle.mileage, vehicle.createdAt],
    );
    return vehicle;
  }
  await updateStore((store) => ({
    ...store,
    vehicles: [vehicle, ...(store.vehicles || [])],
  }));
  return vehicle;
}

export async function listVehicles(userId) {
  if (pool) {
    await ensureDatabase();
    const result = await pool.query(
      "select id, user_id, vin, year, make, model, trim, engine, mileage, created_at from vehicles where user_id = $1 order by created_at desc",
      [userId],
    );
    return result.rows.map((row) => ({
      ...row,
      userId: row.user_id,
      createdAt: row.created_at,
    }));
  }
  const store = await readStore();
  return (store.vehicles || []).filter((vehicle) => vehicle.userId === userId);
}

export async function saveDiagnosis(diagnosis) {
  if (pool) {
    await ensureDatabase();
    await pool.query(
      `insert into diagnoses (id, user_id, vehicle, description, zip, result, created_at)
       values ($1,$2,$3,$4,$5,$6,$7)`,
      [diagnosis.id, diagnosis.userId, diagnosis.vehicle, diagnosis.description, diagnosis.zip, diagnosis.result, diagnosis.createdAt],
    );
    return diagnosis;
  }
  await updateStore((store) => ({
    ...store,
    diagnoses: [diagnosis, ...(store.diagnoses || [])].slice(0, 200),
  }));
  return diagnosis;
}

export async function createQuoteRequest(quote) {
  if (pool) {
    await ensureDatabase();
    await pool.query(
      `insert into quote_requests
       (id, user_id, shop_name, customer, vehicle, issue, zip, estimate, diagnosis_summary, status, initials, created_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [quote.id, quote.userId, quote.shopName, quote.customer, quote.vehicle, quote.issue, quote.zip, quote.estimate, quote.diagnosisSummary, quote.status, quote.initials, quote.createdAt],
    );
    return quote;
  }
  await updateStore((store) => ({
    ...store,
    quoteRequests: [quote, ...(store.quoteRequests || [])].slice(0, 100),
  }));
  return quote;
}

export async function listQuoteRequests(shopName) {
  if (pool) {
    await ensureDatabase();
    const values = [];
    let where = "";
    if (shopName) {
      values.push(shopName);
      where = "where shop_name = $1";
    }
    const result = await pool.query(
      `select * from quote_requests ${where} order by created_at desc limit 100`,
      values,
    );
    return result.rows.map(mapQuoteRow);
  }
  const store = await readStore();
  return (store.quoteRequests || []).filter(
    (quote) => !shopName || quote.shopName === shopName,
  );
}

// ── Itemized quotes ────────────────────────────────────────────────────────

function mapIQRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    token: row.token,
    quoteRequestId: row.quote_request_id,
    userId: row.user_id,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    customerPhone: row.customer_phone,
    vehicle: row.vehicle || {},
    diagnosis: row.diagnosis || {},
    quoteCombo: row.quote_combo || {},
    quoteSingle: row.quote_single || {},
    repairStage: row.repair_stage,
    customerApproved: row.customer_approved,
    approvedAt: row.approved_at,
    sentAt: row.sent_at,
    createdAt: row.created_at,
  };
}

export async function createItemizedQuote(q) {
  if (pool) {
    await ensureDatabase();
    const result = await pool.query(
      `insert into itemized_quotes
       (id, token, quote_request_id, user_id, customer_name, customer_email, customer_phone,
        vehicle, diagnosis, quote_combo, quote_single, repair_stage, sent_at, created_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       returning *`,
      [
        q.id, q.token, q.quoteRequestId || null, q.userId || null,
        q.customerName, q.customerEmail || null, q.customerPhone || null,
        JSON.stringify(q.vehicle || {}), JSON.stringify(q.diagnosis || {}),
        JSON.stringify(q.quoteCombo || {}), JSON.stringify(q.quoteSingle || {}),
        q.repairStage || "Quote Sent",
        q.sentAt || new Date().toISOString(), q.createdAt || new Date().toISOString(),
      ],
    );
    return mapIQRow(result.rows[0]);
  }
  await updateStore((store) => ({
    ...store,
    itemizedQuotes: [q, ...(store.itemizedQuotes || [])].slice(0, 200),
  }));
  return q;
}

export async function getItemizedQuoteByToken(token) {
  if (pool) {
    await ensureDatabase();
    const result = await pool.query("select * from itemized_quotes where token = $1 limit 1", [token]);
    return mapIQRow(result.rows[0]);
  }
  const store = await readStore();
  return (store.itemizedQuotes || []).find((q) => q.token === token) || null;
}

export async function updateRepairStage({ id, stage }) {
  if (pool) {
    await ensureDatabase();
    const result = await pool.query(
      "update itemized_quotes set repair_stage = $2 where id = $1 returning *",
      [id, stage],
    );
    return mapIQRow(result.rows[0]);
  }
  let updated = null;
  await updateStore((store) => ({
    ...store,
    itemizedQuotes: (store.itemizedQuotes || []).map((q) => {
      if (q.id !== id) return q;
      updated = { ...q, repairStage: stage };
      return updated;
    }),
  }));
  return updated;
}

export async function listSentQuotes(userId) {
  if (pool) {
    await ensureDatabase();
    const values = [];
    let where = "";
    if (userId) { values.push(userId); where = "where user_id = $1"; }
    const result = await pool.query(
      `select * from itemized_quotes ${where} order by created_at desc limit 100`,
      values,
    );
    return result.rows.map(mapIQRow);
  }
  const store = await readStore();
  const all = store.itemizedQuotes || [];
  return userId ? all.filter((q) => q.userId === userId) : all;
}

export async function approveQuoteByToken(token) {
  const now = new Date().toISOString();
  if (pool) {
    await ensureDatabase();
    const result = await pool.query(
      "update itemized_quotes set customer_approved = true, approved_at = $2, repair_stage = 'Approved' where token = $1 returning *",
      [token, now],
    );
    return mapIQRow(result.rows[0]);
  }
  let updated = null;
  await updateStore((store) => ({
    ...store,
    itemizedQuotes: (store.itemizedQuotes || []).map((q) => {
      if (q.token !== token) return q;
      updated = { ...q, customerApproved: true, approvedAt: now, repairStage: "Approved" };
      return updated;
    }),
  }));
  return updated;
}

export async function updateQuoteRequestStatus({ id, shopName, status }) {
  if (pool) {
    await ensureDatabase();
    const values = [id, status];
    let where = "where id = $1";
    if (shopName) {
      values.push(shopName);
      where += " and shop_name = $3";
    }
    const result = await pool.query(
      `update quote_requests set status = $2 ${where} returning *`,
      values,
    );
    return mapQuoteRow(result.rows[0]);
  }

  let updatedQuote = null;
  await updateStore((store) => ({
    ...store,
    quoteRequests: (store.quoteRequests || []).map((quote) => {
      if (quote.id !== id || (shopName && quote.shopName !== shopName)) return quote;
      updatedQuote = { ...quote, status };
      return updatedQuote;
    }),
  }));
  return updatedQuote;
}

// ── Phone OTP ────────────────────────────────────────────────────────────────

export async function upsertPhoneVerification({ phone, code, expiresAt }) {
  if (pool) {
    await ensureDatabase();
    await pool.query(
      `insert into phone_verifications (phone, code, code_expires_at, verified, used_free)
       values ($1, $2, $3, false, false)
       on conflict (phone) do update
         set code = excluded.code,
             code_expires_at = excluded.code_expires_at,
             verified = false`,
      [phone, code, expiresAt],
    );
    return;
  }
  await updateStore((store) => ({
    ...store,
    phoneVerifications: {
      ...(store.phoneVerifications || {}),
      [phone]: { phone, code, expiresAt, verified: false, usedFree: (store.phoneVerifications?.[phone]?.usedFree ?? false) },
    },
  }));
}

export async function getPhoneVerification(phone) {
  if (pool) {
    await ensureDatabase();
    const r = await pool.query("select * from phone_verifications where phone = $1", [phone]);
    if (!r.rows[0]) return null;
    const row = r.rows[0];
    return {
      phone: row.phone,
      code: row.code,
      codeExpiresAt: row.code_expires_at,
      verified: row.verified,
      usedFree: row.used_free,
    };
  }
  const store = await readStore();
  return (store.phoneVerifications || {})[phone] || null;
}

export async function markPhoneVerified(phone) {
  if (pool) {
    await ensureDatabase();
    await pool.query("update phone_verifications set verified = true where phone = $1", [phone]);
    return;
  }
  await updateStore((store) => ({
    ...store,
    phoneVerifications: {
      ...(store.phoneVerifications || {}),
      [phone]: { ...(store.phoneVerifications?.[phone] || {}), verified: true },
    },
  }));
}

export async function markPhoneUsedFree(phone) {
  const now = new Date().toISOString();
  if (pool) {
    await ensureDatabase();
    await pool.query(
      "update phone_verifications set used_free = true, free_used_at = $2 where phone = $1",
      [phone, now],
    );
    return;
  }
  await updateStore((store) => ({
    ...store,
    phoneVerifications: {
      ...(store.phoneVerifications || {}),
      [phone]: { ...(store.phoneVerifications?.[phone] || {}), usedFree: true, freeUsedAt: now },
    },
  }));
}

// ── Pending diagnoses (Stripe flow) ──────────────────────────────────────────

export async function createPendingDiagnosis({ id, phone, vehicle, mileage, description, zip, language }) {
  if (pool) {
    await ensureDatabase();
    await pool.query(
      `insert into pending_diagnoses (id, phone, vehicle, mileage, description, zip, language)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [id, phone, JSON.stringify(vehicle), mileage, description, zip, language],
    );
    return { id, phone, vehicle, mileage, description, zip, language, paid: false, result: null };
  }
  const record = { id, phone, vehicle, mileage, description, zip, language, paid: false, result: null, createdAt: new Date().toISOString() };
  await updateStore((store) => ({
    ...store,
    pendingDiagnoses: { ...(store.pendingDiagnoses || {}), [id]: record },
  }));
  return record;
}

export async function getPendingDiagnosis(id) {
  if (pool) {
    await ensureDatabase();
    const r = await pool.query("select * from pending_diagnoses where id = $1", [id]);
    if (!r.rows[0]) return null;
    const row = r.rows[0];
    return {
      id: row.id, phone: row.phone,
      vehicle: row.vehicle, mileage: row.mileage,
      description: row.description, zip: row.zip, language: row.language,
      stripeSessionId: row.stripe_session_id,
      paid: row.paid, paidAt: row.paid_at,
      result: row.result, completedAt: row.completed_at,
      createdAt: row.created_at,
    };
  }
  const store = await readStore();
  return (store.pendingDiagnoses || {})[id] || null;
}

export async function setPendingDiagnosisPaid(id, stripeSessionId) {
  const now = new Date().toISOString();
  if (pool) {
    await ensureDatabase();
    await pool.query(
      "update pending_diagnoses set paid = true, paid_at = $2, stripe_session_id = $3 where id = $1",
      [id, now, stripeSessionId],
    );
    return;
  }
  await updateStore((store) => ({
    ...store,
    pendingDiagnoses: {
      ...(store.pendingDiagnoses || {}),
      [id]: { ...(store.pendingDiagnoses?.[id] || {}), paid: true, paidAt: now, stripeSessionId },
    },
  }));
}

export async function setPendingDiagnosisResult(id, result) {
  const now = new Date().toISOString();
  if (pool) {
    await ensureDatabase();
    await pool.query(
      "update pending_diagnoses set result = $2, completed_at = $3 where id = $1",
      [id, JSON.stringify(result), now],
    );
    return;
  }
  await updateStore((store) => ({
    ...store,
    pendingDiagnoses: {
      ...(store.pendingDiagnoses || {}),
      [id]: { ...(store.pendingDiagnoses?.[id] || {}), result, completedAt: now },
    },
  }));
}

// ── Parts inquiries (Bland.ai call tracking) ──────────────────────────────────

function mapInquiryRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    batchId: row.batch_id,
    partName: row.part_name,
    vehicle: row.vehicle,
    storeName: row.store_name,
    storePhone: row.store_phone,
    blandCallId: row.bland_call_id,
    status: row.status,
    hasPart: row.has_part,
    quantity: row.quantity,
    price: row.price,
    pickupToday: row.pickup_today,
    transcript: row.transcript,
    summary: row.summary,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

export async function createPartsInquiries(records) {
  if (pool) {
    await ensureDatabase();
    const inserted = [];
    for (const r of records) {
      const res = await pool.query(
        `insert into parts_inquiries (id, batch_id, part_name, vehicle, store_name, store_phone, status)
         values ($1,$2,$3,$4,$5,$6,'pending') returning *`,
        [r.id, r.batchId, r.partName, r.vehicle || null, r.storeName, r.storePhone],
      );
      inserted.push(mapInquiryRow(res.rows[0]));
    }
    return inserted;
  }
  await updateStore((store) => {
    const next = { ...(store.partsInquiries || {}) };
    for (const r of records) next[r.id] = { ...r, status: "pending" };
    return { ...store, partsInquiries: next };
  });
  return records.map((r) => ({ ...r, status: "pending" }));
}

export async function updateBlandCallId(inquiryId, blandCallId) {
  if (pool) {
    await ensureDatabase();
    await pool.query(
      "update parts_inquiries set bland_call_id=$2, status='calling' where id=$1",
      [inquiryId, blandCallId],
    );
    return;
  }
  await updateStore((store) => ({
    ...store,
    partsInquiries: {
      ...(store.partsInquiries || {}),
      [inquiryId]: { ...(store.partsInquiries?.[inquiryId] || {}), blandCallId, status: "calling" },
    },
  }));
}

export async function completePartsInquiry(inquiryId, { status, hasPart, quantity, price, pickupToday, transcript, summary }) {
  const now = new Date().toISOString();
  if (pool) {
    await ensureDatabase();
    await pool.query(
      `update parts_inquiries set status=$2, has_part=$3, quantity=$4, price=$5,
       pickup_today=$6, transcript=$7, summary=$8, completed_at=$9 where id=$1`,
      [inquiryId, status, hasPart ?? null, quantity ?? null, price ?? null,
       pickupToday ?? null, transcript || null, summary || null, now],
    );
    return;
  }
  await updateStore((store) => ({
    ...store,
    partsInquiries: {
      ...(store.partsInquiries || {}),
      [inquiryId]: {
        ...(store.partsInquiries?.[inquiryId] || {}),
        status, hasPart, quantity, price, pickupToday, transcript, summary, completedAt: now,
      },
    },
  }));
}

export async function getPartsInquiryBatch(batchId) {
  if (pool) {
    await ensureDatabase();
    const res = await pool.query(
      "select * from parts_inquiries where batch_id=$1 order by created_at",
      [batchId],
    );
    return res.rows.map(mapInquiryRow);
  }
  const store = await readStore();
  return Object.values(store.partsInquiries || {}).filter((r) => r.batchId === batchId);
}

export async function getPartsInquiryById(inquiryId) {
  if (pool) {
    await ensureDatabase();
    const res = await pool.query("select * from parts_inquiries where id=$1", [inquiryId]);
    return mapInquiryRow(res.rows[0]);
  }
  const store = await readStore();
  return store.partsInquiries?.[inquiryId] || null;
}
