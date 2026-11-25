/**
 * Smoke test: unauthenticated endpoints must return 401/403 as expected.
 *
 * Usage:
 *   node testing/smoke-unauth.mjs http://localhost:3000
 */

const base = (process.argv[2] || 'http://localhost:3000').replace(/\/$/, '');

const tests = [
  { name: 'GET /api/shifts', method: 'GET', path: '/api/shifts', expect: [401] },
  { name: 'PATCH /api/approvals/manage', method: 'PATCH', path: '/api/approvals/manage', expect: [401] },
  { name: 'DELETE /api/approvals/manage', method: 'DELETE', path: '/api/approvals/manage', expect: [401] },
  { name: 'GET /api/schedules', method: 'GET', path: '/api/schedules', expect: [401] },
  { name: 'GET /api/operator-schedules', method: 'GET', path: '/api/operator-schedules', expect: [401] },
  { name: 'GET /api/settings', method: 'GET', path: '/api/settings', expect: [401] },
  { name: 'GET /api/reports/kpi', method: 'GET', path: '/api/reports/kpi', expect: [401, 403] },
  { name: 'GET /api/dashboard', method: 'GET', path: '/api/dashboard', expect: [401] },
];

async function run() {
  let ok = 0;
  let bad = 0;

  for (const t of tests) {
    const url = `${base}${t.path}`;
    let status = 0;
    let body = '';
    try {
      const res = await fetch(url, { method: t.method, redirect: 'manual' });
      status = res.status;
      body = await res.text();
    } catch (e) {
      console.error(`[ERR] ${t.name} -> network error`, e);
      bad++;
      continue;
    }

    const pass = t.expect.includes(status);
    if (pass) {
      console.log(`[OK]  ${t.name} -> ${status}`);
      ok++;
    } else {
      console.error(`[BAD] ${t.name} -> ${status} (expected ${t.expect.join(' or ')})`);
      console.error(`      ${url}`);
      if (body) console.error(`      body: ${body.slice(0, 200)}`);
      bad++;
    }
  }

  console.log(`\nDone. ok=${ok} bad=${bad}`);
  process.exitCode = bad ? 1 : 0;
}

run();
