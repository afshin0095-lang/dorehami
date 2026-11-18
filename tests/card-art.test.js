/* ============================================================
   آزمون هنر کارت‌ها
   کاربر خواست هر کارت تصویر مرتبط و یکتای خودش را داشته باشد و
   تصویر کل کارت را بپوشاند. این آزمون همان قرارداد را قفل می‌کند.
   ============================================================ */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const registry = readFileSync(join(ROOT, 'public/src/games/registry.js'), 'utf8');
const css = readFileSync(join(ROOT, 'public/styles.css'), 'utf8');
const sw = readFileSync(join(ROOT, 'public/sw.js'), 'utf8');

/** فقط بلوک GAMES را می‌خوانیم، نه فهرست دسته‌ها */
const gamesBlock = registry.slice(registry.indexOf('export const GAMES'));
const entries = [...gamesBlock.matchAll(/id: '([a-z][a-z0-9-]*)',[\s\S]*?art: '([^']+)'/g)]
  .map(m => ({ id: m[1], art: m[2] }));

test('هر بازی تصویر خودش را دارد (بدون اشتراک)', () => {
  assert.ok(entries.length >= 20, `فقط ${entries.length} بازی`);
  const byArt = {};
  for (const e of entries) (byArt[e.art] = byArt[e.art] || []).push(e.id);
  const shared = Object.entries(byArt).filter(([, ids]) => ids.length > 1);
  assert.equal(shared.length, 0,
    `تصویر مشترک: ${shared.map(([a, ids]) => `${a} → ${ids.join('/')}`).join(' | ')}`);
});

test('همهٔ تصویرهای ثبت‌شده روی دیسک موجودند', () => {
  for (const e of entries) {
    const p = join(ROOT, 'public', e.art.replace(/^\//, ''));
    assert.ok(existsSync(p), `فایل موجود نیست: ${e.art} (${e.id})`);
  }
});

test('تصویرها حجم واقعی دارند، نه فایل خالی', () => {
  for (const e of entries) {
    const p = join(ROOT, 'public', e.art.replace(/^\//, ''));
    const size = statSync(p).size;
    assert.ok(size > 40_000, `${e.art}: فقط ${size} بایت — تصویر ساختگی/خالی است`);
  }
});

test('همهٔ تصویرهای کارت پیش‌کش می‌شوند (آفلاین کار کند)', () => {
  for (const e of entries) {
    assert.ok(sw.includes(e.art), `${e.art} در precache نیست`);
  }
});

test('تصویر کارت کل کارت را می‌پوشاند', () => {
  const artRule = css.match(/\.game-card__art\s*\{[^}]*\}/);
  assert.ok(artRule, 'قاعدهٔ .game-card__art پیدا نشد');
  const rule = artRule[0];
  assert.ok(/position:\s*absolute/.test(rule), 'تصویر مطلق نیست');
  assert.ok(/inset:\s*0/.test(rule) || /top:\s*0/.test(rule), 'تصویر کل قاب را نمی‌گیرد');
  assert.ok(/background-size:\s*cover/.test(rule), 'background-size باید cover باشد');
});

test('کارت پوشش کاغذی خودش را هم دارد (سبک چاپ قدیمی)', () => {
  const cardRule = css.match(/\.game-card\s*\{[^}]*\}/);
  assert.ok(cardRule, 'قاعدهٔ .game-card پیدا نشد');
  assert.ok(/overflow:\s*hidden/.test(cardRule[0]), 'کارت باید سرریز را ببندد');
  assert.ok(/background-size:\s*cover/.test(cardRule[0]), 'کاغذ کارت هم cover لازم دارد');
});

test('نام فایل تصویر با شناسهٔ بازی هم‌خوان است', () => {
  // استثناهای آگاهانه: نام تجاری متفاوت، ولی یکتا
  const alias = { gk: 'geo-quiz', ring: 'paper-cream', island: 'velvet-board' };
  for (const e of entries) {
    const base = e.art.split('/').pop().replace('.jpg', '');
    const want = alias[e.id] || e.id;
    assert.equal(base, want, `${e.id}: تصویر «${base}» با انتظار «${want}» نمی‌خواند`);
  }
});

/* ------------------------------ تصویرهای دسته و سطح ------------------------------ */

const kit = readFileSync(join(ROOT, 'public/src/ui/kit.js'), 'utf8');

test('هر دسته‌بندی تصویر و نشان خودش را دارد', () => {
  const catsBlock = registry.slice(registry.indexOf('export const CATEGORIES'), registry.indexOf('export const GAMES'));
  const cats = [...catsBlock.matchAll(/id: '([a-z]+)'[\s\S]*?glyph: '([^']+)', emblem: '([^']+)'/g)]
    .map(m => ({ id: m[1], glyph: m[2], emblem: m[3] }));
  assert.ok(cats.length >= 7, `فقط ${cats.length} دسته تصویر دارد`);
  const arts = cats.map(c => c.emblem);
  // دستهٔ داستانی می‌تواند با تکی هم‌تصویر باشد، ولی بقیه باید یکتا باشند
  const dupes = arts.filter((a, i) => arts.indexOf(a) !== i);
  assert.ok(dupes.length <= 1, `تصویر تکراری در دسته‌ها: ${dupes.join(', ')}`);
  for (const c of cats) {
    assert.ok(existsSync(join(ROOT, 'public', c.emblem.replace(/^\//, ''))), `${c.id}: تصویر موجود نیست`);
    assert.ok(sw.includes(c.emblem), `${c.id}: در precache نیست`);
    assert.ok(c.glyph.length > 0, `${c.id}: نشان ندارد`);
  }
});

test('هر سطح سختی تصویر خودش را دارد', () => {
  const arts = [...kit.matchAll(/easy: '([^']+)'[\s\S]*?normal: '([^']+)'[\s\S]*?hard: '([^']+)'/g)];
  const m = kit.match(/LEVEL_ART\s*=\s*\{([\s\S]*?)\}/);
  assert.ok(m, 'LEVEL_ART تعریف نشده');
  const entries = [...m[1].matchAll(/(\w+):\s*'([^']+)'/g)].map(x => [x[1], x[2]]);
  assert.equal(entries.length, 3, 'سه سطح لازم است');
  const paths = entries.map(e => e[1]);
  assert.equal(new Set(paths).size, 3, 'تصویر سطوح تکراری است');
  for (const [id, p] of entries) {
    assert.ok(existsSync(join(ROOT, 'public', p.replace(/^\//, ''))), `سطح ${id}: تصویر موجود نیست`);
    assert.ok(sw.includes(p), `سطح ${id}: در precache نیست`);
  }
  void arts;
});

test('هر تصویر در پوشهٔ assets یا استفاده می‌شود یا یتیم نیست', () => {
  const dir = join(ROOT, 'public/assets/art');
  const all = [];
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith('.jpg')) all.push('/' + full.slice(join(ROOT, 'public').length + 1));
    }
  };
  walk(dir);
  // همهٔ کدهای رابط و موتور را می‌گردیم، نه فقط چند فایل
  const codeFiles = [];
  const walkCode = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, e.name);
      if (e.isDirectory()) walkCode(full);
      else if (e.name.endsWith('.js')) codeFiles.push(full);
    }
  };
  walkCode(join(ROOT, 'public/src'));
  const haystack = registry + kit + css + sw
    + codeFiles.map(f => readFileSync(f, 'utf8')).join('\n');
  const orphans = all.filter(p => !haystack.includes(p));
  assert.equal(orphans.length, 0, `تصویر بدون استفاده: ${orphans.join(', ')}`);
});
