/**
 * POST /api/repo/add
 * Public endpoint — anyone can submit a GitHub repo URL to add it to the world.
 * No auth required. Rate-limited per IP.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createServiceClient } from '../lib/supabase';
import { fetchRepoMetrics } from '../lib/github-server';

// Simple in-memory rate limit: max 5 requests per IP per minute
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(ip) || [];
  const recent = timestamps.filter(t => now - t < RATE_WINDOW_MS);
  rateLimitMap.set(ip, recent);
  if (recent.length >= RATE_LIMIT) return true;
  recent.push(now);
  return false;
}

/** Extract owner/repo from a GitHub URL or "owner/repo" string */
function parseRepoInput(input: string): { owner: string; repo: string } | null {
  const trimmed = input.trim();

  // Try as GitHub URL: https://github.com/owner/repo[/...]
  try {
    const url = new URL(trimmed);
    if (url.hostname === 'github.com' || url.hostname === 'www.github.com') {
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts.length >= 2) return { owner: parts[0], repo: parts[1] };
    }
  } catch { /* not a URL */ }

  // Try as "owner/repo"
  const slashMatch = trimmed.match(/^([a-zA-Z0-9][\w-]{0,37}[a-zA-Z0-9]?)\/([a-zA-Z0-9._-]{1,100})$/);
  if (slashMatch) return { owner: slashMatch[1], repo: slashMatch[2] };

  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
    || req.socket?.remoteAddress || 'unknown';

  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Too many requests. Try again in a minute.' });
  }

  const { url, owner, repo } = req.body || {};
  const parsed = url ? parseRepoInput(url) : (owner && repo ? { owner, repo } : null);

  if (!parsed) {
    return res.status(400).json({ error: 'Provide a GitHub URL or owner/repo.' });
  }

  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) {
    return res.status(500).json({ error: 'Server GitHub token not configured' });
  }

  try {
    const service = createServiceClient();

    // Check if repo was recently fetched (skip re-fetch within 24h)
    const fullName = `${parsed.owner}/${parsed.repo}`.toLowerCase();
    const { data: existing } = await service.from('repos')
      .select('id, fetched_at')
      .eq('full_name', fullName)
      .single();

    if (existing?.fetched_at) {
      const fetchedAge = Date.now() - new Date(existing.fetched_at).getTime();
      if (fetchedAge < 24 * 60 * 60 * 1000) {
        return res.json({ ok: true, repo: fullName, already: true, message: 'Repo already in the world!' });
      }
    }

    // Fetch from GitHub
    const metrics = await fetchRepoMetrics(parsed.owner, parsed.repo, githubToken);
    if (!metrics) {
      return res.status(404).json({ error: 'Repo not found on GitHub.' });
    }

    // Upsert repo (same pattern as join.ts)
    const { data: repoRow, error: repoErr } = await service.from('repos').upsert({
      full_name: metrics.repo.full_name.toLowerCase(),
      name: metrics.repo.name,
      owner_login: metrics.repo.owner?.login || parsed.owner,
      owner_avatar: metrics.repo.owner?.avatar_url || '',
      description: metrics.repo.description,
      language: metrics.repo.language,
      stargazers: metrics.repo.stargazers_count,
      forks: metrics.repo.forks_count,
      open_issues: metrics.repo.open_issues_count,
      size_kb: metrics.repo.size || 0,
      created_at: metrics.repo.created_at,
      pushed_at: metrics.repo.pushed_at || metrics.repo.updated_at,
      topics: metrics.repo.topics || [],
      total_commits: metrics.totalCommits,
      merged_prs: Math.floor(metrics.totalCommits * 0.3),
      king_login: metrics.king?.login || null,
      king_avatar: metrics.king?.avatar_url || null,
      king_contributions: metrics.king?.contributions || 0,
      fetched_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'full_name' }).select('id').single();

    if (repoErr || !repoRow) {
      console.warn(`[add] Failed to upsert ${fullName}:`, repoErr?.message);
      return res.status(500).json({ error: 'Failed to save repo.' });
    }

    // Upsert contributors
    if (metrics.contributors.length > 0) {
      await service.from('contributors').upsert(
        metrics.contributors.slice(0, 20).map(c => ({
          repo_id: repoRow.id,
          login: c.login,
          avatar_url: c.avatar_url,
          contributions: c.contributions || 0,
        })),
        { onConflict: 'repo_id,login' },
      );
    }

    console.log(`[add] ${fullName} added (${metrics.repo.language || 'no language'}, ${metrics.repo.stargazers_count}★)`);

    res.json({
      ok: true,
      repo: metrics.repo.full_name,
      language: metrics.repo.language || 'Uncharted',
      stars: metrics.repo.stargazers_count,
    });
  } catch (err: any) {
    console.error(`[add] Error:`, err?.message);
    res.status(500).json({ error: 'Failed to add repo.' });
  }
}
