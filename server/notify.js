// Notification layer — email via Resend, SMS via Twilio
// Falls back to console simulation when keys are not configured

const RESEND_KEY = process.env.RESEND_API_KEY;
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM = process.env.TWILIO_FROM_NUMBER;

const APP_URL = process.env.APP_URL || "http://localhost:4311";

function formatCurrency(n) {
  return n != null ? `$${Number(n).toFixed(2)}` : "—";
}

function buildEmailBody({ quote, trackUrl, customer, language }) {
  const isEn = language !== "es";
  const q = quote.single ?? quote.combo;
  if (!q) return "";

  const greeting = isEn ? "Hi" : "Hola";
  const subject = isEn
    ? `Your repair quote is ready — ${customer.name}`
    : `Tu cotización de reparación está lista — ${customer.name}`;

  const approveLabel = isEn ? "Review &amp; Approve Quote" : "Ver y aprobar cotización";
  const trackLabel  = isEn ? "Track Your Repair Status" : "Seguimiento de tu reparación";

  const rows = (q.lineItems || []).map((item) =>
    `<tr>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;">${isEn ? item.nameEn : item.nameEs}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:center;">${item.qty} ${item.unit}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;">${formatCurrency(item.totalPrice)}</td>
    </tr>`
  ).join("\n");

  const partsCost   = formatCurrency(q.partsCost);
  const laborRange  = `${formatCurrency(q.laborLow)} – ${formatCurrency(q.laborHigh)}`;
  const totalRange  = `${formatCurrency(q.totalLow)} – ${formatCurrency(q.totalHigh)}`;

  return {
    subject,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body{font-family:system-ui,sans-serif;background:#f4f5f7;margin:0;padding:0}
  .wrap{max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.1)}
  .header{background:#1e3a5f;padding:28px 32px;color:#fff}
  .header h1{margin:0;font-size:22px;font-weight:700;letter-spacing:.5px}
  .header p{margin:4px 0 0;font-size:14px;opacity:.8}
  .body{padding:28px 32px}
  table{width:100%;border-collapse:collapse;font-size:14px}
  th{text-align:left;padding:8px 10px;background:#f8f9fa;font-size:12px;color:#666;text-transform:uppercase;letter-spacing:.5px}
  .total-row td{font-weight:700;font-size:15px;border-top:2px solid #1e3a5f}
  .btn{display:inline-block;background:#1e3a5f;color:#fff!important;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:700;font-size:15px;margin:24px 0 8px}
  .btn-outline{display:inline-block;border:2px solid #1e3a5f;color:#1e3a5f!important;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px;margin:0 0 24px}
  .footer{background:#f4f5f7;padding:16px 32px;font-size:12px;color:#888;text-align:center}
</style></head>
<body>
<div class="wrap">
  <div class="header">
    <h1>RepairScout</h1>
    <p>${isEn ? "Your vehicle repair quote" : "Tu cotización de reparación vehicular"}</p>
  </div>
  <div class="body">
    <p style="margin-top:0">${greeting} ${customer.name},</p>
    <p>${isEn
      ? "Your shop has prepared an itemized parts &amp; labor quote for your vehicle."
      : "Tu taller ha preparado una cotización detallada de piezas y mano de obra para tu vehículo."}</p>

    <table>
      <thead>
        <tr>
          <th>${isEn ? "Part / Service" : "Pieza / Servicio"}</th>
          <th style="text-align:center">${isEn ? "Qty" : "Cant."}</th>
          <th style="text-align:right">${isEn ? "Price" : "Precio"}</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        <tr>
          <td colspan="2" style="padding:6px 10px;color:#555">${isEn ? "Parts subtotal" : "Subtotal piezas"}</td>
          <td style="padding:6px 10px;text-align:right">${partsCost}</td>
        </tr>
        <tr>
          <td colspan="2" style="padding:6px 10px;color:#555">${isEn ? "Labor (estimated)" : "Mano de obra (estimada)"}</td>
          <td style="padding:6px 10px;text-align:right">${laborRange}</td>
        </tr>
        <tr class="total-row">
          <td colspan="2" style="padding:10px 10px">${isEn ? "Estimated Total" : "Total estimado"}</td>
          <td style="padding:10px 10px;text-align:right">${totalRange}</td>
        </tr>
      </tbody>
    </table>

    <p style="font-size:12px;color:#888;margin:12px 0 24px">
      ${isEn
        ? "Final price may vary based on vehicle inspection findings."
        : "El precio final puede variar según los resultados de la inspección del vehículo."}
    </p>

    <a class="btn" href="${trackUrl}">${approveLabel}</a><br>
    <a class="btn-outline" href="${trackUrl}">${trackLabel}</a>
  </div>
  <div class="footer">RepairScout · ${isEn ? "Powered by trusted local shops" : "Impulsado por talleres locales de confianza"}</div>
</div>
</body>
</html>`,
  };
}

function buildSmsBody({ quote, trackUrl, customer, language }) {
  const isEn = language !== "es";
  const q = quote.single ?? quote.combo;
  const total = q ? `${formatCurrency(q.totalLow)}–${formatCurrency(q.totalHigh)}` : "—";
  if (isEn) {
    return `Hi ${customer.name}! Your RepairScout repair quote is ready: ${total}. Review & approve here: ${trackUrl}`;
  }
  return `Hola ${customer.name}! Tu cotización de RepairScout está lista: ${total}. Revisa y aprueba aquí: ${trackUrl}`;
}

async function sendEmail({ to, subject, html }) {
  if (!RESEND_KEY) {
    console.log(`[notify] Email simulation → ${to}: "${subject}"`);
    return { simulated: true };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_KEY}`,
    },
    body: JSON.stringify({
      from: "RepairScout <quotes@repairscout.app>",
      to: [to],
      subject,
      html,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error ${res.status}: ${err}`);
  }
  return res.json();
}

async function sendSms({ to, body }) {
  if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM) {
    console.log(`[notify] SMS simulation → ${to}: "${body}"`);
    return { simulated: true };
  }
  const encoded = new URLSearchParams({ To: to, From: TWILIO_FROM, Body: body });
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: encoded.toString(),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Twilio error ${res.status}: ${err}`);
  }
  return res.json();
}

export async function sendQuoteNotification({ quote, customer, quoteId, token, language = "es" }) {
  const trackUrl = `${APP_URL}/track/${token}`;
  const results = {};

  const emailBody = buildEmailBody({ quote, trackUrl, customer, language });
  const smsText   = buildSmsBody({ quote, trackUrl, customer, language });

  if (customer.email) {
    try {
      results.email = await sendEmail({ to: customer.email, ...emailBody });
    } catch (e) {
      console.error("[notify] email error:", e.message);
      results.emailError = e.message;
    }
  }

  if (customer.phone) {
    const normalized = customer.phone.replace(/\D/g, "");
    const e164 = normalized.startsWith("1") ? `+${normalized}` : `+1${normalized}`;
    try {
      results.sms = await sendSms({ to: e164, body: smsText });
    } catch (e) {
      console.error("[notify] SMS error:", e.message);
      results.smsError = e.message;
    }
  }

  return results;
}
