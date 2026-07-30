import pg from "pg";

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
});

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed" });
  }
  if (!process.env.DATABASE_URL) {
    return response.status(503).json({ error: "Portfolio metrics are not configured" });
  }

  try {
    const result = await pool.query(`
      select
        count(*) filter (where created_at >= now() - interval '7 days')::int
          as verified_quote_requests_weekly,
        count(*)::int as quote_requests_total,
        count(*) filter (
          where status in ('Cotizada', 'Cita solicitada')
          and created_at >= now() - interval '7 days'
        )::int as progressed_quote_requests_weekly,
        max(created_at) as latest_quote_request_at
      from quote_requests
    `);
    const metrics = result.rows[0] || {};
    response.setHeader("Cache-Control", "public, max-age=0, s-maxage=300, stale-while-revalidate=600");
    return response.status(200).json({
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
    return response.status(500).json({ error: "Unable to read portfolio metrics" });
  }
}
