/**
 * resend-domains.mjs — read-only Resend configuration check.
 *
 * Answers two launch questions without ever printing a credential:
 *   1. is EMAIL_API_KEY present and accepted by Resend's API?
 *   2. is each sending domain verified, and are its DNS records satisfied?
 *
 * The API key is read from the process environment inside this script and is
 * NEVER logged, echoed or written anywhere. Output is names + statuses only.
 *
 * Usage:  node scripts/resend-domains.mjs
 */

const key = (process.env.EMAIL_API_KEY ?? '').trim();
const provider = (process.env.EMAIL_PROVIDER ?? '').trim();
const mode = (process.env.EMAIL_MODE ?? '').trim();

console.log('EMAIL_PROVIDER set :', provider ? `yes (${provider})` : 'NO');
console.log('EMAIL_API_KEY set  :', key ? 'yes' : 'NO');
console.log('EMAIL_MODE         :', mode || '(unset → development)');
console.log('EMAIL_WEBHOOK_SECRET set:', (process.env.EMAIL_WEBHOOK_SECRET ?? '').trim() ? 'yes' : 'NO');

if (!key) {
  console.log('\nRESULT: no API key in this environment — cannot query Resend.');
  process.exit(0);
}

const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };

try {
  const res = await fetch('https://api.resend.com/domains', { headers });
  console.log(`\nGET /domains → HTTP ${res.status}`);
  if (!res.ok) {
    const body = (await res.text()).slice(0, 200);
    // Bounded provider error only — never the request headers.
    console.log('response:', body);
    if (res.status === 401) console.log('RESULT: the API key was rejected (401).');
    process.exit(0);
  }
  const data = await res.json();
  const domains = Array.isArray(data?.data) ? data.data : [];
  console.log(`domains on this account: ${domains.length}`);
  for (const d of domains) {
    console.log(
      ` - ${d.name}: status=${d.status} created=${(d.created_at ?? '').slice(0, 10)} id=${d.id}`,
    );
  }

  const target = domains.find((d) => d.name === 'vidnov.com');
  if (target) {
    const detail = await fetch(`https://api.resend.com/domains/${target.id}`, { headers });
    if (detail.ok) {
      const full = await detail.json();
      const records = full?.records ?? [];
      console.log('\nvidnov.com DNS records as Resend sees them:');
      for (const r of records) {
        console.log(`   ${r.record} ${r.name ?? ''} → ${r.status}${r.value ? '' : ''}`);
      }
      console.log(`\nRESULT: vidnov.com is ${target.status} in Resend.`);
    } else {
      console.log(`\ndetail fetch → HTTP ${detail.status}`);
    }
  } else {
    console.log('\nRESULT: vidnov.com is NOT among this account\'s domains.');
  }
} catch (err) {
  console.log('network error:', err instanceof Error ? err.message.slice(0, 140) : 'unknown');
}
