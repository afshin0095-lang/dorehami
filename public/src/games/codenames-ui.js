/* ============================================================
   اسم رمز (Codenames) — دو تیم، ۲۵ کارت، سرنخ و حدس
   نسخه‌ی یک گوشی با پرده‌ی حریم بین نوبت‌ها
   ============================================================ */

import { h, mount, playSound, toast, stats, toFa } from '../core.js';
import { CODENAMES_WORDS } from '../content.js';
import { createBoard, giveClue, guess, endTurn } from '../engines/codenames.js';
import { gameHeader, sheet, btn, helpBlock, callout, iconBtn } from '../ui/kit.js';

const HELP = {
  steps: [
    'دو تیم: سرخ و آبی. ۲۵ کارت واژه روی میز است. ۹ کارت مال تیم سرخ، ۸ کارت تیم آبی، ۷ کارت بی‌طرف و ۱ کارت قاتل.',
    'در هر تیم یک نفر «سرنخ‌دهنده» می‌شود. او نقشه‌ی کارت‌ها را می‌بیند و یک سرنخ یک‌کلمه‌ای با یک عدد می‌گوید؛ مثلاً «آتش — ۲» یعنی دو کارت روی میز با آتش مرتبط است.',
    'هم‌تیمی‌ها حدس می‌زنند. تا عدد+۱ حدس مجاز دارند. اگر کارت خودشان را بزنند، ادامه می‌دهند؛ اگر کارت حریف یا بی‌طرف را بزنند، نوبت عوض می‌شود.',
    'اگر کارت قاتل باز شود، تیمی که زده فوراً می‌بازد.',
    'تیمی که اول همه‌ی کارت‌هایش را پیدا کند، برنده است.'
  ],
  example: 'مثال: سرنخ «آتش — ۲». هم‌تیمی‌ها «زغال» و «کوره» را می‌زنند (کارت تیم خودشان) و بعد «دریا» را می‌زنند که کارت بی‌طرف است — نوبت به تیم حریف می‌رسد.',
  note: 'برای حفظ محرمانگی، نقشه‌ی کارت‌ها فقط در صفحه‌ی سرنخ‌دهنده و پشت پرده‌ی حریم نشان داده می‌شود.'
};

export function mountGame(root, { onExit }) {
  let state = { screen: 'setup' };

  const render = () => mount(root, draw());
  render();

  function draw() {
    switch (state.screen) {
      case 'setup': return drawSetup();
      case 'help': return drawHelp();
      case 'pass': return drawPass();
      case 'clue': return drawClue();
      case 'board': return drawBoardView();
      case 'result': return drawResult();
      default: return drawSetup();
    }
  }

  function drawSetup() {
    return h('div', {},
      gameHeader({ title: 'اسم رمز', onBack: onExit }),
      sheet({ title: 'چطور بازی می‌شود؟', iconName: 'book', children: h('div', {},
        h('p', { style: { margin: 0, fontSize: '.88rem' } }, 'دو تیم، یک گوشی. سرنخ‌دهنده نقشه را می‌بیند و یک کلمه می‌گوید؛ بقیه حدس می‌زنند.'),
        h('div', { style: { marginTop: '.7rem' } }, callout('۲۵ کارت، ۱ قاتل. مراقب باش!', 'skull'))
      ) }),
      h('div', { style: { display: 'grid', gap: '.5rem' } },
        btn('شروع بازی', {
          variant: 'btn--primary btn--block',
          onClick: () => {
            state.board = createBoard(CODENAMES_WORDS, 'red');
            state.screen = 'pass';
            state.role = 'clue';
            playSound('card-deal');
            render();
          }
        }),
        btn('راهنمای کامل', { variant: 'btn--ghost btn--block', onClick: () => { state.screen = 'help'; render(); } })
      )
    );
  }

  function drawHelp() {
    return h('div', {},
      gameHeader({ title: 'راهنمای اسم رمز', onBack: () => { state.screen = 'setup'; render(); } }),
      sheet({ title: 'قدم به قدم', iconName: 'book', children: helpBlock(HELP) }),
      btn('فهمیدم', { variant: 'btn--block', onClick: () => { state.screen = 'setup'; render(); } })
    );
  }

  /** پرده‌ی حریم بین نوبت‌ها */
  function drawPass() {
    const team = state.board.turn === 'red' ? 'سرخ' : 'آبی';
    return h('div', {},
      gameHeader({ title: 'اسم رمز', onBack: () => { if (confirm('از بازی خارج شوی؟')) onExit(); } }),
      h('div', { class: 'reveal-stage' },
        h('div', {
          class: 'private-card', style: { transform: 'none' },
          onclick: () => { playSound('paper-flip'); state.screen = state.role === 'clue' ? 'clue' : 'board'; render(); }
        },
          h('div', { class: 'private-card__face private-card__back', style: { position: 'relative', transform: 'none' } },
            h('div', { style: { fontSize: '.8rem', opacity: .8 } }, 'نوبت تیم'),
            h('div', { style: { fontSize: '1.5rem', fontWeight: 700, color: state.board.turn === 'red' ? '#ffbdb0' : '#b8d6f5' } }, team),
            h('div', { style: { fontSize: '.85rem', opacity: .9, lineHeight: 1.9 } },
              state.role === 'clue' ? 'فقط سرنخ‌دهنده گوشی را بگیرد.' : 'فقط تیم حدس‌زننده گوشی را بگیرد.',
              h('br'), 'برای ادامه لمس کن.'),
            h('div', { style: { fontSize: '.74rem', opacity: .6, marginTop: '.4rem' } },
              `کارت‌های باقی‌مانده — سرخ ${toFa(state.board.remaining.red)} · آبی ${toFa(state.board.remaining.blue)}`)
          )
        )
      ),
      callout('قبل از لمس، مطمئن شو تیم مقابل صفحه را نمی‌بیند.', 'help')
    );
  }

  /** نقشه‌ی سرنخ‌دهنده */
  function drawClue() {
    const b = state.board;
    let word = '';
    let count = 2;

    return h('div', {},
      gameHeader({ title: 'سرنخ‌دهنده', onBack: () => { state.screen = 'pass'; render(); } }),
      sheet({ title: 'یک سرنخ یک‌کلمه‌ای بده', iconName: 'spark', children: h('div', {},
        h('input', {
          type: 'text', placeholder: 'مثلاً: آتش', maxlength: '18',
          style: { width: '100%', padding: '.6rem .7rem', font: 'inherit', fontSize: '.95rem', border: '1px solid rgba(0,0,0,.2)', borderRadius: '2px', marginBottom: '.5rem' },
          oninput: (e) => { word = e.target.value; }
        }),
        h('div', { style: { display: 'flex', gap: '.35rem', justifyContent: 'center', flexWrap: 'wrap' } },
          ...[1, 2, 3, 4].map(n => h('button', {
            class: 'chip', 'aria-pressed': String(count === n),
            onclick: (e) => {
              count = n;
              [...e.currentTarget.parentElement.children].forEach((c, i) => c.setAttribute('aria-pressed', String(i + 1 === n)));
            }
          }, toFa(n)))
        ),
        h('div', { style: { marginTop: '.7rem' } },
          btn('ثبت سرنخ و پنهان‌کردن نقشه', {
            variant: 'btn--primary btn--block',
            onClick: () => {
              try {
                state.board = giveClue(b, { word, count, team: b.turn });
                state.role = 'guess';
                state.screen = 'pass';
                playSound('seal');
                render();
              } catch (e) { toast(e.message, 'warn'); }
            }
          })
        )
      ) }),
      sheet({ title: 'نقشه (محرمانه)', iconName: 'skull', children: h('div', {},
        h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '3px' } },
          ...b.cards.map(c => h('div', {
            style: {
              padding: '.45rem .2rem', fontSize: '.62rem', textAlign: 'center', lineHeight: 1.4,
              background: c.kind === 'red' ? 'rgba(163,61,44,.85)' : c.kind === 'blue' ? 'rgba(43,58,85,.85)' : c.kind === 'assassin' ? '#241d1a' : 'rgba(160,140,110,.6)',
              color: '#f8f1e0', fontWeight: 700
            }
          }, c.word))
        ),
        h('div', { style: { fontSize: '.72rem', opacity: .7, marginTop: '.4rem' } }, 'سرخ ۹ · آبی ۸ · بی‌طرف ۷ · قاتل ۱')
      ) })
    );
  }

  /** تخته‌ی حدس */
  function drawBoardView() {
    const b = state.board;
    if (b.winner) { state.screen = 'result'; return drawResult(); }

    return h('div', {},
      gameHeader({ title: `تیم ${b.turn === 'red' ? 'سرخ' : 'آبی'} حدس می‌زند`, onBack: () => { state.screen = 'pass'; render(); } },
        h('span', { class: 'score-pill' }, `${toFa(b.guessesLeft)} حدس`)),

      b.clue ? callout(`سرنخ: «${b.clue.word}» — ${toFa(b.clue.count)}`, 'spark') : null,

      sheet({ children: h('div', {},
        h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px' } },
          ...b.cards.map(c => h('button', {
            disabled: c.revealed,
            style: {
              aspectRatio: '1', padding: '.2rem', fontSize: '.6rem', lineHeight: 1.35, fontWeight: 700,
              border: 'none', cursor: c.revealed ? 'default' : 'pointer',
              background: c.revealed
                ? (c.kind === 'red' ? 'rgba(163,61,44,.88)' : c.kind === 'blue' ? 'rgba(43,58,85,.88)' : c.kind === 'assassin' ? '#241d1a' : 'rgba(150,130,100,.7)')
                : 'var(--paper-hi)',
              color: c.revealed ? '#f8f1e0' : 'var(--ink)',
              boxShadow: c.revealed ? 'none' : 'var(--lift-1)',
              opacity: c.revealed ? .95 : 1
            },
            onclick: () => {
              try {
                state.board = guess(b, c.id);
                playSound(c.kind === 'assassin' ? 'lose' : 'tap');
                if (c.kind === 'assassin') toast('قاتل باز شد!', 'warn');
                render();
              } catch (e) { toast(e.message, 'warn'); }
            }
          }, c.word))
        )
      ) }),

      h('div', { class: 'score-row', style: { marginBottom: '.5rem' } },
        h('span', { class: 'score-pill' }, `سرخ: ${toFa(b.remaining.red)}`),
        h('span', { class: 'score-pill' }, `آبی: ${toFa(b.remaining.blue)}`)
      ),

      h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.5rem' } },
        btn('پایان نوبت', {
          variant: 'btn--ghost',
          onClick: () => { state.board = endTurn(b); state.role = 'clue'; state.screen = 'pass'; playSound('paper-flip'); render(); }
        }),
        btn('قانون‌ها', { variant: 'btn--ghost', onClick: () => { state.screen = 'help'; render(); } })
      )
    );
  }

  function drawResult() {
    const b = state.board;
    if (!state.recorded) {
      state.recorded = true;
      stats.record('codenames', { label: b.winner === 'red' ? 'برد سرخ' : 'برد آبی' });
      playSound('win');
    }
    return h('div', {},
      gameHeader({ title: 'پایان اسم رمز', onBack: onExit }),
      sheet({ cls: 'stamp', children: h('div', { class: 'result-banner' },
        h('div', { style: { fontSize: '2rem' } }, b.endReason === 'assassin' ? '💀' : '🏆'),
        h('div', { class: 'result-banner__verdict' }, b.winner === 'red' ? 'تیم سرخ برد' : 'تیم آبی برد'),
        h('div', { class: 'result-banner__sub' }, b.endReason === 'assassin' ? 'قاتل باز شد' : 'همه‌ی کارت‌ها پیدا شد')
      ) }),
      sheet({ title: 'نقشه‌ی کامل', iconName: 'skull', children: h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '3px' } },
        ...b.cards.map(c => h('div', {
          style: {
            padding: '.45rem .2rem', fontSize: '.6rem', textAlign: 'center', color: '#f8f1e0', fontWeight: 700,
            background: c.kind === 'red' ? 'rgba(163,61,44,.9)' : c.kind === 'blue' ? 'rgba(43,58,85,.9)' : c.kind === 'assassin' ? '#241d1a' : 'rgba(150,130,100,.75)'
          }
        }, c.word))
      ) }),
      h('div', { style: { display: 'grid', gap: '.5rem' } },
        btn('دوباره', { variant: 'btn--primary btn--block', onClick: () => { state = { screen: 'setup' }; render(); } }),
        btn('خروج', { variant: 'btn--ghost btn--block', onClick: onExit })
      )
    );
  }

  return () => {};
}

void iconBtn;
