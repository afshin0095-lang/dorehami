/* ============================================================
   آزمون «صدای آرام»
   اگر کسی دوباره گِین‌ها را بالا ببرد یا فیلتر پایین‌گذر را بردارد،
   این آزمون می‌گیردش — چون خستگی گوش با عدد قابل سنجش است.
   ============================================================ */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const core = readFileSync(join(ROOT, 'public/src/core.js'), 'utf8');

/* کتابخانه را از متن می‌خوانیم تا بدون AudioContext قابل سنجش باشد */
const libStart = core.indexOf('const SOUND_LIB = {');
const libEnd = core.indexOf('export function playSound');
const libSrc = core.slice(libStart, libEnd);

/** همهٔ لایه‌های همهٔ صداها را بیرون می‌کشد */
function layers() {
  const out = [];
  const names = [...libSrc.matchAll(/^\s{2}'([a-z-]+)':\s*\[/gm)].map(m => m[1]);
  for (const name of names) {
    const from = libSrc.indexOf(`'${name}': [`);
    const to = libSrc.indexOf(']', from);
    const block = libSrc.slice(from, to);
    for (const m of block.matchAll(/\{([^}]*)\}/g)) {
      const body = m[1];
      const num = (k) => {
        const mm = body.match(new RegExp(`${k}:\\s*([0-9.]+)`));
        return mm ? Number(mm[1]) : null;
      };
      out.push({ name, freq: num('freq'), gain: num('gain'), dur: num('dur'), tone: num('tone') });
    }
  }
  return out;
}

test('همهٔ صداها شناسایی می‌شوند', () => {
  const all = layers();
  assert.ok(all.length >= 25, `فقط ${all.length} لایه پیدا شد`);
  const names = new Set(all.map(l => l.name));
  for (const want of ['paper-flip', 'card-deal', 'tap', 'seal', 'unwrap', 'dice',
    'shuffle', 'win', 'lose', 'card-slide', 'error']) {
    assert.ok(names.has(want), `صدای «${want}» نیست`);
  }
});

test('هیچ لایه‌ای بلندتر از ۰٫۱ نیست', () => {
  const loud = layers().filter(l => (l.gain ?? 0) > 0.1);
  assert.deepEqual(loud.map(l => `${l.name}=${l.gain}`), [],
    'این لایه‌ها بلندتر از حد آرام‌اند');
});

test('مرکز باند هیچ صدایی بالاتر از ۳٫۵ کیلوهرتز نیست', () => {
  // فرکانس مرکزی فیلتر میان‌گذر = همان freq
  const harsh = layers().filter(l => (l.freq ?? 0) > 3500);
  assert.deepEqual(harsh.map(l => `${l.name}=${l.freq}Hz`), [],
    'این لایه‌ها تیزند و گوش را خسته می‌کنند');
});

test('میانگین بلندی در محدودهٔ آرام است', () => {
  const gs = layers().map(l => l.gain ?? 0).filter(g => g > 0);
  const mean = gs.reduce((a, b) => a + b, 0) / gs.length;
  assert.ok(mean < 0.055, `میانگین گِین ${mean.toFixed(3)} — باید زیر ۰٫۰۵۵ باشد`);
});

test('گذرگاه مستر فیلتر پایین‌گذر و اشباع نرم دارد', () => {
  assert.match(core, /ensureBus/, 'گذرگاه مستر نیست');
  assert.match(core, /lp\.type = 'lowpass'/, 'فیلتر پایین‌گذر مستر نیست');
  assert.match(core, /WaveShaper/, 'اشباع نرم نیست');
  assert.match(core, /Math\.tanh/, 'منحنی اشباع نرم نیست');
});

test('همهٔ لایه‌ها از گذرگاه می‌گذرند، نه مستقیم به خروجی', () => {
  assert.equal(/\.connect\(ac\.destination\)/.test(
    core.slice(core.indexOf('function paperLayer'), core.indexOf('const SOUND_LIB'))), false,
    'لایه‌ای هست که گذرگاه مستر را دور می‌زند');
  assert.ok(core.includes('busOut(ac)'), 'busOut استفاده نمی‌شود');
});

test('پاکت زمانی نرم است، نه حملهٔ تیز', () => {
  assert.match(core, /const atk = Math\.min\(0\.014/, 'حملهٔ نرم نیست');
});

test('بلندی صدا قابل تنظیم است و پیش‌فرض آرام', () => {
  assert.match(core, /export function setVolume/, 'setVolume نیست');
  assert.match(core, /volume: 0\.7/, 'پیش‌فرض بلندی آرام نیست');
});

test('صدای محیطی از گذرگاه می‌گذرد و بسیار آرام است', () => {
  const amb = core.slice(core.indexOf('export function ambientPaper'));
  assert.match(amb, /busOut\(ac\)/, 'صدای محیطی گذرگاه را دور می‌زند');
  const m = amb.match(/linearRampToValueAtTime\(([0-9.]+)/);
  assert.ok(m, 'پاکت صدای محیطی پیدا نشد');
  assert.ok(Number(m[1]) <= 0.02, `صدای محیطی بلند است (${m[1]})`);
});
