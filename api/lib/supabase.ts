/**
 * Supabase client factories for Git Kingdom serverless functions.
 *
 * createServerClient(req, res) — Auth-aware client that reads/writes session cookies.
 * createServiceClient()        — Admin client that bypasses RLS (for server writes).
 */
import { createServerClient as createSSRClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Auth-aware Supabase client for serverless functions.
 * Reads session from cookies, sets new cookies on auth state changes.
 */
export function createServerClient(req: VercelRequest, res: VercelResponse) {
  return createSSRClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return Object.entries(req.cookies || {}).map(([name, value]) => ({
            name,
            value: value || '',
          }));
        },
        setAll(cookies) {
          cookies.forEach(({ name, value, options }) => {
            const isSecure = !!process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'development';
            const parts = [
              `${name}=${value}`,
              `Path=${options?.path || '/'}`,
              'HttpOnly',
              'SameSite=Lax',
              `Max-Age=${options?.maxAge || 86400 * 30}`,
            ];
            if (isSecure) parts.push('Secure');
            res.appendHeader('Set-Cookie', parts.join('; '));
          });
        },
      },
    }
  );
}

/**
 * Admin Supabase client — bypasses RLS.
 * Use only in server-side code (seed script, join endpoint, etc.)
 */
export function createServiceClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}
