/**
 * GET /api/auth/me
 * Returns the currently signed-in user from Supabase Auth session.
 * Returns 401 if not signed in.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createServerClient } from '../lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const supabase = createServerClient(req, res);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return res.status(401).json({ error: 'Not signed in' });
  }

  const meta = user.user_metadata;

  // Return user info (never expose the access token)
  res.json({
    login: meta.user_name || meta.preferred_username,
    github_id: meta.provider_id || meta.sub,
    avatar_url: meta.avatar_url,
  });
}
