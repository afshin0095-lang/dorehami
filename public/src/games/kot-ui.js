/* ============================================================
   «پادشاه توکیو» — تاس روی مقوا، شهر در آتش
   ============================================================ */

import { h, mount, playSound, stats, toFa } from '../core.js';
import {
  FACES, FACE, RULES, MAX_REROLLS, STARTS, MAX_HEALTH, CARDS,
  createKot, roll, toggleKeep, commit, enterTokyo, leaveTokyo,
  buyCard, botMove, isOver, winnerOf, currentMonster, kingOf
} from '../engines/kot.js';
import { gameHeader, sheet, btn, helpBlock } from '../ui/kit.js';
import { turnBanner, tableNote } from '../ui/tablekit.js';

export function mountGame(root, { onExit, game } = {}) {
  let screen = 'intro';
  let state = null;
  let note = ''; let noteTone = 'info';
  let botTimer = null;

  const render = () => mount(root, draw());
  render();
  const cleanup = () => { if (botTimer) { clearTimeout(botTimer); botTimer = null; } };
  const setNote = (t, tone = 'info') => { note = t; noteTone = tone; };

  function draw() {
    if (screen === 'help') return drawHelp();
    if (screen === 'play') return drawPlay();
    if (screen === 'over') return drawOver();
    return drawIntro();
  }

  function start() {
    cleanup(); note = '';
    state = createKot({ players: 2, seed: (Date.now() ^ Math.random() * 1e6) >>> 0 });
    screen = 'play';
    playSound('dice');
    render();
  }

  /* ------------------------------ مقدمه ------------------------------ */

  function drawIntro() {
    return h('div', { class: 'page' },
      gameHeader({ title: 'پادشاه توکیو', onBack: onExit }),
      h('section', { class: 'kot-hero' },
        h('div', { class: 'kot-hero__art', style: "background-image:url('/assets/art/games/king-of-tokyo.jpg')" }),
        h('div', { class: 'kot-hero__text' },
          h('p', { class: 'kot-hero__kicker' }, 'هیولاها به شهر زده‌اند'),
          h('h1', {}, 'پادشاه توکیو'),
          h('p', {}, 'تاس بریز، پنجه بزن، ستاره بگیر. هر کس زودتر ۲۰ ستاره بگیرد یا تنها بازمانده باشد، پادشاه است.')
        )
      ),
      sheet({ title: 'شروع', iconName: 'dice', children: h('div', { class: 'stack' },
        btn('شروع بازی', { variant: 'btn--primary btn--block', ico: 'play', onClick: start }),
        btn('قواعد', { variant: 'btn--block', ico: 'book', onClick: () => { screen = 'help'; render(); } })
      ) })
    );
  }

  function drawHelp() {
    return h('div', { class: 'page' },
      gameHeader({ title: 'راهنمای پادشاه توکیو', onBack: () => { screen = 'intro'; render(); } }),
      sheet({ title: 'قواعد', iconName: 'book', children: helpBlock(RULES) }),
      h('div', { class: 'stack' },
        btn('برگشت', { variant: 'btn--block', ico: 'back', onClick: () => { screen = 'intro'; render(); } }))
    );
  }

  /* ------------------------------ بازی ------------------------------ */

  function monsterCard(m) {
    const isTurn = state.turnId === m.id;
    const isKing = state.kingId === m.id;
    return h('div', {
      class: `kot-monster${isTurn ? ' is-turn' : ''}${isKing ? ' is-king' : ''}${!m.alive ? ' is-dead' : ''}`
    },
      h('div', { class: 'kot-monster__top' },
        h('span', { class: 'kot-monster__name' }, m.name),
        isKing ? h('span', { class: 'kot-monster__crown', title: 'پادشاه توکیو' }, '♛') : null,
        !m.alive ? h('span', { class: 'kot-monster__ko' }, 'از پا افتاد') : null
      ),
      h('div', { class: 'kot-monster__bars' },
        bar('جان', m.health, MAX_HEALTH, 'hp'),
        bar('ستاره', m.stars, STARTS, 'star'),
        bar('انرژی', m.energy, 10, 'en')
      )
    );
  }

  function bar(label, value, max, kind) {
    const pct = Math.max(0, Math.min(100, (value / max) * 100));
    return h('div', { class: `kot-bar kot-bar--${kind}` },
      h('span', { class: 'kot-bar__label' }, label),
      h('span', { class: 'kot-bar__track' },
        h('span', { class: 'kot-bar__fill', style: `width:${pct}%` })),
      h('span', { class: 'kot-bar__num' }, toFa(value))
    );
  }

  function dieFace(id, { kept = false, onClick = null } = {}) {
    const f = FACE[id] || { glyph: '·', label: 'تاس' };
    return h('button', {
      class: `kot-die${kept ? ' is-kept' : ''} kot-die--${id}`,
      type: 'button',
      'aria-pressed': kept ? 'true' : 'false',
      'aria-label': `${f.label}${kept ? ' — نگه‌داشته' : ''}`,
      disabled: !onClick,
      onclick: onClick ? (e) => { e.preventDefault?.(); onClick(); } : null
    },
      h('span', { class: 'kot-die__glyph', 'aria-hidden': 'true' }, f.glyph),
      h('span', { class: 'kot-die__label' }, f.label)
    );
  }

  function drawPlay() {
    const me = currentMonster(state);
    const over = isOver(state);

    return h('div', { class: 'page' },
      gameHeader({ title: 'پادشاه توکیو', onBack: onExit }),

      turnBanner(
        over ? 'بازی تمام شد'
          : me?.human ? 'نوبت توست' : `نوبت ${me?.name || ''}`,
        { tone: me?.human ? 'mine' : 'theirs' }
      ),

      h('div', { class: 'kot-table' },
        ...state.monsters.map(monsterCard)
      ),

      tableNote(note, { tone: noteTone }),

      h('div', { class: 'kot-dice' },
        ...state.dice.map((d, i) => dieFace(d, {
          kept: state.kept.includes(i),
          onClick: me?.human && state.rerollsLeft > 0 ? () => {
            const r = toggleKeep(state, i);
            if (r.ok) { state = r.game; playSound('tap'); render(); }
          } : null
        })),
        state.dice.length === 0
          ? h('p', { class: 'kot-dice__empty' }, 'هنوز تاسی ریخته نشده')
          : null
      ),

      h('div', { class: 'kot-actions' },
        btn(
          state.rolled ? (state.rerollsLeft > 0 ? `بازپرتاب (${toFa(state.rerollsLeft)})` : 'بازپرتابی نمانده') : 'تاس بریز',
          {
            variant: 'btn--primary btn--block', ico: 'dice',
            disabled: !me?.human || over || (state.rolled && state.rerollsLeft <= 0),
            onClick: () => {
              const r = roll(state);
              if (!r.ok) { setNote(r.error, 'bad'); render(); return; }
              state = r.game; playSound('dice'); setNote(''); render();
            }
          }),
        btn('حرکت', {
          variant: 'btn--teal btn--block', ico: 'check',
          disabled: !me?.human || over || !state.rolled,
          onClick: () => {
            const r = commit(state);
            if (!r.ok) { setNote(r.error, 'bad'); render(); return; }
            state = r.game;
            playSound(r.winner ? 'win' : 'card-slide');
            if (isOver(state)) { screen = 'over'; }
            setNote('');
            render();
            scheduleBot();
          }
        })
      ),

      h('div', { class: 'kot-side' },
        !me?.inTokyo && state.kingId === null
          ? btn('برو توکیو', { variant: 'btn--mustard btn--block', ico: 'crown', onClick: () => {
              const r = enterTokyo(state);
              if (!r.ok) { setNote(r.error, 'bad'); render(); return; }
              state = r.game; playSound('seal'); render();
            } })
          : null,
        me?.inTokyo
          ? btn('از توکیو بیرون بیا (۱ ستاره)', { variant: 'btn--block', ico: 'back', onClick: () => {
              const r = leaveTokyo(state);
              if (!r.ok) { setNote(r.error, 'bad'); render(); return; }
              state = r.game; playSound('paper-flip'); render();
            } })
          : null
      ),

      h('section', { class: 'kot-cards' },
        h('h2', { class: 'kot-cards__title' }, 'کارت‌های انرژی'),
        ...CARDS.map(c => h('button', {
          class: `kot-card${(me?.energy || 0) < c.cost ? ' is-locked' : ''}`,
          type: 'button',
          disabled: !me?.human || over || (me?.energy || 0) < c.cost,
          onclick: () => {
            const r = buyCard(state, c.id);
            if (!r.ok) { setNote(r.error, 'bad'); render(); return; }
            state = r.game; playSound('unwrap');
            if (isOver(state)) screen = 'over';
            render();
          }
        },
          h('span', { class: 'kot-card__name' }, c.name),
          h('span', { class: 'kot-card__cost' }, `${toFa(c.cost)} ⚡`),
          h('span', { class: 'kot-card__text' }, c.text)
        ))
      )
    );
  }

  /* ------------------------------ ربات ------------------------------ */

  function scheduleBot() {
    cleanup();
    if (!state || isOver(state)) return;
    const me = currentMonster(state);
    if (me?.human) return;
    botTimer = setTimeout(() => {
      botTimer = null;
      if (!state || isOver(state)) return;
      state = botMove(state);
      playSound('dice');
      if (isOver(state)) screen = 'over';
      render();
      scheduleBot();
    }, 700);
  }

  /* ------------------------------ پایان ------------------------------ */

  function drawOver() {
    const w = winnerOf(state);
    const mine = w?.human;
    return h('div', { class: 'page' },
      gameHeader({ title: 'پادشاه توکیو', onBack: onExit }),
      h('section', { class: 'kot-result' },
        h('div', { class: 'kot-result__seal' }, mine ? '♛' : '☠'),
        h('h2', {}, mine ? 'پادشاه توکیو شدی!' : `${w?.name || 'هیولا'} پادشاه شد`),
        h('p', {}, mine
          ? 'شهر مال توست. هیولاها به تو تعظیم می‌کنند.'
          : 'شهر را از دست دادی. یک بار دیگر؟'),
        h('div', { class: 'kot-result__stats' },
          statBox('ستاره', w?.stars ?? 0),
          statBox('جان', w?.health ?? 0),
          statBox('دور', state.round)
        )
      ),
      h('div', { class: 'stack' },
        btn('بازی دوباره', { variant: 'btn--primary btn--block', ico: 'refresh', onClick: start }),
        btn('برگشت', { variant: 'btn--block', ico: 'back', onClick: onExit })
      )
    );
  }

  function statBox(label, value) {
    return h('div', { class: 'kot-result__stat' },
      h('strong', {}, toFa(value)),
      h('span', {}, label)
    );
  }

  return cleanup;
}
