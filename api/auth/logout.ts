/**
 * POST /api/auth/logout
 * Signs out via Supabase Auth (clears session cookies) and redirects to home.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createServerClient } from '../lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = createServerClient(req, res);
  await supabase.auth.signOut();

  res.redirect(302, '/');
}
