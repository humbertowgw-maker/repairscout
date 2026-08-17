import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

// Sentry must be initialized before anything else — fails silently (no-op)
// if SENTRY_DSN is unset, same gate white-glove-backend/frontend already use.
let Sentry = null;
if (process.env.SENTRY_DSN) {
  Sentry = await import("@sentry/node");
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0.1,
    environment: process.env.NODE_ENV || "production",
  });
}

// The floor even without Sentry configured: an unhandled error gets logged
// loudly instead of silently vanishing. With Sentry configured, it also
// gets reported there.
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
  Sentry?.captureException(err);
});
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
  Sentry?.captureException(reason instanceof Error ? reason : new Error(String(reason)));
});

const { default: app } = await import("./app.js");

const port = Number(process.env.PORT || 4312);

app.listen(port, "0.0.0.0", () => {
  console.log(`RepairScout API running on http://localhost:${port}`);
});
