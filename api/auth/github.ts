/**
 * GET /api/auth/github
 * Redirects the user to GitHub's OAuth authorization page.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateState } from '../lib/session';

/** Allowed hosts for OAuth redirect URI (prevents open redirect via header injection) */
const ALLOWED_HOSTS = (process.env.ALLOWED_HOSTS || 'localhost:3000,localhost:5173').split(',').map(h => h.trim());

export default function handler(req: VercelRequest, res: VercelResponse) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return res.status(500).json({ error: 'GITHUB_CLIENT_ID not configured' });
  }

  // Determine the callback URL — validate host against allowlist
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = (req.headers['x-forwarded-host'] || req.headers.host || '') as string;
  if (!host || !ALLOWED_HOSTS.includes(host)) {
    return res.status(400).json({ error: 'Invalid host' });
  }
  const redirectUri = `${proto}://${host}/api/auth/callback`;

  // Generate CSRF state and store in a short-lived cookie
  const state = generateState();
  const isSecure = !!process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'development';
  res.setHeader('Set-Cookie', [
    `gk_oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${isSecure ? '; Secure' : ''}`,
  ]);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'read:user',
    state,
  });

  res.redirect(302, `https://github.com/login/oauth/authorize?${params}`);
}
