import { pathToFileURL } from 'node:url';

// Run after deploying expiringOfflineAccessTokens: true. Default is read only.
export async function migrateOfflineTokens({ prisma, exchange = fetch, apply = false, limit = Infinity }) {
  const rows = await prisma.session.findMany({
    where: { isOnline: false, expires: null },
    select: { id: true, shop: true, accessToken: true },
  });
  const candidates = rows.filter(row => row.accessToken);
  const result = { pending: candidates.length, migrated: 0, failed: 0 };
  if (!apply) return result;
  for (const row of candidates.slice(0, limit)) {
    if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(row.shop)) {
      result.failed++;
      break;
    }
    try {
      const requestedAt = Date.now();
      const response = await exchange(`https://${row.shop}/admin/oauth/access_token`, {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(30000),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
          client_id: process.env.SHOPIFY_API_KEY,
          client_secret: process.env.SHOPIFY_API_SECRET,
          subject_token: row.accessToken,
          subject_token_type: 'urn:shopify:params:oauth:token-type:offline-access-token',
          requested_token_type: 'urn:shopify:params:oauth:token-type:offline-access-token',
          expiring: '1',
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        if (response.status === 400 && body.error === 'invalid_subject_token') {
          // Old/uninstalled sessions can remain in the database. Leave them intact.
          result.failed++;
          continue;
        }
        throw new Error('Exchange failed');
      }
      const token = await response.json();
      if (typeof token.access_token !== 'string' || !token.access_token ||
          typeof token.refresh_token !== 'string' || !token.refresh_token ||
          !Number.isFinite(token.expires_in) || token.expires_in <= 0 ||
          !Number.isFinite(token.refresh_token_expires_in) || token.refresh_token_expires_in <= 0) {
        throw new Error('Invalid token response');
      }
      const now = requestedAt;
      const data = {
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        expires: new Date(now + token.expires_in * 1000),
        refreshTokenExpires: new Date(now + token.refresh_token_expires_in * 1000),
      };
      // Persist the pair together; never overwrite a session another request replaced.
      let saved;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          saved = await prisma.session.updateMany({
            where: { id: row.id, accessToken: row.accessToken, expires: null }, data,
          });
          break;
        } catch (error) {
          if (attempt === 2) throw error;
        }
      }
      if (saved.count !== 1) throw new Error('Session changed concurrently');
      result.migrated++;
    } catch {
      // Never print provider responses, credentials, or session records.
      // Stop so a failed save can be recovered with the original stored token.
      result.failed++;
      break;
    }
  }
  result.pending -= result.migrated;
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const apply = process.argv.includes('--apply');
  const limitArg = process.argv.find(arg => arg.startsWith('--limit='));
  const limit = limitArg ? Number(limitArg.split('=')[1]) : Infinity;
  if (!(limit > 0) || (limit !== Infinity && !Number.isInteger(limit))) {
    throw new Error('Limit must be a positive integer');
  }
  if (apply && (!process.env.SHOPIFY_API_KEY || !process.env.SHOPIFY_API_SECRET)) {
    throw new Error('Shopify credentials must be configured in the runtime environment');
  }
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  try {
    const result = await migrateOfflineTokens({ prisma, apply, limit });
    console.log(JSON.stringify({ mode: apply ? 'apply' : 'read-only', ...result }));
    if (result.failed) process.exitCode = 1;
  } catch {
    console.error('Migration stopped. Check database connectivity and schema. No credentials logged.');
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}
