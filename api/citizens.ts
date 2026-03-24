/**
 * GET /api/citizens
 * Returns recent citizens and total citizen count.
 *
 * Query params:
 *   ?page=1&limit=20  — paginated list (default: page 1, limit 20)
 *
 * Response includes:
 *   - citizens: array of { login, avatar_url, top_repos[] }
 *   - total: total unique citizen count (contributors + registered users)
 *   - page, limit, totalPages
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createServiceClient } from './lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = createServiceClient();
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
    const offset = (page - 1) * limit;

    // Get total unique contributor count
    const { count: totalContributors } = await supabase
      .from('contributors')
      .select('login', { count: 'exact', head: true });

    // Get registered users count
    const { count: totalUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    // Unique citizens = we'll use a generous estimate
    // (many contributors are also registered users)
    const total = Math.max(totalContributors || 0, totalUsers || 0);

    // Get recently registered users with their top repos
    const { data: users, error } = await supabase
      .from('users')
      .select('login, avatar_url, id')
      .order('id', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[/api/citizens] Error:', error.message);
      return res.status(500).json({ error: 'Failed to fetch citizens' });
    }

    // For each user, get their top 3 repos by stars
    const citizens = await Promise.all(
      (users || []).map(async (u) => {
        const { data: userRepos } = await supabase
          .from('user_repos')
          .select('repos(full_name, name, language, stargazers)')
          .eq('user_id', u.id)
          .limit(10);

        const topRepos = (userRepos || [])
          .map((ur: any) => ur.repos)
          .filter((r: any) => r && r.stargazers >= 1)
          .sort((a: any, b: any) => b.stargazers - a.stargazers)
          .slice(0, 3)
          .map((r: any) => ({
            full_name: r.full_name,
            name: r.name,
            language: r.language,
            stars: r.stargazers,
          }));

        return {
          login: u.login,
          avatar_url: u.avatar_url,
          top_repos: topRepos,
        };
      }),
    );

    // Cache for 5 minutes
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    res.json({
      citizens,
      total,
      page,
      limit,
      totalPages: Math.ceil((totalUsers || 0) / limit),
    });
  } catch (err: any) {
    console.error('[/api/citizens] Error:', err?.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}
