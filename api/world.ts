/**
 * GET /api/world
 * Returns the universal world — all repos from Supabase Postgres.
 * Maps database rows to KingdomMetrics[] format for the client.
 * Cached at Vercel's edge for 5 minutes.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createServiceClient } from './lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = createServiceClient();

    // Fetch all repos with their contributors
    const { data: repos, error } = await supabase
      .from('repos')
      .select('*, contributors(*)')
      .order('stargazers', { ascending: false });

    if (error) {
      console.error('[/api/world] Supabase error:', error.message);
      return res.status(200).json({ repos: [], users: [], updatedAt: new Date().toISOString() });
    }

    // Map Postgres rows → KingdomMetrics[] (client-expected format)
    const metrics = (repos || []).map(r => ({
      repo: {
        full_name: r.full_name,
        name: r.name,
        description: r.description,
        stargazers_count: r.stargazers,
        forks_count: r.forks,
        open_issues_count: r.open_issues,
        language: r.language,
        created_at: r.created_at,
        pushed_at: r.pushed_at,
        size: r.size_kb,
        default_branch: r.default_branch || 'main',
        has_wiki: r.has_wiki || false,
        license: r.license_spdx ? { spdx_id: r.license_spdx } : null,
        topics: r.topics || [],
      },
      contributors: (r.contributors || []).map((c: any) => ({
        login: c.login,
        contributions: c.contributions,
        avatar_url: c.avatar_url,
      })),
      totalCommits: r.total_commits,
      mergedPRs: r.merged_prs,
      king: r.king_login ? {
        login: r.king_login,
        contributions: r.king_contributions,
        avatar_url: r.king_avatar,
      } : null,
    }));

    // Fetch registered users
    const { data: users } = await supabase.from('users').select('login');

    // Cache at Vercel edge for 5 minutes, stale-while-revalidate for 10 min
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    res.json({
      repos: metrics,
      users: (users || []).map(u => u.login),
      updatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[/api/world] Error:', err?.message);
    res.status(200).json({ repos: [], users: [], updatedAt: new Date().toISOString() });
  }
}
