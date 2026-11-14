import "server-only";

import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { sql } from "@/lib/db";

/**
 * Researcher accounts: email and password. Passwords are stored only as scrypt hashes with a
 * random salt. A session is a random token kept in an httpOnly cookie; the database stores
 * only the token's SHA-256, so a leaked database cannot be used to sign in.
 */
export type User = { id: string; email: string; name: string };

const COOKIE = "tess_session";
const DAYS = 30;
const N = 32768; // scrypt work factor

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => scrypt(password.normalize("NFKC"), salt, 64, { N, r: 8, p: 1, maxmem: 128 * 1024 * 1024 }, (e, key) => (e ? reject(e) : resolve(key))));
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return `scrypt$${N}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, , saltB64, keyB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, "base64");
  const key = await derive(password, Buffer.from(saltB64, "base64"));
  return key.length === expected.length && timingSafeEqual(key, expected);
}

const sha = (v: string) => createHash("sha256").update(v).digest("hex");
export const normalizeEmail = (email: string) => email.trim().toLowerCase();

/** Too many failed sign-ins for one email in a short time: slow guessing down. */
export async function tooManyAttempts(email: string) {
  const rows = await sql<{ n: number }>`select count(*)::int as n from login_attempts where email = ${email} and at > now() - interval '15 minutes'`;
  return (rows[0]?.n ?? 0) >= 8;
}
export const recordFailure = (email: string) => sql`insert into login_attempts (email) values (${email})`;
export const clearFailures = (email: string) => sql`delete from login_attempts where email = ${email}`;

export async function createUser(email: string, name: string, password: string): Promise<User | null> {
  const existing = await sql`select 1 from users where email = ${email}`;
  if (existing.length) return null;
  const id = randomUUID();
  await sql`insert into users (id, email, name, password_hash) values (${id}, ${email}, ${name}, ${await hashPassword(password)})`;
  return { id, email, name };
}

export async function checkCredentials(email: string, password: string): Promise<User | null> {
  const rows = await sql<{ id: string; email: string; name: string; password_hash: string }>`select id, email, name, password_hash from users where email = ${email}`;
  const u = rows[0];
  // Hash even when the account does not exist, so the reply takes the same time either way.
  if (!u) {
    await derive(password, Buffer.alloc(16));
    return null;
  }
  return (await verifyPassword(password, u.password_hash)) ? { id: u.id, email: u.email, name: u.name } : null;
}

export async function startSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + DAYS * 864e5);
  await sql`insert into sessions (token_hash, user_id, expires_at) values (${sha(token)}, ${userId}, ${expires.toISOString()})`;
  (await cookies()).set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", expires });
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await sql`delete from sessions where token_hash = ${sha(token)}`;
  jar.delete(COOKIE);
}

/** The signed-in researcher, or null. */
export async function currentUser(): Promise<User | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const rows = await sql<User>`select u.id, u.email, u.name from sessions s join users u on u.id = s.user_id where s.token_hash = ${sha(token)} and s.expires_at > now()`;
  return rows[0] ?? null;
}

/** Only same-site paths are accepted as a place to return to after signing in. */
export const safeNext = (next: string | undefined | null, fallback: string) => (next && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : fallback);
