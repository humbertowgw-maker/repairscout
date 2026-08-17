// Notification layer — email via Resend, SMS via Twilio
// Falls back to console simulation when keys are not configured

const RESEND_KEY  = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM_EMAIL || "repairscout@whitegwireless.com";
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
      from: `RepairScout <${RESEND_FROM}>`,
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

export async function sendShopApprovalNotification({ shopPhone, shopEmail, customerName, vehicle, appUrl }) {
  const msg = `RepairScout: ${customerName} approved their repair quote for ${vehicle}. Log in to create the work order: ${appUrl}`;
  const results = {};

  if (shopPhone) {
    const normalized = shopPhone.replace(/\D/g, "");
    const e164 = normalized.startsWith("1") ? `+${normalized}` : `+1${normalized}`;
    try { results.sms = await sendSms({ to: e164, body: msg }); }
    catch (e) { console.error("[notify] shop sms error:", e.message); results.shopSmsError = e.message; }
  }

  if (shopEmail) {
    const html = `<p style="font-family:system-ui;font-size:15px">${msg.replace(appUrl, `<a href="${appUrl}">${appUrl}</a>`)}</p>`;
    try { results.email = await sendEmail({ to: shopEmail, subject: `Quote approved: ${customerName} — ${vehicle}`, html }); }
    catch (e) { console.error("[notify] shop email error:", e.message); results.shopEmailError = e.message; }
  }

  return results;
}

const STAGE_MESSAGES = {
  "Parts Ordered": {
    en: (v) => `RepairScout update: Parts have been ordered for your ${v}. We'll let you know when they arrive.`,
    es: (v) => `Actualización RepairScout: Las piezas para tu ${v} han sido pedidas. Te avisaremos cuando lleguen.`,
  },
  "Parts In Transit": {
    en: (v) => `RepairScout update: Parts for your ${v} are on the way — we'll start repairs once they arrive.`,
    es: (v) => `Actualización RepairScout: Las piezas para tu ${v} están en camino. Empezaremos las reparaciones cuando lleguen.`,
  },
  "Parts Arrived": {
    en: (v) => `RepairScout update: Parts for your ${v} have arrived. We're starting your repair soon!`,
    es: (v) => `Actualización RepairScout: Las piezas para tu ${v} llegaron. ¡Comenzaremos tu reparación pronto!`,
  },
  "In Progress": {
    en: (v) => `RepairScout update: Your ${v} repair is now in progress. We'll let you know when it's done!`,
    es: (v) => `Actualización RepairScout: La reparación de tu ${v} está en proceso. ¡Te avisaremos cuando esté lista!`,
  },
  "Quality Check": {
    en: (v) => `RepairScout update: Your ${v} is in quality inspection — almost done!`,
    es: (v) => `Actualización RepairScout: Tu ${v} está en inspección de calidad. ¡Casi lista!`,
  },
  "Ready for Pickup": {
    en: (v) => `RepairScout: Your ${v} is READY FOR PICKUP! 🎉 Come by during business hours.`,
    es: (v) => `RepairScout: ¡Tu ${v} está LISTA PARA RECOGER! 🎉 Pasa en horario de atención.`,
  },
  "Completed": {
    en: (v) => `RepairScout: Your ${v} repair is complete. Thank you for trusting us!`,
    es: (v) => `RepairScout: La reparación de tu ${v} está completa. ¡Gracias por confiar en nosotros!`,
  },
};

export async function sendStageUpdateNotification({ customerEmail, customerPhone, customerName, vehicle, stage, trackUrl, surveyUrl, lang = "es" }) {
  const msgFn = STAGE_MESSAGES[stage];
  if (!msgFn) return {};

  const isEn = lang === "en";
  const surveyPrompt = isEn ? "Did this fix it?" : "¿Esto resolvió tu problema?";
  const smsBody = msgFn[isEn ? "en" : "es"](vehicle)
    + (trackUrl ? ` Track: ${trackUrl}` : "")
    + (surveyUrl ? ` ${surveyPrompt} ${surveyUrl}` : "");
  const subject = isEn ? `Repair update: ${stage} — ${vehicle}` : `Actualización de reparación: ${stage} — ${vehicle}`;
  const html = `<div style="font-family:system-ui;max-width:520px;margin:0 auto">
    <h2 style="color:#1e3a5f">RepairScout</h2>
    <p>Hi ${customerName},</p>
    <p>${msgFn[isEn ? "en" : "es"](vehicle)}</p>
    ${trackUrl ? `<a href="${trackUrl}" style="display:inline-block;background:#1e3a5f;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">Track your repair →</a>` : ""}
    ${surveyUrl ? `<p style="margin-top:16px"><a href="${surveyUrl}" style="color:#1e3a5f;font-weight:700">${surveyPrompt} →</a></p>` : ""}
  </div>`;

  const results = {};
  if (customerEmail) {
    try { results.email = await sendEmail({ to: customerEmail, subject, html }); }
    catch (e) { results.emailError = e.message; }
  }
  if (customerPhone) {
    const normalized = customerPhone.replace(/\D/g, "");
    const e164 = normalized.startsWith("1") ? `+${normalized}` : `+1${normalized}`;
    try { results.sms = await sendSms({ to: e164, body: smsBody }); }
    catch (e) { results.smsError = e.message; }
  }
  return results;
}

/**
 * One-time follow-up for a confirmed-fix survey nobody opened yet — see the cron at
 * /api/cron/nudge-outcome-surveys and database.js's listOutcomesNeedingReminder. Kept
 * separate from sendStageUpdateNotification (which already tried once, alongside the
 * "Completed" stage message) since this fires independently, days later.
 */
export async function sendOutcomeReminderNotification({ customerEmail, customerPhone, customerName, vehicle, surveyUrl, lang = "es" }) {
  const isEn = lang === "en";
  const smsBody = isEn
    ? `RepairScout: Quick follow-up on your ${vehicle} repair — did it fix the issue? ${surveyUrl}`
    : `RepairScout: Seguimiento rápido sobre la reparación de tu ${vehicle} — ¿resolvió el problema? ${surveyUrl}`;
  const subject = isEn ? `Did your ${vehicle} repair work?` : `¿Funcionó la reparación de tu ${vehicle}?`;
  const html = `<div style="font-family:system-ui;max-width:520px;margin:0 auto">
    <h2 style="color:#1e3a5f">RepairScout</h2>
    <p>Hi ${customerName},</p>
    <p>${isEn ? `We haven't heard back yet — did the repair on your ${vehicle} fix the issue? Your answer helps future customers with the same problem.` : `Aún no hemos sabido de ti — ¿la reparación de tu ${vehicle} resolvió el problema? Tu respuesta ayuda a futuros clientes con el mismo problema.`}</p>
    <a href="${surveyUrl}" style="display:inline-block;background:#1e3a5f;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">${isEn ? "Let us know →" : "Cuéntanos →"}</a>
  </div>`;

  const results = {};
  if (customerEmail) {
    try { results.email = await sendEmail({ to: customerEmail, subject, html }); }
    catch (e) { results.emailError = e.message; }
  }
  if (customerPhone) {
    const normalized = customerPhone.replace(/\D/g, "");
    const e164 = normalized.startsWith("1") ? `+${normalized}` : `+1${normalized}`;
    try { results.sms = await sendSms({ to: e164, body: smsBody }); }
    catch (e) { results.smsError = e.message; }
  }
  return results;
}

export async function sendInvoiceNotification({ customerEmail, customerPhone, customerName, vehicle, invoiceTotal, trackUrl }) {
  const body = `RepairScout invoice for ${vehicle}: $${Number(invoiceTotal).toFixed(2)}. View here: ${trackUrl}`;
  const results = {};

  if (customerEmail) {
    const html = `<div style="font-family:system-ui;max-width:520px;margin:0 auto">
      <h2 style="color:#1e3a5f">RepairScout Invoice</h2>
      <p>Hi ${customerName},</p>
      <p>Your repair invoice for <strong>${vehicle}</strong> is ready.</p>
      <p style="font-size:24px;font-weight:700;color:#f97316">Total: $${Number(invoiceTotal).toFixed(2)}</p>
      <a href="${trackUrl}" style="display:inline-block;background:#1e3a5f;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">View Invoice & Pay</a>
    </div>`;
    try { results.email = await sendEmail({ to: customerEmail, subject: `Invoice ready: ${vehicle} — $${Number(invoiceTotal).toFixed(2)}`, html }); }
    catch (e) { results.emailError = e.message; }
  }

  if (customerPhone) {
    const normalized = customerPhone.replace(/\D/g, "");
    const e164 = normalized.startsWith("1") ? `+${normalized}` : `+1${normalized}`;
    try { results.sms = await sendSms({ to: e164, body }); }
    catch (e) { results.smsError = e.message; }
  }

  return results;
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

export async function sendVerificationEmail({ to, name, token, language = "es" }) {
  const isEn = language === "en";
  const verifyUrl = `${APP_URL}/verify-email?token=${token}`;
  const subject = isEn ? "Verify your RepairScout email" : "Verifica tu correo de RepairScout";
  const html = `<div style="font-family:system-ui;max-width:520px;margin:0 auto">
    <h2 style="color:#1e3a5f">RepairScout</h2>
    <p>${isEn ? "Hi" : "Hola"} ${name},</p>
    <p>${isEn ? "Confirm your email address to finish setting up your account." : "Confirma tu correo electrónico para terminar de configurar tu cuenta."}</p>
    <a href="${verifyUrl}" style="display:inline-block;background:#1e3a5f;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">${isEn ? "Verify email" : "Verificar correo"} →</a>
    <p style="margin-top:16px;font-size:12px;color:#666">${isEn ? "This link expires in 24 hours." : "Este enlace expira en 24 horas."}</p>
  </div>`;

  try {
    return await sendEmail({ to, subject, html });
  } catch (e) {
    console.error("[notify] verification email error:", e.message);
    return { emailError: e.message };
  }
}

export async function sendPasswordResetEmail({ to, name, token, language = "es" }) {
  const isEn = language === "en";
  const resetUrl = `${APP_URL}/reset-password?token=${token}`;
  const subject = isEn ? "Reset your RepairScout password" : "Restablece tu contraseña de RepairScout";
  const html = `<div style="font-family:system-ui;max-width:520px;margin:0 auto">
    <h2 style="color:#1e3a5f">RepairScout</h2>
    <p>${isEn ? "Hi" : "Hola"} ${name},</p>
    <p>${isEn ? "We received a request to reset your password. If this wasn't you, you can ignore this email." : "Recibimos una solicitud para restablecer tu contraseña. Si no fuiste tú, puedes ignorar este correo."}</p>
    <a href="${resetUrl}" style="display:inline-block;background:#1e3a5f;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">${isEn ? "Reset password" : "Restablecer contraseña"} →</a>
    <p style="margin-top:16px;font-size:12px;color:#666">${isEn ? "This link expires in 1 hour." : "Este enlace expira en 1 hora."}</p>
  </div>`;

  try {
    return await sendEmail({ to, subject, html });
  } catch (e) {
    console.error("[notify] password reset email error:", e.message);
    return { emailError: e.message };
  }
}
