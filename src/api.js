async function request(path, options = {}) {
  const token = window.localStorage.getItem("repairscout_token");
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    ...options,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || "Request failed.");
  }

  return payload;
}

export function decodeVin(vin) {
  return request(`/api/vehicle/decode?vin=${encodeURIComponent(vin)}`);
}

export function createDiagnosis(input) {
  return request("/api/diagnose", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function saveQuoteRequest(input) {
  return request("/api/quote-requests", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getQuoteRequests() {
  return request("/api/quote-requests");
}

export function updateQuoteRequestStatus(id, status) {
  return request(`/api/quote-requests/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export function getShopProfile() {
  return request("/api/shop-profile");
}

export function saveShopProfile(input) {
  return request("/api/shop-profile", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function getSystemHealth() {
  return request("/api/health");
}

export function registerAccount(input) {
  return request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function loginAccount(input) {
  return request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getCurrentUser() {
  return request("/api/auth/me");
}

export function saveVehicle(input) {
  return request("/api/vehicles", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getVehicles() {
  return request("/api/vehicles");
}

export function searchShops(zip, radius) {
  return request(`/api/shops/search?zip=${encodeURIComponent(zip)}&radius=${encodeURIComponent(radius)}`);
}

export function getSentQuotes() {
  return request("/api/quotes/sent");
}

export function buildPartsQuote(input) {
  return request("/api/quotes/build", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function sendItemizedQuote(input) {
  return request("/api/quotes/send", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getTrackingInfo(token) {
  return request(`/api/track/${encodeURIComponent(token)}`);
}

export function approveRepairQuote(token) {
  return request(`/api/track/${encodeURIComponent(token)}/approve`, {
    method: "POST",
  });
}

export function updateRepairStage(quoteId, stage) {
  return request(`/api/quotes/${encodeURIComponent(quoteId)}/repair-stage`, {
    method: "PATCH",
    body: JSON.stringify({ stage }),
  });
}

export function sendOtp(phone) {
  return request("/api/otp/send", { method: "POST", body: JSON.stringify({ phone }) });
}

export function verifyOtp(phone, code) {
  return request("/api/otp/verify", { method: "POST", body: JSON.stringify({ phone, code }) });
}

export function runFreeDiagnosis(input) {
  return request("/api/diagnose/free", { method: "POST", body: JSON.stringify(input) });
}

export function startCheckout(input) {
  return request("/api/checkout/start", { method: "POST", body: JSON.stringify(input) });
}

export function getDiagnoseResult(pendingId) {
  return request(`/api/diagnose/result/${encodeURIComponent(pendingId)}`);
}

export function getAdminStats() {
  return request("/api/admin/stats");
}

export function getAdminUsers() {
  return request("/api/admin/users");
}

export function setAdminUserRole(id, role) {
  return request(`/api/admin/users/${encodeURIComponent(id)}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
}

export function getAdminQuotes() {
  return request("/api/admin/quotes");
}

export function searchParts(query, lang, zip, state) {
  return request("/api/parts/search", { method: "POST", body: JSON.stringify({ query, lang, zip, state }) });
}

export function startPartsVerification(payload) {
  return request("/api/parts/verify", { method: "POST", body: JSON.stringify(payload) });
}

export function getPartsInquiryBatch(batchId) {
  return request(`/api/parts/inquiry-batch/${encodeURIComponent(batchId)}`);
}
