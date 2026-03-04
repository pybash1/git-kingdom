/**
 * GET /api/user/repos
 * Returns the signed-in user's claimed repos (via user_repos junction).
 * Requires auth. Returns 401 if not signed in.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createServerClient, createServiceClient } from '../lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = createServerClient(req, res);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return res.status(401).json({ error: 'Not signed in' });
  }

  try {
    const service = createServiceClient();

    // Join user_repos → repos to get the user's claimed repos
    const { data: userRepos, error } = await service
      .from('user_repos')
      .select('repos(id, full_name, name, language, stargazers, description, owner_login)')
      .eq('user_id', user.id);

    if (error) {
      console.error('[/api/user/repos] Supabase error:', error.message);
      return res.status(500).json({ error: 'Failed to fetch repos' });
    }

    // Flatten the join result and sort by stars
    const repos = (userRepos || [])
      .map((ur: any) => ur.repos)
      .filter(Boolean)
      .sort((a: any, b: any) => b.stargazers - a.stargazers);

    res.json({ repos });
  } catch (err: any) {
    console.error('[/api/user/repos] Error:', err?.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}
