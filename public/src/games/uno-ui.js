/* ============================================================
   «اونو» — رابط
   کارت‌ها کاغذی‌اند، رنگ‌ها مرکب چاپی، و میز مثل یک دست واقعی
   چیده می‌شود. رقیب‌ها نوبتی بازی می‌کنند.
   ============================================================ */

import { h, mount, playSound, stats, toFa } from '../core.js';
import {
  COLORS, COLOR_LABEL, RULES, createUno, playUno, drawForTurn, botChoice,
  playableCards, topCard, cardName, isOver, handCount
} from '../engines/uno.js';
import { gameHeader, sheet, btn, helpBlock, callout } from '../ui/kit.js';
import { handCard, turnBanner, seatStrip, drawPile, tableNote } from '../ui/tablekit.js';
import { artBanner } from '../ui/kit.js';

/** نماد هر کارت اکشن روی خود کارت */
const FACE_LABEL = { skip: '⦸', reverse: '⇄', draw2: '+۲', wild: '★', wild4: '+۴' };
const faceText = (c) => (c.kind === 'num' ? c.face : FACE_LABEL[c.face] || c.face);

export function mountGame(root, { onExit } = {}) {
  let screen = 'intro';     // intro | play | over | help
  let players = 3;
  let game = null;
  let note = '';
  let noteTone = 'info';
  let busy = false;
  let pendingWild = null;   // کارت وحشی که منتظر انتخاب رنگ است
  let botTimer = null;

  const render = () => mount(root, draw());
  render();

  const cleanupBots = () => { if (botTimer) { clearTimeout(botTimer); botTimer = null; } };

  function draw() {
    if (screen === 'help') return drawHelp();
    if (screen === 'play') return drawPlay();
    if (screen === 'over') return drawOver();
    return drawIntro();
  }

  /* ------------------------------ شروع ------------------------------ */

  function start() {
    cleanupBots();
    game = createUno({
      players,
      seed: (Date.now() ^ Math.random() * 1e6) >>> 0
    });
    note = ''; noteTone = 'info'; pendingWild = null; busy = false;
    screen = 'play';
    playSound('shuffle');
    render();
    scheduleBot();
  }

  function setNote(text, tone = 'info') { note = text; noteTone = tone; }

  /** رقیب‌ها تا وقتی نوبت من نشده بازی می‌کنند */
  function scheduleBot() {
    cleanupBots();
    if (!game || isOver(game) || game.turn === 0) return;
    busy = true;
    botTimer = setTimeout(() => {
      botTimer = null;
      if (!game || isOver(game)) return;
      const seat = game.turn;
      if (seat === 0) { busy = false; render(); return; }

      const choice = botChoice(game, seat);
      if (choice.action === 'draw') {
        const r = drawForTurn(game);
        if (!r.ok) { busy = false; return; }
        game = r.game;
        playSound('card-slide');
      } else {
        const r = playUno(game, seat, choice.cardId, choice.color);
        if (!r.ok) {
          const d = drawForTurn(game);
          if (!d.ok) { busy = false; return; }
          game = d.game;
        } else {
          game = r.game;
          setNote(`${game.names[seat]} بازی کرد`, 'info');
          playSound('card-deal');
        }
      }
      if (isOver(game)) { finish(); return; }
      render();
      scheduleBot();
    }, 620);
  }

  function finish() {
    cleanupBots();
    if (!game || game._recorded) return;
    game._recorded = true;
    const won = game.winner === 0;
    stats.record('uno', {
      key: 'uno-wins', best: won ? 1 : 0, higherIsBetter: true, label: won ? 'برد' : 'باخت'
    });
    playSound(won ? 'win' : 'lose');
    screen = 'over';
    render();
  }

  /* ------------------------------ مقدمه ------------------------------ */

  function drawIntro() {
    return h('div', {},
      gameHeader({ title: 'اونو', onBack: onExit }),

      h('section', { class: 'uno-hero print-edge' },
        h('div', { class: 'uno-hero__fan', 'aria-hidden': 'true' },
          ...COLORS.map(c => h('span', {
            class: 'uno-hero__card',
            style: `--c:${c.hex};transform:rotate(${(COLORS.indexOf(c) - 1.5) * 7}deg)`
          }))
        ),
        h('div', { class: 'uno-hero__text' },
          h('div', { class: 'uno-hero__kicker' }, '۱۰۸ کارت · ۲ تا ۴ نفر'),
          h('h1', {}, 'کارت هم‌رنگ را روی هم بگذار'),
          h('p', {}, 'رنگ یا شماره باید بخواند. کارت‌های اکشن بازی را به هم می‌ریزند.')
        )
      ),

      sheet({ title: 'چند نفر', iconName: 'users', children: h('div', { class: 'level-row' },
        ...[2, 3, 4].map(n => h('button', {
          class: `level-card${players === n ? ' is-on' : ''}`,
          'aria-pressed': String(players === n),
          style: `--lvl-art:url('/assets/art/cats/lvl-${n === 2 ? 'quick' : n === 3 ? 'standard' : 'deep'}.jpg')`,
          onclick: () => { players = n; playSound('tap'); render(); }
        },
          h('div', { class: 'level-card__name' }, `${toFa(n)} نفر`),
          h('div', { class: 'level-card__meta' }, n === 2 ? 'دوئل' : n === 3 ? 'میز گرم' : 'شلوغ')
        ))
      ) }),

      h('div', { class: 'stack' },
        btn('شروع دست', { variant: 'btn--primary btn--block', onClick: start }),
        btn('راهنما', { onClick: () => { screen = 'help'; render(); } })
      )
    );
  }

  function drawHelp() {
    return h('div', {},
      gameHeader({ title: 'راهنمای اونو', onBack: () => { screen = 'intro'; render(); } }),
      sheet({ title: 'قواعد', iconName: 'book', children: helpBlock(RULES) }),
      h('div', { class: 'stack' },
        btn('فهمیدم', { variant: 'btn--primary btn--block', onClick: () => { screen = 'intro'; render(); } })
      )
    );
  }

  /* ------------------------------ میز ------------------------------ */

  function drawPlay() {
    if (!game) return drawIntro();
    const top = topCard(game);
    const myHand = game.hands[0];
    const myTurn = game.turn === 0 && !pendingWild;
    const legal = playableCards(myHand, top, game.currentColor);

    return h('div', {},
      gameHeader({
        title: 'میز اونو',
        onBack: () => { cleanupBots(); screen = 'intro'; render(); },
        children: [
          h('span', { class: 'score-pill' }, `${toFa(myHand.length)} کارت`),
          h('span', { class: `score-pill uno-color-pill`, style: `--c:${colorHex(game.currentColor)}` },
            COLOR_LABEL[game.currentColor] || '')
        ]
      }),

      seatStrip(game.names.map((n, i) => ({
        name: n,
        meta: i === 0 ? `${toFa(game.hands[0].length)} کارت` : `${toFa(game.hands[i].length)} کارت`,
        active: game.turn === i,
        mine: i === 0
      }))),

      /* میز */
      h('section', { class: 'uno-table', 'aria-label': 'میز بازی' },
        h('div', { class: 'uno-table__pile' },
          drawPile(game.deck.length, {
            label: 'برداشت',
            onClick: myTurn && !busy ? onDraw : null
          })
        ),
        h('div', { class: 'uno-table__center' },
          h('div', { class: 'uno-top', style: `--c:${colorHex(top.color || game.currentColor)}` },
            h('span', { class: 'uno-top__face' }, faceText(top)),
            h('span', { class: 'uno-top__name' }, cardName(top))
          ),
          note ? tableNote(note, { tone: noteTone }) : null
        )
      ),

      /* انتخاب رنگ برای وحشی */
      pendingWild
        ? h('section', { class: 'uno-pick' },
            h('h3', { class: 'uno-pick__title' }, 'رنگ را انتخاب کن'),
            h('div', { class: 'uno-pick__row' },
              ...COLORS.map(c => h('button', {
                class: 'uno-pick__btn',
                style: `--c:${c.hex}`,
                'aria-label': `رنگ ${c.label}`,
                onclick: () => commitWild(c.id)
              }, h('span', {}, c.label)))
            ),
            btn('بی‌خیال', { variant: 'btn--ghost btn--block', onClick: () => { pendingWild = null; render(); } })
          )
        : null,

      /* نوبت */
      turnBanner(
        isOver(game) ? 'دست تمام شد'
          : myTurn ? 'نوبت توست — یک کارت بازی کن یا بردار'
            : `${game.names[game.turn]} دارد بازی می‌کند…`,
        { tone: myTurn ? 'mine' : 'theirs' }
      ),

      /* دست من */
      sheet({ title: `دست تو (${toFa(myHand.length)})`, iconName: 'cards', children:
        h('div', { class: 'uno-hand' },
          ...myHand.map(c => handCard(
            { suit: c.color || 'wild', rank: 0 },
            {
              label: faceText(c),
              playable: myTurn && !busy && legal.some(l => l.id === c.id),
              onClick: myTurn && !busy ? () => onPlay(c) : null
            }
          ))
        )
      }),

      h('div', { class: 'uno-actions' },
        btn('برداشتن کارت', {
          variant: 'btn--teal btn--block',
          disabled: !myTurn || busy,
          onClick: onDraw
        })
      ),

      game.log.length > 1
        ? h('section', { class: 'uno-log' },
            ...[...game.log].reverse().slice(0, 4).map(t => h('p', { class: 'uno-log__row' }, t)))
        : null
    );
  }

  function onDraw() {
    if (!game || game.turn !== 0 || busy) return;
    const r = drawForTurn(game);
    if (!r.ok) { setNote(r.error, 'bad'); render(); return; }
    game = r.game;
    setNote('یک کارت برداشتی', 'info');
    playSound('card-slide');
    render();
    scheduleBot();
  }

  function onPlay(card) {
    if (!game || game.turn !== 0 || busy) return;
    if (card.kind === 'wild') {
      pendingWild = card;
      playSound('tap');
      render();
      return;
    }
    const r = playUno(game, 0, card.id);
    if (!r.ok) { setNote(r.error, 'bad'); playSound('error'); render(); return; }
    game = r.game;
    setNote(r.events?.[0] || '', 'info');
    playSound('card-deal');
    if (isOver(game)) { finish(); return; }
    render();
    scheduleBot();
  }

  function commitWild(colorId) {
    if (!pendingWild) return;
    const r = playUno(game, 0, pendingWild.id, colorId);
    pendingWild = null;
    if (!r.ok) { setNote(r.error, 'bad'); render(); return; }
    game = r.game;
    setNote(`رنگ: ${COLOR_LABEL[colorId]}`, 'info');
    playSound('card-deal');
    if (isOver(game)) { finish(); return; }
    render();
    scheduleBot();
  }

  /* ------------------------------ پایان ------------------------------ */

  function drawOver() {
    const won = game?.winner === 0;
    return h('div', {},
      gameHeader({ title: won ? 'دست را بردی' : 'دست را باختی', onBack: onExit }),
      h('section', { class: `uno-result${won ? ' is-win' : ''}` },
        h('div', { class: 'uno-result__seal', 'aria-hidden': 'true' }, won ? '❧' : '☾'),
        h('h2', {}, won ? 'دست خالی شد!' : `${game?.names[game?.winner] || 'رقیب'} زودتر خالی کرد`),
        h('p', {}, `کارت‌های تو: ${toFa(game?.hands[0]?.length ?? 0)}`)
      ),
      h('div', { class: 'stack' },
        btn('دست تازه', { variant: 'btn--primary btn--block', onClick: start }),
        btn('بازگشت', { variant: 'btn--ghost btn--block', onClick: onExit })
      )
    );
  }

  function colorHex(id) {
    return COLORS.find(c => c.id === id)?.hex || '#6a5a44';
  }

  return () => { cleanupBots(); game = null; };
}
