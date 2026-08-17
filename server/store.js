import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.VERCEL === "1"
  ? "/tmp/repairscout"
  : path.join(currentDir, "data");
const dataFile = path.join(dataDir, "repairscout.json");

const initialData = {
  quoteRequests: [],
  users: [],
  vehicles: [],
  diagnoses: [],
  itemizedQuotes: [],
  phoneVerifications: {},
  pendingDiagnoses: {},
  partsInquiries: {},
  plans: [],
  emailVerifications: {},
  passwordResets: {},
  auditLogs: [],
};

async function ensureStore() {
  await fs.mkdir(dataDir, { recursive: true });

  try {
    await fs.access(dataFile);
  } catch {
    await fs.writeFile(dataFile, JSON.stringify(initialData, null, 2));
  }
}

export async function readStore() {
  await ensureStore();
  const contents = await fs.readFile(dataFile, "utf8");
  return { ...initialData, ...JSON.parse(contents) };
}

// Concurrent updateStore calls (e.g. a route that fires off an audit-log write
// and a token-creation write without awaiting either) used to race on the same
// dataFile.tmp path and could corrupt it. Serialize all writes through one
// promise chain so each write sees the previous one's result before starting.
let writeQueue = Promise.resolve();

export async function updateStore(update) {
  const result = writeQueue.then(async () => {
    const current = await readStore();
    const next = update(current);
    const temporaryFile = `${dataFile}.tmp`;

    await fs.writeFile(temporaryFile, JSON.stringify(next, null, 2));
    await fs.rename(temporaryFile, dataFile);

    return next;
  });
  // Keep the queue alive even if this write rejects — callers still see their
  // own rejection via `result`, but subsequent writes aren't blocked forever.
  writeQueue = result.catch(() => {});
  return result;
}
