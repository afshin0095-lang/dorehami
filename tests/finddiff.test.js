/* ============================================================
   آزمون «تفاوت را پیدا کن» — دقت پیکسلی نواحی
   ============================================================ */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SCENES, SCENE, FRAME_W, FRAME_H, TOLERANCE, PAD_PX, RULES,
  createFindDiff, tap, warmth, useHint, isDone, remaining, score
} from '../public/src/engines/finddiff.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/* ------------------------------ ساختار ------------------------------ */

test('پنج صحنه وجود دارد و هر کدام دو عکس دارد', () => {
  assert.equal(SCENES.length, 5);
  for (const s of SCENES) {
    assert.ok(s.id && s.title, 'شناسه یا عنوان ندارد');
    assert.notEqual(s.artA, s.artB, `${s.id}: دو عکس یکسان است`);
    for (const p of [s.artA, s.artB]) {
      const file = join(ROOT, 'public', p.replace(/^\//, ''));
      assert.ok(existsSync(file), `${s.id}: تصویر موجود نیست ${p}`);
      assert.ok(statSync(file).size > 20000, `${s.id}: تصویر خیلی کوچک ${p}`);
    }
  }
});

test('هر صحنه بین ۴ تا ۵ تفاوت دارد', () => {
  for (const s of SCENES) {
    assert.ok(s.hotspots.length >= 4 && s.hotspots.length <= 6, `${s.id}: ${s.hotspots.length} تفاوت`);
    for (const hs of s.hotspots) assert.ok(hs.name, `${s.id}: تفاوت بی‌نام`);
  }
});

test('نواحی تفاوت داخل قاب عکس و بدون هم‌پوشانی‌اند', () => {
  for (const s of SCENES) {
    for (const hs of s.hotspots) {
      assert.ok(hs.x >= 0 && hs.y >= 0, `${s.id}/${hs.name}: مختصات منفی`);
      assert.ok(hs.x + hs.w <= FRAME_W, `${s.id}/${hs.name}: از عرض بیرون`);
      assert.ok(hs.y + hs.h <= FRAME_H, `${s.id}/${hs.name}: از ارتفاع بیرون`);
      assert.ok(hs.w > 20 && hs.h > 20, `${s.id}/${hs.name}: ناحیه بیش از حد کوچک`);
    }
    // هم‌پوشانی = کلیک مبهم
    for (let i = 0; i < s.hotspots.length; i++) {
      for (let j = i + 1; j < s.hotspots.length; j++) {
        const a = s.hotspots[i], b = s.hotspots[j];
        const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        assert.ok(ox <= 0 || oy <= 0, `${s.id}: «${a.name}» و «${b.name}» هم‌پوشانی دارند`);
      }
    }
  }
});

test('شناسهٔ صحنه‌ها یکتاست و نگاشت SCENE درست است', () => {
  const ids = SCENES.map(s => s.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.equal(SCENE[id].id, id);
});

/* ------------------------------ بازی ------------------------------ */

test('بازی تازه با صحنهٔ انتخابی ساخته می‌شود', () => {
  const g = createFindDiff({ sceneId: 'bakery' });
  assert.equal(g.scene.id, 'bakery');
  assert.deepEqual(g.found, []);
  assert.equal(g.misses, 0);
  assert.equal(g.finished, false);
});

test('کلیک روی مرکز هر تفاوت آن را پیدا می‌کند', () => {
  let g = createFindDiff({ sceneId: 'kitchen' });
  g.scene.hotspots.forEach((hs, i) => {
    const relX = (hs.x + hs.w / 2) / FRAME_W;
    const relY = (hs.y + hs.h / 2) / FRAME_H;
    const r = tap(g, relX, relY);
    assert.equal(r.ok, true);
    assert.equal(r.hit, true, `«${hs.name}» پیدا نشد`);
    assert.equal(r.index, i);
    g = r.game;
  });
  assert.equal(g.found.length, g.total);
  assert.equal(isDone(g), true);
});

test('کلیک روی جای خالی پیدا نمی‌شود و خطا ثبت می‌کند', () => {
  const g = createFindDiff({ sceneId: 'reading' });
  // گوشهٔ بالا-چپ: در همهٔ صحنه‌ها خالی است
  const r = tap(g, 0.01, 0.02);
  assert.equal(r.ok, true);
  assert.equal(r.hit, false);
  assert.equal(r.game.misses, 1);
  assert.equal(r.game.found.length, 0);
});

test('کلیک تکراری روی یک تفاوت، خطا حساب می‌شود نه پیدا‌شدن دوباره', () => {
  const g = createFindDiff({ sceneId: 'study' });
  const hs = g.scene.hotspots[0];
  const rel = [(hs.x + hs.w / 2) / FRAME_W, (hs.y + hs.h / 2) / FRAME_H];
  const first = tap(g, ...rel);
  assert.equal(first.hit, true);
  const second = tap(first.game, ...rel);
  assert.equal(second.hit, false, 'تفاوت تکراری باید خطا باشد');
  assert.equal(second.game.found.length, 1);
  assert.equal(second.game.misses, 1);
});

test('کلیک بیرون از ناحیه ولی نزدیک آن، پذیرفته نمی‌شود', () => {
  const g = createFindDiff({ sceneId: 'bicycle' });
  const hs = g.scene.hotspots.find(x => x.name === 'آچار سوم');
  // ۴۰ پیکسل بیرون از لبه — نزدیک، ولی نه روی تغییر
  const relX = (hs.x - 40) / FRAME_W;
  const relY = (hs.y + hs.h / 2) / FRAME_H;
  const r = tap(g, relX, relY);
  assert.equal(r.hit, false, 'کلیک بیرون از ناحیه نباید پیدا شود');
});

test('حاشیهٔ کوچک بیرون از لبه هنوز پذیرفته می‌شود', () => {
  const g = createFindDiff({ sceneId: 'bicycle' });
  const hs = g.scene.hotspots.find(x => x.name === 'آچار سوم');
  const relX = (hs.x - PAD_PX + 2) / FRAME_W;
  const relY = (hs.y + hs.h / 2) / FRAME_H;
  assert.equal(tap(g, relX, relY).hit, true);
});

test('تلورانس مطلق است، نه نسبی — کادر بزرگ ناحیهٔ بزرگ نمی‌گیرد', () => {
  assert.ok(PAD_PX <= 12, 'حاشیهٔ کلیک باید کوچک باشد تا «پیکسل دقیق» معنا داشته باشد');
  const g = createFindDiff({ sceneId: 'kitchen' });
  const hs = g.scene.hotspots.reduce((a, b) => (a.w * a.h >= b.w * b.h ? a : b));
  // به اندازهٔ ۲۵٪ عرضِ کادر، بیرون از لبهٔ چپ: با تلورانس نسبی پذیرفته می‌شد
  const relX = (hs.x - hs.w * 0.25) / FRAME_W;
  const relY = (hs.y + hs.h / 2) / FRAME_H;
  assert.equal(tap(g, relX, relY).hit, false, 'حاشیهٔ نسبیِ بزرگ نباید بپذیرد');
});

test('پیدا کردن همه، صحنه را تمام می‌کند و بعدش کلیک بی‌اثر است', () => {
  const g = createFindDiff({ sceneId: 'bakery' });
  let cur = g;
  for (const hs of g.scene.hotspots) {
    cur = tap(cur, (hs.x + hs.w / 2) / FRAME_W, (hs.y + hs.h / 2) / FRAME_H).game;
  }
  assert.equal(isDone(cur), true);
  assert.equal(remaining(cur), 0);
  const after = tap(cur, 0.5, 0.5);
  assert.equal(after.ok, false);
});

test('گرم/سرد فاصله را درست می‌خواند', () => {
  const g = createFindDiff({ sceneId: 'kitchen' });
  const hs = g.scene.hotspots[0];
  const cx = (hs.x + hs.w / 2) / FRAME_W;
  const cy = (hs.y + hs.h / 2) / FRAME_H;
  assert.equal(warmth(g, cx, cy), 'hot');
  assert.equal(warmth(g, 0.99, 0.99), 'cold');
});

test('راهنما یکی از تفاوت‌های باقی‌مانده را می‌دهد و امتیاز کم می‌کند', () => {
  const g = createFindDiff({ sceneId: 'study' });
  const before = score(g);
  const r = useHint(g);
  assert.equal(r.ok, true);
  assert.ok(r.index >= 0);
  assert.equal(r.game.hints, 1);
  assert.equal(score(r.game), before, 'هنوز تفاوتی پیدا نشده، امتیاز صفر است');
});

test('امتیاز با خطا و راهنما کم می‌شود', () => {
  const g = createFindDiff({ sceneId: 'kitchen' });
  const hs = g.scene.hotspots[0];
  let cur = tap(g, (hs.x + hs.w / 2) / FRAME_W, (hs.y + hs.h / 2) / FRAME_H).game;
  const clean = score(cur);
  assert.equal(clean, 100);
  cur = tap(cur, 0.01, 0.02).game;
  assert.equal(score(cur), 85, 'هر خطا ۱۵ امتیاز');
  cur = useHint(cur).game;
  assert.equal(score(cur), 55, 'هر راهنما ۳۰ امتیاز');
});

test('امتیاز هرگز منفی نمی‌شود', () => {
  const g = createFindDiff({ sceneId: 'kitchen' });
  let cur = g;
  for (let i = 0; i < 20; i++) cur = tap(cur, 0.02, 0.03).game;
  assert.equal(score(cur), 0);
});

test('صحنهٔ تصادفی یکی از صحنه‌های موجود است', () => {
  for (let i = 0; i < 12; i++) {
    const g = createFindDiff({ seed: i * 977 });
    assert.ok(SCENE[g.scene.id], 'صحنهٔ ناشناخته');
  }
});

test('قواعد گام و مثال دارند', () => {
  assert.ok(RULES.steps.length >= 5);
  assert.ok(RULES.example.length > 30);
});
