/* ============================================================
   آزمون پنل‌ها — تنظیمات و پنل مدیریت باید واقعاً چیزی نشان دهند
   باگ گزارش‌شده: «صفحه خالی است».
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
const textOf = (n) => walk(n).map(x => x.textContent || '').join(' ');

test('تنظیمات باز می‌شود و محتوا دارد', async () => {
  const { modal } = installDom();
  const { openSettings } = await import('../public/src/ui/settings.js');
  assert.doesNotThrow(() => openSettings(), 'openSettings خطا داد');

  assert.ok(modal.children.length > 0, 'هیچ چیزی در overlay گذاشته نشد');
  const txt = textOf(modal);
  assert.ok(txt.includes('تنظیمات'), 'عنوان تنظیمات نیست');
  assert.ok(txt.includes('صدای رابط'), 'کلید صدا نیست');
  assert.ok(txt.includes('بلندی صدا'), 'اسلایدر بلندی صدا نیست');
  assert.ok(txt.includes('پاک'), 'دکمهٔ پاک‌سازی نیست');
});

test('همهٔ کلیدهای تنظیمات ساخته می‌شوند', async () => {
  const { modal } = installDom();
  const { openSettings } = await import('../public/src/ui/settings.js');
  openSettings();
  const boxes = walk(modal).filter(n => n.tagName === 'INPUT' && n.attrs.type === 'checkbox');
  assert.ok(boxes.length >= 3, `فقط ${boxes.length} کلید ساخته شد`);
});

test('پنل مدیریت باز می‌شود و محتوا دارد', async () => {
  const { modal } = installDom();
  const { AdminScreen } = await import('../public/src/ui/admin.js');
  assert.equal(typeof AdminScreen, 'function', 'AdminScreen صادر نمی‌شود');
  const { mount } = await import('../public/src/core.js');
  const app = document.getElementById('app');
  assert.doesNotThrow(() => mount(app, AdminScreen({ onBack: () => {} })), 'AdminScreen خطا داد');
  assert.ok(app.children.length > 0, 'پنل مدیریت چیزی نشان نداد');
  modal.replaceChildren(...app.children);
  const txt = textOf(modal);
  assert.ok(/مدیریت|مدیر|ورود|رمز/.test(txt), `متن پنل مدیریت نیست: ${txt.slice(0, 120)}`);
});

test('آیکون داخل دکمه اندازهٔ قطعی دارد (باگ دکمه‌های پاپ‌آپ)', () => {
  // SVG بدون width/height در flex به ۳۰۰×۱۵۰ می‌رسد و پنل را از هم می‌پاشد
  const css = readFileSync(join(ROOT, 'public/styles.css'), 'utf8');
  const block = css.slice(css.indexOf('.btn--with-icon svg'));
  assert.match(block.slice(0, 300), /width:\s*16px/, 'آیکون دکمه عرض قطعی ندارد');
  assert.match(block.slice(0, 300), /height:\s*16px/, 'آیکون دکمه ارتفاع قطعی ندارد');
  assert.match(css, /\.btn svg\s*\{[^}]*max-width/, 'شبکهٔ ایمنی برای svg دکمه نیست');
});

test('دکمه‌های پنل مدیریت نشان دارند و خالی نیستند', async () => {
  const { modal } = installDom();
  const { AdminScreen } = await import('../public/src/ui/admin.js');
  const { mount } = await import('../public/src/core.js');
  const app = document.getElementById('app');
  mount(app, AdminScreen({ onBack: () => {} }));
  modal.replaceChildren(...app.children);
  const buttons = walk(modal).filter(n => n.tagName === 'BUTTON');
  assert.ok(buttons.length > 0, 'هیچ دکمه‌ای ساخته نشد');
  const empty = buttons.filter(b => (b.textContent || '').trim().length === 0);
  assert.equal(empty.length, 0, `${empty.length} دکمهٔ بی‌متن (خالی) وجود دارد`);
});
