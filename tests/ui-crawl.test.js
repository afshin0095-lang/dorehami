/* ============================================================
   خزنده‌ی رابط: هر بازی را mount می‌کند و دکمه‌ها را به‌ترتیب
   «کلیک» می‌کند تا خطاهای زمان اجرا در صفحه‌های بعدی پیدا شوند.
   DOM شبیه‌سازی‌شده است؛ هیچ وابستگی مرورگری لازم نیست.
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
    this._text = '';
    this.classList = {
      _s: new Set(),
      add(...c) { c.forEach(x => this._s.add(x)); },
      remove(...c) { c.forEach(x => this._s.delete(x)); },
      toggle(c, on) { if (on === undefined) { this._s.has(c) ? this._s.delete(c) : this._s.add(c); } else if (on) this._s.add(c); else this._s.delete(c); },
      contains(c) { return this._s.has(c); }
    };
  }
  set className(v) { this.attrs.class = v; }
  get className() { return this.attrs.class || ''; }
  set innerHTML(v) { this._html = v; }
  get innerHTML() { return this._html || ''; }
  set textContent(v) { this._text = String(v); }
  get textContent() { return this._text + this.children.map(c => c.textContent).join(''); }
  append(...n) { for (const c of n) { if (c && c.nodeType) { c.parentElement = this; this.children.push(c); } } }
  appendChild(c) { this.append(c); return c; }
  replaceChildren(...n) { this.children = []; this.append(...n); }
  remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(c => c !== this); }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return this.attrs[k]; }
  addEventListener(t, f) { (this.listeners[t] ||= []).push(f); }
  removeEventListener() {}
  dispatchEvent(e) { (this.listeners[e.type] || []).forEach(f => f(e)); return true; }
  querySelector(sel) { return findAll(this, sel)[0] || null; }
  querySelectorAll(sel) { return findAll(this, sel); }
  get firstChild() { return this.children[0] || null; }
  click() { this.dispatchEvent({ type: 'click', target: this, currentTarget: this, preventDefault() {}, stopPropagation() {} }); }
}

function findAll(root, sel) {
  const out = [];
  const cls = sel.startsWith('.') ? sel.slice(1) : null;
  const walk = (n) => {
    if (cls && (n.attrs.class || '').split(/\s+/).includes(cls)) out.push(n);
    n.children.forEach(walk);
  };
  root.children.forEach(walk);
  return out;
}

// همه‌ی setTimeout ها فوراً اجرا می‌شوند تا صفحه‌های بعدی هم دیده شوند
let pendingTimers = [];
const realTimeout = setTimeout;
globalThis.setTimeout = (fn, ms) => { pendingTimers.push(fn); return pendingTimers.length; };
const flush = () => {
  let guard = 0;
  while (pendingTimers.length && guard++ < 60) {
    const batch = pendingTimers; pendingTimers = [];
    for (const fn of batch) { try { fn(); } catch (e) { throw e; } }
  }
};

function installDom() {
  const body = new FakeNode('body');
  const app = new FakeNode('div'); app.attrs.id = 'app';
  const modal = new FakeNode('div'); modal.attrs.id = 'modal-root';
  const toastEl = new FakeNode('div'); toastEl.attrs.id = 'toast';
  const desk = new FakeNode('div'); desk.attrs.id = 'desk';
  const doc = {
    body, documentElement: new FakeNode('html'), title: '', hidden: false,
    createElement: t => new FakeNode(t),
    createTextNode: t => { const n = new FakeNode('#text'); n.nodeType = 3; n.textContent = t; return n; },
    createDocumentFragment: () => new FakeNode('frag'),
    getElementById: id => ({ app, 'modal-root': modal, toast: toastEl, desk }[id] || null),
    querySelector: sel => app.querySelector(sel),
    querySelectorAll: sel => app.querySelectorAll(sel),
    addEventListener: () => {}, dispatchEvent: () => {}
  };
  globalThis.document = doc;
  globalThis.window = { addEventListener: () => {}, scrollTo: () => {}, matchMedia: () => ({ matches: false }) };
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
  return { app, modal };
}

/** دکمه‌های قابل کلیک را پیدا می‌کند (دکمه‌ها و المان‌های دارای onclick) */
function clickables(root) {
  const out = [];
  const walk = (n) => {
    const isBtn = n.tagName === 'BUTTON' || n.tagName === 'A';
    const hasHandler = n.listeners?.click?.length > 0;
    const disabled = n.attrs.disabled !== undefined || n.classList.contains('is-disabled');
    if ((isBtn || hasHandler) && !disabled) out.push(n);
    n.children.forEach(walk);
  };
  walk(root);
  return out;
}

let totalClicks = 0;

test('خزنده: هیچ بازی در صفحه‌های بعدی خطای زمان اجرا نمی‌دهد', async () => {
  installDom();
  const { GAMES } = await import('../public/src/games/registry.js');
  const problems = [];

  for (const g of GAMES) {
    const mod = await g.load();
    const host = new FakeNode('div');
    let cleanup;
    try {
      cleanup = mod.mountGame(host, { game: g, onExit: () => {} });
    } catch (e) {
      problems.push(`${g.id} (mount): ${e.message}`);
      continue;
    }

    // تا ۲۵ کلیک پشت‌سرهم؛ هر بار اولین دکمه‌ی کلیک‌نشده
    const clicked = new Set();
    for (let step = 0; step < 25; step++) {
      let target = null;
      const scan = () => {
        const list = [...clickables(host), ...clickables(document.getElementById('modal-root'))];
        target = list.find(el => !clicked.has(el)) || null;
        // اگر همه‌ی دکمه‌ها دیده شدند، از نو شروع کن (چرخه‌ی بازی)
        if (!target && list.length) target = list[step % list.length];
      };
      scan();
      if (!target) break;
      clicked.add(target);
      try {
        totalClicks++;
        target.click();
        flush();
      } catch (e) {
        problems.push(`${g.id} (کلیک «${(target.textContent || '').slice(0, 24)}»): ${e.message}`);
        break;
      }
    }

    try { cleanup?.(); } catch (e) { problems.push(`${g.id} (cleanup): ${e.message}`); }
    document.getElementById('modal-root').replaceChildren();
  }

  assert.deepEqual(problems, [], `خطاها:\n${problems.join('\n')}`);
  assert.ok(totalClicks >= 60, `تعداد کلیک‌های انجام‌شده کم است: ${totalClicks}`);
});

test.after(() => { globalThis.setTimeout = realTimeout; });
