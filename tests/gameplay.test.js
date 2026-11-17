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
  setAttribute(k, v) {
    this.attrs[k] = String(v);
    if (k === 'class') this.className = v;
    if (k === 'disabled') this.disabled = true;
  }
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
    createElementNS: (ns, t) => new N(t),
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

  // اگر کابوس وسط پر کردن دست بیاید، دست ناقص می‌ماند و پنجره‌ی کابوس باز می‌شود —
  // این رفتار درست موتور است، پس هر دو حالت پذیرفته می‌شود.
  const nightmareOpen = byClass(host, 'dream-nightmare').length > 0;
  if (nightmareOpen) {
    assert.ok(byClass(host, 'dream-opt').length > 0, 'کابوس باید گزینه داشته باشد');
  } else {
    const after = byClass(host, 'dream-hand')[0].children.length;
    assert.equal(after, before, 'دست باید پر بماند');
  }
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

test('دوز: از منو تا تخته و نشستن مهره', async () => {
  installDom();
  const mod = await import('../public/src/games/duz-ui.js');
  const host = new N('div');
  const cleanup = mod.mountGame(host, { onExit: () => {} });

  assert.ok(textOf(host).includes('دوز'), 'عنوان نیامد');
  assert.ok(textOf(host).includes('آسیاب'), 'توضیح قواعد نیامد');

  const start = btnWith(host, 'شروع بازی');
  assert.ok(start, 'دکمهٔ شروع نیست');
  start.click();

  // تخته باید با SVG ساخته شود
  const svg = walk(host).find(n => n.tagName === 'SVG' || n.tagName === 'svg');
  assert.ok(svg, 'تختهٔ SVG رندر نشد');

  // ۲۴ نقطه باید باشد
  const nodes = walk(host).filter(n => n.attrs && n.attrs['data-node'] !== undefined);
  assert.equal(nodes.length, 24, `تعداد نقطهٔ تخته: ${nodes.length}`);

  // یک نقطهٔ خالی را انتخاب کن — بازی باید پیش برود
  const empty = nodes.find(n => n.classList?.contains('is-target')) || nodes[0];
  empty.click();

  // بعد از کلیک، خطایی نباید رخ دهد و صفحه باید سالم بماند
  assert.ok(walk(host).length > 20, 'درخت DOM پس از کلیک خالی شد');
  cleanup();
});

test('دوز: تخته پس از هر حرکت دوباره ساخته می‌شود', async () => {
  installDom();
  const mod = await import('../public/src/games/duz-ui.js');
  const host = new N('div');
  mod.mountGame(host, { onExit: () => {} });
  btnWith(host, 'شروع بازی').click();

  const countNodes = () => walk(host).filter(n => n.attrs && n.attrs['data-node'] !== undefined).length;
  assert.equal(countNodes(), 24);

  // چند کلیک روی نقاط خالی
  for (let i = 0; i < 4; i++) {
    const nodes = walk(host).filter(n => n.attrs && n.attrs['data-node'] !== undefined);
    const target = nodes.find(n => n.classList?.contains('is-target')) || nodes[i];
    if (target) target.click();
  }

  assert.equal(countNodes(), 24, 'تخته باید همیشه ۲۴ نقطه داشته باشد');
  assert.ok(textOf(host).includes('دوز'), 'سرصفحه گم شد');
});

test('دوز: حالت دو نفره هم باز می‌شود', async () => {
  installDom();
  const mod = await import('../public/src/games/duz-ui.js');
  const host = new N('div');
  mod.mountGame(host, { onExit: () => {} });

  const duoBtn = walk(host).find(n => n.tagName === 'BUTTON' && n.textContent.includes('دو نفره'));
  assert.ok(duoBtn, 'گزینهٔ دو نفره نیست');
  duoBtn.click();
  btnWith(host, 'شروع بازی').click();

  assert.ok(textOf(host).includes('بازیکن ۲'), 'حالت دو نفره نام بازیکن دوم را نشان نمی‌دهد');
});

test('تفاوت را پیدا کن: از منو تا دو تابلو', async () => {
  installDom();
  const mod = await import('../public/src/games/spot-ui.js');
  const host = new N('div');
  const cleanup = mod.mountGame(host, { onExit: () => {} });

  assert.ok(textOf(host).includes('تفاوت را پیدا کن'), 'عنوان نیامد');
  const start = btnWith(host, 'شروع');
  assert.ok(start, 'دکمهٔ شروع نیست');
  start.click();

  // دو تابلو باید رندر شوند — با کلاس spot-svg شناسایی می‌شوند
  const svgs = walk(host).filter(n => n.classList?.contains('spot-svg'));
  assert.equal(svgs.length, 2, `تعداد تابلو: ${svgs.length}`);

  // هر تابلو لایهٔ کلیک دارد
  const layers = walk(host).filter(n => n.classList?.contains('spot-hit-layer'));
  assert.equal(layers.length, 2, `لایهٔ کلیک: ${layers.length}`);

  // چند نشانگر پیشرفت
  const pips = walk(host).filter(n => n.classList?.contains('spot-pip'));
  assert.ok(pips.length >= 3, `نشانگر پیشرفت کم است: ${pips.length}`);
  cleanup();
});

test('تفاوت را پیدا کن: کلیک روی تابلو خطا نمی‌دهد', async () => {
  installDom();
  const mod = await import('../public/src/games/spot-ui.js');
  const host = new N('div');
  const cleanup = mod.mountGame(host, { onExit: () => {} });
  btnWith(host, 'شروع').click();

  const layer = walk(host).find(n => n.classList?.contains('spot-hit-layer'));
  assert.ok(layer, 'لایهٔ کلیک نیست');
  // کلیک بدون مختصات واقعی — نباید بترکد
  layer.click();
  assert.ok(walk(host).length > 30, 'DOM پس از کلیک خالی شد');
  assert.ok(textOf(host).includes('تفاوت'), 'سرصفحه گم شد');
  cleanup();
});

test('تفاوت را پیدا کن: راهنما و تابلو تازه کار می‌کنند', async () => {
  installDom();
  const mod = await import('../public/src/games/spot-ui.js');
  const host = new N('div');
  const cleanup = mod.mountGame(host, { onExit: () => {} });
  btnWith(host, 'شروع').click();

  const hintBtn = btnWith(host, 'راهنما');
  assert.ok(hintBtn, 'دکمهٔ راهنما نیست');
  hintBtn.click();
  assert.ok(walk(host).some(n => n.classList?.contains('spot-hint')), 'حلقهٔ راهنما رسم نشد');

  const fresh = btnWith(host, 'تابلوی تازه');
  assert.ok(fresh, 'دکمهٔ تابلوی تازه نیست');
  fresh.click();
  assert.equal(walk(host).filter(n => n.classList?.contains('spot-hit-layer')).length, 2, 'تابلوی تازه رندر نشد');
  cleanup();
});

test('تفاوت را پیدا کن: صحنهٔ مقدمه واقعاً انتخاب می‌شود', async () => {
  installDom();
  const mod = await import('../public/src/games/spot-ui.js');
  const host = new N('div');
  const cleanup = mod.mountGame(host, { onExit: () => {} });

  const scenes = walk(host).filter(n => n.classList?.contains('spot-scene'));
  assert.equal(scenes.length, 3, `تعداد صحنه: ${scenes.length}`);
  assert.ok(scenes[0].classList.contains('is-on'), 'صحنهٔ پیش‌فرض فعال نیست');

  // انتخاب صحنهٔ دوم باید حالت را عوض کند
  scenes[1].click();
  const after = walk(host).filter(n => n.classList?.contains('spot-scene'));
  assert.ok(after[1].classList.contains('is-on'), 'صحنهٔ دوم فعال نشد');
  assert.ok(!after[0].classList.contains('is-on'), 'صحنهٔ اول هنوز فعال است');

  // و شروع باید همان صحنه را بسازد
  btnWith(host, 'شروع').click();
  const titles = walk(host).filter(n => n.classList?.contains('spot-caption__title'));
  assert.ok(titles.length === 1, 'عنوان تابلو نیست');
  cleanup();
});

test('گِلومهیون: از مقدمه تا کارت‌های دست', async () => {
  installDom();
  const mod = await import('../public/src/games/gloom-ui.js');
  const host = new N('div');
  const cleanup = mod.mountGame(host, { onExit: () => {} });

  assert.ok(textOf(host).includes('گِلومهیون'), 'عنوان نیامد');
  assert.equal(walk(host).filter(n => n.classList?.contains('gloom-scenario')).length, 4, 'صحنه‌ها');
  assert.equal(walk(host).filter(n => n.classList?.contains('level-card')).length, 3, 'سطوح');

  btnWith(host, 'شروع').click();
  assert.equal(walk(host).filter(n => n.classList?.contains('ability-card')).length, 8, 'کارت‌های دست');
  assert.ok(walk(host).filter(n => n.classList?.contains('gloom-enemy')).length >= 1, 'دشمنان');
  cleanup();
});

test('گِلومهیون: انتخاب دو کارت و اجرای نوبت', async () => {
  installDom();
  const mod = await import('../public/src/games/gloom-ui.js');
  const host = new N('div');
  const cleanup = mod.mountGame(host, { onExit: () => {} });
  btnWith(host, 'شروع').click();

  walk(host).filter(n => n.classList?.contains('ability-card'))[0].click();
  walk(host).filter(n => n.classList?.contains('ability-card'))[1].click();

  assert.equal(walk(host).filter(n => n.classList?.contains('ability-card') && n.classList?.contains('is-on')).length, 2, 'دو کارت انتخاب نشد');
  assert.equal(walk(host).filter(n => n.classList?.contains('gloom-combine')).length, 1, 'ترکیب نیامد');
  assert.equal(walk(host).filter(n => n.classList?.contains('gloom-combine__opt')).length, 2, 'دو ترکیب باید باشد');

  btnWith(host, 'اجرای نوبت').click();
  assert.equal(walk(host).filter(n => n.classList?.contains('ability-card')).length, 6, 'کارت‌ها کم نشد');
  assert.ok(walk(host).filter(n => n.classList?.contains('gloom-log__row')).length > 0, 'گزارش خالی است');
  cleanup();
});

test('گِلومهیون: بیش از دو کارت انتخاب نمی‌شود', async () => {
  installDom();
  const mod = await import('../public/src/games/gloom-ui.js');
  const host = new N('div');
  const cleanup = mod.mountGame(host, { onExit: () => {} });
  btnWith(host, 'شروع').click();

  walk(host).filter(n => n.classList?.contains('ability-card'))[0].click();
  walk(host).filter(n => n.classList?.contains('ability-card'))[1].click();
  walk(host).filter(n => n.classList?.contains('ability-card'))[2].click();

  assert.equal(
    walk(host).filter(n => n.classList?.contains('ability-card') && n.classList?.contains('is-on')).length,
    2, 'بیش از دو کارت انتخاب شد'
  );
  cleanup();
});
