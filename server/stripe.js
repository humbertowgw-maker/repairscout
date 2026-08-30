import Stripe from "stripe";

const APP_URL     = process.env.APP_URL || "http://localhost:4311";
const PRICE_CENTS = Number(process.env.STRIPE_DIAGNOSIS_PRICE_CENTS || "999");

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  return new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });
}

export async function createDiagnosisCheckout({ pendingId, phone }) {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe not configured — add STRIPE_SECRET_KEY.");

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: "RepairScout AI Diagnosis",
            description: "AI-powered vehicle diagnosis with itemized parts quote",
          },
          unit_amount: PRICE_CENTS,
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    success_url: `${APP_URL}/diagnose/result?pid=${pendingId}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  `${APP_URL}/?canceled=1`,
    metadata:    { pendingId, phone },
  });

  return session;
}

export async function createShopPlanCheckout({ shopUserId, planId, planName, priceMonthly }) {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe not configured — add STRIPE_SECRET_KEY.");

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: { name: `RepairScout ${planName}` },
          unit_amount: Math.round(priceMonthly * 100),
          recurring: { interval: "month" },
        },
        quantity: 1,
      },
    ],
    mode: "subscription",
    client_reference_id: shopUserId,
    success_url: `${APP_URL}/?shopCheckout=success`,
    cancel_url:  `${APP_URL}/?shopCheckout=cancelled`,
    metadata:    { shopUserId, planId },
  });

  return session;
}

export function constructWebhookEvent(rawBody, signature) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) throw new Error("Stripe webhook not configured.");
  return stripe.webhooks.constructEvent(rawBody, signature, secret);
}
