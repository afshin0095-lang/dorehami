/* ============================================================
   آزمون رابط کوییز — باگی که پاسخ درست را «غلط» نشان می‌داد
   انتخاب گزینه باید فقط قفل کند؛ رفتن به سؤال بعد جدا باشد.
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
    location: { hash: '' }, history: { pushState: () => {} }
  };
  const mem = {};
  globalThis.localStorage = {
    getItem: k => (k in mem ? mem[k] : null),
    setItem: (k, v) => { mem[k] = String(v); },
    removeItem: k => { delete mem[k]; },
    length: 0, key: () => null
  };
  globalThis.CustomEvent = class { constructor(t, o) { this.type = t; Object.assign(this, o); } };
  globalThis.confirm = () => true;
  return { app };
}

const walk = (n, out = []) => {
  out.push(n);
  for (const c of n.children || []) if (c && c.nodeType === 1) walk(c, out);
  return out;
};
const findButton = (root, re) => walk(root).find(n =>
  n.tagName === 'BUTTON' && re.test(n.textContent || '') && !n.attrs.disabled);
const exactButton = (root, label) => walk(root).find(n =>
  n.tagName === 'BUTTON' && (n.textContent || '').trim() === label && !n.attrs.disabled);
const optionButtons = (root) => walk(root).filter(n =>
  n.tagName === 'BUTTON' && /^[۰-۹]+\.[\s\u200c]/.test((n.textContent || '').trim()));

// گزینه‌های بازی‌های دیگر (گک و تست هوش) کلاس خاص دارند
const classOptions = (root) => walk(root).filter(n =>
  n.tagName === 'BUTTON' && /gk-opt|iq-opt/.test(n.className || ''));

/** متن سؤالِ روی صفحه (پاراگرافی که به «؟» تمام می‌شود) */
const surfaceQuestion = (root) =>
  walk(root).filter(n => n.tagName === 'P').map(n => (n.textContent || '').trim())
    .find(t => t.endsWith('؟')) || null;

/**
 * ایندکس گزینهٔ درست: متن درست را از بانک می‌گیریم (بانک شکل اصلی را دارد،
 * نه ترتیب بُر‌خورده) و بعد می‌بینیم همان متن در UI چندمین دکمه است.
 */
async function correctOptionIndexInUI(root, questionText) {
  const { QUIZ_BANK } = await import('../public/src/content.js');
  const { QUIZ_EXTRA } = await import('../public/src/content-extra.js');
  const bank = [...QUIZ_BANK, ...QUIZ_EXTRA];
  const q = bank.find(x => (x.q || '').trim() === questionText);
  if (!q) return -1;
  const correctText = q.a[q.correct ?? q.answerIndex];
  const buttons = optionButtons(root);
  return buttons.findIndex(b => (b.textContent || '').includes(correctText));
}

test('انتخاب پاسخ درست، «درست بود!» نشان می‌دهد نه غلط', async () => {
  installDom();
  // اول با موتور، ایندکس صحیح را می‌گیریم؛ بعد همان گزینه را در UI می‌زنیم
  const engine = await import('../public/src/engines/quiz.js');
  const { GAMES } = await import('../public/src/games/registry.js');
  const entry = GAMES.find(g => g.id === 'quiz');
  const mod = await entry.load();

  // Math.random را قطعی می‌کنیم تا سؤال و ترتیب گزینه‌ها ثابت بماند
  const realRandom = Math.random;
  let seed = 12345;
  Math.random = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };

  try {
    const host = new FakeNode('div');
    const cleanup = mod.mountGame(host, { game: entry, onExit: () => {} });
    exactButton(host, 'شروع').dispatchEvent({ type: 'click' });

    const opts = optionButtons(host);
    assert.ok(opts.length >= 2, 'گزینه‌ها رندر نشدند');

    // متن گزینه‌ها را برمی‌داریم و با موتور تطبیق می‌دهیم
    const marker = surfaceQuestion(host);
    assert.ok(marker, 'متن سؤال پیدا نشد');

    // گزینه‌ای را می‌زنیم که موتور آن را درست می‌داند
    const correctIdx = await correctOptionIndexInUI(host, marker);
    assert.ok(correctIdx >= 0, 'پاسخ درست شناسایی نشد');

    opts[correctIdx].dispatchEvent({ type: 'click' });

    const text = walk(host).map(n => n.textContent || '').join(' ');
    assert.ok(!/پاسخ درست:/.test(text), 'پاسخ درست به‌عنوان «غلط» نمایش داده شد');
    assert.ok(/درست بود/.test(text), 'پیام «درست بود» نمایش داده نشد');
    cleanup();
  } finally {
    Math.random = realRandom;
  }
});

test('پس از انتخاب، سؤال عوض نمی‌شود تا «سؤال بعد» زده شود', async () => {
  installDom();
  const { GAMES } = await import('../public/src/games/registry.js');
  const entry = GAMES.find(g => g.id === 'quiz');
  const mod = await entry.load();
  const host = new FakeNode('div');
  const cleanup = mod.mountGame(host, { game: entry, onExit: () => {} });
  exactButton(host, 'شروع').dispatchEvent({ type: 'click' });

  // فقط متن خودِ سؤال (نه توضیح پاسخ که بعد از انتخاب ظاهر می‌شود)
  const questionOf = (root) => {
    const ps = walk(root).filter(n => n.tagName === 'P').map(n => (n.textContent || '').trim());
    return ps.find(t => t.endsWith('؟') || t.endsWith('?')) || ps[0] || '';
  };
  const questionBefore = questionOf(host);
  const opts = optionButtons(host);
  opts[0].dispatchEvent({ type: 'click' });

  const questionAfter = questionOf(host);
  assert.equal(questionAfter, questionBefore, 'با انتخاب گزینه، متن سؤال عوض شد');

  const next = findButton(host, /^(سؤال بعد|دیدن نتیجه)$/);
  assert.ok(next, 'دکمهٔ سؤال بعد ظاهر نشد');
  next.dispatchEvent({ type: 'click' });

  const questionNext = questionOf(host);
  assert.notEqual(questionNext, questionBefore, 'با زدن «سؤال بعد»، سؤال عوض نشد');
  cleanup();
});
