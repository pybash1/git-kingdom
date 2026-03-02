/**
 * Secure session management via encrypted cookies.
 * Uses AES-256-GCM to encrypt session data (token is never visible in cookie).
 * Includes issued_at timestamp for server-side expiry checks.
 */
import { createCipheriv, createDecipheriv, randomBytes, createHmac } from 'crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const SESSION_COOKIE = 'gk_session';
const SESSION_SECRET = process.env.SESSION_SECRET;
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days
const MAX_AGE_MS = MAX_AGE_SECONDS * 1000;

/** Fail fast if SESSION_SECRET is missing */
function getSecret(): string {
  if (!SESSION_SECRET) {
    throw new Error('SESSION_SECRET environment variable is required');
  }
  return SESSION_SECRET;
}

/** Derive a 32-byte key from the secret using HMAC */
function deriveKey(purpose: string): Buffer {
  const hmac = createHmac('sha256', getSecret());
  hmac.update(purpose);
  return hmac.digest(); // 32 bytes
}

export interface Session {
  /** GitHub username */
  login: string;
  /** GitHub user ID */
  github_id: number;
  /** GitHub avatar URL */
  avatar_url: string;
  /** GitHub OAuth access token (for API calls) */
  token: string;
  /** When the session was created (ms since epoch) */
  issued_at: number;
}

/** Encrypt session data with AES-256-GCM */
function encrypt(session: Session): string {
  const key = deriveKey('encrypt');
  const iv = randomBytes(12); // 96-bit nonce for GCM
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const json = JSON.stringify(session);
  const encrypted = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag(); // 16 bytes
  // Format: base64url(iv + tag + ciphertext)
  return Buffer.concat([iv, tag, encrypted]).toString('base64url');
}

/** Decrypt session data */
function decrypt(cookie: string): Session | null {
  try {
    const key = deriveKey('encrypt');
    const buf = Buffer.from(cookie, 'base64url');
    if (buf.length < 28) return null; // 12 (iv) + 16 (tag) minimum
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const ciphertext = buf.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const json = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    return JSON.parse(json) as Session;
  } catch {
    return null;
  }
}

/** Whether to set the Secure flag (everywhere except local dev) */
function isSecureContext(): boolean {
  return !!process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'development';
}

/** Read the session from the request cookie. Returns null if not signed in or expired. */
export function getSession(req: VercelRequest): Session | null {
  const raw = req.cookies?.[SESSION_COOKIE];
  if (!raw) return null;
  try {
    const session = decrypt(raw);
    if (!session) return null;
    // Check expiry
    if (session.issued_at && Date.now() - session.issued_at > MAX_AGE_MS) return null;
    return session;
  } catch {
    return null; // SESSION_SECRET not set or decryption failed
  }
}

/** Set the session cookie on the response. */
export function setSession(res: VercelResponse, session: Session) {
  const value = encrypt(session);
  const secure = isSecureContext() ? '; Secure' : '';
  res.setHeader('Set-Cookie', [
    `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE_SECONDS}${secure}`,
  ]);
}

/** Clear the session cookie. */
export function clearSession(res: VercelResponse) {
  const secure = isSecureContext() ? '; Secure' : '';
  res.setHeader('Set-Cookie', [
    `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`,
  ]);
}

/** Generate a random state nonce for CSRF protection. */
export function generateState(): string {
  return randomBytes(16).toString('hex');
}

/** GitHub username validation — alphanumeric and hyphens, 1-39 chars */
export function isValidGitHubUsername(username: string): boolean {
  return /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(username);
}
