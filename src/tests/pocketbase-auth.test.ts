import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AUTH_COLLECTION,
  generateAppUid,
  isPocketBaseId,
  pbCreateAuthUser,
  pbFindAuthUserByEmail,
  pbSetPasswordByAppUid,
  pbVerifyPassword,
} from '@/lib/pocketbase/auth-users';

/**
 * The PocketBase account store is the identity authority, so its request shapes
 * are security-relevant, not cosmetic:
 *
 *   • the auth collection must be created as `type: 'auth'` with password auth
 *     ON and superuser-only record rules, or either every login fails or the
 *     credential collection becomes publicly readable;
 *   • password verification must go to the guest `auth-with-password` endpoint
 *     WITHOUT the superuser token, or the superuser's own session is what gets
 *     verified and any password "works";
 *   • duplicates must be reported as `duplicate_email` so registration can
 *     refuse without creating a second identity.
 *
 * fetch is replaced with a fake that records every call; no network is used.
 */

/**
 * Configured for this file only, and removed again afterwards: leaving these
 * set would switch PocketBase on for every other test file in the same
 * process, which changes their behaviour (this exact leak made the growth
 * scheduler suite fail when it ran after this one).
 */
const PB_ENV = {
  POCKETBASE_URL: 'https://pb.test',
  POCKETBASE_ADMIN_EMAIL: 'admin@test',
  POCKETBASE_ADMIN_PASSWORD: 'secret',
};

interface Call {
  url: string;
  init: RequestInit;
  headers: Record<string, string>;
  body: Record<string, unknown> | null;
}

const calls: Call[] = [];

/** JSON response helper. */
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

let collectionExists = true;
let createRecordResponse: () => Response = () =>
  json({ id: 'abc123def456ghi', appUid: 'abc123def456ghi', email: 'a@b.com' });
let listRows: unknown[] = [];

const realFetch = globalThis.fetch;

const fakeFetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
  const url = typeof input === 'string' ? input : input.toString();
  const headers = (init.headers ?? {}) as Record<string, string>;
  let body: Record<string, unknown> | null = null;
  if (typeof init.body === 'string') {
    body = JSON.parse(init.body) as Record<string, unknown>;
  }
  calls.push({ url, init, headers, body });

  // Superuser auth (the credential every other call is signed with).
  if (url.endsWith('/auth-with-password') && url.includes('_superusers')) {
    return json({ token: 'superuser-token' });
  }
  // Collection schema read.
  if (url.endsWith(`/api/collections/${AUTH_COLLECTION}`) && !init.method) {
    return collectionExists
      ? json({ name: AUTH_COLLECTION, type: 'auth', passwordAuth: { enabled: true }, fields: [] })
      : new Response('missing', { status: 404 });
  }
  // Collection create.
  if (url.endsWith('/api/collections') && init.method === 'POST') {
    return json({ name: AUTH_COLLECTION }, 200);
  }
  // Paginated list.
  if (url.includes(`/api/collections/${AUTH_COLLECTION}/records?`)) {
    return json({ items: listRows, totalItems: listRows.length });
  }
  // Record create.
  if (url.endsWith(`/api/collections/${AUTH_COLLECTION}/records`)) {
    return createRecordResponse();
  }
  // Record update.
  if (/\/records\/[a-z0-9]+$/.test(url) && init.method === 'PATCH') {
    return json({ ok: true });
  }
  // Guest password auth.
  if (url.endsWith(`/api/collections/${AUTH_COLLECTION}/auth-with-password`)) {
    return json({
      token: 'user-token',
      record: { id: 'abc123def456ghi', appUid: 'abc123def456ghi', email: 'a@b.com' },
    });
  }
  return new Response('unexpected', { status: 500 });
}) as typeof fetch;

test.before(() => {
  Object.assign(process.env, PB_ENV);
  globalThis.fetch = fakeFetch;
});

test.after(() => {
  for (const key of Object.keys(PB_ENV)) delete process.env[key];
  globalThis.fetch = realFetch;
});

test.beforeEach(() => {
  globalThis.fetch = fakeFetch;
  calls.length = 0;
  collectionExists = true;
  listRows = [];
});

test('the auth collection is created as a locked auth collection with password auth', async () => {
  collectionExists = false;
  await pbFindAuthUserByEmail('nobody@example.com');

  const create = calls.find((call) => call.url.endsWith('/api/collections') && call.init.method === 'POST');
  assert.ok(create, 'the missing collection must be created');
  const body = create.body!;
  assert.equal(body.type, 'auth');
  assert.deepEqual(body.passwordAuth, { enabled: true, identityFields: ['email'] });
  assert.equal(body.listRule, null);
  assert.equal(body.createRule, null);
  assert.equal(body.updateRule, null);
  assert.equal(body.deleteRule, null);
  // Custom fields only — PocketBase owns email/password/verified.
  const fieldNames = (body.fields as { name: string }[]).map((field) => field.name);
  assert.ok(fieldNames.includes('appUid'));
  assert.ok(!fieldNames.includes('email'));
  assert.ok(!fieldNames.includes('password'));
});

test('password verification goes to the guest endpoint without the superuser token', async () => {
  const result = await pbVerifyPassword('A@B.com', 'hunter2hunter2');
  assert.equal(result.ok, true);

  const call = calls.find((entry) => entry.url.endsWith('/auth-with-password') && !entry.url.includes('_superusers'));
  assert.ok(call, 'auth-with-password must be called');
  assert.equal(call.headers.Authorization, undefined, 'the superuser token must never be used to verify a password');
  assert.equal(call.body?.identity, 'a@b.com', 'the email must be normalised before lookup');
  assert.equal(call.body?.password, 'hunter2hunter2');
});

test('a wrong password is reported as invalid credentials, not as an outage', async () => {
  const realAuth = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.endsWith('/auth-with-password') && !url.includes('_superusers')) {
      return new Response('{"message":"Failed to authenticate."}', { status: 400 });
    }
    return realAuth(input, init);
  }) as typeof fetch;

  try {
    const result = await pbVerifyPassword('a@b.com', 'wrong');
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.failure.kind, 'invalid_credentials');
  } finally {
    globalThis.fetch = realAuth;
  }
});

test('throttled verification is reported as rate_limited so the UI can say so', async () => {
  const realAuth = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.endsWith('/auth-with-password') && !url.includes('_superusers')) {
      return new Response('{}', { status: 429 });
    }
    return realAuth(input, init);
  }) as typeof fetch;

  try {
    const result = await pbVerifyPassword('a@b.com', 'whatever');
    assert.equal(result.ok === false && result.failure.kind, 'rate_limited');
  } finally {
    globalThis.fetch = realAuth;
  }
});

test('an app uid is exactly 15 lowercase alphanumerics (a legal PocketBase id)', async () => {
  for (let i = 0; i < 50; i++) {
    const uid = generateAppUid();
    assert.match(uid, /^[a-z0-9]{15}$/);
  }
});

test('creating an account uses the app uid as the record id and sends both password fields', async () => {
  const created = await pbCreateAuthUser({
    email: 'New@Example.com',
    password: 'longenoughpassword',
    appUid: 'abc123def456ghi',
    fullName: 'New Person',
    userRole: 'seller',
  });

  assert.equal(created.ok, true);
  const create = calls.find((call) => call.url.endsWith(`/api/collections/${AUTH_COLLECTION}/records`) && call.init.method === 'POST');
  assert.ok(create);
  assert.equal(create.body?.id, 'abc123def456ghi');
  assert.equal(create.body?.appUid, 'abc123def456ghi');
  assert.equal(create.body?.email, 'new@example.com');
  assert.equal(create.body?.password, 'longenoughpassword');
  assert.equal(create.body?.passwordConfirm, 'longenoughpassword');
  assert.equal(create.body?.userRole, 'seller');
});

test('a duplicate email is a typed failure, never a silent second account', async () => {
  createRecordResponse = () =>
    new Response(
      JSON.stringify({
        data: { email: { code: 'validation_not_unique', message: 'The email is invalid or already in use.' } },
      }),
      { status: 400 },
    );

  const created = await pbCreateAuthUser({
    email: 'taken@example.com',
    password: 'longenoughpassword',
    appUid: 'aaa111bbb222ccc',
  });

  assert.equal(created.ok, false);
  assert.equal(created.ok === false && created.failure.kind, 'duplicate_email');
  createRecordResponse = () => json({ id: 'abc123def456ghi', appUid: 'abc123def456ghi', email: 'a@b.com' });
});

test('a password reset targets the record mapped from the app uid', async () => {
  listRows = [{ id: 'rec00000000000x', appUid: 'firebaseuid123', email: 'legacy@example.com' }];

  const ok = await pbSetPasswordByAppUid('firebaseuid123', 'brandnewpassword');
  assert.equal(ok, true);

  const patch = calls.find((call) => call.init.method === 'PATCH' && call.url.includes('/records/'));
  assert.ok(patch, 'the password update must PATCH the mapped record');
  assert.ok(patch.url.endsWith('/records/rec00000000000x'));
  assert.equal(patch.body?.password, 'brandnewpassword');
  assert.equal(patch.body?.passwordConfirm, 'brandnewpassword');
});

test('a legacy Firebase uid is never sent as the PocketBase record id', async () => {
  // Regression: Firebase uids are 28 mixed-case characters, and PocketBase
  // rejects anything but 15 [a-z0-9]. Sending it made every migrated account
  // fail creation, which is the live "account exists but could not be prepared
  // for sign-in" login error. The uid still travels as `appUid`.
  const legacyUid = 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4';
  const created = await pbCreateAuthUser({
    email: 'legacy@example.com',
    password: 'longenoughpassword',
    appUid: legacyUid,
    userRole: 'buyer',
  });

  assert.equal(created.ok, true);
  const create = calls
    .filter(
      (call) =>
        call.url.endsWith(`/api/collections/${AUTH_COLLECTION}/records`) &&
        call.init.method === 'POST',
    )
    .pop();
  assert.ok(create);
  assert.equal(create.body?.id, undefined, 'a 28-char uid is not a legal PocketBase id');
  assert.equal(create.body?.appUid, legacyUid);
  assert.equal(isPocketBaseId(legacyUid), false);
  assert.equal(isPocketBaseId(generateAppUid()), true);
});

test('with no PocketBase configured every helper reports "not configured" instead of throwing', async () => {
  const url = process.env.POCKETBASE_URL;
  delete process.env.POCKETBASE_URL;

  try {
    const created = await pbCreateAuthUser({
      email: 'a@b.com',
      password: 'longenoughpassword',
      appUid: 'abc123def456ghi',
    });
    assert.equal(created.ok === false && created.failure.kind, 'not_configured');
    assert.equal(await pbFindAuthUserByEmail('a@b.com'), null);
  } finally {
    process.env.POCKETBASE_URL = url;
  }
});
