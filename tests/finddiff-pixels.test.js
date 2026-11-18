/* ============================================================
   آزمون «کادرها روی تغییر واقعی نشسته‌اند»
   وقتی کادرها استخراج شدند، energieٔ تفاوتِ هر کادر اندازه‌گیری و
   در tests/fixtures/finddiff-energy.json ذخیره شد. این آزمون همان
   اندازه‌گیری را بدون نیاز به Pillow بازبینی می‌کند: اگر مختصات
   جابه‌جا یا عکس عوض شود، عدد ذخیره‌شده دیگر با واقعیت نمی‌خواند.
   ============================================================ */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCENES, FRAME_W, FRAME_H, PAD_PX } from '../public/src/engines/finddiff.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const energy = JSON.parse(readFileSync(join(ROOT, 'tests/fixtures/finddiff-energy.json'), 'utf8'));

test('هر کادر تفاوت، انرژی تفاوت واقعی دارد', () => {
  for (const s of SCENES) {
    const e = energy[s.id];
    assert.ok(e, `${s.id}: اندازه‌گیری ثبت نشده`);
    for (const hs of s.hotspots) {
      const row = e.hotspots.find(r => r.name === hs.name);
      assert.ok(row, `${s.id}/${hs.name}: اندازه‌گیری ثبت نشده`);
      assert.ok(row.strong >= 0.012,
        `${s.id}/${hs.name}: فقط ${(row.strong * 100).toFixed(1)}٪ پیکسل تغییرکرده — کادر روی فضای خالی است`);
      assert.ok(row.mean > 12, `${s.id}/${hs.name}: میانگین اختلاف ${row.mean} — تقریباً بی‌تغییر`);
    }
  }
});

test('مختصات فعلی همان مختصاتی است که اندازه‌گیری شد', () => {
  for (const s of SCENES) {
    const e = energy[s.id];
    assert.equal(s.artA, e.artA, `${s.id}: عکس A عوض شده ولی انرژی دوباره اندازه‌گیری نشده`);
    assert.equal(s.artB, e.artB, `${s.id}: عکس B عوض شده`);
    for (const hs of s.hotspots) {
      const row = e.hotspots.find(r => r.name === hs.name);
      assert.ok(row, `${s.id}/${hs.name}: نام تازه است`);
      for (const k of ['x', 'y', 'w', 'h']) {
        assert.equal(hs[k], row[k], `${s.id}/${hs.name}: ${k} جابه‌جا شده — دوباره اندازه‌گیری کن`);
      }
    }
  }
});

test('عکس‌های هر صحنه با نام‌گذاری جفت‌اند و حجم دارند', () => {
  for (const s of SCENES) {
    assert.match(s.artA, /-a\.jpg$/, `${s.id}: عکس A باید -a.jpg باشد`);
    assert.match(s.artB, /-b\.jpg$/, `${s.id}: عکس B باید -b.jpg باشد`);
    for (const p of [s.artA, s.artB]) {
      const f = join(ROOT, 'public', p.replace(/^\//, ''));
      assert.ok(existsSync(f), `${s.id}: ${p} نیست`);
      assert.ok(statSync(f).size > 60000, `${s.id}: ${p} خیلی کوچک است`);
    }
  }
});

test('هیچ کادری بیش از نیمی از قاب را نمی‌گیرد', () => {
  const frame = FRAME_W * FRAME_H;
  for (const s of SCENES) {
    for (const hs of s.hotspots) {
      assert.ok(hs.w * hs.h < frame * 0.5, `${s.id}/${hs.name}: کادر بیش از حد بزرگ`);
    }
  }
});

test('حاشیهٔ کلیک کوچک است — «پیکسل دقیق» معنا داشته باشد', () => {
  assert.ok(PAD_PX <= 12, `حاشیهٔ ${PAD_PX}px بیش از حد بخشنده است`);
});
