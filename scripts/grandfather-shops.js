#!/usr/bin/env node
// One-time migration: run once, immediately after deploying the shop-plan paywall,
// before any new shop can sign up under the new flow. Any shop_profiles row with no
// plan_id at the moment this runs is by definition a pre-existing shop — it gets Shop
// Pro for free ("grandfathered") so nothing changes for real shops already using
// RepairScout. Shops created after this runs start with plan_id unset and must choose
// a plan. Safe to run only once — running it again would also grandfather any shop
// that legitimately never finished checkout, so don't re-run casually.
import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required — this script only makes sense against the real Postgres database.");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
});

const { rows: totalRows } = await pool.query("select count(*)::int as count from shop_profiles");
const { rows: pendingRows } = await pool.query("select count(*)::int as count from shop_profiles where plan_id is null");

console.log(`shop_profiles total: ${totalRows[0].count}`);
console.log(`shop_profiles with no plan_id (will be grandfathered): ${pendingRows[0].count}`);

if (!process.argv.includes("--confirm")) {
  console.log("\nDry run only. Re-run with --confirm to actually grandfather these shops onto Shop Pro.");
  await pool.end();
  process.exit(0);
}

const result = await pool.query(
  `update shop_profiles
     set plan_id = 'shop-pro', subscription_status = 'grandfathered', updated_at = now()
   where plan_id is null
   returning id, shop_name`,
);

console.log(`Grandfathered ${result.rowCount} shop(s) onto Shop Pro:`);
for (const row of result.rows) console.log(`  - ${row.shop_name} (${row.id})`);

await pool.end();
