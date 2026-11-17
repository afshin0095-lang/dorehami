/* ============================================================
   «تفاوت را پیدا کن» — دو تابلوی اروپایی کنار هم
   صحنه با SVG رسم می‌شود تا تفاوت‌ها دقیقاً کنترل شوند.
   ============================================================ */

import { h, mount, playSound, stats, toFa } from '../core.js';
import { gameHeader, sheet, btn, helpBlock, callout, icon } from '../ui/kit.js';
import {
  SCENES, DIFFICULTY, createPuzzle, tapAt, hintAt, isSolved,
  elapsedMs, scoreOf, variantName
} from '../engines/spot.js';

const NS = 'http://www.w3.org/2000/svg';

const HELP = {
  steps: [
    'دو تابلو می‌بینی: چپ اصل، راست نسخهٔ تغییرکرده. تفاوت‌ها را در هر دو تابلو می‌توانی بزنی.',
    'روی ناحیه‌ای که فکر می‌کنی تفاوت دارد بزن. اگر درست باشد، دایره‌ای طلایی دورش کشیده می‌شود.',
    'کلیک اشتباه، امتیاز کم می‌کند ولی تنبیه سختی ندارد — عجله نکن.',
    'با «راهنما» یک ناحیه مشخص می‌شود، ولی هر راهنما از امتیاز نهایی کم می‌کند.',
    'وقتی همهٔ تفاوت‌ها پیدا شدند، امتیازت بر اساس زمان، خطا و راهنما حساب می‌شود.'
  ],
  example: 'مثال: در تابلو پرنده‌ای روی شاخه هست و در نسخهٔ دوم نیست — یک حذف. یا شمعدانی که شعله‌اش جابه‌جا شده.',
  note: 'تابلوها با SVG کشیده شده‌اند تا هر تفاوت دقیقاً همان جایی باشد که کلیک می‌کنی — بدون تصویر جدا و بدون بارگذاری اضافه.'
};

/* ------------------------------ رسم تابلو ------------------------------ */

function svgEl(tag, attrs) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined) continue;
    n.setAttribute(k, String(v));
  }
  return n;
}

/**
 * یک تابلو می‌کشد.
 * @param {object} puzzle
 * @param {'left'|'right'} side
 * @param {{onTap?:Function, hint?:{x:number,y:number}|null, showFound?:boolean}} opts
 */
function drawPanel(puzzle, side, { onTap, hint = null, flash = null, showFound = true } = {}) {
  const scene = puzzle.scene;
  const p = scene.palette;
  const svg = svgEl('svg', {
    viewBox: '0 0 100 100',
    class: 'spot-svg',
    role: 'img',
    'aria-label': `${scene.title} — ${side === 'left' ? 'تابلوی اصل' : 'نسخهٔ تغییرکرده'}`
  });

  /* آسمان با گرادیان */
  const defs = svgEl('defs');
  const grad = svgEl('linearGradient', { id: `sky-${side}-${scene.id}`, x1: 0, y1: 0, x2: 0, y2: 1 });
  grad.append(
    svgEl('stop', { offset: '0%', 'stop-color': p.sky }),
    svgEl('stop', { offset: '100%', 'stop-color': p.hills, 'stop-opacity': '.55' })
  );
  defs.append(grad);
  svg.append(defs);

  svg.append(svgEl('rect', { x: 0, y: 0, width: 100, height: 100, fill: `url(#sky-${side}-${scene.id})` }));

  /* تپه‌ها */
  svg.append(svgEl('path', {
    d: 'M0,58 Q18,42 34,54 T66,50 Q82,44 100,56 L100,100 L0,100 Z',
    fill: p.hills, opacity: '.65'
  }));
  /* زمین */
  svg.append(svgEl('path', {
    d: 'M0,76 Q30,70 52,78 T100,74 L100,100 L0,100 Z',
    fill: p.ground, opacity: '.85'
  }));

  /* عناصر ثابت صحنه */
  addScenery(svg, scene, side, p);

  /* تفاوت‌ها: در نسخهٔ راست تغییر می‌کنند */
  for (const spot of puzzle.spots) {
    drawFeature(svg, spot, side, p);
  }

  /* نشانهٔ راهنما — ناحیه‌ای که راهنما لو داد */
  if (hint) {
    svg.append(svgEl('rect', {
      x: Math.max(0, hint.x - 5), y: Math.max(0, hint.y - 5),
      width: 10, height: 10, rx: 1.5,
      fill: 'none', stroke: '#b08d57', 'stroke-width': 1.4,
      'stroke-dasharray': '2 1.4', class: 'spot-hint'
    }));
  }

  /* جای کلیک آخر — سبز اگر درست، سرخ اگر خطا */
  if (flash) {
    const cx = Math.max(0, Math.min(100, flash.x));
    const cy = Math.max(0, Math.min(100, flash.y));
    svg.append(svgEl('circle', {
      cx, cy, r: 2.6,
      fill: 'none',
      stroke: flash.ok ? '#2f7d63' : '#a33d2c',
      'stroke-width': 1.2,
      class: 'spot-ring'
    }));
  }

  /* حلقه‌های پیدا‌شده */
  if (showFound) {
    for (const spot of puzzle.spots) {
      if (!spot.found) continue;
      svg.append(svgEl('circle', {
        cx: spot.x + spot.w / 2,
        cy: spot.y + spot.h / 2,
        r: Math.max(spot.w, spot.h) / 2 + 2.5,
        fill: 'none',
        stroke: '#b08d57',
        'stroke-width': 1.4,
        'stroke-dasharray': '3 2',
        class: 'spot-ring'
      }));
    }
  }

  /* راهنما */
  if (hint) {
    svg.append(svgEl('circle', {
      cx: hint.x, cy: hint.y, r: 9,
      fill: 'none', stroke: '#2f6f68', 'stroke-width': 1.6,
      class: 'spot-hint'
    }));
  }

  /* ناحیهٔ کلیک */
  if (onTap) {
    const layer = svgEl('rect', {
      x: 0, y: 0, width: 100, height: 100,
      fill: 'transparent', class: 'spot-hit-layer', role: 'button',
      tabindex: '0',
      'aria-label': 'برای علامت‌گذاری تفاوت، روی تابلو بزن'
    });
    layer.addEventListener('click', (e) => {
      // e.currentTarget در همهٔ محیط‌ها و رویدادهای ساختگی موجود نیست
      const target = e?.currentTarget || layer;
      const rect = typeof target.getBoundingClientRect === 'function'
        ? target.getBoundingClientRect()
        : { left: 0, top: 0, width: 100, height: 100 };
      const cx = Number.isFinite(e?.clientX) ? e.clientX : 50;
      const cy = Number.isFinite(e?.clientY) ? e.clientY : 50;
      const w = rect.width || 100;
      const h = rect.height || 100;
      const x = (cx - (rect.left || 0)) / w * 100;
      const y = (cy - (rect.top || 0)) / h * 100;
      onTap(Math.max(0, Math.min(100, x)), Math.max(0, Math.min(100, y)));
    });
    svg.append(layer);
  }

  return svg;
}

/** عناصر پس‌زمینه که در هر دو تابلو یکی‌اند */
function addScenery(svg, scene, side, p) {
  if (scene.id === 'garden') {
    // عمارت
    svg.append(svgEl('rect', { x: 26, y: 34, width: 30, height: 26, fill: p.stone, opacity: '.9' }));
    svg.append(svgEl('path', { d: 'M24,34 L41,24 L58,34 Z', fill: p.accent, opacity: '.75' }));
    // پنجره‌ها
    for (const wx of [33, 45]) {
      svg.append(svgEl('rect', { x: wx, y: 42, width: 6, height: 8, fill: '#3d3325', opacity: '.65' }));
    }
    // در
    svg.append(svgEl('rect', { x: 40, y: 52, width: 6, height: 8, fill: '#3d3325', opacity: '.7' }));
  } else if (scene.id === 'harbor') {
    // اسکله
    svg.append(svgEl('rect', { x: 0, y: 78, width: 100, height: 4, fill: '#5a4a38', opacity: '.8' }));
    for (let i = 6; i < 96; i += 14) {
      svg.append(svgEl('rect', { x: i, y: 82, width: 2.5, height: 12, fill: '#4a3c2e', opacity: '.7' }));
    }
    // طاق سنگی
    svg.append(svgEl('path', {
      d: 'M54,64 Q63,48 72,64 L72,78 L54,78 Z',
      fill: p.stone, opacity: '.8'
    }));
  } else {
    // دیوار و کف
    svg.append(svgEl('rect', { x: 0, y: 0, width: 100, height: 76, fill: '#4b3d30', opacity: '.55' }));
    svg.append(svgEl('rect', { x: 0, y: 76, width: 100, height: 24, fill: '#2f251c', opacity: '.8' }));
    // قاب آینه
    svg.append(svgEl('rect', { x: 40, y: 12, width: 24, height: 30, rx: 2, fill: 'none', stroke: '#b08d57', 'stroke-width': 1.6, opacity: '.8' }));
  }
}

/** یک ویژگی که در نسخهٔ راست تغییر می‌کند */
function drawFeature(svg, spot, side, p) {
  const changed = side === 'right';
  const v = spot.variant;
  let { x, y, w, h } = spot;

  // تغییرها
  if (changed) {
    if (v === 'shift') { x += w * 0.35; y += h * 0.2; }
    if (v === 'scale') { w *= 1.35; h *= 1.35; }
  }

  const removed = changed && v === 'remove';
  const color = changed && v === 'color' ? shade(p.accent, 1.6) : p.accent;

  if (removed) return;   // حذف‌شده: چیزی رسم نمی‌شود

  switch (spot.kind) {
    case 'tree':
      svg.append(svgEl('rect', { x: x + w / 2 - 1.5, y: y + h * 0.55, width: 3, height: h * 0.45, fill: '#4a3a26' }));
      svg.append(svgEl('circle', { cx: x + w / 2, cy: y + h * 0.35, r: w / 2, fill: '#5c6b3a', opacity: '.85' }));
      svg.append(svgEl('circle', { cx: x + w * 0.3, cy: y + h * 0.45, r: w * 0.32, fill: '#4a5a2e', opacity: '.7' }));
      break;

    case 'bench':
      svg.append(svgEl('rect', { x, y, width: w, height: h * 0.25, fill: '#6b5136' }));
      svg.append(svgEl('rect', { x, y: y + h * 0.3, width: w, height: h * 0.22, fill: '#5a4229' }));
      svg.append(svgEl('rect', { x: x + 2, y: y + h * 0.55, width: 2, height: h * 0.45, fill: '#4a3520' }));
      svg.append(svgEl('rect', { x: x + w - 4, y: y + h * 0.55, width: 2, height: h * 0.45, fill: '#4a3520' }));
      break;

    case 'fountain':
      svg.append(svgEl('ellipse', { cx: x + w / 2, cy: y + h * 0.85, rx: w / 2, ry: h * 0.18, fill: p.stone, opacity: '.9' }));
      svg.append(svgEl('rect', { x: x + w / 2 - 1.2, y: y, width: 2.4, height: h * 0.75, fill: '#6d7a78', opacity: '.8' }));
      svg.append(svgEl('path', {
        d: `M${x + w / 2},${y} q-5,4 -3,9`,
        fill: 'none', stroke: '#7f9490', 'stroke-width': 1.2, opacity: '.75'
      }));
      break;

    case 'bird':
      svg.append(svgEl('path', {
        d: `M${x},${y + h / 2} q${w * 0.25},${-h * 0.45} ${w * 0.5},0 q${w * 0.25},${-h * 0.45} ${w * 0.5},0`,
        fill: 'none', stroke: '#3a3328', 'stroke-width': 1.2, opacity: '.8'
      }));
      break;

    case 'window':
      svg.append(svgEl('rect', { x, y, width: w, height: h, fill: '#2f2a20', opacity: '.7' }));
      svg.append(svgEl('line', { x1: x + w / 2, y1: y, x2: x + w / 2, y2: y + h, stroke: '#b5a88c', 'stroke-width': 0.8, opacity: '.8' }));
      svg.append(svgEl('line', { x1: x, y1: y + h / 2, x2: x + w, y2: y + h / 2, stroke: '#b5a88c', 'stroke-width': 0.8, opacity: '.8' }));
      break;

    case 'sail':
      svg.append(svgEl('path', {
        d: `M${x + w / 2},${y} L${x + w},${y + h * 0.75} L${x + w / 2},${y + h * 0.75} Z`,
        fill: '#d8cfb8', opacity: '.9'
      }));
      svg.append(svgEl('rect', { x: x + w / 2 - 1, y: y + h * 0.75, width: 2, height: h * 0.25, fill: '#4a3c2e' }));
      break;

    case 'lantern':
      svg.append(svgEl('rect', { x: x + w / 2 - 1, y, width: 2, height: h * 0.35, fill: '#3a3328' }));
      svg.append(svgEl('rect', { x, y: y + h * 0.35, width: w, height: h * 0.45, fill: '#d9a441', opacity: '.85', rx: 1 }));
      break;

    case 'arch':
      svg.append(svgEl('path', {
        d: `M${x},${y + h} Q${x + w / 2},${y} ${x + w},${y + h}`,
        fill: 'none', stroke: color, 'stroke-width': 1.6, opacity: '.85'
      }));
      break;

    case 'chest':
      svg.append(svgEl('rect', { x, y: y + h * 0.3, width: w, height: h * 0.7, fill: '#5a4229' }));
      svg.append(svgEl('path', {
        d: `M${x},${y + h * 0.3} Q${x + w / 2},${y} ${x + w},${y + h * 0.3}`,
        fill: '#6b5136'
      }));
      svg.append(svgEl('rect', { x: x + w / 2 - 1.5, y: y + h * 0.45, width: 3, height: 3, fill: '#b08d57' }));
      break;

    case 'candle':
      svg.append(svgEl('rect', { x: x + w / 2 - 1.2, y: y + h * 0.3, width: 2.4, height: h * 0.7, fill: '#e8dfc8' }));
      svg.append(svgEl('ellipse', { cx: x + w / 2, cy: y + h * 0.2, rx: 1.8, ry: 3.2, fill: '#e8b455', opacity: '.9' }));
      break;

    case 'mirror':
      svg.append(svgEl('rect', { x, y, width: w, height: h, rx: 1, fill: '#8f9a94', opacity: '.55' }));
      svg.append(svgEl('rect', { x, y, width: w, height: h, rx: 1, fill: 'none', stroke: '#b08d57', 'stroke-width': 1.2 }));
      break;

    case 'chair':
      svg.append(svgEl('rect', { x, y: y + h * 0.45, width: w, height: h * 0.22, fill: '#4a3a2a' }));
      svg.append(svgEl('rect', { x, y, width: w * 0.18, height: h * 0.5, fill: '#3d2f22' }));
      svg.append(svgEl('rect', { x: x + 2, y: y + h * 0.67, width: 2, height: h * 0.33, fill: '#3d2f22' }));
      svg.append(svgEl('rect', { x: x + w - 4, y: y + h * 0.67, width: 2, height: h * 0.33, fill: '#3d2f22' }));
      break;

    case 'vase':
      svg.append(svgEl('path', {
        d: `M${x + w * 0.25},${y + h} Q${x},${y + h * 0.4} ${x + w * 0.35},${y} L${x + w * 0.65},${y} Q${x + w},${y + h * 0.4} ${x + w * 0.75},${y + h} Z`,
        fill: p.stone, opacity: '.9'
      }));
      svg.append(svgEl('path', {
        d: `M${x + w / 2},${y} q-2,-6 1,-9`,
        fill: 'none', stroke: '#5c6b3a', 'stroke-width': 1.1
      }));
      break;

    case 'clock':
      svg.append(svgEl('circle', { cx: x + w / 2, cy: y + h / 2, r: Math.min(w, h) / 2, fill: '#d8cfb8', opacity: '.9' }));
      svg.append(svgEl('line', {
        x1: x + w / 2, y1: y + h / 2, x2: x + w / 2, y2: y + h * 0.25,
        stroke: '#3a3328', 'stroke-width': 1
      }));
      svg.append(svgEl('line', {
        x1: x + w / 2, y1: y + h / 2, x2: x + w * 0.72, y2: y + h / 2,
        stroke: '#3a3328', 'stroke-width': 1
      }));
      break;

    default:
      svg.append(svgEl('circle', { cx: x + w / 2, cy: y + h / 2, r: Math.min(w, h) / 2, fill: color, opacity: '.6' }));
  }
}

/** روشن‌تر/تیره‌تر کردن رنگ ساده */
function shade(hex, factor) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * factor));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * factor));
  const b = Math.min(255, Math.round((n & 255) * factor));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/* ------------------------------ بازی ------------------------------ */

export function mountGame(root, { onExit } = {}) {
  let screen = 'intro';
  let difficulty = 'normal';
  let sceneId = SCENES[0].id;   // صحنهٔ انتخابی در مقدمه
  let puzzle = null;
  let hint = null;
  let msg = '';
  let flash = null;       // { x, y, ok }
  let recorded = false;
  let timer = null;
  let mounted = true;

  const render = () => mount(root, draw());
  render();

  function draw() {
    if (screen === 'help') return drawHelp();
    if (screen === 'play') return drawPlay();
    return drawIntro();
  }

  function start() {
    puzzle = createPuzzle({ seed: (Date.now() ^ Math.random() * 1e9) >>> 0, difficulty, sceneId });
    hint = null;
    msg = '';
    flash = null;
    recorded = false;
    screen = 'play';
    playSound('paper-flip');
    render();
    stopTimer();
    // تایمر فقط برای نمایش زمان است و باید با خروج از بازی متوقف شود،
    // وگرنه بعد از رفتن به صفحهٔ دیگر هم بی‌دلیل رندر می‌کند.
    timer = setInterval(() => {
      if (!mounted || screen !== 'play' || !puzzle || isSolved(puzzle)) { stopTimer(); return; }
      render();
    }, 1000);
  }

  function stopTimer() {
    if (timer) { clearInterval(timer); timer = null; }
  }

  /* ------------------------------ منو ------------------------------ */
  function drawIntro() {
    const s = stats.get();
    const best = s.records?.['spot-best'] || 0;
    return h('div', {},
      gameHeader({ title: 'تفاوت را پیدا کن', onBack: () => { stopTimer(); onExit(); } }),

      h('section', { class: 'paper spot-hero print-edge' },
        h('div', { class: 'spot-hero__frame', 'aria-hidden': 'true' },
          h('span', {}, '❦')),
        h('div', { class: 'spot-hero__text' },
          h('div', { class: 'spot-hero__kicker' }, 'تابلوی اروپایی · تک‌نفره'),
          h('h1', {}, 'تفاوت را پیدا کن'),
          h('p', {}, 'دو نسخه از یک نقاشی قدیمی. یکی اصل است، دیگری چند تغییر پنهان دارد. پیدا کن.')
        )
      ),

      sheet({ title: 'تابلو و سختی', iconName: 'grid', children: h('div', {},
        h('div', { class: 'spot-scenes' },
          ...SCENES.map(sc => h('button', {
            class: `spot-scene${sceneId === sc.id ? ' is-on' : ''}`,
            'aria-pressed': String(sceneId === sc.id),
            onclick: () => { sceneId = sc.id; playSound('tap'); render(); }
          },
            h('span', { class: 'spot-scene__name' }, sc.title),
            h('span', { class: 'spot-scene__period' }, sc.period)
          ))
        ),
        h('div', { class: 'level-row', style: 'margin-top:.5rem' },
          ...Object.entries(DIFFICULTY).map(([id, d]) => h('button', {
            class: `level-card${difficulty === id ? ' is-on' : ''}`,
            'aria-pressed': String(difficulty === id),
            onclick: () => { difficulty = id; playSound('tap'); render(); }
          },
            h('div', { class: 'level-card__name' }, d.label),
            h('div', { class: 'level-card__meta' }, `${toFa(d.count)} تفاوت`)
          ))
        ),
        h('p', { class: 'spot-note' }, 'تابلو در هر دست تصادفی انتخاب می‌شود. تفاوت‌ها هم تصادفی‌اند.')
      ) }),

      h('div', { class: 'stack' },
        btn('شروع', { variant: 'btn--primary btn--block', onClick: start }),
        btn('راهنما', { variant: 'btn--ghost btn--block', onClick: () => { screen = 'help'; render(); } }),
        btn('بازگشت', { variant: 'btn--ghost btn--block', onClick: () => { stopTimer(); onExit(); } })
      ),

      best ? callout(`بهترین امتیازت: ${toFa(best)}`, 'crown') : null
    );
  }

  function drawHelp() {
    return h('div', {},
      gameHeader({ title: 'راهنمای تفاوت‌یابی', onBack: () => { screen = 'intro'; render(); } }),
      sheet({ title: 'قواعد', iconName: 'book', children: helpBlock(HELP) }),
      h('div', { class: 'stack' },
        btn('فهمیدم', { variant: 'btn--primary btn--block', onClick: () => { screen = 'intro'; render(); } })
      )
    );
  }

  /* ------------------------------ بازی ------------------------------ */
  function drawPlay() {
    const solved = isSolved(puzzle);
    const secs = Math.floor(elapsedMs(puzzle) / 1000);
    const mm = String(Math.floor(secs / 60)).padStart(2, '0');
    const ss = String(secs % 60).padStart(2, '0');

    const onTap = (x, y) => {
      if (solved) return;
      const res = tapAt(puzzle, x, y);
      puzzle = res.puzzle;
      if (res.hit) {
        flash = { x, y, ok: true };
        msg = `پیدا شد: ${variantName(res.spot.variant)}`;
        playSound('seal');
        if (isSolved(puzzle)) finish();
      } else {
        flash = { x, y, ok: false };
        msg = 'اینجا تفاوتی نیست.';
        playSound('error');
      }
      render();
    };

    return h('div', {},
      gameHeader({
        title: 'تفاوت را پیدا کن',
        onBack: () => { stopTimer(); screen = 'intro'; render(); },
        children: [
          h('span', { class: 'score-pill' }, `${toFa(puzzle.found)}/${toFa(puzzle.total)}`),
          h('span', { class: 'score-pill' }, `${mm}:${ss}`)
        ]
      }),

      /* قاب دو تابلو */
      h('section', { class: 'spot-frame print-edge' },
        h('div', { class: 'spot-pair' },
          h('figure', { class: 'spot-panel' },
            h('div', { class: 'spot-panel__art' }, drawPanel(puzzle, 'left', { onTap, hint, flash })),
            h('figcaption', { class: 'spot-panel__cap' }, 'اصل')
          ),
          h('figure', { class: 'spot-panel' },
            h('div', { class: 'spot-panel__art' }, drawPanel(puzzle, 'right', { onTap, hint, flash })),
            h('figcaption', { class: 'spot-panel__cap' }, 'تغییرکرده')
          )
        ),
        h('div', { class: 'spot-caption' },
          h('span', { class: 'spot-caption__title' }, puzzle.scene.title),
          h('span', { class: 'spot-caption__period' }, puzzle.scene.period)
        )
      ),

      /* پیشرفت */
      h('div', { class: 'spot-progress', 'aria-label': `پیشرفت: ${puzzle.found} از ${puzzle.total}` },
        ...Array.from({ length: puzzle.total }, (_, i) => h('span', {
          class: `spot-pip${i < puzzle.found ? ' is-found' : ''}`,
          'aria-hidden': 'true'
        }))
      ),

      msg ? h('div', { class: `spot-msg${flash && !flash.ok ? ' is-err' : ''}`, role: 'status' }, msg) : null,

      /* دکمه‌ها */
      h('div', { class: 'spot-actions' },
        btn('راهنما', {
          variant: 'btn--ghost',
          disabled: solved,
          onClick: () => {
            const r = hintAt(puzzle);
            if (!r) return;
            hint = { x: r.x, y: r.y };
            puzzle = r.puzzle;
            msg = 'یک ناحیه علامت خورد — از امتیازت کم شد.';
            playSound('unwrap');
            render();
          }
        }),
        btn('تابلوی تازه', { variant: 'btn--ghost', onClick: start }),
        btn('پایان', { variant: 'btn--ghost', onClick: () => { stopTimer(); screen = 'intro'; render(); } })
      ),

      solved ? drawEnd() : null,

      callout('تفاوت‌ها در هر دو تابلو قابل نشانی‌اند. کلیک اشتباه فقط امتیاز کم می‌کند.', 'eye')
    );
  }

  function finish() {
    stopTimer();
    playSound('win');
    if (recorded) return;
    recorded = true;
    const score = scoreOf(puzzle);
    const best = stats.get().records?.['spot-best'] || 0;
    stats.record('spot', {
      key: 'spot-best',
      best: Math.max(score, best),
      higherIsBetter: true,
      label: `تفاوت‌یابی ${DIFFICULTY[puzzle.difficulty].label}`
    });
  }

  function drawEnd() {
    const score = scoreOf(puzzle);
    const secs = Math.floor(elapsedMs(puzzle) / 1000);
    return h('section', { class: 'spot-end' },
      h('div', { class: 'spot-end__seal', 'aria-hidden': 'true' }, '❦'),
      h('h2', {}, 'همه را پیدا کردی'),
      h('div', { class: 'spot-end__stats' },
        h('span', {}, `زمان: ${toFa(secs)} ثانیه`),
        h('span', {}, `خطا: ${toFa(puzzle.wrongTaps)}`),
        h('span', {}, `راهنما: ${toFa(puzzle.hintsUsed)}`),
        h('span', { class: 'spot-end__score' }, `امتیاز: ${toFa(score)}`)
      ),
      h('div', { class: 'btn-row' },
        btn('تابلوی تازه', { variant: 'btn--primary', onClick: start }),
        btn('برگشت به منو', { variant: 'btn--ghost', onClick: () => { screen = 'intro'; render(); } })
      )
    );
  }

  return () => {
    mounted = false;
    stopTimer();
    puzzle = null;
  };
}
