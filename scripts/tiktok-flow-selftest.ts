/**
 * Runtime self-test for the Social Reach OAuth state — run only against the
 * local preview. Prints pass/fail, never any secret or token value.
 */
import { issueOAuthState, verifyOAuthState } from '../src/lib/tiktok/oauth-state';

const SECRET = 'self-test-secret-entropy-ABCDEFGH12345678';

const results: Array<[string, boolean]> = [];
const check = (name: string, ok: boolean) => results.push([name, ok]);

const state = issueOAuthState('seller-uid-1', SECRET);
check('valid state returns the uid', verifyOAuthState(state, state, SECRET) === 'seller-uid-1');

const parts = state.split('.');
parts[1] = 'attacker-uid';
check('tampered uid rejected', verifyOAuthState(parts.join('.'), parts.join('.'), SECRET) === null);

check('raw UID rejected', verifyOAuthState('seller-uid-1', 'seller-uid-1', SECRET) === null);

check('cookie/state mismatch rejected', verifyOAuthState(state, issueOAuthState('seller-uid-1', SECRET), SECRET) === null);
check('missing cookie rejected', verifyOAuthState(state, null, SECRET) === null);

const expired = issueOAuthState('seller-uid-1', SECRET, Date.now() - 11 * 60 * 1000);
check('expired state rejected', verifyOAuthState(expired, expired, SECRET) === null);

check('wrong secret rejected', verifyOAuthState(state, state, 'another-long-enough-secret-ZZZZ9999') === null);
check('secret never embedded in state', !state.includes(SECRET));
check('state is versioned v1', state.startsWith('v1.'));

let failed = 0;
for (const [name, ok] of results) {
  if (!ok) failed += 1;
  process.stdout.write(`${ok ? 'ok  ' : 'FAIL'} ${name}\n`);
}
process.stdout.write(`\n${results.length - failed}/${results.length} oauth-state checks passed\n`);
process.exit(failed === 0 ? 0 : 1);
