/* ============================================================
   آزمون انتها-به-انتها روی سرور واقعی: اتاق، صندلی، نوبت، داوری
   دو کلاینت WebSocket به سرور محلی وصل می‌شوند و همان مسیری را
   می‌روند که دو گوشی واقعی می‌روند.
   ============================================================ */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4319;                     // پورت جدا تا با سرور در حال اجرا تصادم نکند
const BASE = `http://127.0.0.1:${PORT}`;
const WS = `ws://127.0.0.1:${PORT}`;
let srv;

before(async () => {
  srv = spawn(process.execPath, ['server.mjs'], {
    cwd: ROOT, env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore'
  });
  // منتظر بالا آمدن سرور
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${BASE}/api/health`);
      if (r.ok) return;
    } catch { /* هنوز نیامده */ }
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('سرور آزمون بالا نیامد');
});

after(() => { try { srv.kill(); } catch {} });

test('دو بازیکن: صندلی، شروع، نوبت، داوری سرور و بی‌نشتی', async () => {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const send = (ws, obj) => ws.send(JSON.stringify(obj));
  const last = (ws, type) => [...ws.msgs].reverse().find(m => m.type === type);

  async function createRoom() {
    const r = await fetch(`${BASE}/api/room`, { method: 'POST' });
    return r.json();
  }

  function open(code, token, hostToken) {
    const q = new URLSearchParams({ token });
    if (hostToken) q.set('host', hostToken);
    const ws = new WebSocket(`${WS}/api/room/${code}?${q}`);
    ws.msgs = [];
    ws.onmessage = (e) => { try { ws.msgs.push(JSON.parse(e.data)); } catch {} };
    return new Promise((res, rej) => {
      ws.onopen = () => res(ws);
      ws.onerror = () => rej(new Error('ws error'));
      setTimeout(() => rej(new Error('ws timeout')), 5000);
    });
  }
  const room = await createRoom();
  console.log('room', room.code, 'host token?', !!room.hostToken);

  const host = await open(room.code, room.token, room.hostToken);
  const guest = await open(room.code, room.token);
  await sleep(250);

  const wHost = last(host, 'welcome');
  const wGuest = last(guest, 'welcome');
  assert.ok(wHost?.payload?.youAre, 'میزبان شناسهٔ بازیکن نگرفت');
  assert.ok(wGuest?.payload?.youAre, 'مهمان شناسهٔ بازیکن نگرفت');
  assert.equal(wHost.payload.youAreHost, true, 'میزبان به‌عنوان میزبان شناخته نشد');
  assert.equal(wGuest.payload.youAreHost, false, 'مهمان نباید میزبان باشد');
  assert.notEqual(wHost.payload.youAre, wGuest.payload.youAre, 'دو بازیکن شناسهٔ یکسان گرفتند');

  // seat both
  send(host, { v:1, type:'seat', roomId: room.code, from:'srv-a', payload:{ name:'میزبان' } });
  send(guest, { v:1, type:'seat', roomId: room.code, from:'srv-b', payload:{ name:'مهمان' } });
  await sleep(300);
  let st = last(host, 'state');
  assert.equal(st?.seats?.length, 2, 'دو صندلی ساخته نشد');

  // guest tries to start -> must fail
  send(guest, { v:1, type:'start', roomId: room.code, from:'srv-b', payload:{} });
  await sleep(200);
  const err = last(guest, 'error');
  assert.match(err?.payload?.reason || '', /میزبان/, 'شروع توسط مهمان باید رد شود');

  // host starts
  send(host, { v:1, type:'start', roomId: room.code, from:'srv-a', payload:{} });
  await sleep(300);
  st = last(host, 'state');
  assert.equal(st?.phase, 'playing', 'بازی شروع نشد');
  assert.ok(st?.seed, 'سیید عمومی پخش نشد (برای ساخت دست لازم است)');

  // host is turn holder -> move
  const hostId = wHost.payload.youAre;
  const guestId = wGuest.payload.youAre;
  assert.equal(st.turn, hostId, 'نوبت اول باید با میزبان باشد');

  // wrong player moves
  send(guest, { v:1, type:'move', roomId: room.code, from:'srv-b', payload:{ action:{ type:'pass' } } });
  await sleep(200);
  assert.match(last(guest,'error')?.payload?.reason || '', /نوبت/, 'حرکت بی‌نوبت باید رد شود');

  send(host, { v:1, type:'move', roomId: room.code, from:'srv-a', payload:{ action:{ type:'score', payload:{ delta: 10 } } } });
  await sleep(300);
  st = last(host, 'state');
  assert.equal(st.turn, guestId, 'نوبت باید به بازیکن بعد برسد');
  const hostSeat = st.seats.find(x => x.playerId === hostId);
  assert.equal(hostSeat.score, 10, 'امتیاز حرکت اعمال نشد');

  // try to inject state -> must be rejected
  send(host, { v:1, type:'state', roomId: room.code, from:'srv-a', payload:{ seed:'evil' } });
  await sleep(200);
  assert.equal(last(host,'error')?.payload?.reason, 'state-is-server-authoritative',
    'کلاینت نباید بتواند وضعیت را جعل کند');

  // no private fields leaked anywhere
  const all = JSON.stringify([...host.msgs, ...guest.msgs]);
  for (const k of ['"hand"','"hands"','"cards"','"deck"','"secret"']) {
    assert.equal(all.includes(k), false, `نشت اطلاعات خصوصی: ${k}`);
  }

  // guest leaves -> turn must not hang
  guest.close();
  await sleep(500);
  st = last(host, 'state');
  assert.equal(st?.seats?.length, 1, 'صندلی بازیکنِ رفته آزاد نشد');
  assert.ok(st?.turn, 'با رفتن بازیکن، نوبت قفل شد');

  host.close();

});
