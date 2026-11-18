/* ============================================================
   آزمون صداها
   کاربر صراحتاً صداهای کاغذی خواست (لغزش کارت، خش‌خش کاغذ) و
   «بوق» را رد کرد. این آزمون قفل می‌کند که هر صدای فراخوانی‌شده
   واقعاً تعریف شده باشد — وگرنه بی‌صدا به tap برمی‌گردد.
   ============================================================ */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const core = readFileSync(join(ROOT, 'public/src/core.js'), 'utf8');
const libSrc = core.slice(core.indexOf('const SOUND_LIB'), core.indexOf('export function playSound'));
const defined = new Set([...libSrc.matchAll(/^  '([a-z-]+)':/gm)].map(m => m[1]));

const gamesDir = join(ROOT, 'public/src/games');
const used = new Set();
for (const f of readdirSync(gamesDir)) {
  const src = readFileSync(join(gamesDir, f), 'utf8');
  for (const m of src.matchAll(/playSound\('([a-z-]+)'\)/g)) used.add(m[1]);
}

test('هر صدای فراخوانی‌شده در بازی‌ها تعریف شده است', () => {
  const missing = [...used].filter(u => !defined.has(u));
  assert.equal(missing.length, 0, `بدون تعریف (بی‌صدا به tap می‌افتد): ${missing.join(', ')}`);
});

test('صداهای پایهٔ کاغذ موجودند', () => {
  for (const s of ['paper-flip', 'card-deal', 'card-slide', 'shuffle', 'tap', 'seal', 'unwrap']) {
    assert.ok(defined.has(s), `صدای «${s}» تعریف نشده`);
  }
});

test('صدای لغزش ورق و خطا هست (کاربر خواسته بود)', () => {
  assert.ok(defined.has('card-slide'), 'صدای لغزش کارت روی کارت نیست');
  assert.ok(defined.has('error'), 'صدای خطا نیست');
  // خطا نباید بوق باشد: باید لایه‌ی نویزی/کاغذی داشته باشد
  const block = libSrc.slice(libSrc.indexOf("'error'"), libSrc.indexOf("'error'") + 260);
  assert.ok(/freq:/.test(block) && /q:/.test(block), 'صدای خطا لایهٔ کاغذی ندارد');
});

test('هر صدا حداقل یک لایه دارد', () => {
  const re = /'([a-z-]+)':\s*\[([\s\S]*?)\]/g;
  let m, count = 0;
  while ((m = re.exec(libSrc))) {
    count++;
    assert.ok(m[2].includes('freq:'), `صدای «${m[1]}» لایهٔ صوتی ندارد`);
    assert.ok(m[2].includes('gain:'), `صدای «${m[1]}» بلندی ندارد`);
  }
  assert.ok(count >= 10, `فقط ${count} صدا تعریف شده`);
});

test('صدای برد و باخت از هم متفاوت‌اند', () => {
  assert.ok(defined.has('win') && defined.has('lose'));
  const win = libSrc.slice(libSrc.indexOf("'win'"), libSrc.indexOf("'lose'"));
  const lose = libSrc.slice(libSrc.indexOf("'lose'"), libSrc.indexOf("'card-slide'"));
  assert.notEqual(win.trim(), lose.trim());
});
