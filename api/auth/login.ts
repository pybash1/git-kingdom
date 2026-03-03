/**
 * GET /api/auth/login
 * Redirects to GitHub OAuth via Supabase Auth.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createServerClient } from '../lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const supabase = createServerClient(req, res);

  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const redirectTo = `${proto}://${host}/api/auth/callback`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: { redirectTo },
  });

  if (error || !data.url) {
    console.error('[/api/auth/login] OAuth error:', error?.message);
    return res.status(500).json({ error: error?.message || 'OAuth failed' });
  }

  res.redirect(302, data.url);
}
