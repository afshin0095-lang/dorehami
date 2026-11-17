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
/**
 * همهٔ جفت‌های «انتخابگر ← بدنه» را از CSS بیرون می‌کشد.
 * چون @media پرانتزهای تودرتو دارد، از اسکن کاراکتری استفاده می‌کنیم نه regex.
 */
function cssBlocks() {
  if (cssBlocks.cache) return cssBlocks.cache;
  const out = [];
  let depth = 0, start = 0;
  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    if (ch === '{') {
      const sel = css.slice(start, i).trim();
      if (depth === 0) {
        // بدنهٔ این بلوک را تا بستن متناظرش برمی‌داریم
        let d = 1, j = i + 1;
        while (j < css.length && d > 0) {
          if (css[j] === '{') d++;
          else if (css[j] === '}') d--;
          j++;
        }
        out.push({ sel, body: css.slice(i + 1, j - 1) });
        i = j - 1;
        start = j;
        continue;
      }
      depth++;
    } else if (ch === '}') {
      depth = Math.max(0, depth - 1);
      start = i + 1;
    }
  }
  cssBlocks.cache = out;
  return out;
}

function hasWrapGuard(selector) {
  const blocks = cssBlocks();
  // ۱) قاعدهٔ اختصاصی خود انتخابگر
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(^|[\\s,>+~])${esc}(?![\\w-])`);
  for (const b of blocks) {
    if (b.sel.startsWith('@')) continue;
    if (re.test(b.sel) && /overflow-wrap:\s*anywhere/.test(b.body)) return true;
  }
  // ۲) گارد جهانی با انتخابگر صفت: [class*="gloom-"]
  const token = (selector.match(/\.([\w-]+)/) || [])[1] || '';
  if (!token) return false;
  for (const b of blocks) {
    if (!/overflow-wrap:\s*anywhere/.test(b.body)) continue;
    const prefixes = [...b.sel.matchAll(/\[class\*="([^"]+)"\]/g)].map(m => m[1]);
    if (prefixes.some(pre => token.startsWith(pre))) return true;
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

test('کلاس‌های متنی بازی‌های تازه گارد شکستن دارند', () => {
  const guarded = [
    '.spot-scene__name', '.spot-end', '.spot-msg', '.spot-caption',
    '.spot-hero p', '.spot-frame',
    '.gloom-enemy__name', '.gloom-scenario__name', '.gloom-brief span',
    '.ability-card', '.ability-card__name', '.ability-card__text',
    '.gloom-combine__opt', '.gloom-log', '.gloom-log__row',
    '.gloom-track__verdict', '.gloom-hero p',
    '.siege-hero p', '.siege-card__title', '.siege-card__body', '.siege-job__name',
    '.siege-person__name', '.siege-log', '.siege-res__num', '.siege-brief__row',
    '.siege-choice__label'
  ];
  for (const sel of guarded) {
    assert.ok(hasWrapGuard(sel), `${sel} بدون گارد شکستن کلمه`);
  }
});

test('هیچ‌کدام از متن‌های تازه با nowrap سرریز نمی‌کنند', () => {
  // nowrap فقط برای برچسب‌های بسیار کوتاه مجاز است
  const lines = css.split('\n');
  const offenders = [];
  let inBlock = null;
  for (const line of lines) {
    if (/^\.(spot|gloom|ability)/.test(line.trim())) inBlock = line.trim();
    if (inBlock && /white-space:\s*nowrap/.test(line)) {
      // تنها استثناها: برچسب هدف صحنه و دور ردیف iniciativa
      if (!inBlock.includes('spot-scenario__goal') && !inBlock.includes('gloom-scenario__goal')) {
        offenders.push(inBlock);
      }
    }
    if (line.includes('}')) inBlock = null;
  }
  assert.deepEqual(offenders, [], `nowrap بی‌گارد: ${offenders.join(', ')}`);
});

test('بدون background-size: 100% 100% (کشیدگی ممنوع)', () => {
  assert.equal(/background-size:\s*100%\s+100%/.test(css), false);
});

test('هر صفحه‌ی بازی دکمه‌ی بازگشت دارد', async () => {
  const files = ['mafia', 'hokm', 'esmfamil', 'snake', 'quiz', 'riddle', 'iq', 'codenames',
    'lowball', 'story', 'warden', 'logic', 'duz', 'spot', 'gloom', 'siege'];
  for (const id of files) {
    const src = await readFile(join(ROOT, `public/src/games/${id}-ui.js`), 'utf8');
    assert.match(src, /gameHeader\(/, `${id}: gameHeader ندارد`);
    assert.match(src, /onBack/, `${id}: onBack ندارد`);
  }
});
