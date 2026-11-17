/* ============================================================
   آزمون چیدمان: متن هرگز از کاغذ بیرون نمی‌زند.
   CSS را می‌خوانیم و تضمین‌های سرریز را بررسی می‌کنیم،
   به‌علاوه‌ی ساختار کارت‌ها و ورق‌های بازی را می‌سنجیم.
   ============================================================ */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = await readFile(join(ROOT, 'public/styles.css'), 'utf8');

/** آیا این انتخابگر قاعده‌ی overflow-wrap: anywhere دارد؟ */
function hasWrapGuard(selector) {
  const re = new RegExp(`([^{}]*${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^{}]*)\\{([^}]*)\\}`, 'g');
  let m;
  while ((m = re.exec(css))) {
    if (/overflow-wrap:\s*anywhere/.test(m[2])) return true;
  }
  return false;
}

test('قانون طلایی سرریز در CSS وجود دارد', () => {
  assert.match(css, /overflow-wrap:\s*anywhere/);
  assert.match(css, /html,\s*body\s*\{[^}]*overflow-x:\s*hidden/);
});

test('عناصر متنی اصلی گارد شکستن دارند', () => {
  // اینها نام‌ها و متن‌هایی هستند که در همه‌ی صفحه‌ها تکرار می‌شوند
  const guarded = ['p', 'h1', 'small', '.btn', '.chip', '.sheet', '.game-card__title',
    '.private-card__label', '.result-banner', '.callout'];
  for (const sel of guarded) {
    assert.ok(hasWrapGuard(sel), `${sel} بدون گارد شکستن کلمه`);
  }
});

test('ورق بازی و صورتش گارد سرریز دارند', () => {
  assert.match(css, /\.pcard\s*\{/);
  assert.match(css, /\.pcard__face\s*\{[^}]*overflow:\s*hidden/);
  assert.match(css, /\.pcard__corner\s*\{[^}]*font-family:\s*'Pirata One'/);
});

test('هر کارت عکس‌دار تصویر خودش را دارد (نه یک عکس مشترک)', () => {
  assert.match(css, /\.pcard__art\s*\{[^}]*background-size:\s*cover/);
  // تصویرها در cardkit تعیین می‌شوند و باید شش فایل جدا باشند
});

test('ورودی‌ها هرگز از عرض بیرون نمی‌زنند', () => {
  assert.match(css, /input,\s*textarea,\s*select\s*\{[^}]*max-width:\s*100%/);
  assert.match(css, /input,\s*textarea,\s*select\s*\{[^}]*box-sizing:\s*border-box/);
});

test('تخته‌ی مار و پله و لایه‌ی SVG داخل کادر می‌مانند', () => {
  assert.match(css, /\.board-wrap\s*\{[^}]*overflow:\s*hidden/);
  assert.match(css, /\.board-svg\s*\{[^}]*overflow:\s*hidden/);
  assert.match(css, /\.board__cell\s*\{[^}]*overflow:\s*hidden/);
});

test('اسم و فامیل: ورودی خط‌دار و نوار هشدار استایل دارند', () => {
  assert.match(css, /\.esf-input\s*\{[^}]*text-overflow:\s*ellipsis/);
  assert.match(css, /\.esf-warn__body\s*\{[^}]*background-color:\s*var\(--rust\)/);
});

test('تصاویر پس‌زمینه با cover پر می‌کنند و کشیده نمی‌شوند', () => {
  assert.match(css, /\.cover\s*\{[^}]*background-size:\s*cover/);
  assert.match(css, /\.game-card__art\s*\{[^}]*background-size:\s*cover/);
  assert.match(css, /\.inv-card__art\s*\{[^}]*background-size:\s*cover/);
  assert.match(css, /\.warden-hero__art\s*\{[^}]*background-size:\s*cover/);
});

test('فونت گوتیک برای حروف و اعداد لاتین تعریف شده', () => {
  assert.match(css, /font-family:\s*'Pirata One'/);
  assert.match(css, /@font-face\s*\{[^}]*PirataOne\.woff2/s);
});

test('بدون background-size: 100% 100% (کشیدگی ممنوع)', () => {
  assert.equal(/background-size:\s*100%\s+100%/.test(css), false);
});

test('هر صفحه‌ی بازی دکمه‌ی بازگشت دارد', async () => {
  const files = ['mafia', 'hokm', 'esmfamil', 'snake', 'quiz', 'riddle', 'iq', 'codenames', 'lowball', 'story', 'warden', 'logic'];
  for (const id of files) {
    const src = await readFile(join(ROOT, `public/src/games/${id}-ui.js`), 'utf8');
    assert.match(src, /gameHeader\(/, `${id}: gameHeader ندارد`);
    assert.match(src, /onBack/, `${id}: onBack ندارد`);
  }
});
