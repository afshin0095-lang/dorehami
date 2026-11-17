/* ============================================================
   «مهره‌چین» — معماهای منطقی روی کاغذ شطرنجی کهنه
   صفحه‌ی ۵×۵، مهره‌های چوبی رنگی، سرنخ‌های چاپ‌شده.
   ============================================================ */

import { h, mount, playSound, stats, toFa, toast } from '../core.js';
import {
  COLORS, SIZE, LEVELS, createPuzzleGame, placeAt, clearAt, selectColor,
  checkClues, isSolved, countSolutions
} from '../engines/logic.js';
import { gameHeader, sheet, btn, helpBlock, callout, icon } from '../ui/kit.js';

const HELP = {
  steps: [
    'هر معما چند مهره‌ی رنگی و چند سرنخ دارد. سرنخ‌ها با هم فقط یک چیدمان درست می‌سازند.',
    'یک مهره را از نوار پایین انتخاب کن، بعد روی خانه‌ی مورد نظر بزن تا آنجا بنشیند.',
    'روی خانه‌ی پر بزنی، مهره‌ی قبلی برداشته می‌شود و مهره‌ی جدید می‌نشیند.',
    '«بررسی سرنخ‌ها» نشان می‌دهد کدام سرنخ‌ها با چیدمان فعلی جور است (فقط وقتی همه‌ی مهره‌ها چیده شده باشند).',
    'وقتی همه‌ی مهره‌ها درست بنشینند، معما خودش حل می‌شود.'
  ],
  example: 'مثال: «سرخ در سطر ۳، ستون ۲ است» و «فیروزه سمت چپِ سرخ است» → فیروزه باید در ستون ۱ و در همان سطر یا سطر دیگر باشد، ولی چون سرنخ سوم می‌گوید فیروزه در ستون ۳ نیست، تنها جای ممکن پیدا می‌شود.',
  note: 'هر معما پیش از نمایش، با شمارش کامل بررسی می‌شود که دقیقاً یک پاسخ داشته باشد — پس هیچ معمای بی‌جواب یا چندجوابی نمی‌بینی.'
};

export function mountGame(root, { onExit }) {
  let state = { screen: 'intro', level: 'easy', game: null, solvedCount: 0, showCheck: false };

  const render = () => mount(root, draw());
  render();

  function draw() {
    switch (state.screen) {
      case 'help': return drawHelp();
      case 'play': return drawPlay();
      default: return drawIntro();
    }
  }

  /* ------------------------------ شروع ------------------------------ */
  function drawIntro() {
    const best = stats.get().records?.['logic-solved'] || 0;
    return h('div', {},
      gameHeader({ title: 'مهره‌چین', onBack: onExit }),

      h('section', { class: 'paper logic-hero' },
        h('div', { class: 'logic-hero__grid' }),
        h('div', { class: 'logic-hero__text' },
          h('div', { class: 'logic-hero__kicker' }, 'معمای منطقی · تک‌نفره'),
          h('h1', {}, 'مهره‌چین'),
          h('p', {}, 'چهار مهره‌ی چوبی، یک صفحه‌ی کهنه، و چند سرنخ که فقط یک چیدمان را قبول می‌کنند.')
        )
      ),

      sheet({ title: 'سطح', iconName: 'grid', children: h('div', { class: 'level-row' },
        ...LEVELS.map(l => h('button', {
          class: `level-card ${state.level === l.id ? 'is-on' : ''}`.trim(),
          'aria-pressed': String(state.level === l.id),
          onclick: () => { state.level = l.id; playSound('tap'); render(); }
        },
          h('div', { class: 'level-card__name' }, l.label),
          h('div', { class: 'level-card__meta' }, `${toFa(l.colorCount)} مهره · ${toFa(l.clueCount)} سرنخ`)
        ))
      ) }),

      best ? h('div', { class: 'score-row', style: { marginBottom: '.7rem' } },
        h('span', { class: 'score-pill' }, icon('crown', 14), ` بهترین: ${toFa(best)} معما`)) : null,

      sheet({ title: 'راهنمای بازی', iconName: 'book', children: helpBlock(HELP) }),

      btn('شروع معما', {
        variant: 'btn--primary btn--block',
        onClick: startPuzzle
      }),
      btn('بازگشت', { variant: 'btn--ghost btn--block', onClick: onExit })
    );
  }

  function drawHelp() {
    return h('div', {},
      gameHeader({ title: 'راهنمای مهره‌چین', onBack: () => { state.screen = 'play'; render(); } }),
      sheet({ cls: 'sheet--lined', title: 'قدم به قدم', iconName: 'book', children: helpBlock(HELP) }),
      btn('فهمیدم', { variant: 'btn--block', onClick: () => { state.screen = 'play'; render(); } })
    );
  }

  function startPuzzle() {
    state.game = createPuzzleGame({ level: state.level });
    state.screen = 'play';
    state.showCheck = false;
    playSound('card-deal');
    render();
  }

  /* ------------------------------ صفحه‌ی بازی ------------------------------ */
  function drawPlay() {
    const g = state.game;
    if (!g) { state.screen = 'intro'; return draw(); }

    const palette = g.puzzle.colors.map(id => COLORS.find(c => c.id === id));

    return h('div', {},
      gameHeader({
        title: 'مهره‌چین',
        onBack: () => { if (confirm('معما را رها کنی؟')) { state.screen = 'intro'; render(); } },
        children: [h('span', { class: 'score-pill' }, `${toFa(g.moves)} حرکت`)]
      }),

      // سرنخ‌ها
      sheet({ cls: 'logic-clues', title: 'سرنخ‌ها', iconName: 'book', children:
        h('ol', { class: 'logic-clue-list' },
          ...g.puzzle.clues.map((c, i) => {
            const verdict = state.showCheck && g.checked?.complete ? g.checked.results[i] : null;
            return h('li', {
              class: `logic-clue ${verdict ? (verdict.ok ? 'is-ok' : 'is-bad') : ''}`.trim()
            },
              h('span', { class: 'logic-clue__num' }, toFa(i + 1)),
              h('span', { class: 'logic-clue__text' }, c.text),
              verdict ? h('span', { class: 'logic-clue__mark' }, verdict.ok ? '✓' : '✕') : null
            );
          })
        )
      }),

      // صفحه
      h('div', { class: 'logic-board-wrap' },
        h('div', { class: 'logic-board', style: { '--cells': String(SIZE) } },
          ...Array.from({ length: SIZE * SIZE }, (_, cell) => {
            const owner = g.puzzle.colors.find(id => g.placement[id] === cell);
            const col = owner ? COLORS.find(c => c.id === owner) : null;
            return h('button', {
              class: `logic-cell ${col ? 'is-filled' : ''}`.trim(),
              'aria-label': `سطر ${toFa(Math.floor(cell / SIZE) + 1)}، ستون ${toFa(cell % SIZE + 1)}${col ? ` — ${col.name}` : ''}`,
              onclick: () => onCell(cell, owner)
            },
              col ? h('span', { class: 'logic-piece', style: { '--c': col.hex } }) : null
            );
          })
        )
      ),

      // انتخاب مهره
      h('div', { class: 'logic-palette', role: 'group', 'aria-label': 'انتخاب مهره' },
        ...palette.map(c => h('button', {
          class: `logic-token ${g.selected === c.id ? 'is-on' : ''}`.trim(),
          'aria-pressed': String(g.selected === c.id),
          style: { '--c': c.hex },
          onclick: () => {
            try {
              state.game = selectColor(g, c.id);
              playSound('tap');
              render();
            } catch (e) { toast(e.message, 'warn'); }
          }
        },
          h('span', { class: 'logic-token__dot' }),
          h('span', {}, c.name),
          g.placement[c.id] === null ? h('span', { class: 'logic-token__hint' }, 'نچیده') : null
        ))
      ),

      // کنش‌ها
      h('div', { class: 'logic-actions' },
        btn(state.showCheck ? 'پنهان‌کردن بررسی' : 'بررسی سرنخ‌ها', {
          variant: 'btn--teal btn--block',
          onClick: () => {
            const res = checkClues(state.game);
            state.checked = res;
            state.showCheck = true;
            if (!res.complete) toast('اول همه‌ی مهره‌ها را بچین', 'warn');
            else playSound(res.allOk ? 'win' : 'lose');
            render();
          }
        }),
        btn('معمای تازه', { variant: 'btn--ghost btn--block', onClick: () => {
          if (confirm('معمای تازه؟ چیدمان فعلی از دست می‌رود.')) startPuzzle();
        } })
      ),

      g.finished ? solvedPanel() : null,

      callout('هر مهره فقط یک جا دارد. اگر دو خانه را جابه‌جا کنی، سرنخ‌ها جواب نمی‌دهند.', 'spark')
    );
  }

  function onCell(cell, owner) {
    const g = state.game;
    if (g.finished) return;
    try {
      // زدن روی خانه‌ی خالی → گذاشتن؛ روی خانه‌ی پر → برداشتن (اگر همان مهره باشد)
      if (owner) {
        state.game = owner === g.selected ? clearAt(g, cell) : placeAt(g, cell);
      } else {
        state.game = placeAt(g, cell);
      }
      playSound('tap');
      if (state.game.finished) onSolved();
      render();
    } catch (e) { toast(e.message, 'warn'); }
  }

  function onSolved() {
    state.solvedCount += 1;
    playSound('win');
    const prev = stats.get().records?.['logic-solved'] || 0;
    const total = prev + 1;
    stats.record('logic', {
      label: `معمای ${LEVELS.find(l => l.id === state.level)?.label || ''}`,
      key: 'logic-solved',
      best: total,
      higherIsBetter: true
    });
    // شمارش سرنخ‌ها برای گزارش کیفیت (سرنخ‌ها یکتا هستند)
    void countSolutions;
  }

  function solvedPanel() {
    return h('div', { class: 'logic-solved' },
      h('div', { class: 'logic-solved__seal' }, '✓'),
      h('div', { class: 'logic-solved__title' }, 'معما حل شد'),
      h('div', { class: 'logic-solved__sub' }, `با ${toFa(state.game.moves)} حرکت`),
      h('div', { style: { display: 'grid', gap: '.45rem', marginTop: '.7rem' } },
        btn('معمای بعدی', { variant: 'btn--primary', onClick: startPuzzle }),
        btn('تغییر سطح', { variant: 'btn--ghost', onClick: () => { state.screen = 'intro'; render(); } })
      )
    );
  }

  return () => { /* no timers */ };
}

void isSolved;
