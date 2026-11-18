/* آزمون دود UI: بدون مرورگر، DOM ساده شبیه‌سازی می‌شود و هر ۱۰ بازی mount می‌شود. */

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
  get textContent() { return this._text + this.children.map(c => c.textContent).join(''); }
  append(...n) { for (const c of n) { if (c && c.nodeType) { c.parentElement = this; this.children.push(c); } } }
  appendChild(c) { this.append(c); return c; }
  replaceChildren(...n) { this.children = []; this.append(...n); }
  remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(c => c !== this); }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return this.attrs[k]; }
  addEventListener(t, f) { (this.listeners[t] ||= []).push(f); }
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
    // مرورگر واقعی این را جدا دارد؛ آیکون‌ها با آن ساخته می‌شوند.
    // بدونش، یک SVG در فضای‌نام HTML می‌ماند و رسم نمی‌شود.
    createElementNS: (ns, t) => new FakeNode(t),
    createTextNode: t => { const n = new FakeNode('#text'); n.nodeType = 3; n.textContent = t; return n; },
    createDocumentFragment: () => new FakeNode('frag'),
    getElementById: id => ({ app, 'modal-root': modal, toast, desk }[id] || null),
    querySelector: () => null, querySelectorAll: () => [],
    addEventListener: () => {}, dispatchEvent: () => {}
  };
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
  if (!globalThis.localStorage) throw new Error('localStorage لازم است');
  return { app };
}

test('همه‌ی بازی‌ها در یک DOM شبیه‌سازی‌شده mount می‌شوند و cleanup برمی‌گردانند', async () => {
  installDom();
  const { GAMES } = await import('../public/src/games/registry.js');
  assert.ok(GAMES.length >= 12, 'حداقل ۱۰ بازی لازم است');

  for (const g of GAMES) {
    const mod = await g.load();
    assert.equal(typeof mod.mountGame, 'function', `${g.id}: mountGame ندارد`);
    const host = new FakeNode('div');
    const cleanup = mod.mountGame(host, { game: g, onExit: () => {} });
    assert.equal(typeof cleanup, 'function', `${g.id}: cleanup برنگرداند`);
    assert.ok(host.children.length > 0, `${g.id}: هیچ محتوایی رندر نکرد`);
    cleanup();
  }
});

test('صفحه‌ی خانه و فهرست بازی‌ها بدون خطا رندر می‌شوند', async () => {
  installDom();
  const { HomeScreen, GamesScreen } = await import('../public/src/ui/screens.js');
  const home = HomeScreen({ navigate: () => {}, openGame: () => {} });
  assert.ok(home.children.length > 0);
  const games = GamesScreen({ navigate: () => {}, openGame: () => {}, state: { cat: 'all', q: '' } });
  assert.ok(games.children.length > 0);
});

test('آمار و رکورد محلی ذخیره و بازخوانی می‌شود', async () => {
  installDom();
  const { stats, playStreak, localDateKey } = await import('../public/src/core.js');
  stats.record('quiz', { label: 'تست', key: 'quiz-best', best: 5, higherIsBetter: true });
  const s = stats.get();
  assert.equal(s.byGame.quiz, 1);
  assert.equal(s.best['quiz-best'], 5);
  assert.equal(playStreak(s.playDates), 1);
  assert.ok(s.playDates.includes(localDateKey()));
});
