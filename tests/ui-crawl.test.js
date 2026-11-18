/* ============================================================
   آزمون حرکت در رابط بازی‌های تازه:
   پس از mount، دکمهٔ «شروع» را می‌زنیم و مطمئن می‌شویم
   صفحهٔ بازی (نه مقدمه) رندر می‌شود — بدون مرورگر.
   ============================================================ */

import { test } from 'node:test';
import assert from 'node:assert/strict';

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
  append(...n) { for (const c of n) { if (c && c.nodeType) { c.parentElement = this; this.children.push(c); } } }
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
  const body = new FakeNode('body');
  const app = new FakeNode('div'); app.attrs.id = 'app';
  const modal = new FakeNode('div'); modal.attrs.id = 'modal-root';
  const toast = new FakeNode('div'); toast.attrs.id = 'toast';
  const desk = new FakeNode('div'); desk.attrs.id = 'desk';
  globalThis.document = {
    body, documentElement: new FakeNode('html'), title: '', hidden: false,
    createElement: t => new FakeNode(t),
    createElementNS: (ns, t) => new FakeNode(t),
    createTextNode: t => { const n = new FakeNode('#text'); n.nodeType = 3; n.textContent = t; return n; },
    createDocumentFragment: () => new FakeNode('frag'),
    getElementById: id => ({ app, 'modal-root': modal, toast, desk }[id] || null),
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
    get length() { return Object.keys(mem).length; },
    key: i => Object.keys(mem)[i]
  };
  globalThis.CustomEvent = class CustomEvent { constructor(type, opts) { this.type = type; Object.assign(this, opts); } };
  globalThis.confirm = () => true;
  return { app };
}

/** همهٔ گره‌های درخت را پیمایش کن */
function walk(node, out = []) {
  out.push(node);
  for (const c of node.children || []) if (c && c.nodeType === 1) walk(c, out);
  return out;
}

const findButton = (root, re) => walk(root).find(n =>
  n.tagName === 'BUTTON' && re.test(n.textContent || '') && !n.attrs.disabled);

const count = (root, cls) => walk(root).filter(n => (n.className || '').split(/\s+/).includes(cls)).length;

const NEW_GAMES = ['uno', 'eights', 'blackjack', 'yahtzee', 'farkle', 'skyjo', 'kittens', 'liarsdice'];

test('هر بازی تازه: مقدمه رندر می‌شود و «شروع» به میز می‌برد', async () => {
  installDom();
  const { GAMES } = await import('../public/src/games/registry.js');
  for (const id of NEW_GAMES) {
    const entry = GAMES.find(g => g.id === id);
    assert.ok(entry, `${id}: در فهرست بازی‌ها نیست`);
    const mod = await entry.load();
    const host = new FakeNode('div');
    const cleanup = mod.mountGame(host, { game: entry, onExit: () => {} });
    assert.ok(host.children.length > 0, `${id}: چیزی رندر نشد`);

    const start = findButton(host, /^(شروع|شروع دست|شروع دور)( |$)/);
    assert.ok(start, `${id}: دکمهٔ شروع پیدا نشد`);
    start.dispatchEvent({ type: 'click', currentTarget: start, target: start, preventDefault() {}, stopPropagation() {} });

    // پس از شروع باید میز بازی بیاید، نه مقدمه
    const html = walk(host).map(n => n.className || '').join(' ');
    assert.ok(/tbl-|cards-table|bj-|dice-tray|yahtzee|skyjo|kit-|liar-|uno-/.test(html),
      `${id}: پس از شروع هیچ نشانهٔ میز بازی نبود`);
    cleanup();
  }
});

test('میز هر بازی تازه کنترل‌های واقعی دارد', async () => {
  installDom();
  const { GAMES } = await import('../public/src/games/registry.js');
  const expect = {
    uno: /uno-top/,
    eights: /cards-table/,
    blackjack: /bj-mine/,
    yahtzee: /yahtzee-cell/,
    farkle: /dice-tray/,
    skyjo: /skyjo-grid/,
    kittens: /kit-hand/,
    liarsdice: /liar-hand/
  };
  for (const [id, re] of Object.entries(expect)) {
    const entry = GAMES.find(g => g.id === id);
    const mod = await entry.load();
    const host = new FakeNode('div');
    const cleanup = mod.mountGame(host, { game: entry, onExit: () => {} });
    const start = findButton(host, /^(شروع|شروع دست|شروع دور)( |$)/);
    start.dispatchEvent({ type: 'click', currentTarget: start, target: start, preventDefault() {}, stopPropagation() {} });
    const marks = walk(host).map(n => n.className || '').join(' ');
    assert.ok(re.test(marks), `${id}: ${re} روی میز نیست`);
    cleanup();
  }
});

test('یاتزی: ریختن تاس‌ها واقعاً تاس‌ها را عوض می‌کند', async () => {
  installDom();
  const { GAMES } = await import('../public/src/games/registry.js');
  const entry = GAMES.find(g => g.id === 'yahtzee');
  const mod = await entry.load();
  const host = new FakeNode('div');
  const cleanup = mod.mountGame(host, { game: entry, onExit: () => {} });
  findButton(host, /^شروع/).dispatchEvent({ type: 'click' });

  const before = count(host, 'die');
  assert.ok(before >= 5, `فقط ${before} تاس رندر شد`);
  const roll = findButton(host, /^ریختن/);
  assert.ok(roll, 'دکمهٔ ریختن نیست');
  roll.dispatchEvent({ type: 'click' });
  assert.equal(count(host, 'die'), 5, 'پس از ریختن باید ۵ تاس بماند');

  // خانه‌های قابل ثبت باید فعال شوند
  const cell = walk(host).find(n => (n.className || '').includes('yahtzee-cell') && !n.attrs.disabled);
  assert.ok(cell, 'هیچ خانهٔ قابل ثبتی فعال نشد');
  cleanup();
});

test('اونو: پس از شروع، دست و کارت روی زمین رندر می‌شود', async () => {
  installDom();
  const { GAMES } = await import('../public/src/games/registry.js');
  const entry = GAMES.find(g => g.id === 'uno');
  const mod = await entry.load();
  const host = new FakeNode('div');
  const cleanup = mod.mountGame(host, { game: entry, onExit: () => {} });
  findButton(host, /^شروع/).dispatchEvent({ type: 'click' });
  assert.ok(count(host, 'uno-top') >= 1, 'کارت روی زمین نیست');
  assert.ok(count(host, 'tbl-card') >= 7, 'کارت‌های دست رندر نشدند');
  cleanup();
});

test('تاس دروغگو: تاس‌های خودم و شرط رندر می‌شوند', async () => {
  installDom();
  const { GAMES } = await import('./../public/src/games/registry.js');
  const entry = GAMES.find(g => g.id === 'liarsdice');
  const mod = await entry.load();
  const host = new FakeNode('div');
  const cleanup = mod.mountGame(host, { game: entry, onExit: () => {} });
  findButton(host, /^شروع/).dispatchEvent({ type: 'click' });
  assert.ok(count(host, 'die') >= 5, 'تاس‌های دست رندر نشدند');
  assert.ok(findButton(host, /^شرط/), 'دکمهٔ شرط نیست');
  assert.ok(findButton(host, /دروغ می‌گویی/), 'دکمهٔ اعتراض نیست');
  cleanup();
});
