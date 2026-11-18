/* ============================================================
   «یاتزی» و «فارکل» — رابط مشترک دو بازی تاس
   تاس‌ها چوبی-کاغذی‌اند و با نقطه‌های واقعی، نه عدد.
   ============================================================ */

import { h, mount, playSound, stats, toFa } from '../core.js';
import {
  YAHTZEE_CATS, YAHTZEE_BONUS, RULES,
  createYahtzee, yahtzeeRoll, toggleHold, yahtzeeScoreCat, yahtzeeScore,
  yahtzeeTotal, yahtzeeUpper, yahtzeeBot, yahtzeeOver,
  createFarkle, farkleRoll, farkleKeep, farkleBank, farkleBot, farkleOver, farkleScoreSelection
} from '../engines/dice5.js';
import { gameHeader, sheet, btn, helpBlock, callout } from '../ui/kit.js';
import { die, turnBanner, seatStrip, tableNote } from '../ui/tablekit.js';

export function mountGame(root, { onExit, game } = {}) {
  const kind = game?.id === 'farkle' ? 'farkle' : 'yahtzee';
  const title = kind === 'farkle' ? 'فارکل' : 'یاتزی';

  let screen = 'intro';
  let state = null;
  let note = '';
  let noteTone = 'info';
  let selected = [];        // ایندکس تاس‌های انتخابی در فارکل
  let botTimer = null;

  const render = () => mount(root, draw());
  render();

  const cleanupBots = () => { if (botTimer) { clearTimeout(botTimer); botTimer = null; } };
  const setNote = (t, tone = 'info') => { note = t; noteTone = tone; };

  function draw() {
    if (screen === 'help') return drawHelp();
    if (screen === 'play') return kind === 'farkle' ? drawFarkle() : drawYahtzee();
    if (screen === 'over') return drawOver();
    return drawIntro();
  }

  function start() {
    cleanupBots();
    selected = [];
    note = ''; noteTone = 'info';
    state = kind === 'farkle'
      ? createFarkle({ seed: (Date.now() ^ Math.random() * 1e6) >>> 0, players: 2 })
      : createYahtzee({ seed: (Date.now() ^ Math.random() * 1e6) >>> 0, players: 2 });
    screen = 'play';
    playSound('dice');
    render();
    scheduleBot();
  }

  function finish() {
    cleanupBots();
    if (!state || state._recorded) return;
    state._recorded = true;
    const won = state.winner === 0;
    stats.record(kind, {
      key: `${kind}-wins`, best: won ? 1 : 0, higherIsBetter: true,
      label: `${won ? 'برد' : 'باخت'} · ${toFa(kind === 'farkle' ? state.totals[0] : yahtzeeTotal(state.scores[0]))}`
    });
    playSound(won ? 'win' : 'lose');
    screen = 'over';
    render();
  }

  /* ------------------------------ نوبت رقیب ------------------------------ */

  function scheduleBot() {
    cleanupBots();
    if (!state || state.winner !== null || state.turn === 0) return;
    botTimer = setTimeout(() => {
      botTimer = null;
      if (!state || state.winner !== null) return;
      if (state.turn === 0) { render(); return; }
      const seat = state.turn;
      const choice = kind === 'farkle' ? farkleBot(state, seat) : yahtzeeBot(state, seat);

      if (kind === 'farkle') stepFarkleBot(seat, choice);
      else stepYahtzeeBot(seat, choice);

      if (state.winner !== null) { finish(); return; }
      render();
      scheduleBot();
    }, 560);
  }

  function stepYahtzeeBot(seat, choice) {
    if (choice.action === 'roll') {
      if (choice.hold) state = { ...state, held: choice.hold };
      const r = yahtzeeRoll(state);
      if (r.ok) { state = r.game; playSound('dice'); }
      else {
        // سه بار ریخته، باید خانه بگذارد
        const empty = YAHTZEE_CATS.filter(c => state.scores[seat][c.id] === undefined);
        const best = empty.map(c => ({ id: c.id, pts: yahtzeeScore(c.id, state.dice) }))
          .sort((a, b) => b.pts - a.pts)[0];
        if (best) { const s = yahtzeeScoreCat(state, seat, best.id); if (s.ok) state = s.game; }
      }
    } else if (choice.action === 'score' && choice.catId) {
      const s = yahtzeeScoreCat(state, seat, choice.catId);
      if (s.ok) { state = s.game; playSound('card-slide'); }
    }
  }

  function stepFarkleBot(seat, choice) {
    if (choice.action === 'roll') {
      const r = farkleRoll(state);
      if (r.ok) { state = r.game; playSound('dice'); }
    } else if (choice.action === 'keep') {
      const r = farkleKeep(state, choice.indices || []);
      if (r.ok) { state = r.game; playSound('card-slide'); }
    } else {
      const r = farkleBank(state);
      if (!r.ok) {
        const d = farkleRoll(state);
        if (d.ok) state = d.game;
      } else state = r.game;
    }
  }

  /* ------------------------------ مقدمه ------------------------------ */

  function drawIntro() {
    return h('div', {},
      gameHeader({ title, onBack: onExit }),
      h('section', { class: 'dice-hero print-edge' },
        h('div', { class: 'dice-hero__row', 'aria-hidden': 'true' },
          ...[1, 3, 5, 6, 2].map(v => die(v))
        ),
        h('div', { class: 'dice-hero__text' },
          h('div', { class: 'dice-hero__kicker' },
            kind === 'farkle' ? '۶ تاس · طمع نکن' : '۵ تاس · ۱۳ خانه'),
          h('h1', {}, kind === 'farkle' ? 'امتیاز را انبار کن یا بسوزان' : 'ترکیب‌ها را شکار کن'),
          h('p', {}, kind === 'farkle'
            ? 'هر ریختن ممکن است همهٔ امتیاز نوبت را ببرد.'
            : 'سه بار می‌ریزی و یک خانه را پر می‌کنی.')
        )
      ),
      h('div', { class: 'stack' },
        btn('شروع', { variant: 'btn--primary btn--block', onClick: start }),
        btn('راهنما', { onClick: () => { screen = 'help'; render(); } })
      )
    );
  }

  function drawHelp() {
    return h('div', {},
      gameHeader({ title: `راهنمای ${title}`, onBack: () => { screen = 'intro'; render(); } }),
      sheet({ title: 'قواعد', iconName: 'book', children: helpBlock(RULES) }),
      h('div', { class: 'stack' },
        btn('فهمیدم', { variant: 'btn--primary btn--block', onClick: () => { screen = 'intro'; render(); } })
      )
    );
  }

  /* ------------------------------ یاتزی ------------------------------ */

  function drawYahtzee() {
    const g = state;
    const myTurn = g.turn === 0;
    const sheetMine = g.scores[0];
    const canRoll = myTurn && g.rollsLeft > 0;
    const canScore = myTurn && g.rollsLeft < 3;

    return h('div', {},
      gameHeader({
        title: 'میز یاتزی',
        onBack: () => { cleanupBots(); screen = 'intro'; render(); },
        children: [
          h('span', { class: 'score-pill' }, `ریختن ${toFa(3 - g.rollsLeft)}/۳`),
          h('span', { class: 'score-pill' }, `امتیاز ${toFa(yahtzeeTotal(sheetMine))}`)
        ]
      }),

      seatStrip(g.names.map((n, i) => ({
        name: n,
        meta: `${toFa(yahtzeeTotal(g.scores[i]))}`,
        active: g.turn === i, mine: i === 0
      }))),

      h('section', { class: 'dice-tray', 'aria-label': 'تاس‌ها' },
        h('div', { class: 'dice-tray__row' },
          ...g.dice.map((v, i) => die(v, {
            held: g.held[i],
            label: `تاس ${i + 1}${g.held[i] ? ' نگه‌داشته' : ''}`,
            onClick: canRoll || !myTurn ? null : () => onToggleHold(i)
          }))
        ),
        h('p', { class: 'dice-tray__hint' }, canRoll
          ? 'تاس‌های دلخواه را لمس کن تا نگه داشته شوند، بعد بریز.'
          : canScore ? 'یک خانه را انتخاب کن تا امتیازش ثبت شود.' : '')
      ),

      turnBanner(
        myTurn ? (canRoll ? 'نوبت توست — بریز' : 'امتیاز یک خانه را ثبت کن') : `${g.names[g.turn]} در حال بازی…`,
        { tone: myTurn ? 'mine' : 'theirs' }
      ),

      h('div', { class: 'dice-actions' },
        btn(g.rollsLeft > 0 ? `ریختن (${toFa(g.rollsLeft)} بار مانده)` : 'ریختن تمام شد', {
          variant: 'btn--primary btn--block',
          disabled: !canRoll,
          onClick: onRoll
        })
      ),

      /* جدول امتیاز */
      sheet({ title: 'جدول امتیاز', iconName: 'chart', children:
        h('div', { class: 'yahtzee-grid' },
          ...YAHTZEE_CATS.map(cat => {
            const mineVal = sheetMine[cat.id];
            const preview = mineVal === undefined && canScore ? yahtzeeScore(cat.id, g.dice) : null;
            const filled = mineVal !== undefined;
            return h('button', {
              class: `yahtzee-cell${filled ? ' is-filled' : ''}${preview !== null ? ' is-preview' : ''}`,
              disabled: !canScore || filled,
              'aria-label': `${cat.label}: ${filled ? mineVal : preview !== null ? `${preview} قابل ثبت` : 'خالی'}`,
              onclick: () => onScoreCat(cat.id)
            },
              h('span', { class: 'yahtzee-cell__name' }, cat.label),
              h('span', { class: 'yahtzee-cell__val' },
                filled ? toFa(mineVal) : preview !== null ? toFa(preview) : '—')
            );
          })
        )
      }),

      h('div', { class: 'yahtzee-bonus' },
        h('span', {}, `بخش بالا: ${toFa(yahtzeeUpper(sheetMine))}/۶۳`),
        yahtzeeUpper(sheetMine) >= 63 ? h('strong', {}, `+${toFa(YAHTZEE_BONUS)} پاداش`) : null
      ),

      note ? tableNote(note, { tone: noteTone }) : null
    );
  }

  function onRoll() {
    if (!state || state.turn !== 0) return;
    const r = yahtzeeRoll(state);
    if (!r.ok) { setNote(r.error, 'bad'); render(); return; }
    state = r.game;
    playSound('dice');
    render();
  }

  function onToggleHold(i) {
    if (!state || state.turn !== 0) return;
    const r = toggleHold(state, i);
    if (!r.ok) return;
    state = r.game;
    playSound('tap');
    render();
  }

  function onScoreCat(catId) {
    if (!state || state.turn !== 0) return;
    const r = yahtzeeScoreCat(state, 0, catId);
    if (!r.ok) { setNote(r.error, 'bad'); render(); return; }
    state = r.game;
    setNote(`${r.points} امتیاز ثبت شد`, r.points > 0 ? 'info' : 'bad');
    playSound('paper-flip');
    if (yahtzeeOver(state)) { finish(); return; }
    render();
    scheduleBot();
  }

  /* ------------------------------ فارکل ------------------------------ */

  function drawFarkle() {
    const g = state;
    const myTurn = g.turn === 0;
    const picked = selected.map(i => g.dice[i]).filter(Boolean);
    const previewPts = picked.length ? farkleScoreSelection(picked) : 0;

    return h('div', {},
      gameHeader({
        title: 'میز فارکل',
        onBack: () => { cleanupBots(); screen = 'intro'; return; },
        children: [
          h('span', { class: 'score-pill' }, `نوبت: ${toFa(g.turnScore)}`),
          h('span', { class: 'score-pill' }, `کل ${toFa(g.totals[0])}`)
        ]
      }),

      seatStrip(g.names.map((n, i) => ({
        name: n,
        meta: toFa(g.totals[i]),
        active: g.turn === i, mine: i === 0
      }))),

      h('section', { class: 'dice-tray', 'aria-label': 'تاس‌ها' },
        h('div', { class: 'dice-tray__row' },
          ...g.dice.map((v, i) => die(v, {
            held: selected.includes(i),
            label: `تاس ${i + 1}`,
            onClick: myTurn && g.phase === 'choose' ? () => onTogglePick(i) : null
          }))
        ),
        picked.length
          ? h('p', { class: 'dice-tray__hint' }, `انتخاب: ${toFa(previewPts)} امتیاز`)
          : h('p', { class: 'dice-tray__hint' }, myTurn && g.phase === 'choose'
              ? 'تاس‌های امتیازآور را انتخاب کن (۱، ۵ یا سه‌تایی).' : '')
      ),

      turnBanner(
        myTurn ? `نوبت توست — بانک ${toFa(g.turnScore)}` : `${g.names[g.turn]} در حال بازی…`,
        { tone: myTurn ? 'mine' : 'theirs' }
      ),

      h('div', { class: 'dice-actions' },
        btn('ریختن شش تاس', {
          variant: 'btn--primary btn--block',
          disabled: !myTurn || g.phase !== 'roll',
          onClick: onFarkleRoll
        }),
        btn(picked.length ? `ثبت انتخاب (${toFa(previewPts)})` : 'ثبت انتخاب', {
          variant: 'btn--teal btn--block',
          disabled: !myTurn || g.phase !== 'choose' || !picked.length,
          onClick: onFarkleKeep
        }),
        btn(`انبار کردن ${toFa(g.turnScore)}`, {
          variant: 'btn--ghost btn--block',
          disabled: !myTurn || g.turnScore <= 0 || g.phase === 'busted',
          onClick: onFarkleBank
        })
      ),

      note ? tableNote(note, { tone: noteTone }) : null,

      h('section', { class: 'farkle-log' },
        ...[...g.log].reverse().slice(0, 5).map(t => h('p', { class: 'farkle-log__row' }, t))
      )
    );
  }

  function onTogglePick(i) {
    selected = selected.includes(i) ? selected.filter(k => k !== i) : [...selected, i];
    playSound('tap');
    render();
  }

  function onFarkleRoll() {
    if (!state || state.turn !== 0) return;
    const r = farkleRoll(state);
    if (!r.ok) { setNote(r.error, 'bad'); render(); return; }
    state = r.game;
    selected = [];
    if (r.busted) setNote('هیچ امتیازی نبود — نوبت سوخت', 'bad');
    playSound(r.busted ? 'error' : 'dice');
    render();
    if (state.turn !== 0) scheduleBot();
  }

  function onFarkleKeep() {
    if (!state || state.turn !== 0) return;
    const r = farkleKeep(state, selected);
    if (!r.ok) { setNote(r.error, 'bad'); playSound('error'); render(); return; }
    state = r.game;
    selected = [];
    setNote(`${r.points} امتیاز به بانک نوبت رفت`, 'info');
    playSound('card-slide');
    render();
  }

  function onFarkleBank() {
    if (!state || state.turn !== 0) return;
    const r = farkleBank(state);
    if (!r.ok) { setNote(r.error, 'bad'); render(); return; }
    state = r.game;
    selected = [];
    setNote(`${r.banked} امتیاز انبار شد`, 'info');
    playSound('seal');
    if (farkleOver(state)) { finish(); return; }
    render();
    scheduleBot();
  }

  /* ------------------------------ پایان ------------------------------ */

  function drawOver() {
    const won = state?.winner === 0;
    const mine = kind === 'farkle' ? state?.totals[0] : yahtzeeTotal(state?.scores[0] || {});
    return h('div', {},
      gameHeader({ title: won ? 'بردی' : 'باختی', onBack: onExit }),
      h('section', { class: `dice-result${won ? ' is-win' : ''}` },
        h('div', { class: 'dice-result__seal', 'aria-hidden': 'true' }, won ? '❧' : '☾'),
        h('h2', {}, won ? `در ${title} بردی` : 'رقیب برد'),
        h('p', {}, `امتیاز تو: ${toFa(mine)}`),
        kind === 'farkle'
          ? h('p', {}, `رقیب: ${toFa(state?.totals[1] ?? 0)}`)
          : h('p', {}, `رقیب: ${toFa(yahtzeeTotal(state?.scores[1] || {}))}`)
      ),
      h('div', { class: 'stack' },
        btn('دست تازه', { variant: 'btn--primary btn--block', onClick: start }),
        btn('بازگشت', { variant: 'btn--ghost btn--block', onClick: onExit })
      )
    );
  }

  return () => { cleanupBots(); state = null; };
}
