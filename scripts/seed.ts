/**
 * Seed script — populates Supabase with DEFAULT_REPOS from GitHub API.
 *
 * Usage:
 *   GITHUB_TOKEN=ghp_xxx SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=xxx npx tsx scripts/seed.ts
 *
 * Requires: npm install -D tsx (for running TypeScript directly)
 */

import { createClient } from '@supabase/supabase-js';

// ─── Configuration ──────────────────────────────────────────
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!GITHUB_TOKEN) { console.error('Missing GITHUB_TOKEN'); process.exit(1); }
if (!SUPABASE_URL) { console.error('Missing SUPABASE_URL'); process.exit(1); }
if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const GH_API = 'https://api.github.com';
const CONCURRENCY = 10;

// ─── Import DEFAULT_REPOS ───────────────────────────────────
// We can't directly import from src/github/api.ts because it uses import.meta.env.
// Instead, dynamically extract the array. The file exports DEFAULT_REPOS as a const.
async function loadDefaultRepos(): Promise<[string, string][]> {
  // Read the source file and extract the array
  const fs = await import('fs');
  const path = await import('path');
  const filePath = path.resolve(process.cwd(), 'src/github/api.ts');
  const source = fs.readFileSync(filePath, 'utf-8');

  // Find the DEFAULT_REPOS array — it's between the marker and the closing ];
  const startMarker = 'export const DEFAULT_REPOS: [string, string][] = [';
  const startIdx = source.indexOf(startMarker);
  if (startIdx === -1) throw new Error('Could not find DEFAULT_REPOS in api.ts');
  const afterStart = source.indexOf('[', startIdx);
  const endIdx = source.indexOf('\n];', afterStart);
  if (endIdx === -1) throw new Error('Could not find end of DEFAULT_REPOS array');

  const arraySource = source.substring(afterStart, endIdx + 2);

  // Parse the array — each line looks like: ['owner', 'name'],  // comment
  const repos: [string, string][] = [];
  const regex = /\[\s*'([^']+)'\s*,\s*'([^']+)'\s*\]/g;
  let match;
  while ((match = regex.exec(arraySource)) !== null) {
    repos.push([match[1], match[2]]);
  }

  return repos;
}

// ─── GitHub API helpers ─────────────────────────────────────
const ghHeaders = {
  Authorization: `Bearer ${GITHUB_TOKEN}`,
  Accept: 'application/vnd.github.v3+json',
};

interface FetchResult {
  owner: string;
  name: string;
  repoData: any;
  contributors: any[];
}

async function fetchRepo(owner: string, name: string): Promise<FetchResult | null> {
  try {
    const [repoRes, contribRes] = await Promise.all([
      fetch(`${GH_API}/repos/${owner}/${name}`, { headers: ghHeaders }),
      fetch(`${GH_API}/repos/${owner}/${name}/contributors?per_page=20`, { headers: ghHeaders }),
    ]);

    if (!repoRes.ok) {
      if (repoRes.status === 403) throw new Error('RATE_LIMITED');
      console.warn(`  ⚠ ${owner}/${name}: ${repoRes.status}`);
      return null;
    }

    const repoData = await repoRes.json();
    const contributors = contribRes.ok ? await contribRes.json() : [];

    return { owner, name, repoData, contributors: Array.isArray(contributors) ? contributors : [] };
  } catch (err: any) {
    if (err.message === 'RATE_LIMITED') throw err;
    console.warn(`  ⚠ ${owner}/${name}: ${err.message}`);
    return null;
  }
}

// ─── Upsert into Supabase ───────────────────────────────────
async function upsertRepo(result: FetchResult): Promise<boolean> {
  const { repoData: r, contributors: contribs } = result;

  const totalCommits = contribs.reduce((s: number, c: any) => s + (c.contributions || 0), 0);
  const king = contribs.length > 0
    ? contribs.reduce((a: any, b: any) => (a.contributions || 0) >= (b.contributions || 0) ? a : b)
    : null;

  // Upsert repo row
  const { data: inserted, error } = await supabase.from('repos').upsert({
    full_name: r.full_name.toLowerCase(),
    name: r.name,
    owner_login: r.owner.login,
    owner_avatar: r.owner.avatar_url,
    description: r.description,
    language: r.language,
    stargazers: r.stargazers_count,
    forks: r.forks_count,
    open_issues: r.open_issues_count,
    size_kb: r.size || 0,
    created_at: r.created_at,
    pushed_at: r.pushed_at,
    default_branch: r.default_branch,
    has_wiki: r.has_wiki,
    license_spdx: r.license?.spdx_id || null,
    topics: r.topics || [],
    total_commits: totalCommits,
    merged_prs: Math.floor(totalCommits * 0.3),
    king_login: king?.login || null,
    king_avatar: king?.avatar_url || null,
    king_contributions: king?.contributions || 0,
    fetched_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'full_name' }).select('id').single();

  if (error || !inserted) {
    console.warn(`  ⚠ DB upsert failed for ${r.full_name}: ${error?.message}`);
    return false;
  }

  // Upsert contributors
  if (contribs.length > 0) {
    const { error: contribErr } = await supabase.from('contributors').upsert(
      contribs.slice(0, 20).map((c: any) => ({
        repo_id: inserted.id,
        login: c.login,
        avatar_url: c.avatar_url,
        contributions: c.contributions || 0,
      })),
      { onConflict: 'repo_id,login' }
    );
    if (contribErr) {
      console.warn(`  ⚠ Contributors upsert failed for ${r.full_name}: ${contribErr.message}`);
    }
  }

  return true;
}

// ─── Main seed function ─────────────────────────────────────
async function seed() {
  console.log('🏰 Git Kingdom Seed Script');
  console.log('─────────────────────────────');

  // Check rate limit first
  const rlRes = await fetch(`${GH_API}/rate_limit`, { headers: ghHeaders });
  const rl = await rlRes.json();
  console.log(`GitHub API rate limit: ${rl.rate.remaining}/${rl.rate.limit} remaining`);
  console.log(`Resets at: ${new Date(rl.rate.reset * 1000).toLocaleTimeString()}`);
  console.log('');

  const repos = await loadDefaultRepos();
  console.log(`Found ${repos.length} repos in DEFAULT_REPOS`);

  // Deduplicate
  const seen = new Set<string>();
  const unique = repos.filter(([o, n]) => {
    const key = `${o}/${n}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  console.log(`${unique.length} unique repos (${repos.length - unique.length} duplicates removed)`);
  console.log('');

  let success = 0;
  let fail = 0;
  let idx = 0;
  const queue = [...unique];

  async function worker() {
    while (idx < queue.length) {
      const i = idx++;
      const [owner, name] = queue[i];
      try {
        const result = await fetchRepo(owner, name);
        if (!result) { fail++; continue; }

        const ok = await upsertRepo(result);
        if (ok) {
          success++;
        } else {
          fail++;
        }

        if ((success + fail) % 25 === 0) {
          console.log(`  📦 Progress: ${success} seeded, ${fail} failed, ${queue.length - i - 1} remaining`);
        }
      } catch (err: any) {
        if (err.message === 'RATE_LIMITED') {
          console.error('\n❌ Rate limited! Wait for reset and run again.');
          console.log(`  Completed ${success} repos before hitting the limit.`);
          process.exit(1);
        }
        fail++;
        console.warn(`  ⚠ ${owner}/${name}: ${err.message}`);
      }
    }
  }

  const startTime = Date.now();
  const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, () => worker());
  await Promise.all(workers);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('');
  console.log(`✅ Done in ${elapsed}s!`);
  console.log(`   ${success} repos seeded`);
  console.log(`   ${fail} failed`);

  // Final count
  const { count } = await supabase.from('repos').select('*', { count: 'exact', head: true });
  console.log(`   ${count} total repos in database`);
}

seed().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
