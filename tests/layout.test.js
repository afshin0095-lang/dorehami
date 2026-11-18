/* ============================================================
   آزمون چیدمان: متن هرگز از کاغذ بیرون نمی‌زند.
   CSS را می‌خوانیم و تضمین‌های سرریز را بررسی می‌کنیم،
   به‌علاوه‌ی ساختار کارت‌ها و ورق‌های بازی را می‌سنجیم.
   ============================================================ */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
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
    '.siege-choice__label',
    '.island-hero p', '.island-card__title', '.island-card__body', '.island-action__name',
    '.island-build__eff', '.island-log', '.island-res__num', '.island-brief__eff',
    '.island-bar__num', '.island-endbuilt',
    '.ark-hero p', '.ark-enemy__name', '.ark-card__name', '.ark-card__text',
    '.ark-act__name', '.ark-log', '.ark-test__math', '.ark-track__name',
    '.ark-inv__name', '.ark-inv__perk', '.ark-brief span',
    '.ring-hero p', '.ring-hero-pick__name', '.ring-card__name', '.ring-card__text',
    '.ring-stage__name', '.ring-stage__intro', '.ring-log', '.ring-stat__num',
    '.ring-foe__name', '.ring-threat__val', '.ring-crew__row', '.ring-brief span',
    '.sp-hero h1', '.sp-hero p', '.sp-spirit__name', '.sp-spirit__perk',
    '.sp-power__name', '.sp-power__text', '.sp-land__name', '.sp-land__count',
    '.sp-target__name', '.sp-log__row', '.sp-gauge__label', '.sp-brief span',
    '.gk-hero h1', '.gk-hero p', '.gk-q', '.gk-opt__text', '.gk-cat__label',
    '.gk-review__q', '.gk-review__a', '.gk-stat__val', '.gk-progress__note'
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
    'lowball', 'story', 'warden', 'logic', 'duz', 'finddiff', 'gloom', 'kot', 'worms', 'siege', 'island', 'arkham', 'ring', 'spirit', 'gk'];
  for (const id of files) {
    const src = await readFile(join(ROOT, `public/src/games/${id}-ui.js`), 'utf8');
    assert.match(src, /gameHeader\(/, `${id}: gameHeader ندارد`);
    assert.match(src, /onBack/, `${id}: onBack ندارد`);
  }
});

/* ── پس‌زمینه‌ها باید دقیقاً در قاب خودشان جا شوند ───────────────── */

test('قاب حکاکی‌شده با border-image دور ستون می‌نشیند، نه با cover روی کل صحنه', () => {
  const css = readFileSync(join(ROOT, 'public/styles.css'), 'utf8');
  // قاب باید به‌صورت border-image باشد…
  assert.match(css, /border-image-source:\s*url\('\/assets\/art\/desk-frame\.jpg'\)/,
    'قاب با border-image دور برنامه نمی‌نشیند');
  assert.match(css, /border-image-slice:\s*26%\s+15%\s+20%\s+15%/,
    'نسبت برش قاب اندازه‌گیری‌شده نیست');
  /**
   * این مهم‌ترین بخش است: `stretch` نوارهای قاب را در ارتفاع چند‌هزار
   * پیکسلی صفحه می‌کشید و همان چیزی می‌شد که کاربر «دفرمه و زشت»
   * توصیفش کرد. `round` تکرار می‌کند، نه کشیدن.
   */
  assert.match(css, /border-image-repeat:\s*round/,
    'قاب هنوز با stretch کشیده می‌شود — دفرمه می‌شود');
  // فقط «اعلانِ» واقعی سنجیده شود، نه توضیحی که در کامنت دربارهٔ همان
  // اشتباه نوشته شده است
  const cssNoComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.equal(/border-image-repeat:\s*stretch/.test(cssNoComments), false,
    'stretch در قاب مانده — نوار قاب در ارتفاع صفحه کشیده می‌شود');
  // …و دیگر با cover روی کل صحنه کشیده نشود (این کار ۷۰٪ نقش را می‌بُرید)
  const deskBlock = css.slice(css.indexOf('#desk {'), css.indexOf('#desk::before'));
  assert.equal(deskBlock.includes("url('/assets/art/desk-frame.jpg')"), false,
    'قاب هنوز روی #desk با cover کشیده می‌شود');
});

test('هیچ surface با پس‌زمینهٔ عکس، نسبت تصویر را دفرمه نمی‌کند', () => {
  const css = readFileSync(join(ROOT, 'public/styles.css'), 'utf8');
  // هیچ‌جا نباید ۱۰۰٪ ۱۰۰٪ باشد (کشیدگی) — قبلاً همین قاعده سبب باگ شده بود
  assert.equal(/background-size:\s*100%\s+100%/.test(css), false,
    'پس‌زمینه با ۱۰۰٪ ۱۰۰٪ کشیده می‌شود');
  // banner باید نسبت ابعاد خودش را قفل کند تا cover دفرمه‌اش نکند
  assert.match(css, /\.hero-fabric\s*\{[^}]*aspect-ratio:\s*1376\s*\/\s*768/s,
    'بنر پارچه‌ای نسبت ابعاد تصویر را قفل نکرده');
  // و پوشش‌های cover باید center باشند، نه یک گوشهٔ دلبخواه
  const coverRules = [...css.matchAll(/background-size:\s*cover[^;]*;/g)];
  assert.ok(coverRules.length > 10, 'قاعده‌های cover کمتر از انتظار است');
});
