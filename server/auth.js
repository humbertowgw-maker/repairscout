import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { findUserById } from "./database.js";

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET environment variable is required");
  return s;
}

export function authConfigured() {
  return Boolean(process.env.AUTH_SECRET);
}

export async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

export function createToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role },
    secret(),
    { expiresIn: "7d", issuer: "repairscout" },
  );
}

export async function optionalAuth(request, _response, next) {
  const authorization = request.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";

  if (!token) {
    request.user = null;
    return next();
  }

  try {
    const payload = jwt.verify(token, secret(), { issuer: "repairscout" });
    request.user = await findUserById(payload.sub);
  } catch {
    request.user = null;
  }

  next();
}

export function requireAuth(request, response, next) {
  if (!request.user) {
    return response.status(401).json({ error: "Inicia sesión para continuar." });
  }
  next();
}
