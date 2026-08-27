#!/usr/bin/env node
import "dotenv/config";

const apiUrl = String(process.env.REPAIRSCOUT_API_URL || "https://repairscout-smoky.vercel.app").replace(/\/$/, "");
const token = process.env.LOCAL_WORKER_TOKEN;
const workerId = process.env.REPAIRSCOUT_WORKER_ID || `repairscout-${process.env.HOSTNAME || "local"}`;
const pollMs = Math.max(2_000, Number(process.env.REPAIRSCOUT_WORKER_POLL_MS || 5_000));
const brainOsHealthUrl = process.env.BRAINOS_HEALTH_URL || "http://127.0.0.1:8000/api/health";

if (!token || token.length < 24) throw new Error("LOCAL_WORKER_TOKEN must be configured with at least 24 characters.");

process.env.AI_PROVIDER_ORDER = "ollama";
process.env.OLLAMA_DIAGNOSIS_ENABLED = "true";
const { diagnoseVehicle } = await import("../server/diagnosis.js");

async function api(path, body) {
  const response = await fetch(`${apiUrl}${path}`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${path} returned ${response.status}: ${(await response.text()).slice(0, 300)}`);
  return response.json();
}

async function runOnce() {
  const health = await fetch(brainOsHealthUrl, { signal: AbortSignal.timeout(3_000) }).catch(() => null);
  if (!health?.ok) return false;
  const { job } = await api("/api/local-worker/claim", { workerId });
  if (!job) return false;
  try {
    const result = await diagnoseVehicle({
      vehicle: job.vehicle || {}, mileage: job.mileage, obdCodes: job.obdCodes || [], description: job.description,
      zip: job.zip, language: job.language || "es",
    });
    if (result.source !== "ollama") throw new Error(`Local model unavailable; received ${result.source}.`);
    await api(`/api/local-worker/jobs/${encodeURIComponent(job.id)}/complete`, { workerId, result });
  } catch (error) {
    await api(`/api/local-worker/jobs/${encodeURIComponent(job.id)}/fail`, { workerId, error: error?.message || String(error) });
  }
  return true;
}

console.log(`[repairscout-worker] ${workerId} polling ${apiUrl}; one job at a time`);
for (;;) {
  try {
    const worked = await runOnce();
    if (!worked) await new Promise((resolve) => setTimeout(resolve, pollMs));
  } catch (error) {
    console.error(`[repairscout-worker] ${error?.message || error}`);
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}
