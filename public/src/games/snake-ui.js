/* ============================================================
   مار و پله — تخته ۳۶ خانه، ۲ تا ۴ بازیکن، تاس چوبی
   ============================================================ */

import { h, mount, playSound, toast, stats, toFa } from '../core.js';
import { createSnakeGame, rollMove, rollDice, BOARD_SIZE, SNAKES, LADDERS } from '../engines/snake.js';
import { gameHeader, sheet, btn, helpBlock, callout } from '../ui/kit.js';

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
      gameHeader({ title: 'مار و پله', onBack: () => { if (confirm('از بازی خارج شوی؟')) onExit(); } }),

      h('div', { class: 'score-row', style: { marginBottom: '.55rem' } },
        ...g.players.map((p, i) => h('span', {
          class: `score-pill ${g.turn === i ? 'score-pill--active' : ''}`,
          style: { borderRight: `4px solid ${p.color}` }
        }, p.name, ': ', toFa(p.pos)))
      ),

      sheet({ children: h('div', {},
        h('div', { class: 'board' },
          ...cells.map(n => {
            const tokens = g.players.filter(p => p.pos === n);
            const isSnake = Boolean(SNAKES[n]);
            const isLadder = Boolean(LADDERS[n]);
            return h('div', {
              class: `board__cell ${n === 1 ? 'board__cell--start' : ''} ${isSnake ? 'board__cell--snake' : ''} ${isLadder ? 'board__cell--ladder' : ''} ${n === BOARD_SIZE ? 'board__cell--end' : ''}`.trim()
            },
              h('span', {}, toFa(n)),
              isSnake ? h('span', { style: { position: 'absolute', bottom: '1px', left: '2px', fontSize: '.55rem' } }, '🐍') : null,
              isLadder ? h('span', { style: { position: 'absolute', bottom: '1px', left: '2px', fontSize: '.55rem' } }, '🪜') : null,
              h('div', { class: 'board__tokens' },
                ...tokens.map(t => h('div', { class: 'token', style: { background: t.color }, title: t.name }))
              )
            );
          })
        )
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

      callout(state.rolling ? 'تاس می‌چرخد…' : `نوبت ${g.players[g.turn].name} است.`, 'dice'),
      btn('راهنما', { variant: 'btn--ghost btn--sm btn--block', onClick: () => { state.screen = 'help'; render(); } })
    );
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
        btn('دوباره', { variant: 'btn--primary btn--block', onClick: () => { state = { screen: 'play', game: createSnakeGame({ players: g.players.map(p => p.name) }) }; render(); } }),
        btn('خروج', { variant: 'btn--ghost btn--block', onClick: onExit })
      )
    );
  }

  return () => {};
}
