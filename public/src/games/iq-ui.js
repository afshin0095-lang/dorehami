/* ============================================================
   تست هوش — منطق، الگو، استدلال
   ============================================================ */

import { h, mount, playSound, stats, toFa } from '../core.js';
import { IQ_ITEMS } from '../content.js';
import { IQ_EXTRA } from '../content-more.js';
import { gameHeader, sheet, btn, helpBlock, callout } from '../ui/kit.js';

const HELP = {
  steps: [
    'هر سؤال یک تست منطقی است: الگوی عددی، تمایز، یا استدلال.',
    'گزینه را انتخاب کن؛ بعد پاسخ درست و توضیح کوتاه می‌آید.',
    '۸ سؤال در هر بازی می‌آید و در پایان نتیجه و مرور نشان داده می‌شود.'
  ],
  example: 'الگو: ۱، ۴، ۹، ۱۶ — این‌ها مربع کامل‌اند، پس عدد بعد ۲۵ است.',
  note: 'این تست سنجش هوش بالینی نیست؛ یک بازی فکری برای گرم‌کردن ذهن است.'
};

export function mountGame(root, { onExit }) {
  const bank = [...IQ_ITEMS, ...IQ_EXTRA];
  let state = { screen: 'setup', index: 0, answers: [], picked: null };

  const render = () => mount(root, draw());
  render();

  function draw() {
    if (state.screen === 'help') return drawHelp();
    if (state.screen === 'done') return drawDone();
    return drawQuestion();
  }

  function drawHelp() {
    return h('div', {},
      gameHeader({ title: 'راهنمای تست هوش', onBack: () => { state.screen = 'play'; render(); } }),
      sheet({ title: 'قدم به قدم', iconName: 'book', children: helpBlock(HELP) }),
      btn('فهمیدم', { variant: 'btn--block', onClick: () => { state.screen = 'play'; render(); } })
    );
  }

  function drawQuestion() {
    const q = bank[state.index];
    if (!q) { state.screen = 'done'; return drawDone(); }
    const show = state.picked !== null;

    return h('div', {},
      gameHeader({ title: 'تست هوش', onBack: onExit },
        h('span', { class: 'score-pill' }, `${toFa(state.index + 1)} / ${toFa(bank.length)}`)),

      sheet({ cls: 'sheet--lined', title: 'سؤال', iconName: 'spark', children: h('div', {},
        h('p', { style: { fontSize: '1rem', fontWeight: 700, lineHeight: 2, marginTop: 0 } }, q.q),
        h('div', { style: { display: 'grid', gap: '.45rem' } },
          ...q.a.map((opt, i) => {
            const isCorrect = show && i === q.correct;
            const isWrong = show && i === state.picked && i !== q.correct;
            return h('button', {
              class: 'btn btn--block',
              style: {
                justifyContent: 'flex-start',
                ...(isCorrect ? { background: 'var(--teal)', color: '#f4fbf8' } : {}),
                ...(isWrong ? { background: 'var(--rust)', color: '#fff' } : {})
              },
              disabled: show,
              onclick: () => pick(i)
            }, `${toFa(i + 1)}. ${opt}`);
          })
        ),
        show && q.note ? h('div', { style: { marginTop: '.6rem' } }, callout(q.note, 'help')) : null
      ) }),

      show
        ? btn(state.index + 1 >= bank.length ? 'دیدن نتیجه' : 'سؤال بعد', {
            variant: 'btn--primary btn--block',
            onClick: () => { state.picked = null; state.index += 1; if (state.index >= bank.length) state.screen = 'done'; playSound('paper-flip'); render(); }
          })
        : btn('راهنما', { variant: 'btn--ghost btn--block', onClick: () => { state.screen = 'help'; render(); } })
    );
  }

  function pick(i) {
    const q = bank[state.index];
    state.picked = i;
    state.answers = [...state.answers, { correct: i === q.correct, q: q.q }];
    playSound(i === q.correct ? 'win' : 'lose');
    render();
  }

  function drawDone() {
    const correct = state.answers.filter(a => a.correct).length;
    const pct = Math.round((correct / bank.length) * 100);
    if (!state.recorded) {
      state.recorded = true;
      stats.record('iq', { label: `${toFa(correct)} از ${toFa(bank.length)}`, key: 'iq-best', best: correct, higherIsBetter: true });
      playSound('win');
    }
    return h('div', {},
      gameHeader({ title: 'نتیجه‌ی تست', onBack: onExit }),
      sheet({ cls: 'stamp', children: h('div', { class: 'result-banner' },
        h('div', { style: { fontSize: '2rem' } }, pct >= 70 ? '🧠' : '📘'),
        h('div', { class: 'result-banner__verdict' }, `${toFa(correct)} از ${toFa(bank.length)} درست`),
        h('div', { class: 'result-banner__sub' }, `${toFa(pct)}٪`)
      ) }),
      sheet({ title: 'مرور', iconName: 'book', children: h('div', { style: { display: 'grid', gap: '.35rem', fontSize: '.82rem' } },
        ...state.answers.map(a => h('div', { style: { display: 'flex', gap: '.4rem' } },
          h('span', { style: { color: a.correct ? 'var(--teal)' : 'var(--rust)', fontWeight: 700 } }, a.correct ? '✓' : '✕'),
          h('span', {}, a.q)
        ))
      ) }),
      h('div', { style: { display: 'grid', gap: '.5rem' } },
        btn('دوباره', { variant: 'btn--primary btn--block', onClick: () => { state = { screen: 'play', index: 0, answers: [], picked: null }; render(); } }),
        btn('بازگشت', { variant: 'btn--ghost btn--block', onClick: onExit })
      )
    );
  }

  return () => {};
}
