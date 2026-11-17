/* ============================================================
   مار و پله — تخته ۳۶ خانه، ۲ تا ۴ بازیکن، تاس چوبی
   ============================================================ */

import { h, mount, playSound, toast, stats, toFa } from '../core.js';
import { createSnakeGame, rollMove, rollDice, BOARD_SIZE, makeLayout, validateLayout } from '../engines/snake.js';
import { gameHeader, sheet, btn, helpBlock, callout, iconBtn } from '../ui/kit.js';

const HELP = {
  steps: [
    'هر بازیکن از خانه ۱ شروع می‌کند. نوبت‌ها به ترتیب می‌چرخد.',
    'تاس بریز و به اندازه‌ی عدد تاس جلو برو.',
    'اگر روی پایه‌ی نردبان بایستی، بالا می‌روی. اگر روی سر مار بایستی، پایین می‌آیی.',
    'اگر عدد تاس از خانه ۳۶ رد شود، به اندازه‌ی اضافه برمی‌گردی.',
    'اولین نفری که دقیقاً به خانه ۳۶ برسد، برنده است.'
  ],
  example: 'مثال: در خانه ۳۴ هستی و ۵ می‌آوری. ۳۴+۵=۳۹ که از ۳۶ رد می‌شود، پس به ۳۶−(۳۹−۳۶)=۳۳ برمی‌گردی.',
  note: 'این بازی کاملاً شانسی است؛ برای گرم‌کردن جمع یا بازی با بچه‌ها عالی است.'
};

export function mountGame(root, { onExit }) {
  let state = { screen: 'intro', count: 2 };

  const render = () => mount(root, draw());
  render();

  function draw() {
    if (state.screen === 'help') return drawHelp();
    if (state.screen === 'play') return drawBoard();
    return drawIntro();
  }

  function drawIntro() {
    return h('div', {},
      gameHeader({ title: 'مار و پله', onBack: onExit }),
      sheet({ title: 'چند نفر؟', iconName: 'users', children: h('div', { style: { display: 'flex', gap: '.4rem', justifyContent: 'center' } },
        ...[2, 3, 4].map(n => h('button', {
          class: 'chip', 'aria-pressed': String(state.count === n),
          onclick: () => { state.count = n; playSound('tap'); render(); }
        }, `${toFa(n)} نفر`))
      ) }),
      sheet({ title: 'راهنمای بازی', iconName: 'book', children: helpBlock(HELP) }),
      btn('شروع', {
        variant: 'btn--primary btn--block',
        onClick: () => {
          const names = Array.from({ length: state.count }, (_, i) => i === 0 ? 'تو' : `بازیکن ${toFa(i + 1)}`);
          state = { screen: 'play', game: createSnakeGame({ players: names }), rolling: false };
          playSound('card-deal');
          render();
        }
      })
    );
  }

  function drawHelp() {
    return h('div', {},
      gameHeader({ title: 'راهنمای مار و پله', onBack: () => { state.screen = 'play'; render(); } }),
      sheet({ title: 'قدم به قدم', iconName: 'book', children: helpBlock(HELP) }),
      btn('فهمیدم', { variant: 'btn--block', onClick: () => { state.screen = 'play'; render(); } })
    );
  }

  /**
   * موقعیت مرکز هر خانه روی تخته، در مختصات درصدی.
   * تخته مارپیچ است: ردیف پایین از ۱ شروع می‌شود و راست‌به‌چپ پیش می‌رود.
   */
  function cellCenter(n) {
    const { col, rowFromTop } = gridPlace(n);
    return { x: (col + 0.5) * (100 / 6), y: (rowFromTop + 0.5) * (100 / 6) };
  }

  /**
   * جای هر خانه در شبکه‌ی ۶×۶.
   * خانه ۱ پایین-راست است و ردیف‌ها مارپیچ بالا می‌روند (مثل تخته‌ی واقعی).
   */
  function gridPlace(n) {
    const idx = n - 1;
    const rowFromBottom = Math.floor(idx / 6);
    const colInRow = idx % 6;
    // ردیف زوج از راست به چپ، ردیف فرد از چپ به راست
    const col = rowFromBottom % 2 === 0 ? 5 - colInRow : colInRow;
    return { col, rowFromTop: 5 - rowFromBottom };
  }

  /** مار: بدنه‌ی موج‌دار از سر (خانه‌ی بالا) تا دم (خانه‌ی پایین) با سر و دم مشخص */
  function snakeSvg(from, to) {
    const a = cellCenter(from); // سر — خانه‌ی بالاتر
    const b = cellCenter(to);   // دم — خانه‌ی پایین‌تر
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const amp = Math.min(11, len * 0.22);
    // موج دوگانه (S) برای حس پیچیدن
    const c1 = { x: mx + nx * amp, y: my + ny * amp };
    const c2 = { x: mx - nx * amp * 0.8, y: my - ny * amp * 0.8 };
    const path = `M ${a.x} ${a.y} Q ${c1.x} ${c1.y} ${mx} ${my} Q ${c2.x} ${c2.y} ${b.x} ${b.y}`;
    // زاویه‌ی سر به سمت اولین نقطه‌ی مسیر
    const headAngle = Math.atan2(c1.y - a.y, c1.x - a.x) * 180 / Math.PI;
    return { path, head: a, tail: b, headAngle, amp };
  }

  /** نردبان: دو ریل موازی + پله‌ها، دقیقاً بین دو خانه */
  function ladderSvg(from, to) {
    const a = cellCenter(from); // پایه (پایین)
    const b = cellCenter(to);   // بالا
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const half = 3.1; // نیم‌عرض نردبان (درصد)
    const a1 = { x: a.x + nx * half, y: a.y + ny * half };
    const a2 = { x: a.x - nx * half, y: a.y - ny * half };
    const b1 = { x: b.x + nx * half, y: b.y + ny * half };
    const b2 = { x: b.x - nx * half, y: b.y - ny * half };
    const rungs = Math.max(3, Math.round(len / 4));
    const lines = [];
    for (let i = 1; i < rungs; i++) {
      const t = i / rungs;
      lines.push({
        x1: a1.x + (b1.x - a1.x) * t, y1: a1.y + (b1.y - a1.y) * t,
        x2: a2.x + (b2.x - a2.x) * t, y2: a2.y + (b2.y - a2.y) * t
      });
    }
    return { a1, a2, b1, b2, lines };
  }

  function drawSnakeArt(g) {
    const NS = 'http://www.w3.org/2000/svg';
    const el = (name, attrs, ...kids) => {
      const n = document.createElementNS(NS, name);
      for (const [k, v] of Object.entries(attrs || {})) n.setAttribute(k, String(v));
      kids.flat().forEach(c => c && n.append(c));
      return n;
    };

    const snakes = Object.entries(g.snakes || {}).map(([f, t]) => snakeSvg(Number(f), Number(t)));
    const ladders = Object.entries(g.ladders || {}).map(([f, t]) => ladderSvg(Number(f), Number(t)));

    return el('svg', {
      class: 'board-svg', viewBox: '0 0 100 100',
      'aria-hidden': 'true'
    },
      // نردبان‌ها اول، تا مارها رویشان بیایند
      ladders.map(L => el('g', { class: 'lad' },
        el('line', { x1: L.a1.x, y1: L.a1.y, x2: L.b1.x, y2: L.b1.y, class: 'lad__rail' }),
        el('line', { x1: L.a2.x, y1: L.a2.y, x2: L.b2.x, y2: L.b2.y, class: 'lad__rail' }),
        L.lines.map(r => el('line', { x1: r.x1, y1: r.y1, x2: r.x2, y2: r.y2, class: 'lad__rung' }))
      )),
      snakes.map(S => el('g', { class: 'snake' },
        // سایه‌ی بدنه برای عمق
        el('path', { d: S.path, class: 'snake__shadow' }),
        el('path', { d: S.path, class: 'snake__body' }),
        el('path', { d: S.path, class: 'snake__scales' }),
        // دم کوچک
        el('circle', { cx: S.tail.x, cy: S.tail.y, r: 1.15, class: 'snake__tail' }),
        // سر با چشم‌ها
        el('g', { transform: `translate(${S.head.x} ${S.head.y}) rotate(${S.headAngle})` },
          el('ellipse', { cx: 0, cy: 0, rx: 4.6, ry: 3.5, class: 'snake__head' }),
          el('circle', { cx: -1.1, cy: -1.35, r: .78, class: 'snake__eye' }),
          el('circle', { cx: -1.1, cy:  1.35, r: .78, class: 'snake__eye' }),
          el('path', { d: 'M -4.2 0 L -6.4 0', class: 'snake__tongue' })
        )
      ))
    );
  }

  /* ------------------------------ تخته ------------------------------ */
  function drawBoard() {
    const g = state.game;
    if (g.winner !== null) return drawWinner();

    const cells = [];
    for (let n = BOARD_SIZE; n >= 1; n--) cells.push(n);

    const roll = () => {
      if (state.rolling) return;
      state.rolling = true;
      playSound('dice');
      const d = rollDice();
      // انیمیشن کوتاه تاس
      let ticks = 0;
      const el = root.querySelector('[data-dice]');
      const spin = setInterval(() => {
        ticks++;
        if (el) el.textContent = toFa(rollDice());
        if (ticks > 6) {
          clearInterval(spin);
          const next = rollMove(g, d);
          state.game = next;
          state.rolling = false;
          if (next.lastEvent === 'ladder') toast('نردبان! بالا رفت', 'ok');
          if (next.lastEvent === 'snake') toast('مار! پایین آمد', 'warn');
          if (next.winner !== null) playSound('win');
          render();
        }
      }, 70);
    };

    return h('div', {},
      gameHeader({
        title: 'مار و پله',
        onBack: () => { if (confirm('از بازی خارج شوی؟')) onExit(); },
        children: [iconBtn('shuffle', {
          label: 'نقشه‌ی تازه — جابه‌جایی مارها و نردبان‌ها و شروع دوباره',
          onClick: shuffleBoard
        })]
      }),

      h('div', { class: 'score-row', style: { marginBottom: '.55rem' } },
        ...g.players.map((p, i) => h('span', {
          class: `score-pill ${g.turn === i ? 'score-pill--active' : ''}`,
          style: { borderRight: `4px solid ${p.color}` }
        }, p.name, ': ', toFa(p.pos)))
      ),

      sheet({ children: h('div', { class: 'board-wrap' },
        h('div', { class: 'board' },
          // خانه‌ها به ترتیب مارپیچ: ردیف پایین ۱..۶ از راست، ردیف بعد ۷..۱۲ از چپ
          ...Array.from({ length: BOARD_SIZE }, (_, i) => {
            const n = i + 1;
            const tokens = g.players.filter(p => p.pos === n);
            const isSnakeHead = Boolean(g.snakes?.[n]);
            const isSnakeTail = Object.values(g.snakes || {}).includes(n);
            const isLadderFoot = Boolean(g.ladders?.[n]);
            const isLadderTop = Object.values(g.ladders || {}).includes(n);
            const cls = [
              'board__cell',
              n === 1 ? 'board__cell--start' : '',
              n === BOARD_SIZE ? 'board__cell--end' : '',
              isSnakeHead ? 'board__cell--snakehead' : '',
              isLadderFoot ? 'board__cell--ladderfoot' : ''
            ].filter(Boolean).join(' ');
            const place = gridPlace(n);
            return h('div', {
              class: cls,
              dataset: { cell: String(n) },
              style: { gridColumn: String(place.col + 1), gridRow: String(place.rowFromTop + 1) },
              'aria-label': `خانه ${toFa(n)}${isSnakeHead ? ' — سر مار' : ''}${isSnakeTail ? ' — دم مار' : ''}${isLadderFoot ? ' — پایه نردبان' : ''}${isLadderTop ? ' — بالای نردبان' : ''}`
            },
              h('span', { class: 'board__num' }, toFa(n)),
              h('div', { class: 'board__tokens' },
                ...tokens.map(t => h('div', { class: 'token', style: { background: t.color }, title: t.name }))
              )
            );
          })
        ),
        // مارها و نردبان‌ها: SVG دقیقاً روی شبکه، سر و ته در خانه‌های درست
        drawSnakeArt(g)
      ) }),

      h('div', { style: { display: 'flex', gap: '.6rem', alignItems: 'center', marginTop: '.7rem' } },
        h('div', {
          style: {
            width: '58px', height: '58px', flex: '0 0 58px',
            display: 'grid', placeItems: 'center', fontSize: '1.6rem', fontWeight: 700,
            background: 'var(--paper-hi)', boxShadow: 'var(--lift-2)', transform: 'rotate(-4deg)'
          }
        }, h('span', { dataset: { dice: '1' } }, g.dice ? toFa(g.dice) : '؟')),
        btn(state.rolling ? 'در حال ریختن…' : `تاس (${g.players[g.turn].name})`, {
          variant: 'btn--primary', cls: 'btn--block', disabled: state.rolling, onClick: roll
        })
      ),

      callout(state.rolling ? 'تاس می‌چرخد…' : `نوبت ${g.players[g.turn].name} است · ${toFa(Object.keys(g.snakes || {}).length)} مار و ${toFa(Object.keys(g.ladders || {}).length)} نردبان روی تخته`, 'dice'),
      btn('راهنما', { variant: 'btn--ghost btn--sm btn--block', onClick: () => { state.screen = 'help'; render(); } })
    );
  }

  /** نقشه‌ی تازه: مارها و نردبان‌ها جابه‌جا می‌شوند و بازی از صفر شروع می‌شود */
  function shuffleBoard() {
    if (state.rolling) return;
    const names = state.game ? state.game.players.map(p => p.name) : ['تو', 'بازیکن ۲'];
    let layout = null;
    // تا رسیدن به چیدمان معتبر تلاش کن (اعتبارسنجی، نه شانس)
    for (let i = 0; i < 40; i++) {
      const candidate = makeLayout(Math.random);
      if (validateLayout(candidate).ok) { layout = candidate; break; }
    }
    if (!layout) { toast('چیدمان تازه ساخته نشد، دوباره تلاش کن', 'warn'); return; }
    state.game = createSnakeGame({ players: names, layout });
    state.screen = 'play';
    playSound('paper-flip');
    toast('نقشه عوض شد — بازی از نو', 'ok');
    render();
  }

  function drawWinner() {
    const g = state.game;
    if (!state.recorded) {
      state.recorded = true;
      stats.record('snake', { label: g.players[g.winner].name });
    }
    return h('div', {},
      gameHeader({ title: 'پایان', onBack: onExit }),
      sheet({ cls: 'stamp', children: h('div', { class: 'result-banner' },
        h('div', { style: { fontSize: '2rem' } }, '🏁'),
        h('div', { class: 'result-banner__verdict' }, `${g.players[g.winner].name} برد`),
        h('div', { class: 'result-banner__sub' }, `${toFa(g.log.length)} نوبت تاس ریخته شد`)
      ) }),
      h('div', { style: { display: 'grid', gap: '.5rem' } },
        btn('دوباره با همین نقشه', { variant: 'btn--primary btn--block', onClick: () => { state = { screen: 'play', game: createSnakeGame({ players: g.players.map(p => p.name), layout: { snakes: g.snakes, ladders: g.ladders, seed: g.layoutSeed } }) }; render(); } }),
        btn('نقشه‌ی تازه', { variant: 'btn--teal btn--block', onClick: () => { state = { screen: 'play', game: createSnakeGame({ players: g.players.map(p => p.name) }) }; render(); } }),
        btn('خروج', { variant: 'btn--ghost btn--block', onClick: onExit })
      )
    );
  }

  return () => { /* هیچ تایمر دائمی نیست */ };
}
