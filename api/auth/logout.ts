/**
 * POST /api/auth/logout
 * Clears the session cookie and redirects to home.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { clearSession } from '../lib/session';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  clearSession(res);
  res.redirect(302, '/');
}
