/**
 * GET /api/auth/callback
 * Supabase Auth redirects here after GitHub approval.
 * Exchanges the code for a session, upserts user into our users table.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createServerClient, createServiceClient } from '../lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const code = req.query.code as string;
  if (!code) {
    return res.status(400).json({ error: 'Missing authorization code' });
  }

  const supabase = createServerClient(req, res);
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) {
    console.error('[/api/auth/callback] Session exchange failed:', error?.message);
    return res.status(400).json({ error: error?.message || 'Session exchange failed' });
  }

  // Upsert user into our users table
  const meta = data.session.user.user_metadata;
  const login = meta.user_name || meta.preferred_username || '';
  const githubId = meta.provider_id || meta.sub;

  try {
    const service = createServiceClient();
    await service.from('users').upsert({
      id: data.session.user.id,
      github_id: typeof githubId === 'string' ? parseInt(githubId, 10) : githubId,
      login,
      avatar_url: meta.avatar_url,
    }, { onConflict: 'id' });
  } catch (err: any) {
    console.error('[/api/auth/callback] User upsert failed:', err?.message);
    // Non-fatal — user can still use the app
  }

  res.redirect(302, `/${login}`);
}
