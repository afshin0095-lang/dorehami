/* ============================================================
   کم‌ترین پیشنهاد (Lowball) — مناقصه‌ی ورق نوآر
   ۲ تا ۴ نفر: هرکس یک کارت رو می‌کند، کم‌ترین امتیاز دور را می‌برد
   ============================================================ */

import { h, mount, playSound, toast, stats, toFa } from '../core.js';
import { createLowball, pick, nextRound } from '../engines/lowball.js';
import { SUIT_GLYPH, SUIT_IS_RED, rankLabel, cardPoints } from '../engines/hokm.js';
import { gameHeader, sheet, btn, helpBlock, callout } from '../ui/kit.js';
import { playingCard } from '../ui/cardkit.js';

const HELP = {
  steps: [
    'هر بازیکن چند کارت در دست دارد. در هر دور یک کارت رو می‌کنید؛ همه هم‌زمان.',
    'کارتی که کم‌ترین امتیاز را دارد، دور را می‌برد. اما حواست باشد: تو نمی‌دانی بقیه چه کارتی می‌گذارند.',
    'امتیاز کارت‌ها: ۲ تا ۹ صفر، سرباز ۲، شاه ۴، آس ۵. پس «۲» بهترین و «آس» بدترین است.',
    '۵ دور بازی می‌شود و هرکس بیشتر دور ببرد، برنده است.'
  ],
  example: 'مثال: تو «۷» می‌گذاری (۰ امتیاز)، رقیب «آس» می‌گذارد (۵) و نفر سوم «سرباز» (۲). تو دور را بردی.',
  note: 'در نسخه‌ی ۲ نفره، هر دو هم‌زمان انتخاب می‌کنند و کم‌ترین کارت برنده می‌شود؛ کارت مساوی = مساوی.'
};

export function mountGame(root, { onExit }) {
  let state = { screen: 'setup', count: 2 };

  const render = () => mount(root, draw());
  render();

  function draw() {
    if (state.screen === 'help') return drawHelp();
    if (state.screen === 'play') return drawPlay();
    if (state.screen === 'done') return drawDone();
    return drawSetup();
  }

  function drawSetup() {
    return h('div', {},
      gameHeader({ title: 'کم‌ترین پیشنهاد', onBack: onExit }),
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
          state = { screen: 'play', game: createLowball({ players: names }) };
          playSound('card-deal');
          render();
        }
      })
    );
  }

  function drawHelp() {
    return h('div', {},
      gameHeader({ title: 'راهنمای کم‌ترین پیشنهاد', onBack: () => { state.screen = 'play'; render(); } }),
      sheet({ title: 'قدم به قدم', iconName: 'book', children: helpBlock(HELP) }),
      btn('فهمیدم', { variant: 'btn--block', onClick: () => { state.screen = 'play'; render(); } })
    );
  }

  function drawPlay() {
    const g = state.game;
    const myHand = g.hands[0];
    const revealed = g.phase === 'reveal';

    return h('div', {},
      gameHeader({ title: `دور ${toFa(g.round)} از ${toFa(g.maxRounds)}`, onBack: () => { if (confirm('از بازی خارج شوی؟')) onExit(); } }),

      h('div', { class: 'score-row', style: { marginBottom: '.5rem' } },
        ...g.players.map(p => h('span', { class: 'score-pill' }, `${p.name}: ${toFa(p.score)}`))
      ),

      revealed && g.roundResult
        ? sheet({ children: h('div', {},
            h('div', { class: 'result-banner', style: { paddingBottom: '.4rem' } },
              h('div', { class: 'result-banner__verdict' },
                g.roundResult.tie ? 'مساوی' : `${g.players[g.roundResult.winnerId]?.name} دور را برد`),
              h('div', { class: 'result-banner__sub' }, 'کارت‌های رو‌شده')
            ),
            h('div', { style: { display: 'flex', gap: '.5rem', justifyContent: 'center', flexWrap: 'wrap' } },
              ...g.roundResult.values.map(v => h('div', { style: { textAlign: 'center' } },
                cardMini(v.card),
                h('div', { style: { fontSize: '.72rem', marginTop: '.2rem' } }, g.players[v.playerId].name),
                h('div', { style: { fontSize: '.72rem', fontWeight: 700 } }, `${toFa(v.value)} امتیاز`)
              ))
            )
          ) })
        : null,

      !revealed
        ? h('div', {},
            h('div', { style: { textAlign: 'center', color: '#f3e9d4', fontSize: '.85rem', marginBottom: '.4rem', textShadow: '0 2px 6px #000' } },
              'یک کارت انتخاب کن — کم‌ترین امتیاز برنده است'),
            h('div', { class: 'hand' },
              ...myHand.map((card, i) => h('div', {
                class: 'hand__card',
                dataset: { selected: String(g.picks[0] === card.id) },
                style: { '--rot': `${(i - (myHand.length - 1) / 2) * 3}deg` },
                onclick: () => {
                  try {
                    state.game = pick(g, 0, card.id);
                    playSound('card-deal');
                    if (state.game.phase === 'pick') autoBotPicks();
                    render();
                  } catch (e) { toast(e.message, 'warn'); }
                }
              }, cardMini(card, { full: true })))
            )
          )
        : btn('دور بعد', {
            variant: 'btn--primary btn--block',
            onClick: () => {
              const next = nextRound(g);
              state.game = next;
              state.screen = next.phase === 'done' ? 'done' : 'play';
              playSound('paper-flip');
              render();
            }
          }),

      callout('کارت‌های ۲ تا ۹ صفر امتیاز دارند — طمع نکن!', 'spark')
    );
  }

  /** بقیه‌ی بازیکن‌ها خودکار انتخاب می‌کنند */
  function autoBotPicks() {
    let g = state.game;
    for (const p of g.players) {
      if (p.id === 0) continue;
      if (g.picks[p.id]) continue;
      const hand = g.hands[p.id];
      if (!hand?.length) continue;
      // بات: کم‌ترین امتیاز با کمی تصادف
      const sorted = [...hand].sort((a, b) => cardPoints(a.rank) - cardPoints(b.rank));
      const idx = Math.random() < 0.75 ? 0 : Math.min(sorted.length - 1, Math.floor(Math.random() * sorted.length));
      g = pick(g, p.id, sorted[idx].id);
      if (g.phase === 'reveal') break;
    }
    state.game = g;
  }

  function cardMini(card, { full = false } = {}) {
    return playingCard({ suit: card.suit, rank: card.rank }, { compact: !full });
  }

  function drawDone() {
    const g = state.game;
    if (!state.recorded) {
      state.recorded = true;
      const w = g.winner;
      stats.record('lowball', { label: w !== null ? g.players[w].name : 'مساوی' });
      playSound('win');
    }
    return h('div', {},
      gameHeader({ title: 'پایان', onBack: onExit }),
      sheet({ cls: 'stamp', children: h('div', { class: 'result-banner' },
        h('div', { style: { fontSize: '2rem' } }, '🃏'),
        h('div', { class: 'result-banner__verdict' }, g.winner !== null ? `${g.players[g.winner].name} برد` : 'مساوی'),
        h('div', { class: 'result-banner__sub' }, g.players.map(p => `${p.name}: ${toFa(p.score)}`).join(' · '))
      ) }),
      h('div', { style: { display: 'grid', gap: '.5rem' } },
        btn('دوباره', { variant: 'btn--primary btn--block', onClick: () => { state = { screen: 'setup', count: 2 }; render(); } }),
        btn('خروج', { variant: 'btn--ghost btn--block', onClick: onExit })
      )
    );
  }

  return () => {};
}
