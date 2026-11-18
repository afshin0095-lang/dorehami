/* ============================================================
   بررسی یکپارچگی پروژه:
   ۱) نحو همه‌ی ماژول‌ها (شامل ماژول‌های وابسته به مرورگر)
   ۲) هماهنگی رجیستری ↔ فایل UI ↔ کش سرویس‌ورکر
   ۳) وجود همه‌ی دارایی‌های ارجاع‌شده روی دیسک
   ۴) هماهنگی نسخه
   ============================================================ */

import { readFile, stat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const ok = [];

const read = p => readFile(join(ROOT, p), 'utf8');
const exists = async p => { try { await stat(join(ROOT, p)); return true; } catch { return false; } };

/* ---------------- ۱) نحو: با node --check روی همه‌ی فایل‌های JS ---------------- */
const allJs = [
  'server.mjs', 'public/sw.js',
  'public/src/main.js', 'public/src/core.js', 'public/src/content.js',
  'public/src/content-extra.js', 'public/src/content-more.js',
  'public/src/ui/kit.js', 'public/src/ui/screens.js', 'public/src/ui/settings.js',
  'public/src/ui/admin.js', 'public/src/ui/cardkit.js',
  'public/src/net/sync.js', 'public/src/net/ws.js', 'public/src/net/table.js',
  'tests/core.test.js', 'tests/mafia.test.js', 'tests/hokm.test.js', 'tests/games.test.js',
  'tests/net.test.js', 'tests/server.test.js', 'tests/ui-smoke.test.js', 'tests/ui-crawl.test.js',
  'public/src/games/registry.js', 'public/src/games/mafia-ui.js', 'public/src/games/hokm-ui.js',
  'public/src/games/esmfamil-ui.js', 'public/src/games/quiz-ui.js', 'public/src/games/riddle-ui.js',
  'public/src/games/iq-ui.js', 'public/src/games/snake-ui.js', 'public/src/games/codenames-ui.js',
  'public/src/games/lowball-ui.js', 'public/src/games/story-ui.js',
  'public/src/engines/mafia.js', 'public/src/engines/hokm.js', 'public/src/engines/snake.js',
  'public/src/engines/esmfamil.js', 'public/src/engines/quiz.js', 'public/src/engines/codenames.js',
  'public/src/engines/lowball.js', 'public/src/engines/v10.js', 'public/src/engines/logic.js',
  'public/src/engines/spirit.js', 'public/src/games/spirit-ui.js', 'tests/spirit.test.js',
  'public/src/net/hokm-table.js', 'tests/hokm-engine.test.js', 'tests/table-echo.test.js',
  'public/src/engines/gk.js', 'public/src/games/gk-ui.js', 'tests/gk.test.js',
  'public/src/content/gk-geo.js', 'public/src/content/gk-history.js',
  'public/src/content/gk-science.js', 'public/src/content/gk-culture.js',
  'public/src/content/gk-misc.js', 'public/src/content/gk-tables.js',
  'public/src/content/gk-gen.js', 'tests/card-art.test.js', 'tests/sound.test.js',
  'public/src/engines/uno.js', 'public/src/engines/eights.js', 'public/src/engines/dice5.js',
  'public/src/ui/tablekit.js', 'public/src/games/uno-ui.js',
  'public/src/games/cards-ui.js', 'public/src/games/dice-ui.js',
  'public/src/engines/skyjo.js', 'public/src/engines/kittens.js', 'public/src/engines/bluff.js',
  'public/src/games/skyjo-ui.js', 'public/src/games/kittens-ui.js', 'public/src/games/liar-ui.js',
  'public/src/engines/qwixx.js', 'public/src/games/qwixx-ui.js',
  'public/src/engines/worms.js', 'public/src/games/worms-ui.js',
  'public/src/engines/finddiff.js', 'public/src/games/finddiff-ui.js',
  'tests/finddiff.test.js', 'tests/quiz-ui.test.js',
  'tests/qwixx.test.js', 'tests/worms.test.js',
  'tests/uno.test.js', 'tests/cards.test.js', 'tests/dice.test.js'
];

for (const f of allJs) {
  if (!(await exists(f))) { errors.push(`فایل موجود نیست: ${f}`); continue; }
  try {
    await run(process.execPath, ['--check', join(ROOT, f)]);
    ok.push(`نحو ${f}`);
  } catch (e) {
    errors.push(`خطای نحو ${f}: ${(e.stderr || e.message).split('\n')?.[0] || ''}`);
  }
}

/* ---------------- ۲) رجیستری ↔ UI ↔ سرویس‌ورکر ---------------- */
const registry = await read('public/src/games/registry.js');
const sw = await read('public/sw.js');
const uiFiles = [...registry.matchAll(/load:\s*\(\)\s*=>\s*import\('\.\/([^']+)'\)/g)].map(m => m[1]);
// فقط شناسه‌ی بازی‌های داخل آرایه GAMES را می‌گیریم (نه id داخل دسته‌ها)
const gamesBlock = registry.slice(registry.indexOf('export const GAMES'));
const ids = [...gamesBlock.matchAll(/^\s{4}id:\s*'([a-z][a-z0-9-]*)'/gm)].map(m => m[1]);

if (ids.length === 0) errors.push('هیچ بازی‌ای در رجیستری پیدا نشد');
if (ids.length < 10) errors.push(`تعداد بازی‌ها کمتر از ۱۰ است: ${ids.length}`);
if (new Set(ids).size !== ids.length) errors.push('شناسه‌ی تکراری در رجیستری');

for (const f of uiFiles) {
  if (!(await exists(`public/src/games/${f}`))) errors.push(`فایل UI بازی موجود نیست: ${f}`);
  if (!sw.includes(`/src/games/${f}`)) errors.push(`فایل ${f} در precache سرویس‌ورکر نیست`);
}
if (uiFiles.length !== ids.length) errors.push(`تعداد فایل UI (${uiFiles.length}) با تعداد بازی‌ها (${ids.length}) نمی‌خواند`);
ok.push(`${ids.length} بازی · ${uiFiles.length} فایل UI · همه در کش`);

/* ---------------- ۳) دارایی‌ها ---------------- */
const css = await read('public/styles.css');
const referenced = new Set([
  ...[...css.matchAll(/url\('\/(assets\/[^']+)'\)/g)].map(m => m[1]),
  ...[...registry.matchAll(/art:\s*'\/(assets\/[^']+)'/g)].map(m => m[1]),
  ...[...sw.matchAll(/'(\/assets\/[^']+)'/g)].map(m => m[1].replace(/^\//, ''))
]);
for (const a of referenced) {
  if (!(await exists(`public/${a}`))) errors.push(`دارایی موجود نیست: /${a}`);
  if (!sw.includes(`/${a}`) && a.startsWith('assets/art/')) errors.push(`دارایی /${a} در precache سرویس‌ورکر نیست`);
}
ok.push(`${referenced.size} دارایی بررسی شد`);

/* ---------------- ۴) نسخه ---------------- */
const pkg = JSON.parse(await read('package.json'));
const swCache = sw.match(/dorehami-shell-v(\d+)/)?.[1];
if (!swCache) errors.push('نام کش سرویس‌ورکر نسخه ندارد');
ok.push(`نسخه ${pkg.version} · کش v${swCache}`);

/* ---------------- خروجی ---------------- */
console.log('— بررسی پروژه —');
for (const o of ok) console.log('  ✓', o);
if (errors.length) {
  console.error('\n— خطاها —');
  for (const e of errors) console.error('  ✗', e);
  process.exit(1);
}
console.log('\nهمه‌ی بررسی‌ها سبز است.');
