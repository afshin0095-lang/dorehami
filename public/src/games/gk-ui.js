/* ============================================================
   «تست اطلاعات عمومی» — رابط
   مرحلهٔ انتخاب: ادامهٔ پیشرفت قبلی یا شروع تازه.
   سپس ۱۰ سؤال با ایموجی، پاسخ درست و توضیح.
   ============================================================ */

import { h, mount, playSound, stats, toFa, store } from '../core.js';
import {
  GK_CATEGORIES, QUESTIONS_PER_ROUND, RULES, bankSize, categoryCounts,
  createGkGame, currentQuestion, answer, next, isOver,
  correctCount, accuracy, scoreOf, gradeOf, progressOf, mergeProgress
} from '../engines/gk.js';
import { gameHeader, sheet, btn, helpBlock, callout } from '../ui/kit.js';

const PROGRESS_KEY = 'gk-progress';   // کلید پایدار ذخیره‌سازی

export function mountGame(root, { onExit } = {}) {
  let screen = 'intro';        // intro | play | done | help
  let cat = 'all';
  let game = null;
  let msg = '';
  let mounted = true;

  const progress = () => {
    const p = store.get(PROGRESS_KEY, null);
    return p && typeof p === 'object' ? p : null;
  };
  const seenSet = () => new Set((progress()?.seen) || []);

  const render = () => mount(root, draw());
  render();

  function draw() {
    if (screen === 'help') return drawHelp();
    if (screen === 'play') return drawPlay();
    if (screen === 'done') return drawDone();
    return drawIntro();
  }

  /* ------------------------------ شروع ------------------------------ */

  function startFresh() {
    game = createGkGame({
      seed: (Date.now() ^ Math.random() * 1e9) >>> 0,
      cat,
      count: QUESTIONS_PER_ROUND,
      skip: seenSet()
    });
    msg = '';
    screen = 'play';
    playSound('paper-flip');
    render();
  }

  function startContinue() {
    // ادامه = سؤال‌هایی که قبلاً دیده نشده‌اند
    game = createGkGame({
      seed: (Date.now() ^ 0x51ed) >>> 0,
      cat,
      count: QUESTIONS_PER_ROUND,
      skip: seenSet()
    });
    msg = '';
    screen = 'play';
    playSound('card-deal');
    render();
  }

  /* ------------------------------ مقدمه ------------------------------ */

  function drawIntro() {
    const p = progress();
    const counts = categoryCounts();
    const seen = (p?.seen || []).length;
    const total = bankSize();

    return h('div', {},
      gameHeader({ title: 'تست اطلاعات عمومی', onBack: onExit }),

      h('section', { class: 'gk-hero print-edge' },
        h('div', { class: 'gk-hero__frame', 'aria-hidden': 'true' }, h('span', {}, '🌍')),
        h('div', { class: 'gk-hero__text' },
          h('div', { class: 'gk-hero__kicker' }, `${toFa(total)} سؤال · ${toFa(GK_CATEGORIES.length - 1)} دسته`),
          h('h1', {}, 'جهان در یک جعبهٔ کاغذی'),
          h('p', {}, 'جغرافیا، تاریخ، علوم، سینما، ادبیات، ورزش و بیشتر — هر دور ده سؤال تازه.')
        )
      ),

      p && p.totalAnswered
        ? sheet({ title: 'کارنامهٔ تو', iconName: 'chart', children: h('div', { class: 'gk-progress' },
            h('div', { class: 'gk-progress__row' },
              stat('پاسخ‌داده', toFa(p.totalAnswered)),
              stat('درست', toFa(p.totalCorrect)),
              stat('بهترین زنجیره', toFa(p.bestStreak || 0))
            ),
            h('div', { class: 'gk-progress__bar', role: 'img', 'aria-label': `دیده‌شده ${seen} از ${total}` },
              h('span', { class: 'gk-progress__fill', style: `width:${Math.min(100, Math.round((seen / total) * 100))}%` })
            ),
            h('div', { class: 'gk-progress__note' },
              `${toFa(seen)} از ${toFa(total)} سؤال را دیده‌ای — ادامه بدهی، سؤال تازه می‌آید.`)
          ) })
        : null,

      sheet({ title: 'دسته', iconName: 'book', children: h('div', { class: 'gk-cats' },
        ...GK_CATEGORIES.map(c => {
          const n = c.id === 'all' ? total : (counts[c.id] || 0);
          return h('button', {
            class: `gk-cat${cat === c.id ? ' is-on' : ''}`,
            'aria-pressed': String(cat === c.id),
            disabled: n === 0 && c.id !== 'all',
            onclick: () => { cat = c.id; playSound('tap'); render(); }
          },
            h('span', { class: 'gk-cat__glyph', 'aria-hidden': 'true' }, c.glyph),
            h('span', { class: 'gk-cat__label' }, c.label),
            h('span', { class: 'gk-cat__count' }, toFa(n))
          );
        })
      ) }),

      h('div', { class: 'gk-start' },
        p && p.totalAnswered
          ? btn('ادامه بده', { variant: 'btn--primary btn--block', onClick: startContinue })
          : null,
        btn(p && p.totalAnswered ? 'شروع تازه' : 'شروع بازی', {
          variant: p && p.totalAnswered ? 'btn--teal btn--block' : 'btn--primary btn--block',
          onClick: startFresh
        }),
        btn('راهنما', { onClick: () => { screen = 'help'; render(); } })
      ),

      msg ? h('div', { class: 'gk-msg' }, msg) : null
    );
  }

  function stat(label, value) {
    return h('div', { class: 'gk-stat' },
      h('span', { class: 'gk-stat__val' }, value),
      h('span', { class: 'gk-stat__label' }, label)
    );
  }

  function drawHelp() {
    return h('div', {},
      gameHeader({ title: 'راهنمای تست', onBack: () => { screen = 'intro'; render(); } }),
      sheet({ title: 'قواعد', iconName: 'book', children: helpBlock(RULES) }),
      h('div', { class: 'stack' },
        btn('فهمیدم', { variant: 'btn--primary btn--block', onClick: () => { screen = 'intro'; render(); } })
      )
    );
  }

  /* ------------------------------ بازی ------------------------------ */

  function drawPlay() {
    if (!game) return drawIntro();
    const q = currentQuestion(game);
    if (!q) return drawDone();
    const answered = game.picked !== null;

    return h('div', {},
      gameHeader({
        title: q.cat || 'اطلاعات عمومی',
        onBack: () => { screen = 'intro'; render(); },
        children: [
          h('span', { class: 'score-pill' }, `${toFa(game.index + 1)}/${toFa(game.round.length)}`),
          h('span', { class: 'score-pill' }, `✓ ${toFa(correctCount(game))}`),
          game.streak >= 2 ? h('span', { class: 'score-pill gk-streak' }, `🔥 ${toFa(game.streak)}`) : null
        ].filter(Boolean)
      }),

      h('div', { class: 'gk-dots', 'aria-hidden': 'true' },
        ...game.round.map((_, i) => {
          const a = game.answers[i];
          return h('span', {
            class: `gk-dot${a ? (a.correct ? ' is-ok' : ' is-bad') : ''}${i === game.index ? ' is-now' : ''}`
          });
        })
      ),

      sheet({ cls: 'sheet--lined gk-card', title: 'سؤال', iconName: 'spark', children: h('div', {},
        h('p', { class: 'gk-q' }, q.q),
        h('div', { class: 'gk-opts' },
          ...q.a.map((opt, i) => {
            const isCorrect = answered && i === q.c;
            const isWrong = answered && i === game.picked && i !== q.c;
            return h('button', {
              class: `gk-opt${isCorrect ? ' is-ok' : ''}${isWrong ? ' is-bad' : ''}`,
              disabled: answered,
              'aria-label': `گزینهٔ ${i + 1}: ${opt}`,
              onclick: () => pick(i)
            },
              h('span', { class: 'gk-opt__key' }, toFa(i + 1)),
              h('span', { class: 'gk-opt__text' }, opt),
              isCorrect ? h('span', { class: 'gk-opt__mark', 'aria-hidden': 'true' }, '✓') : null,
              isWrong ? h('span', { class: 'gk-opt__mark', 'aria-hidden': 'true' }, '✕') : null
            );
          })
        ),
        answered && q.note ? h('div', { class: 'gk-note' }, callout(q.note, 'help')) : null
      ) }),

      answered
        ? btn(game.index + 1 >= game.round.length ? 'دیدن کارنامه' : 'سؤال بعد', {
            variant: 'btn--primary btn--block',
            onClick: goNext
          })
        : h('p', { class: 'gk-hint' }, 'یک گزینه را انتخاب کن.')
    );
  }

  function pick(i) {
    const r = answer(game, i);
    if (!r.ok) { msg = r.error; render(); return; }
    game = r.game;
    playSound(r.correct ? 'win' : 'lose');
    render();
  }

  function goNext() {
    const r = next(game);
    if (!r.ok) { msg = r.error; render(); return; }
    game = r.game;
    playSound('paper-flip');
    if (isOver(game)) { finish(); return; }
    render();
  }

  function finish() {
    if (!game || game._recorded) return;
    game._recorded = true;

    // پیشرفت را ادغام و ذخیره کن
    const merged = mergeProgress(progress(), game);
    store.set(PROGRESS_KEY, merged);

    stats.record('gk', {
      key: 'gk-best', best: correctCount(game), higherIsBetter: true,
      label: `${toFa(correctCount(game))} از ${toFa(game.round.length)}`
    });
    playSound(game.bestStreak >= 3 ? 'seal' : 'paper-flip');
    screen = 'done';
    render();
  }

  /* ------------------------------ پایان ------------------------------ */

  function drawDone() {
    if (!game) return drawIntro();
    const g = gradeOf(game);
    const done = correctCount(game);

    return h('div', {},
      gameHeader({ title: 'کارنامه', onBack: onExit }),

      h('section', { class: 'gk-result print-edge' },
        h('div', { class: 'gk-result__seal', 'aria-hidden': 'true' }, g.glyph),
        h('div', { class: 'gk-result__grade' }, g.label),
        h('div', { class: 'gk-result__score' }, `${toFa(done)} از ${toFa(game.round.length)}`),
        h('div', { class: 'gk-result__pct' }, `${toFa(accuracy(game))}٪ درست`),
        h('div', { class: 'gk-result__meta' },
          h('span', {}, `امتیاز ${toFa(scoreOf(game))}`),
          h('span', {}, `بهترین زنجیره ${toFa(game.bestStreak)}`)
        )
      ),

      sheet({ title: 'مرور سؤال‌ها', iconName: 'book', children: h('div', { class: 'gk-review' },
        ...game.answers.map((a, i) => h('div', { class: `gk-review__row${a.correct ? ' is-ok' : ' is-bad'}` },
          h('span', { class: 'gk-review__mark', 'aria-hidden': 'true' }, a.correct ? '✓' : '✕'),
          h('div', { class: 'gk-review__body' },
            h('span', { class: 'gk-review__q' }, `${toFa(i + 1)}. ${a.q}`),
            h('span', { class: 'gk-review__a' }, `پاسخ: ${a.answer}`),
            a.note ? h('span', { class: 'gk-review__note' }, a.note) : null
          )
        ))
      ) }),

      h('div', { class: 'gk-start' },
        btn('دور تازه', { variant: 'btn--primary btn--block', onClick: startContinue }),
        btn('انتخاب دسته', { onClick: () => { screen = 'intro'; render(); } }),
        btn('بازگشت', { variant: 'btn--ghost btn--block', onClick: onExit })
      )
    );
  }

  return () => { mounted = false; game = null; };
}
