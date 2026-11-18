/* ============================================================
   آزمون صفحهٔ خانه — باید واقعاً رندر شود

   درس گرفته از باگ «صفحهٔ خالی»: کافی نیست CSS را بخوانیم یا
   رشته‌ها را در فایل بگردیم؛ باید صفحه را mount کنیم و ببینیم
   چه چیزی روی صفحه می‌آید. این آزمون همان کار را برای خانه می‌کند.
   ============================================================ */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

class FakeNode {
  constructor(tag = 'div') {
    this.tagName = String(tag).toUpperCase();
    this.nodeType = 1;
    this.children = [];
    this.attrs = {};
    this.style = {};
    this.dataset = {};
    this.parentElement = null;
    this.listeners = {};
    this.classList = { _s: new Set(), add(...c) { c.forEach(x => this._s.add(x)); }, remove(...c) { c.forEach(x => this._s.delete(x)); }, toggle(c, on) { if (on === undefined) { this._s.has(c) ? this._s.delete(c) : this._s.add(c); } else if (on) this._s.add(c); else this._s.delete(c); }, contains(c) { return this._s.has(c); } };
  }
  set className(v) { this.attrs.class = v; }
  get className() { return this.attrs.class || ''; }
  set innerHTML(v) { this._html = v; }
  get innerHTML() { return this._html || ''; }
  set textContent(v) { this._text = String(v); }
  get textContent() { return (this._text || '') + this.children.map(c => c.textContent || '').join(''); }
  append(...n) { for (const c of n) if (c && c.nodeType) { c.parentElement = this; this.children.push(c); } }
  appendChild(c) { this.append(c); return c; }
  replaceChildren(...n) { this.children = []; this.append(...n); }
  remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(c => c !== this); }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return this.attrs[k]; }
  removeAttribute(k) { delete this.attrs[k]; }
  addEventListener(t, f) { (this.listeners[t] ||= []).push(f); }
  removeEventListener() {}
  dispatchEvent(e) { (this.listeners[e.type] || []).forEach(f => f(e)); return true; }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  get firstChild() { return this.children[0] || null; }
}

function installDom() {
  const nodes = {};
  const make = (id) => { const n = new FakeNode('div'); n.attrs.id = id; nodes[id] = n; return n; };
  const body = new FakeNode('body');
  const app = make('app'); const modal = make('modal-root');
  const toast = make('toast'); const desk = make('desk');
  body.append(app, modal, toast, desk);
  globalThis.document = {
    body, documentElement: new FakeNode('html'), title: '', hidden: false,
    createElement: t => new FakeNode(t),
    createElementNS: (ns, t) => new FakeNode(t),
    createTextNode: t => { const n = new FakeNode('#text'); n.nodeType = 3; n.textContent = t; return n; },
    createDocumentFragment: () => new FakeNode('frag'),
    getElementById: id => nodes[id] || null,
    querySelector: () => null, querySelectorAll: () => [],
    addEventListener: () => {}, dispatchEvent: () => {}
  };
  globalThis.window = {
    addEventListener: () => {}, removeEventListener: () => {},
    scrollTo: () => {}, matchMedia: () => ({ matches: false, addEventListener: () => {} }),
    location: { hash: '', pathname: '/' }, history: { pushState: () => {} }
  };
  const mem = {};
  globalThis.localStorage = {
    getItem: k => (k in mem ? mem[k] : null),
    setItem: (k, v) => { mem[k] = String(v); },
    removeItem: k => { delete mem[k]; },
    length: 0, key: () => null
  };
  globalThis.CustomEvent = class { constructor(t, o) { this.type = t; Object.assign(this, o); } };
  globalThis.confirm = () => false;
  return { modal };
}


const walk = (n, out = []) => {
  out.push(n);
  for (const c of n.children || []) if (c && c.nodeType === 1) walk(c, out);
  return out;
};
const textOf = (n) => walk(n).map(x => x.textContent || '').join(' ').replace(/\s+/g, ' ').trim();

async function mountHome() {
  installDom();
  const { HomeScreen } = await import('../public/src/ui/screens.js');
  const { mount } = await import('../public/src/core.js');
  const app = document.getElementById('app');
  mount(app, HomeScreen({ navigate: () => {}, openGame: () => {} }));
  return app;
}

const CSS = () => readFileSync(join(ROOT, 'public/styles.css'), 'utf8');

test('صفحهٔ خانه رندر می‌شود و خالی نیست', async () => {
  const app = await mountHome();
  assert.ok(app.children.length > 0, 'صفحهٔ خانه هیچ فرزندی ندارد');
  const txt = textOf(app);
  assert.ok(txt.length > 40, `متن صفحهٔ خانه بسیار کم است: «${txt.slice(0, 80)}»`);
});

test('لوگو بالای صفحه و بالای بنر است', async () => {
  const app = await mountHome();
  const nodes = walk(app);
  const logo = nodes.find(n => (n.attrs?.class || '').includes('brand__logo'));
  assert.ok(logo, 'تصویر لوگو در صفحهٔ خانه نیست');
  // نام فایل نسخه‌دار است تا هیچ کش کهنه‌ای نتواند نسخهٔ قبلی را بدهد
  assert.match(logo.attrs.src, /^\/assets\/(brand\/)?(seal|logo)-v?\d*-?\d+\.png$/,
    `مسیر لوگو درست نیست: ${logo.attrs.src}`);
  assert.equal(logo.attrs.alt, 'دورهمی‌یار', 'متن جانشین لوگو نیست');
  // لوگو باید پیش از بنر در ترتیب DOM بیاید
  const flat = nodes;
  const logoIdx = flat.indexOf(logo);
  const bannerIdx = flat.findIndex(n => (n.attrs?.class || '').includes('hero-fabric'));
  assert.ok(logoIdx >= 0 && bannerIdx >= 0, 'لوگو یا بنر پیدا نشد');
  assert.ok(logoIdx < bannerIdx, 'لوگو بعد از بنر آمده — باید بالای آن باشد');
});

test('بنر پارچه‌ای با هر سه سطر خواسته‌شده وجود دارد', async () => {
  const app = await mountHome();
  const txt = textOf(app);
  assert.ok(txt.includes('گوشی وسط جمع روشن'), 'سطر اول بنر نیست');
  assert.ok(txt.includes('امشب چی بازی کنیم؟'), 'سطر دوم بنر نیست');
  assert.ok(txt.includes('یه دورهمی شاد و لذت‌بخش'), 'سطر سوم بنر نیست');
  const cloth = walk(app).find(n => (n.attrs?.class || '').includes('hero-fabric__cloth'));
  assert.ok(cloth, 'لایهٔ پارچهٔ بنر ساخته نشده');
});

test('دکمهٔ «شروع» حذف شده و «چالش امروز» زیر بنر است', async () => {
  const app = await mountHome();
  const nodes = walk(app);
  const buttons = nodes.filter(n => n.tagName === 'BUTTON');
  const labels = buttons.map(b => (b.textContent || '').trim());
  assert.equal(labels.some(l => l === 'شروع' || l.startsWith('شروع')),
    false, `دکمهٔ شروع هنوز هست: ${labels.join(' | ')}`);

  const challenge = buttons.find(b => (b.textContent || '').includes('چالش امروز'));
  assert.ok(challenge, 'دکمهٔ چالش امروز نیست');
  assert.ok((challenge.className || '').includes('btn--oxblood'),
    'دکمهٔ چالش رنگ جگری (btn--oxblood) ندارد');

  const bannerIdx = nodes.findIndex(n => (n.attrs?.class || '').includes('hero-fabric'));
  assert.ok(nodes.indexOf(challenge) > bannerIdx, 'چالش امروز باید زیر بنر باشد');
});

test('نوار پایین برای هر بخش آیکون دارد و بخش فعال نشانه‌گذاری شده', async () => {
  // نوار پایین در پوستهٔ برنامه ساخته می‌شود، نه در خودِ HomeScreen
  installDom();
  const { navbar } = await import('../public/src/ui/kit.js');
  const NAV = [
    { id: 'home', label: 'خانه', icon: 'home' },
    { id: 'games', label: 'بازی‌ها', icon: 'games' },
    { id: 'library', label: 'کتابخانه', icon: 'book' }
  ];
  const { mount } = await import('../public/src/core.js');
  const app = document.getElementById('app');
  mount(app, navbar({ items: NAV, active: 'home', onNavigate: () => {} }));
  const items = walk(app).filter(n => (n.attrs?.class || '').split(' ').includes('nav-item'));
  assert.ok(items.length >= 3, `فقط ${items.length} بخش در نوار پایین`);
  for (const item of items) {
    const hasGlyph = walk(item).some(n => (n.attrs?.class || '').includes('nav-item__glyph'));
    assert.ok(hasGlyph, 'بخش نوار پایین آیکون ندارد');
    const hasIcon = walk(item).some(n => n.tagName === 'SVG');
    assert.ok(hasIcon, 'آیکون SVG ساخته نشده');
    assert.ok((item.textContent || '').trim().length > 0, 'بخش نوار پایین عنوان ندارد');
  }
  const active = items.filter(i => i.attrs['aria-current'] === 'page');
  assert.equal(active.length, 1, `باید دقیقاً یک بخش فعال باشد، هست ${active.length}`);
  assert.ok((active[0].className || '').includes('is-active'), 'بخش فعال کلاس is-active ندارد');
});

test('کارت بازی یک شیء ضخیم است، نه چند لایهٔ پشته', async () => {
  const app = await mountHome();
  const cards = walk(app).filter(n => (n.attrs?.class || '').split(' ').includes('game-card'));
  assert.ok(cards.length > 0, 'هیچ کارت بازی روی صفحهٔ خانه نیست');
  const css = CSS();
  // لایهٔ پشته (::after) عمداً حذف شده — نباید برگردد
  assert.match(css, /\.game-card::after\s*\{\s*content:\s*none/,
    'لایهٔ پشتهٔ کارت برگشته — باید یک کارت ضخیم باشد');
  // و ضخامت باید از لبهٔ تیره ساخته شود
  const block = css.slice(css.indexOf('.game-card {'), css.indexOf('.game-card::before'));
  assert.match(block, /inset 0 -3px 0/, 'لبهٔ ضخامت پایین کارت نیست');
  assert.match(block, /inset 0 1\.5px 0/, 'لبهٔ روشن بالای کارت نیست');
  // بدون چرخش: کارت‌ها باید منظم باشند
  assert.match(block, /transform:\s*none/, 'کارت هنوز کج می‌شود');
});

test('CSS نوار پایین حالت فعال را آشکارا متمایز می‌کند', () => {
  const css = CSS();
  const start = css.indexOf('.nav-item {');
  const block = css.slice(start, css.indexOf('/* ============================ چیپ‌ها', start));
  assert.match(block, /\.nav-item__glyph/, 'لایهٔ نشان نوار پایین نیست');
  assert.match(block, /\.nav-item__mark/, 'خط نشانگر نوار پایین نیست');
  assert.match(block, /\.nav-item\.is-active/, 'قاعدهٔ حالت فعال نیست');
  assert.match(block, /scale\(1\.1[0-9]?\)/, 'نشان در حالت فعال بزرگ نمی‌شود');
});

test('بنر پارچه‌ای در CSS نسبت ابعاد را قفل کرده و متن روی پارچه است', () => {
  const css = CSS();
  const block = css.slice(css.indexOf('.hero-fabric {'), css.indexOf('.hero-challenge {'));
  assert.match(block, /aspect-ratio:\s*1376\s*\/\s*768/, 'نسبت ابعاد بنر قفل نشده');
  // تصویر بنر با نام نسخه‌دار ارجاع می‌شود
  assert.match(block, /weave-v\d+(-sm)?\.jpg/, 'تصویر بنر در CSS نیست');
  assert.match(block, /hero-fabric__title/, 'عنوان بنر استایل ندارد');
});
