/* ============================================================
   آزمون بازی‌کردن: در DOM شبیه‌سازی‌شده، واقعاً کلیک می‌کنیم.
   (mount شدن کافی نیست؛ باید بشود بازی کرد.)
   ============================================================ */

import { test } from 'node:test';
import assert from 'node:assert/strict';

class N {
  constructor(tag = 'div') {
    this.tagName = String(tag).toUpperCase();
    this.nodeType = 1;
    this.children = [];
    this.attrs = {};
    this.style = {};
    this.dataset = {};
    this.parentElement = null;
    this.listeners = {};
    this.disabled = false;
    this._text = '';
    this.classList = {
      _s: new Set(),
      add(...c) { c.forEach(x => this._s.add(x)); },
      remove(...c) { c.forEach(x => this._s.delete(x)); },
      toggle(c, on) { on ? this._s.add(c) : this._s.delete(c); },
      contains(c) { return this._s.has(c); }
    };
  }
  set className(v) { this.attrs.class = v; (v || '').split(/\s+/).filter(Boolean).forEach(c => this.classList._s.add(c)); }
  get className() { return this.attrs.class || ''; }
  set innerHTML(v) { this._html = v; this.children = []; }
  get innerHTML() { return this._html || ''; }
  set textContent(v) { this._text = String(v); this.children = []; }
  get textContent() { return this._text + this.children.map(c => c.textContent).join(''); }
  append(...n) { for (const c of n.flat(9)) if (c && c.nodeType) { c.parentElement = this; this.children.push(c); } }
  appendChild(c) { this.append(c); return c; }
  replaceChildren(...n) { this.children = []; this.append(...n); }
  remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(c => c !== this); }
  setAttribute(k, v) { this.attrs[k] = String(v); if (k === 'class') this.className = v; if (k === 'disabled') this.disabled = true; }
  getAttribute(k) { return this.attrs[k]; }
  addEventListener(t, f) { (this.listeners[t] ||= []).push(f); }
  removeEventListener() {}
  dispatchEvent(e) { (this.listeners[e.type] || []).forEach(f => f(e)); return true; }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  get firstChild() { return this.children[0] || null; }
  get lastChild() { return this.children[this.children.length - 1] || null; }
  focus() {}
  click() { this.dispatchEvent({ type: 'click', target: this, preventDefault() {}, stopPropagation() {} }); }
}

function installDom() {
  const app = new N('div'); app.attrs.id = 'app';
  const modal = new N('div'); modal.attrs.id = 'modal-root';
  const toast = new N('div'); toast.attrs.id = 'toast';
  const desk = new N('div'); desk.attrs.id = 'desk';
  globalThis.document = {
    body: new N('body'), documentElement: new N('html'), title: '', hidden: false,
    createElement: t => new N(t),
    createTextNode: t => { const n = new N('#text'); n.nodeType = 3; n.textContent = t; return n; },
    createDocumentFragment: () => new N('frag'),
    getElementById: id => ({ app, 'modal-root': modal, toast, desk }[id] || null),
    querySelector: () => null, querySelectorAll: () => [],
    addEventListener: () => {}, dispatchEvent: () => {}
  };
  if (!globalThis.window) globalThis.window = { addEventListener: () => {}, scrollTo: () => {}, matchMedia: () => ({ matches: false }) };
  const mem = {};
  globalThis.localStorage = {
    getItem: k => (k in mem ? mem[k] : null),
    setItem: (k, v) => { mem[k] = String(v); },
    removeItem: k => { delete mem[k]; },
    get length() { return Object.keys(mem).length; },
    key: i => Object.keys(mem)[i]
  };
  globalThis.CustomEvent = class { constructor(type, opts) { this.type = type; Object.assign(this, opts); } };
  globalThis.confirm = () => true;
  globalThis.requestAnimationFrame = f => { f(0); return 1; };
  globalThis.cancelAnimationFrame = () => {};
}

/** همه‌ی گره‌های درخت */
const walk = (n, out = []) => { out.push(n); (n.children || []).forEach(c => walk(c, out)); return out; };

/** گره‌های دارای این کلاس */
const byClass = (root, cls) => walk(root).filter(n => n.classList?.contains(cls));

/** دکمه‌ای که متنش شامل این عبارت است */
const btnWith = (root, text) =>
  walk(root).find(n => n.tagName === 'BUTTON' && n.textContent.includes(text) && !n.disabled);

const textOf = (root) => root.textContent;

test('دروازه‌های رؤیا: می‌شود واقعاً بازی کرد', async () => {
  installDom();
  const mod = await import('../public/src/games/dream-ui.js');
  const host = new N('div');
  mod.mountGame(host, { onExit: () => {} });

  // منو
  assert.ok(textOf(host).includes('دروازه‌های رؤیا'), 'عنوان روی صفحه نیست');
  const start = btnWith(host, 'شروع خواب');
  assert.ok(start, 'دکمه‌ی شروع پیدا نشد');
  start.click();

  // صفحه‌ی بازی
  assert.ok(textOf(host).includes('دست تو'), 'صفحه‌ی بازی نیامد');
  const hand = byClass(host, 'dream-hand')[0];
  assert.ok(hand, 'دست رندر نشد');
  const cards = hand.children.filter(c => c.classList.contains('dream-card'));
  assert.ok(cards.length >= 1 && cards.length <= 5, `تعداد ورق نامعتبر: ${cards.length}`);

  // یک ورق انتخاب کن
  cards[0].click();
  const playBtn = btnWith(host, 'بازی کردن');
  assert.ok(playBtn, 'دکمه‌ی بازی کردن نیست');

  if (!playBtn.disabled) {
    playBtn.click();
    // زنجیره باید یک کارت داشته باشد
    const chain = byClass(host, 'dream-chain')[0];
    assert.equal(chain.children.length, 1, 'کارت بازی‌شده روی میز نیامد');
  }

  // هرگز نباید صفحه خالی شود
  assert.ok(walk(host).length > 10, 'درخت DOM خالی شد');
});

test('دروازه‌های رؤیا: دور انداختن هم کار می‌کند', async () => {
  installDom();
  const mod = await import('../public/src/games/dream-ui.js');
  const host = new N('div');
  mod.mountGame(host, { onExit: () => {} });
  btnWith(host, 'شروع خواب').click();

  const before = byClass(host, 'dream-hand')[0].children.length;
  byClass(host, 'dream-hand')[0].children[0].click();
  const discard = btnWith(host, 'دور انداختن');
  assert.ok(discard, 'دکمه‌ی دور انداختن نیست');
  discard.click();

  const after = byClass(host, 'dream-hand')[0].children.length;
  assert.equal(after, before, 'دست باید پر بماند');
  // زنجیره نباید عوض شده باشد
  const chain = byClass(host, 'dream-chain')[0];
  assert.ok(!chain.children.some(c => c.classList.contains('dream-card')), 'دور انداختن نباید کارت روی میز بگذارد');
});

test('دروازه‌های رؤیا: راهنما باز و بسته می‌شود', async () => {
  installDom();
  const mod = await import('../public/src/games/dream-ui.js');
  const host = new N('div');
  mod.mountGame(host, { onExit: () => {} });

  btnWith(host, 'راهنما').click();
  assert.ok(textOf(host).includes('سه کارت هم‌رنگ'), 'متن راهنما نیامد');
  btnWith(host, 'فهمیدم').click();
  assert.ok(textOf(host).includes('شروع خواب'), 'بازگشت به منو انجام نشد');
});

test('دروازه‌های رؤیا: روی صفحه‌ی پایان، دوباره شروع می‌شود', async () => {
  installDom();
  const mod = await import('../public/src/games/dream-ui.js');
  const host = new N('div');
  mod.mountGame(host, { onExit: () => {} });
  btnWith(host, 'شروع خواب').click();

  // تا پایان بازی کلیک می‌کنیم (حداکثر ۲۵۰ نوبت)
  let turns = 0;
  while (turns++ < 250) {
    if (byClass(host, 'dream-end').length) break;
    const nightmareOpts = byClass(host, 'dream-opt');
    if (nightmareOpts.length) { nightmareOpts[0].click(); continue; }
    const hand = byClass(host, 'dream-hand')[0];
    if (!hand || !hand.children.length) break;
    hand.children[0].click();
    const play = btnWith(host, 'بازی کردن');
    if (play && !play.disabled) { play.click(); continue; }
    const discard = btnWith(host, 'دور انداختن');
    if (discard && !discard.disabled) { discard.click(); continue; }
    break;
  }

  const end = byClass(host, 'dream-end');
  assert.equal(end.length, 1, 'صفحه‌ی پایان پس از بازی نیامد');
  const again = btnWith(host, 'دوباره');
  assert.ok(again, 'دکمه‌ی دوباره نیست');
  again.click();
  assert.ok(byClass(host, 'dream-hand').length === 1, 'بازی تازه شروع نشد');
});

test('مهره‌چین: از منو تا صفحه‌ی بازی', async () => {
  installDom();
  const mod = await import('../public/src/games/logic-ui.js');
  const host = new N('div');
  mod.mountGame(host, { onExit: () => {} });
  assert.ok(textOf(host).includes('مهره‌چین'));

  const start = btnWith(host, 'شروع معما');
  assert.ok(start, 'دکمه‌ی شروع معما نیست');
  start.click();

  const board = byClass(host, 'logic-board')[0];
  assert.ok(board, 'صفحه‌ی معما رندر نشد');
  assert.equal(board.children.length, 25, 'صفحه باید ۲۵ خانه داشته باشد');

  // مهره بگذار
  const palette = byClass(host, 'logic-palette')[0];
  assert.ok(palette, 'نوار مهره‌ها نیست');
  const tokens = palette.children.filter(c => c.tagName === 'BUTTON');
  assert.ok(tokens.length >= 2, 'مهره‌ها کم‌اند');
  tokens[0].click();
  const cells = board.children.filter(c => c.tagName === 'BUTTON');
  cells[0].click();
  assert.ok(byClass(host, 'logic-piece').length >= 1, 'مهره روی صفحه ننشست');
});
