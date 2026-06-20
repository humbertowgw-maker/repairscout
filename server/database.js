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
