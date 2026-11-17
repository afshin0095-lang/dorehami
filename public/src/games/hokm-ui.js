/* ============================================================
   حکم — میز ورق گوتیک، ۴ نفره، ۲ تیم
   ============================================================ */

import { h, mount, playSound, toast, stats, toFa } from '../core.js';
import { createHokmGame, playCard, canPlay, botCard, trickWinner, teamOf, SUIT_LABEL, SUIT_GLYPH, SUIT_IS_RED, rankLabel, cardPoints, strengthInTrump } from '../engines/hokm.js';
import { gameHeader, sheet, btn, icon, helpBlock, callout } from '../ui/kit.js';

const HELP = {
  steps: [
    '۴ نفر، دو تیم دو نفره. شریک تو روبه‌روی تو (روی میز، صندلی ۰ و ۲) است.',
    'حاکم (صندلی ۰) بازی را با حکم خشت شروع می‌کند. در نسخه‌ی کامل، حاکم خال را انتخاب می‌کند؛ اینجا خشت پیش‌فرض است.',
    'هر نفر ۱۳ کارت دارد. اولین نفر یک کارت می‌اندازد؛ بقیه باید از همان خال بازی کنند، مگر اینکه آن خال را نداشته باشند. اگر نداری، می‌توانی حکم بزنی و دور را ببری.',
    'قوی‌ترین کارت حکم، دور را می‌برد. اگر حکم زمین نبود، بالاترین کارت از خال زمین می‌برد.',
    '۱۳ دور بازی می‌شود و امتیازها جمع می‌شوند. تیمی که ۷ امتیاز یا بیشتر بگیرد برنده است.'
  ],
  example: 'مثال: زمین با ♠ خشت شروع شد. تو ♠ ندار «و» ♦ دل داری، پس نمی‌توانی ♦ بیندازی مگر اینکه حکم ♦ باشد؛ می‌توانی یک کارت ♦ بیندازی و دور را ببری.',
  note: 'امتیاز کارت‌ها: آس ۵، شاه ۴، بی‌بی ۳، سرباز ۲، ده ۱ و بقیه صفر. اما در قدرت بازی، سرباز قوی‌ترین کارت حکم است — دقیقاً مثل حکم واقعی.'
};

export function mountGame(root, { onExit }) {
  let state = { screen: 'intro' };
  const render = () => mount(root, draw());
  render();

  function newGame(names, trump = 'spades') {
    state = { screen: 'table', game: createHokmGame({ names, trumpSuit: trump }), log: [] };
    playSound('card-deal');
    render();
  }

  function draw() {
    if (state.screen === 'intro') return drawIntro();
    if (state.screen === 'help') return drawHelp();
    if (state.screen === 'table') return drawTable();
    return drawIntro();
  }

  function drawIntro() {
    return h('div', {},
      gameHeader({ title: 'حکم', onBack: onExit }),
      h('section', { class: 'sheet', children: h('div', {},
        h('h2', { style: { marginBottom: '.4rem' } }, 'میز ورق گوتیک'),
        h('p', {}, '۴ نفر، دو تیم، ۱۳ دور. تو با شریک رو‌به‌رویت بازی می‌کنی و بقیه را کامپیوتر بازی می‌کند.'),
        h('div', { style: { display: 'flex', gap: '.5rem', justifyContent: 'center', margin: '.9rem 0' } },
          ...['♠', '♥', '♦', '♣'].map((s, i) => h('div', {
            style: {
              width: '54px', height: '76px', background: i % 2 ? '#f7f0dd' : '#f7f0dd',
              border: '1px solid #cbb894', boxShadow: '0 4px 10px rgba(0,0,0,.35)',
              display: 'grid', placeItems: 'center', fontSize: '1.6rem',
              color: i === 1 || i === 2 ? '#a33d2c' : '#241d1a',
              transform: `rotate(${(i - 1.5) * 5}deg)`
            }
          }, s))
        )
      ) }),
      h('div', { style: { display: 'grid', gap: '.5rem' } },
        btn('شروع بازی', { variant: 'btn--primary btn--block', onClick: () => newGame(['تو', 'رقیب ۱', 'شریک', 'رقیب ۲']) }),
        btn('راهنمای حکم', { variant: 'btn--ghost btn--block', onClick: () => { state.screen = 'help'; render(); } })
      )
    );
  }

  function drawHelp() {
    return h('div', {},
      gameHeader({ title: 'راهنمای حکم', onBack: () => { state.screen = 'intro'; render(); } }),
      sheet({ title: 'قدم به قدم', iconName: 'book', children: helpBlock(HELP) }),
      btn('فهمیدم', { variant: 'btn--block', onClick: () => { state.screen = 'intro'; render(); } })
    );
  }

  /* ------------------------------ میز ------------------------------ */
  function drawTable() {
    const g = state.game;
    if (g.finished) return drawResult();

    const mySeat = 0;
    const myHand = g.hands[mySeat];
    const myTurn = g.turn === mySeat;

    // نوبت کامپیوترها
    if (!myTurn) setTimeout(botMove, 620);

    const seatBadge = (seat, label) => h('div', {
      style: {
        textAlign: 'center', fontSize: '.74rem', color: '#f3e9d4',
        opacity: g.turn === seat ? 1 : .72,
        textShadow: '0 2px 6px rgba(0,0,0,.7)'
      }
    },
      h('div', {
        style: {
          width: '34px', height: '34px', margin: '0 auto .15rem',
          borderRadius: '50%', display: 'grid', placeItems: 'center',
          background: teamOf(seat) === 'A' ? 'var(--teal-deep)' : 'var(--plum-deep)',
          border: g.turn === seat ? '2px solid #f3e9d4' : '1px solid rgba(243,233,212,.3)',
          fontSize: '.8rem', fontWeight: 700
        }
      }, toFa(seat + 1)),
      label || g.names[seat],
      h('div', { style: { fontSize: '.66rem', opacity: .8 } }, `${toFa(g.hands[seat].length)} کارت`)
    );

    return h('div', {},
      gameHeader({ title: 'حکم', onBack: () => { if (confirm('از بازی خارج شوی؟')) onExit(); } },
        h('span', { class: 'score-pill' }, `${SUIT_GLYPH[g.trump]} حکم`)),

      // میز
      h('div', { style: { display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '.4rem', marginBottom: '.5rem' } },
        seatBadge(1, 'رقیب'),
        h('div', { style: { textAlign: 'center', color: '#f3e9d4', fontSize: '.7rem', textShadow: '0 2px 6px rgba(0,0,0,.7)' } },
          `دور ${toFa(g.roundCount + 1)} از ۱۳`),
        seatBadge(3, 'رقیب')
      ),

      h('div', { class: 'trick-area' },
        g.trick.length === 0
          ? h('div', { class: 'trick-slot' }, myTurn ? 'نوبت تو' : 'در انتظار…')
          : h('div', { style: { display: 'flex', gap: '.35rem', justifyContent: 'center', flexWrap: 'wrap' } },
              ...g.trick.map(p => h('div', { style: { width: '62px' } },
                cardFace(p.card, { compact: true }),
                h('div', { style: { fontSize: '.62rem', textAlign: 'center', color: '#f3e9d4', marginTop: '.15rem', textShadow: '0 1px 3px #000' } }, p.seat === 0 ? 'تو' : g.names[p.seat])
              ))
            )
      ),

      // امتیاز
      h('div', { class: 'score-row', style: { justifyContent: 'center', marginBottom: '.35rem' } },
        h('span', { class: 'score-pill' }, `ما: ${toFa(g.scores.A + (g.trick.length ? 0 : 0))}`),
        h('span', { class: 'score-pill' }, `آنها: ${toFa(g.scores.B)}`)
      ),

      h('div', { style: { textAlign: 'center', color: '#f3e9d4', fontSize: '.8rem', marginBottom: '.2rem', textShadow: '0 2px 6px #000' } },
        myTurn ? 'نوبت توست — یک کارت انتخاب کن' : 'کامپیوتر بازی می‌کند…'),

      // دست بازیکن
      h('div', { class: 'hand' },
        ...myHand.map((card, i) => {
          const playable = myTurn && canPlay(myHand, card, g.trickLead);
          return h('div', {
            class: 'hand__card',
            style: { '--rot': `${(i - (myHand.length - 1) / 2) * 2.2}deg`, '--lift': `${Math.abs(i - (myHand.length - 1) / 2) * 1.4}px` },
            dataset: { playable: playable ? 'true' : 'false' },
            onclick: () => { if (playable) humanPlay(card); else if (myTurn) toast('این کارت مجاز نیست', 'warn'); }
          }, cardFace(card));
        })
      ),

      h('div', { style: { display: 'flex', gap: '.4rem' } },
        btn('راهنما', { variant: 'btn--ghost btn--sm', cls: 'btn--block', onClick: () => { state.screen = 'help'; render(); } })
      )
    );
  }

  /** کارت ورق با آرت گوتیک: کارت‌های تصویری و آس، تصویر می‌گیرند */
  function cardFace(card, { compact = false } = {}) {
    const red = SUIT_IS_RED[card.suit];
    const artFor = { spades: 14, hearts: 13, clubs: 11, diamonds: 12 }[card.suit];
    const hasArt = !compact && [11, 12, 13, 14].includes(card.rank);
    const label = rankLabel(card.rank);

    return h('div', { class: 'playing-card', style: { width: compact ? '62px' : '100%' } },
      h('div', { class: 'playing-card__face', style: { borderColor: red ? '#c9a8a0' : '#cbb894' } },
        h('div', { class: 'playing-card__corner playing-card__corner--tl', style: { color: red ? '#a33d2c' : '#241d1a' } },
          h('span', {}, label), h('span', { class: 'playing-card__suit' }, SUIT_GLYPH[card.suit])),
        h('div', { class: 'playing-card__corner playing-card__corner--br', style: { color: red ? '#a33d2c' : '#241d1a' } },
          h('span', {}, label), h('span', { class: 'playing-card__suit' }, SUIT_GLYPH[card.suit])),
        hasArt
          ? h('div', { style: { position: 'absolute', inset: '14px 12px', overflow: 'hidden', border: '1px solid rgba(36,29,26,.2)' } },
              h('div', {
                style: {
                  width: '100%', height: '100%',
                  backgroundImage: 'url(/assets/art/persian-gold.jpg)',
                  backgroundSize: 'cover', backgroundPosition: 'center',
                  filter: `hue-rotate(${artFor * 17}deg) saturate(.72) contrast(1.05)`,
                  mixBlendMode: 'multiply'
                }
              }),
              h('div', {
                style: {
                  position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
                  fontSize: compact ? '1.1rem' : '1.9rem',
                  color: red ? '#7c2a1d' : '#241d1a',
                  textShadow: '0 1px 0 rgba(255,255,255,.5)'
                }
              }, label)
            )
          : h('div', { style: { position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: compact ? '1.3rem' : '2.2rem', color: red ? '#a33d2c' : '#241d1a' } },
              SUIT_GLYPH[card.suit])
      )
    );
  }

  function humanPlay(card) {
    try {
      const next = playCard(state.game, 0, card);
      const before = state.game.trick.length;
      state.game = next;
      playSound('card-deal');
      if (before === 3) {
        const winnerSeat = next.turn;
        const pts = next.history.at(-1)?.pts || 0;
        toast(`دور را ${winnerSeat === 0 ? 'تو' : winnerSeat === 2 ? 'شریکت' : next.names[winnerSeat]} برد (${toFa(pts)} امتیاز)`, 'ok');
      }
      render();
    } catch (e) { toast(e.message, 'warn'); }
  }

  function botMove() {
    const g = state.game;
    if (g.finished) return;
    const seat = g.turn;
    if (seat === 0) return;
    const hand = g.hands[seat];
    const partnerWinning = g.trick.length > 0 && teamOf(trickWinner(g.trick, g.trump)) === teamOf(seat);
    const card = botCard(hand, g.trickLead, g.trump, partnerWinning);
    try {
      const next = playCard(g, seat, card);
      state.game = next;
      playSound('card-deal');
      // موتور خودش دور کامل‌شده را پاک می‌کند؛ فقط دوباره رندر می‌کنیم
      render();
    } catch (e) {
      console.warn(e);
      // کارت جایگزین مجاز
      const fallback = hand.find(c => canPlay(hand, c, g.trickLead));
      if (fallback) { state.game = playCard(g, seat, fallback); render(); }
    }
  }

  function drawResult() {
    const g = state.game;
    const myTeamWon = g.winner === 'A';
    if (!state.recorded) {
      state.recorded = true;
      stats.record('hokm', { label: myTeamWon ? 'برد' : 'باخت', key: 'hokm-score', best: g.scores.A, higherIsBetter: true });
      playSound(myTeamWon ? 'win' : 'lose');
    }
    return h('div', {},
      gameHeader({ title: 'پایان دست', onBack: onExit }),
      sheet({ cls: 'stamp', children: h('div', { class: 'result-banner' },
        h('div', { style: { fontSize: '2rem' } }, myTeamWon ? '👑' : '🂠'),
        h('div', { class: 'result-banner__verdict' }, myTeamWon ? 'تیم تو برد' : 'تیم مقابل برد'),
        h('div', { class: 'result-banner__sub' }, `امتیاز ما ${toFa(g.scores.A)} — آنها ${toFa(g.scores.B)}`)
      ) }),
      h('div', { style: { display: 'grid', gap: '.5rem' } },
        btn('دست بعد', { variant: 'btn--primary btn--block', onClick: () => newGame(g.names, g.trump) }),
        btn('خروج', { variant: 'btn--ghost btn--block', onClick: onExit })
      )
    );
  }

  return () => { /* هیچ تایمر پاک‌نشده‌ای نیست */ };
}

void mount;
void strengthInTrump;
void cardPoints;
void SUIT_LABEL;
void callout;
void icon;
