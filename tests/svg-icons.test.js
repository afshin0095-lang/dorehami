/* ============================================================
   آزمون آیکون‌های SVG — «هیچ‌وقت دیده نشدند»
   
   باگ واقعی: `h('svg', …)` عنصر را با document.createElement می‌ساخت،
   یعنی در فضای‌نام HTML. مرورگر چنین عنصری را رسم نمی‌کند و هیچ
   خطایی هم نمی‌دهد. آیکون‌های تنظیمات/مدیریت/بازگشت سال‌ها نامرئی
   بودند و کسی نمی‌فهمید چرا.
   
   این آزمون فضای‌نام را می‌سنجد، نه وجود عنصر را — چون عنصر «بود»
   ولی رسم نمی‌شد.
   ============================================================ */

import { test } from 'node:test';
import assert from 'node:assert/strict';

const SVG_NS = 'http://www.w3.org/2000/svg';

/* ---- DOM قلابی که فضای‌نام را مثل مرورگر واقعی نگه می‌دارد ---- */
class N {
  constructor(tag, ns) {
    this.tagName = String(tag).toUpperCase();
    this.namespaceURI = ns || 'http://www.w3.org/1999/xhtml';
    this.nodeType = 1;
    this.children = [];
    this.childNodes = this.children;
    this.attrs = {};
    this.style = {};
    this.dataset = {};
    this.listeners = {};
    this._html = '';
  }
  set className(v) { this.attrs.class = v; }
  get className() { return this.attrs.class || ''; }
  set innerHTML(v) { this._html = v; }
  get innerHTML() { return this._html; }
  set textContent(v) { this._text = String(v); }
  get textContent() { return (this._text || '') + this.children.map(c => c.textContent || '').join(''); }
  append(...n) { for (const c of n) if (c && c.nodeType) this.children.push(c); }
  appendChild(c) { this.append(c); return c; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return this.attrs[k]; }
  addEventListener(t, f) { (this.listeners[t] ||= []).push(f); }
  removeEventListener() {}
  querySelector() { return null; }
  querySelectorAll() { return []; }
  get attributes() { return Object.entries(this.attrs).map(([name, value]) => ({ name, value })); }
}

function installDom() {
  globalThis.document = {
    createElement: (t) => new N(t, 'http://www.w3.org/1999/xhtml'),
    // همین‌جا تفکیک می‌شود: createElementNS باید فضای‌نام را حفظ کند
    createElementNS: (ns, t) => new N(t, ns),
    createTextNode: (t) => ({ nodeType: 3, textContent: String(t), children: [] }),
    createDocumentFragment: () => new N('frag'),
    querySelector: () => null, querySelectorAll: () => [],
    getElementById: () => null,
    addEventListener: () => {}, dispatchEvent: () => {},
    body: new N('body', 'http://www.w3.org/1999/xhtml'),
    documentElement: new N('html', 'http://www.w3.org/1999/xhtml')
  };
  globalThis.window = {
    addEventListener: () => {}, removeEventListener: () => {},
    matchMedia: () => ({ matches: false, addEventListener: () => {} }),
    location: { hash: '', pathname: '/' }, history: { pushState: () => {} }
  };
  const mem = {};
  globalThis.localStorage = {
    getItem: k => (k in mem ? mem[k] : null),
    setItem: (k, v) => { mem[k] = String(v); },
    removeItem: k => { delete mem[k]; }, length: 0, key: () => null
  };
  globalThis.CustomEvent = class { constructor(t, o) { this.type = t; Object.assign(this, o); } };
}

/* ---- آزمون‌ها ---- */

test('icon() عنصر SVG را در فضای‌نام SVG می‌سازد، نه HTML', async () => {
  installDom();
  const { icon } = await import('../public/src/ui/kit.js');
  const el = icon('settings', 20);
  assert.equal(el.namespaceURI, SVG_NS,
    'آیکون در فضای‌نام HTML ساخته شده — مرورگر آن را رسم نمی‌کند');
  assert.equal(el.tagName, 'SVG');
});

test('آیکون همهٔ دکمه‌های سرصفحه در فضای‌نام درست است', async () => {
  installDom();
  const { icon, iconBtn } = await import('../public/src/ui/kit.js');
  // همان آیکون‌هایی که کاربر گفت «هیچ‌وقت وجود نداشتند»
  for (const name of ['settings', 'panel', 'back']) {
    const svg = icon(name, 20);
    assert.equal(svg.namespaceURI, SVG_NS, `${name}: فضای‌نام HTML`);
    assert.ok((svg.attrs.viewBox || svg.attrs.viewbox), `${name}: viewBox ندارد`);
    assert.ok(svg.innerHTML && svg.innerHTML.length > 10, `${name}: مسیری ندارد`);
  }
  const b = iconBtn('settings', { label: 'تنظیمات', onClick: () => {} });
  const inner = b.children[0];
  assert.equal(inner.namespaceURI, SVG_NS, 'آیکون داخل دکمه در فضای‌نام HTML است');
});

test('همهٔ آیکون‌های نوار پایین فضای‌نام درست دارند', async () => {
  installDom();
  const { navbar } = await import('../public/src/ui/kit.js');
  const nav = navbar({
    items: [
      { id: 'home', label: 'خانه', icon: 'home' },
      { id: 'games', label: 'بازی‌ها', icon: 'games' },
      { id: 'library', label: 'کتابخانه', icon: 'book' },
      { id: 'profile', label: 'پروفایل', icon: 'user' }
    ],
    active: 'home', onNavigate: () => {}
  });
  const walk = (n, out = []) => { out.push(n); for (const c of n.children || []) walk(c, out); return out; };
  const svgs = walk(nav).filter(n => n.tagName === 'SVG');
  assert.equal(svgs.length, 4, `باید ۴ آیکون باشد، هست ${svgs.length}`);
  for (const s of svgs) {
    assert.equal(s.namespaceURI, SVG_NS, 'آیکون نوار پایین در فضای‌نام HTML است');
  }
});

test('مسیرهای فرزند (path/circle) هم باید SVG باشند', async () => {
  installDom();
  const { svgEl } = await import('../public/src/core.js');
  const g = svgEl('g', { class: 'grp' },
    svgEl('path', { d: 'M0 0 L10 10' }),
    svgEl('circle', { cx: 5, cy: 5, r: 2 })
  );
  assert.equal(g.namespaceURI, SVG_NS);
  for (const c of g.children) {
    assert.equal(c.namespaceURI, SVG_NS, `${c.tagName} در فضای‌نام HTML است`);
  }
  // class روی SVG باید با setAttribute برود، نه className
  assert.equal(g.attrs.class, 'grp');
});

test('آیکون بدون نام، بی‌خطا و خالی ساخته می‌شود (نه آیکون شکسته)', async () => {
  installDom();
  const { icon } = await import('../public/src/ui/kit.js');
  const el = icon('ناموجود', 20);
  assert.equal(el.namespaceURI, SVG_NS);
  assert.equal(el.innerHTML, '', 'آیکون ناشناخته نباید مسیر جعلی بگیرد');
});
