/* ============================================================
   کوییز — تکی و دوئل دونفره
   ============================================================ */

import { h, mount, playSound, stats, toFa, toast } from '../core.js';
import { buildQuiz, buildDuel, answer, answerDuel, currentQuestion, scoreOf } from '../engines/quiz.js';
import { gameHeader, sheet, btn, helpBlock, callout } from '../ui/kit.js';
/**
 * بانک کوییز مسابقه‌ای: ۱۴۳ سؤال دست‌ساز در ۱۲ دسته.
 * سؤال‌ها از جنس پرسش‌های مسابقات واقعی‌اند — پاسخ دانستنی است،
 * یادداشت زمینه می‌دهد، و هیچ سؤالی تکرار دیگری نیست.
 */
import { QUIZ_BANK_PRO } from '../content/quiz-pro.js';

const HELP = {
  steps: [
    'در حالت تکی، ۸ سؤال از بانک سؤال‌ها می‌آید. هر سؤال چهار گزینه دارد و فقط یکی درست است.',
    'بعد از انتخاب گزینه، پاسخ درست و یک توضیح کوتاه نشان داده می‌شود.',
    'در حالت دوئل، سؤال‌ها نوبتی بین دو نفر تقسیم می‌شوند و هر پاسخ درست یک امتیاز دارد.',
    'در پایان، نتیجه و مرور پاسخ‌های اشتباه نمایش داده می‌شود.'
  ],
  example: 'مثال: «بلندترین رود ایران کدام است؟» جواب «کارون» است — با یادداشت کوتاهی درباره‌ی طول آن.',
  note: 'همه‌ی سؤال‌ها درون برنامه هستند و آفلاین کار می‌کنند.'
};

export function mountGame(root, { onExit }) {
  const bank = QUIZ_BANK_PRO;
  const cats = ['همه', ...new Set(bank.map(q => q.cat).filter(Boolean))];
  let state = { screen: 'setup', mode: 'solo', count: 12, cat: null };

  const render = () => mount(root, draw());
  render();

  function draw() {
    switch (state.screen) {
      case 'setup': return drawSetup();
      case 'help': return drawHelp();
      case 'play': return drawPlay();
      case 'result': return drawResult();
      default: return drawSetup();
    }
  }

  function drawSetup() {
    return h('div', {},
      gameHeader({ title: 'کوییز', onBack: onExit }),
      sheet({ title: 'حالت بازی', iconName: 'users', children: h('div', { style: { display: 'grid', gap: '.45rem' } },
        ...[['solo', 'تکی — فقط خودم'], ['duel', 'دوئل — دو نفر نوبتی']].map(([id, label]) => h('button', {
          class: 'btn btn--block',
          style: state.mode === id ? { background: 'var(--teal)', color: '#f4fbf8' } : {},
          onclick: () => { state.mode = id; playSound('tap'); render(); }
        }, label))
      ) }),
      sheet({ title: 'دسته‌ی سؤال', iconName: 'spark', children: h('div', { class: 'chips', style: { flexWrap: 'wrap' } },
        ...cats.map(c => h('button', {
          class: 'chip', 'aria-pressed': String(state.cat === c || (c === 'همه' && !state.cat)),
          onclick: () => { state.cat = c === 'همه' ? null : c; playSound('tap'); render(); }
        }, c))
      ) }),
      sheet({ title: 'تعداد سؤال', iconName: 'clock', children: h('div', { style: { display: 'flex', gap: '.4rem', justifyContent: 'center' } },
        ...[8, 12, 20, 30].map(n => h('button', {
          class: 'chip', 'aria-pressed': String(state.count === n),
          onclick: () => { state.count = n; playSound('tap'); render(); }
        }, toFa(n)))
      ) }),
      h('div', { style: { display: 'grid', gap: '.5rem' } },
        btn('شروع', { variant: 'btn--primary btn--block', onClick: start }),
        btn('راهنما', { variant: 'btn--ghost btn--block', onClick: () => { state.screen = 'help'; render(); } })
      ),
      h('p', { style: { textAlign: 'center', color: '#e8dcc4', fontSize: '.76rem', marginTop: '.8rem' } },
        `${toFa(bank.length)} سؤال در بانک`)
    );
  }

  function drawHelp() {
    return h('div', {},
      gameHeader({ title: 'راهنمای کوییز', onBack: () => { state.screen = 'setup'; render(); } }),
      sheet({ title: 'قدم به قدم', iconName: 'book', children: helpBlock(HELP) }),
      btn('فهمیدم', { variant: 'btn--block', onClick: () => { state.screen = 'setup'; render(); } })
    );
  }

  function start() {
    state.quiz = state.mode === 'duel'
      ? buildDuel({ count: state.count })
      : buildQuiz({ count: state.count, cat: state.cat, bank });
    state.screen = 'play';
    state.picked = null;
    playSound('card-deal');
    render();
  }

  function drawPlay() {
    const qz = state.quiz;
    const q = currentQuestion(qz);
    if (!q) { state.screen = 'result'; return drawResult(); }

    const picked = state.picked;
    const showResult = picked !== null;
    const correctIdx = q.answerIndex;

    return h('div', {},
      gameHeader({ title: state.mode === 'duel' ? 'دوئل کوییز' : 'کوییز', onBack: () => { if (confirm('از کوییز خارج شوی؟')) onExit(); } },
        h('span', { class: 'score-pill' }, `${toFa(qz.index + 1)} / ${toFa(qz.questions.length)}`)),

      state.mode === 'duel'
        ? h('div', { class: 'score-row', style: { marginBottom: '.5rem' } },
            ...qz.players.map(p => h('span', { class: `score-pill ${p.id === qz.turn && !showResult ? 'score-pill--active' : ''}` },
              p.name, ': ', toFa(p.score)))
          )
        : null,

      sheet({ cls: 'sheet--lined', title: q.cat || 'سؤال', iconName: 'spark', children: h('div', {},
        h('p', { style: { fontSize: '1rem', fontWeight: 700, lineHeight: 1.9, marginTop: 0 } }, q.q),
        h('div', { style: { display: 'grid', gap: '.45rem', marginTop: '.4rem' } },
          ...q.options.map((opt, i) => {
            const isCorrect = showResult && i === correctIdx;
            const isWrongPick = showResult && i === picked && picked !== correctIdx;
            return h('button', {
              class: 'btn btn--block',
              style: {
                justifyContent: 'flex-start', textAlign: 'right',
                ...(isCorrect ? { background: 'var(--teal)', color: '#f4fbf8' } : {}),
                ...(isWrongPick ? { background: 'var(--rust)', color: '#fff' } : {})
              },
              disabled: showResult,
              onclick: () => select(i)
            }, `${toFa(i + 1)}. ${opt}`);
          })
        ),
        showResult ? h('div', { style: { marginTop: '.7rem' } },
          callout(picked === correctIdx ? 'درست بود!' : `پاسخ درست: ${q.options[correctIdx]}`, picked === correctIdx ? 'check' : 'x'),
          q.note ? h('p', { style: { fontSize: '.84rem', marginBottom: 0 } }, q.note) : null
        ) : null
      ) }),

      showResult
        ? btn(qz.index + 1 >= qz.questions.length ? 'دیدن نتیجه' : 'سؤال بعد', {
            variant: 'btn--primary btn--block',
            onClick: advance
          })
        : callout(state.mode === 'duel' ? `نوبت ${qz.players[qz.turn].name}` : 'یک گزینه را انتخاب کن', 'users')
    );
  }

  /**
   * انتخاب گزینه: فقط «قفل» می‌شود و نتیجه را روی همان سؤال نشان می‌دهد.
   * رفتن به سؤال بعد در advance() انجام می‌شود — اگر اینجا جلو می‌رفتیم،
   * ایندکس انتخاب‌شده با پاسخ درستِ سؤال بعدی مقایسه می‌شد و پاسخ
   * درست هم «غلط» نمایش داده می‌شد.
   */
  function select(i) {
    if (state.picked !== null) return;
    state.picked = i;
    const correct = i === currentQuestion(state.quiz).answerIndex;
    playSound(correct ? 'win' : 'lose');
    render();
  }

  /** ثبت پاسخ در موتور و رفتن به سؤال بعد */
  function advance() {
    const qz = state.quiz;
    const i = state.picked;
    if (i === null) return;
    state.quiz = state.mode === 'duel' ? answerDuel(qz, i) : answer(qz, i);
    state.picked = null;
    if (state.quiz.finished || state.quiz.index >= state.quiz.questions.length) state.screen = 'result';
    playSound('paper-flip');
    render();
  }

  function drawResult() {
    const qz = state.quiz;
    if (!state.recorded) {
      state.recorded = true;
      if (state.mode === 'duel') {
        const [a, b] = qz.players;
        const label = a.score === b.score ? 'مساوی' : a.score > b.score ? `${a.name} برد` : `${b.name} برد`;
        stats.record('quiz', { label, key: 'quiz-best', best: Math.max(a.score, b.score), higherIsBetter: true });
        playSound(a.score === b.score ? 'tap' : 'win');
        state.duelLabel = label;
      } else {
        const sc = scoreOf(qz);
        stats.record('quiz', { label: `${toFa(sc)} از ${toFa(qz.questions.length)}`, key: 'quiz-best', best: sc, higherIsBetter: true });
        playSound(sc > qz.questions.length / 2 ? 'win' : 'lose');
      }
    }

    const correct = qz.answers.filter(a => a.correct).length;
    const total = qz.questions.length;

    return h('div', {},
      gameHeader({ title: 'نتیجه', onBack: onExit }),
      sheet({ cls: 'stamp', children: h('div', { class: 'result-banner' },
        h('div', { style: { fontSize: '2rem' } }, state.mode === 'duel' ? '⚔️' : correct / total >= 0.7 ? '🏅' : '📚'),
        h('div', { class: 'result-banner__verdict' },
          state.mode === 'duel' ? state.duelLabel : `${toFa(correct)} از ${toFa(total)}`),
        h('div', { class: 'result-banner__sub' }, state.mode === 'duel'
          ? qz.players.map(p => `${p.name}: ${toFa(p.score)}`).join(' · ')
          : 'هر پاسخ درست یک قدم جلوتر')
      ) }),

      sheet({ title: 'مرور پاسخ‌ها', iconName: 'book', children: h('div', { style: { display: 'grid', gap: '.4rem', fontSize: '.82rem' } },
        ...qz.answers.map(a => h('div', { style: { display: 'flex', gap: '.4rem', alignItems: 'flex-start', opacity: a.correct ? 1 : .85 } },
          h('span', { style: { color: a.correct ? 'var(--teal)' : 'var(--rust)', fontWeight: 700 } }, a.correct ? '✓' : '✕'),
          h('span', {}, a.q)
        ))
      ) }),

      h('div', { style: { display: 'grid', gap: '.5rem' } },
        btn('بازی دوباره', { variant: 'btn--primary btn--block', onClick: () => { state = { screen: 'setup', mode: state.mode, count: state.count, cat: state.cat }; render(); } }),
        btn('بازگشت', { variant: 'btn--ghost btn--block', onClick: onExit })
      )
    );
  }

  return () => {};
}

void toast;
