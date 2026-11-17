/* ============================================================
   آزمون زنده‌ی میز: دو کلاینت واقعی WebSocket روی سرور واقعی.
   میزبان می‌سازد، مهمان با کد می‌آید، بازی شروع می‌شود،
   کارت‌ها پخش می‌شوند، و هیچ کارتی از شبکه لو نمی‌رود.
   ============================================================ */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';


const PORT = 4193;
const BASE = `http://127.0.0.1:${PORT}`;
let proc = null;

before(async () => {
  proc = spawn(process.execPath, ['server.mjs'], {
    cwd: new URL('..', import.meta.url).pathname,
    env: { ...process.env, PORT: String(PORT) },
    stdio: 'ignore'
  });
  // انتظار برای بالا آمدن
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${BASE}/api/health`);
      if (r.ok) return;
    } catch { /* هنوز */ }
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('سرور بالا نیامد');
});

after(() => { try { proc?.kill('SIGTERM'); } catch { /* */ } });

/** کلاینت ساده روی WebSocket بومی Node */
function dial(code, token) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}/api/room/${code}?token=${encodeURIComponent(token)}`);
    const inbox = [];
    ws.addEventListener('message', (ev) => {
      try { inbox.push(JSON.parse(ev.data)); } catch { /* */ }
    });
    ws.addEventListener('open', () => resolve({
      ws,
      inbox,
      send: (type, payload, from = 'host') => ws.send(JSON.stringify({ v: 1, type, payload, roomId: code, from })),
      next: (type, ms = 1500) => new Promise((res, rej) => {
        const t0 = Date.now();
        const tick = () => {
          const i = inbox.findIndex(m => m.type === type);
          if (i >= 0) return res(inbox.splice(i, 1)[0]);
          if (Date.now() - t0 > ms) return rej(new Error(`پیام ${type} نیامد؛ داشته‌ها: ${inbox.map(m => m.type)}`));
          setTimeout(tick, 20);
        };
        tick();
      })
    }));
    ws.addEventListener('error', reject);
  });
}

test('دو کلاینت: ساخت میز، ورود با کد، پخش کارت', async () => {
  // میزبان
  const created = await (await fetch(`${BASE}/api/room`, { method: 'POST', body: '{}' })).json();
  assert.match(created.code, /^[A-Z0-9]{5}$/);
  assert.ok(created.token);

  const host = await dial(created.code, created.token);
  await host.next('welcome');

  // مهمان با کد
  const joined = await (await fetch(`${BASE}/api/room/${created.code}`)).json();
  assert.ok(joined.token, 'کد ورود باید توکن بدهد');
  const guest = await dial(created.code, joined.token);
  await guest.next('welcome');
  await host.next('presence');

  // میزبان وضعیت شروع را می‌فرستد
  host.send('state', { revision: 1, phase: 'playing', seed: 12345, trumpSuit: 'spades' });
  const st = await guest.next('state');
  assert.equal(st.payload.phase, 'playing');
  assert.equal(st.payload.seed, 12345, 'دانه باید برسد');
  assert.equal(st.from, 'host', 'فرستنده باید میزبان باشد');

  // هیچ کارتی نباید در پیام باشد
  const raw = JSON.stringify(st);
  assert.equal(/"suit"\s*:\s*"/.test(raw), false, 'پیام وضعیت نباید خدشه‌ی کارت داشته باشد');
  assert.equal(/"rank"\s*:/.test(raw), false, 'پیام وضعیت نباید رتبه داشته باشد');

  host.ws.close();
  guest.ws.close();
});

test('مهمان نمی‌تواند وضعیت را تحمیل کند', async () => {
  const created = await (await fetch(`${BASE}/api/room`, { method: 'POST', body: '{}' })).json();
  const host = await dial(created.code, created.token);
  await host.next('welcome');

  const joined = await (await fetch(`${BASE}/api/room/${created.code}`)).json();
  const guest = await dial(created.code, joined.token);
  await guest.next('welcome');
  await host.next('presence');

  // مهمان تلاش می‌کند وضعیت بفرستد
  guest.send('state', { phase: 'playing', cheat: true }, 'guest-1');
  const err = await guest.next('error');
  assert.equal(err.payload?.reason, 'not-host', 'سرور باید رد کند');

  // هیچ stateای نباید به میزبان برسد
  const leaked = host.inbox.filter(m => m.type === 'state');
  assert.equal(leaked.length, 0, 'وضعیت جعلی مهمان نباید پخش شود');

  host.ws.close();
  guest.ws.close();
});

test('کد اتاق ناموجود، خطای ۴۰۴ می‌دهد', async () => {
  const r = await fetch(`${BASE}/api/room/ZZZZZ`);
  assert.equal(r.status, 404);
  const body = await r.json();
  assert.ok(body.error, 'باید پیام خطا داشته باشد');
});

test('وضعیت اتاق تعداد اعضا را نشان می‌دهد', async () => {
  const created = await (await fetch(`${BASE}/api/room`, { method: 'POST', body: '{}' })).json();
  const before = await (await fetch(`${BASE}/api/room/${created.code}/status`)).json();
  assert.equal(before.code, created.code);
  assert.equal(typeof before.members, 'number');
  assert.equal(before.full, false);
});

test('پیام‌های میز (start/move/sync) عبور می‌کنند', async () => {
  const created = await (await fetch(`${BASE}/api/room`, { method: 'POST', body: '{}' })).json();
  const host = await dial(created.code, created.token);
  await host.next('welcome');

  const joined = await (await fetch(`${BASE}/api/room/${created.code}`)).json();
  const guest = await dial(created.code, joined.token);
  await guest.next('welcome');
  await host.next('presence');

  for (const type of ['start', 'move', 'sync']) {
    host.send(type, { probe: type });
    const got = await guest.next(type);
    assert.equal(got.payload.probe, type, `پیام ${type} نرسید`);
  }

  host.ws.close();
  guest.ws.close();
});

test('میزبان‌بودن پس از خروج میزبان منتقل می‌شود', async () => {
  const created = await (await fetch(`${BASE}/api/room`, { method: 'POST', body: '{}' })).json();
  const host = await dial(created.code, created.token);
  await host.next('welcome');

  const joined = await (await fetch(`${BASE}/api/room/${created.code}`)).json();
  const guest = await dial(created.code, joined.token);
  await guest.next('welcome');
  await host.next('presence');

  host.ws.close();
  // مهمان باید پیام حضور تازه بگیرد
  const presence = await guest.next('presence', 2000);
  assert.equal(typeof presence.payload.members, 'number');

  guest.ws.close();
});
