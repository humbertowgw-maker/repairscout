import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

// No monitoring service is wired up yet (no Sentry/uptime pinger configured) —
// these handlers are the floor: an unhandled error gets logged loudly instead
// of silently vanishing. Wiring a real alerting service is a separate,
// external-dependency decision, not something this can fully solve alone.
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});

const { default: app } = await import("./app.js");

const port = Number(process.env.PORT || 4312);

app.listen(port, "0.0.0.0", () => {
  console.log(`RepairScout API running on http://localhost:${port}`);
});
