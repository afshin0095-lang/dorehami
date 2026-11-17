/* ============================================================
   چیستان — تک‌نفره، نمایش سرنخ مرحله‌ای و پاسخ
   ============================================================ */

import { h, mount, playSound, stats, toFa, normalizeFa } from '../core.js';
import { RIDDLES } from '../content.js';
import { RIDDLES_EXTRA } from '../content-more.js';
import { gameHeader, sheet, btn, helpBlock, callout } from '../ui/kit.js';

const HELP = {
  steps: [
    'یک چیستان می‌بینی. می‌توانی مستقیم جواب بدهی یا اول سرنخ بخواهی.',
    'سرنخ گرفتن امتیاز را کم می‌کند: بدون سرنخ ۱۰، با یک سرنخ ۷ و با هر سرنخ بیشتر کمتر.',
    'جواب با نرمال‌سازی فارسی سنجیده می‌شود؛ «ي» و «ی» یکی هستند.',
    'اگر جواب را ندانستی، «دیدن جواب» امتیاز نمی‌دهد ولی چیستان را یاد می‌گیری.'
  ],
  example: 'چیستان: «چیست که سر دارد اما مو ندارد؟» — سرنخ: «در خیاطی» — جواب: سوزن.',
  note: 'کل چیستان‌ها آفلاین و درون برنامه‌اند.'
};

export function mountGame(root, { onExit }) {
  const bank = [...RIDDLES, ...RIDDLES_EXTRA];
  let state = { screen: 'setup', order: shuffleIdx(bank.length), index: 0, score: 0, hints: 0, revealed: false, input: '', verdict: null };

  const render = () => mount(root, draw());
  render();

  function draw() {
    if (state.screen === 'help') return drawHelp();
    if (state.screen === 'done') return drawDone();
    return drawRiddle();
  }

  function drawHelp() {
    return h('div', {},
      gameHeader({ title: 'راهنمای چیستان', onBack: () => { state.screen = 'play'; render(); } }),
      sheet({ title: 'قدم به قدم', iconName: 'book', children: helpBlock(HELP) }),
      btn('فهمیدم', { variant: 'btn--block', onClick: () => { state.screen = 'play'; render(); } })
    );
  }

  function drawRiddle() {
    const r = bank[state.order[state.index]];
    if (!r) { state.screen = 'done'; return drawDone(); }

    return h('div', {},
      gameHeader({ title: 'چیستان', onBack: onExit },
        h('span', { class: 'score-pill' }, `${toFa(state.index + 1)} / ${toFa(bank.length)}`)),

      sheet({ cls: 'sheet--lined', children: h('div', {},
        h('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '.76rem', opacity: .7, marginBottom: '.4rem' } },
          h('span', {}, 'معما'),
          h('span', { class: 'tnum' }, `امتیاز: ${toFa(state.score)}`)
        ),
        h('p', { style: { fontSize: '1.05rem', fontWeight: 700, lineHeight: 2, margin: '0 0 .6rem' } }, r.q),

        state.hints > 0 && !state.revealed
          ? h('div', { class: 'help-example' }, `سرنخ: ${r.hint}`)
          : null,

        !state.revealed
          ? h('div', {},
              h('input', {
                type: 'text', placeholder: 'جوابت را بنویس…', value: state.input,
                style: {
                  width: '100%', padding: '.65rem .7rem', font: 'inherit', fontSize: '.95rem',
                  border: 'none', borderBottom: '2px solid rgba(90,70,50,.4)', background: 'transparent', outline: 'none', marginBottom: '.6rem'
                },
                oninput: (e) => { state.input = e.target.value; },
                onkeydown: (e) => { if (e.key === 'Enter') check(); }
              }),
              h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.4rem' } },
                btn('بررسی جواب', { variant: 'btn--primary', onClick: check }),
                btn(state.hints === 0 ? 'یک سرنخ' : 'سرنخ بیشتر', {
                  onClick: () => { state.hints += 1; playSound('tap'); render(); }
                })
              )
            )
          : h('div', {},
              callout(`جواب: ${r.a}`, 'check'),
              h('div', { style: { display: 'grid', gap: '.4rem' } },
                btn('چیستان بعد', { variant: 'btn--primary btn--block', onClick: next }),
                btn('برگشت به فهرست', { variant: 'btn--ghost btn--block', onClick: onExit })
              )
            ),

        state.verdict === 'wrong'
          ? callout('نه، این جواب درست نیست. یک سرنخ بگیر یا دوباره فکر کن.', 'x')
          : null,
        state.verdict === 'right'
          ? callout(`آفرین! جواب «${r.a}» بود.`, 'check')
          : null
      ) }),

      !state.revealed
        ? btn('دیدن جواب (بدون امتیاز)', {
            variant: 'btn--ghost btn--block',
            onClick: () => { state.revealed = true; playSound('paper-flip'); render(); }
          })
        : null,

      h('div', { style: { display: 'flex', gap: '.5rem', justifyContent: 'center', marginTop: '.6rem' } },
        h('button', { class: 'btn btn--sm btn--ghost', onclick: () => { state.screen = 'help'; render(); } }, 'راهنما')
      )
    );
  }

  function check() {
    const r = bank[state.order[state.index]];
    const got = normalizeFa(state.input, { afToAlef: true });
    const want = normalizeFa(r.a, { afToAlef: true });
    const ok = got && (got === want || want.includes(got) && got.length > 2 || got.includes(want));
    if (ok) {
      const base = state.hints === 0 ? 10 : state.hints === 1 ? 7 : 4;
      state.score += base;
      state.verdict = 'right';
      state.revealed = true;
      playSound('win');
    } else {
      state.verdict = 'wrong';
      playSound('lose');
    }
    render();
  }

  function next() {
    state.index += 1;
    state.hints = 0;
    state.revealed = false;
    state.input = '';
    state.verdict = null;
    playSound('paper-flip');
    if (state.index >= bank.length) state.screen = 'done';
    render();
  }

  function drawDone() {
    if (!state.recorded) {
      state.recorded = true;
      stats.record('riddle', { label: `${toFa(state.score)} امتیاز`, key: 'riddle-best', best: state.score, higherIsBetter: true });
      playSound('win');
    }
    return h('div', {},
      gameHeader({ title: 'پایان چیستان', onBack: onExit }),
      sheet({ cls: 'stamp', children: h('div', { class: 'result-banner' },
        h('div', { style: { fontSize: '2rem' } }, '🕯️'),
        h('div', { class: 'result-banner__verdict' }, `${toFa(state.score)} امتیاز`),
        h('div', { class: 'result-banner__sub' }, `${toFa(bank.length)} چیستان را دیدی`)
      ) }),
      h('div', { style: { display: 'grid', gap: '.5rem' } },
        btn('شروع دوباره', { variant: 'btn--primary btn--block', onClick: () => { state = { screen: 'play', order: shuffleIdx(bank.length), index: 0, score: 0, hints: 0, revealed: false, input: '', verdict: null }; render(); } }),
        btn('بازگشت', { variant: 'btn--ghost btn--block', onClick: onExit })
      )
    );
  }

  return () => {};
}

function shuffleIdx(n) {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
