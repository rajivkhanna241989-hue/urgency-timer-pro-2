import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateOfflineTokens } from '../scripts/migrate-offline-tokens.mjs';
const row = { id: 'offline_test', shop: 'test.myshopify.com', accessToken: 'old' };
const token = { access_token: 'new', refresh_token: 'refresh', expires_in: 3600, refresh_token_expires_in: 604800 };
function fixture(update = async () => ({ count: 1 })) {
 return { session: { findMany: async () => [row], updateMany: update } };
}
test('default only reports pending sessions', async () => {
 const result = await migrateOfflineTokens({ prisma: fixture(), exchange: () => assert.fail('must not exchange') });
 assert.deepEqual(result, { pending: 1, migrated: 0, failed: 0 });
});
test('stores both tokens and expiries atomically with concurrency protection', async () => {
 let write;
 const prisma = fixture(async value => { write = value; return { count: 1 }; });
 const result = await migrateOfflineTokens({ prisma, apply: true, exchange: async (url, options) => {
  assert.equal(url, 'https://test.myshopify.com/admin/oauth/access_token');
  assert.equal(options.body.get('expiring'), '1');
  assert.equal(options.body.get('subject_token'), 'old');
  return { ok: true, json: async () => token };
 } });
 assert.equal(result.migrated, 1);
 assert.equal(write.where.accessToken, 'old');
 assert.equal(write.where.expires, null);
 assert.equal(write.data.refreshToken, 'refresh');
 assert.ok(write.data.expires instanceof Date);
 assert.ok(write.data.refreshTokenExpires > write.data.expires);
});
test('rejects incomplete token response without database writes', async () => {
 const prisma = fixture(() => assert.fail('must not write'));
 const result = await migrateOfflineTokens({ prisma, apply: true, exchange: async () => ({ ok: true, json: async () => ({ access_token: 'new' }) }) });
 assert.equal(result.failed, 1);
});
test('stops on persistence failure after retrying the same pair', async () => {
 let attempts = 0;
 const result = await migrateOfflineTokens({ prisma: fixture(async () => { attempts++; throw new Error('db'); }), apply: true, exchange: async () => ({ ok: true, json: async () => token }) });
 assert.equal(result.failed, 1);
 assert.equal(attempts, 3);
});
test('does not follow token requests to an untrusted host', async () => {
 const prisma = fixture();
 prisma.session.findMany = async () => [{ ...row, shop: 'attacker.example' }];
 const result = await migrateOfflineTokens({ prisma, apply: true, exchange: () => assert.fail('must not exchange') });
 assert.equal(result.failed, 1);
});
test('leaves rejected legacy sessions intact and continues to the next store', async () => {
 const prisma = fixture();
 prisma.session.findMany = async () => [row, { ...row, id: 'offline_second', shop: 'second.myshopify.com' }];
 let count = 0;
 const result = await migrateOfflineTokens({ prisma, apply: true, exchange: async () => ++count === 1
  ? { ok: false, status: 400, json: async () => ({ error: 'invalid_subject_token' }) }
  : { ok: true, json: async () => token } });
 assert.equal(result.failed, 1);
 assert.equal(result.migrated, 1);
});
