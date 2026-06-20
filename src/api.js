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
    throw new Error(payload.error || "No se pudo completar la solicitud.");
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
