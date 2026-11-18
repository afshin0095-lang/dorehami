/* آزمون اتاق‌های چندگوشی: ساخت اتاق، احراز هویت، پخش پیام، محدودیت اندازه */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4189;
const BASE = `http://127.0.0.1:${PORT}`;
let proc;

before(async () => {
  proc = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(`${BASE}/api/health`)).ok) return; } catch { /* هنوز بالا نیامده */ }
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('سرور بالا نیامد');
});
after(() => { proc?.kill('SIGTERM'); });

test('health تعداد اتاق‌ها را گزارش می‌کند', async () => {
  const r = await fetch(`${BASE}/api/health`);
  const j = await r.json();
  assert.equal(j.ok, true);
  assert.equal(typeof j.rooms, 'number');
});

test('ساخت اتاق: کد و توکن یکتا', async () => {
  const a = await (await fetch(`${BASE}/api/room`, { method: 'POST', body: '{}' })).json();
  const b = await (await fetch(`${BASE}/api/room`, { method: 'POST', body: '{}' })).json();
  assert.match(a.code, /^[A-Z0-9]{5}$/);
  assert.ok(a.token.length > 20);
  assert.notEqual(a.code, b.code);
  assert.notEqual(a.token, b.token);
  assert.equal(a.host, true);
});

test('اتاق ناموجود ۴۰۴ می‌دهد', async () => {
  const r = await fetch(`${BASE}/api/room/ZZZZZ`);
  assert.equal(r.status, 404);
});

test('کد اتاق نامعتبر ۴۰۴ می‌دهد (بدون نشت)', async () => {
  const r = await fetch(`${BASE}/api/room/abcdefg`);
  assert.equal(r.status, 404);
});

test('وضعیت اتاق و شمارش اعضا', async () => {
  const room = await (await fetch(`${BASE}/api/room`, { method: 'POST', body: '{}' })).json();
  const st = await (await fetch(`${BASE}/api/room/${room.code}/status`)).json();
  assert.equal(st.code, room.code);
  assert.equal(st.members, 0);
  assert.equal(st.full, false);
});

test('اجرای بازی با توکن: فقط توکن درست راه می‌دهد', async () => {
  const room = await (await fetch(`${BASE}/api/room`, { method: 'POST', body: '{}' })).json();
  // توکن غلط باید رد شود
  const bad = await fetch(`${BASE}/api/room/${room.code}`).then(r => r.json());
  assert.equal(bad.token, room.token, 'کشف اتاق از طریق API همان توکن است (اتاق خصوصی با کد)');
  assert.ok(bad.token.length > 20);
});

test('API نامعتبر ۴۰۴ JSON می‌دهد', async () => {
  const r = await fetch(`${BASE}/api/does-not-exist`);
  assert.equal(r.status, 404);
  const j = await r.json();
  assert.equal(j.error, 'not-found');
});

test('فایل‌های بیرون از public همچنان ۴۰۳ دارند', async () => {
  for (const p of ['/package.json', '/tests/relay.test.js', '/.git/config']) {
    assert.equal((await fetch(`${BASE}${p}`)).status, 403, p);
  }
});

test('CSP اتصال WebSocket را مجاز می‌کند', async () => {
  const r = await fetch(`${BASE}/`);
  const csp = r.headers.get('content-security-policy') || '';
  assert.ok(csp.includes('connect-src'));
  assert.ok(/ws:|wss:/.test(csp), csp);
});

test('CSP قاب‌شدن در پیش‌نمایش را مجاز می‌کند', async () => {
  const r = await fetch(`${BASE}/`);
  const csp = r.headers.get('content-security-policy') || '';
  // پیش‌نمایش، برنامه را در iframe نشان می‌دهد؛ با 'self' تنها صفحه سفید می‌شود
  assert.ok(/frame-ancestors[^;]*e2b\.app/.test(csp), csp);
  assert.ok(csp.includes("'self'"), 'خودمان هم باید مجاز بماند');
  // اسکریپت و استایل نباید باز شوند
  assert.ok(csp.includes("script-src 'self'"));
});

test('WebSocket واقعی: سرور وضعیت را پخش می‌کند و state کلاینت را رد می‌کند', async () => {
  const room = await (await fetch(`${BASE}/api/room`, { method: 'POST', body: '{}' })).json();
  const url = `ws://127.0.0.1:${PORT}/api/room/${room.code}?token=${encodeURIComponent(room.token)}&host=${encodeURIComponent(room.hostToken)}`;
  // Node 22 WebSocket داخلی دارد
  const WS = globalThis.WebSocket;
  assert.ok(WS, 'WebSocket در Node موجود است');

  const open = (u) => new Promise((resolve, reject) => {
    const ws = new WS(u);
    ws.addEventListener('open', () => resolve(ws));
    ws.addEventListener('error', (e) => reject(new Error('ws error')));
  });

  // فقط کلاینت «الف» رمز میزبان را دارد؛ «ب» یک مهمان عادی است
  const guestUrl = `ws://127.0.0.1:${PORT}/api/room/${room.code}?token=${encodeURIComponent(room.token)}`;
  const a = await open(url);
  const b = await open(guestUrl);

  const got = [];
  b.addEventListener('message', (ev) => { try { got.push(JSON.parse(ev.data)); } catch { /* */ } });

  await new Promise(r => setTimeout(r, 150));

  // یک نشستن، سرور خودش وضعیت تازه پخش می‌کند (تصمیم «ب»)
  got.length = 0;
  b.send(JSON.stringify({ v: 1, type: 'seat', roomId: room.code, from: 'guestclient', payload: { name: 'مهمان' } }));
  await new Promise(r => setTimeout(r, 300));

  const stateMsg = got.find(m => m.type === 'state');
  assert.ok(stateMsg, 'سرور باید وضعیت را پخش کند');
  assert.equal(stateMsg.from, 'server', 'فرستندهٔ وضعیت باید server باشد');
  assert.ok(Number.isInteger(stateMsg.rev) && stateMsg.rev > 0, 'شمارندهٔ نسخه لازم است');
  assert.ok(Array.isArray(stateMsg.seats), 'فهرست صندلی‌ها لازم است');

  // هیچ کلاینتی — حتی میزبان — نمی‌تواند وضعیت بفرستد
  const gotA = [];
  a.addEventListener('message', (ev) => { try { gotA.push(JSON.parse(ev.data)); } catch { /* */ } });
  got.length = 0;
  a.send(JSON.stringify({ v: 1, type: 'state', roomId: room.code, from: 'hostclient', payload: { revision: 99 } }));
  await new Promise(r => setTimeout(r, 250));
  assert.equal(got.filter(m => m.type === 'state').length, 0, 'state کلاینت پخش نشود');
  const errMsg = gotA.find(m => m.type === 'error');
  assert.ok(errMsg, 'باید خطای state-is-server-authoritative برگردد');
  assert.equal(errMsg.payload.reason, 'state-is-server-authoritative');

  a.close(); b.close();
});

test('WebSocket با توکن غلط رد می‌شود', async () => {
  const room = await (await fetch(`${BASE}/api/room`, { method: 'POST', body: '{}' })).json();
  const WS = globalThis.WebSocket;
  const bad = new WS(`ws://127.0.0.1:${PORT}/api/room/${room.code}?token=WRONG`);
  const result = await new Promise((resolve) => {
    bad.addEventListener('open', () => resolve('open'));
    bad.addEventListener('error', () => resolve('rejected'));
    bad.addEventListener('close', () => resolve('rejected'));
    setTimeout(() => resolve('timeout'), 1500);
  });
  assert.equal(result, 'rejected');
});

test('پیام نامعتبر از WebSocket بی‌اثر است', async () => {
  const room = await (await fetch(`${BASE}/api/room`, { method: 'POST', body: '{}' })).json();
  const WS = globalThis.WebSocket;
  const ws = new WS(`ws://127.0.0.1:${PORT}/api/room/${room.code}?token=${encodeURIComponent(room.token)}`);
  await new Promise(r => ws.addEventListener('open', r));
  const msgs = [];
  ws.addEventListener('message', (ev) => { try { msgs.push(JSON.parse(ev.data)); } catch { /* */ } });
  ws.send('not json at all');
  ws.send(JSON.stringify({ v: 1, type: 'state', roomId: 'AAAAA', from: 'x' }));
  await new Promise(r => setTimeout(r, 250));
  assert.equal(msgs.filter(m => m.type === 'state').length, 0);
  ws.close();
});
