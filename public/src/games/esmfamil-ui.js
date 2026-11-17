/* ============================================================
   اسم و فامیل — برگه‌ی خط‌دار پانچ‌شده، بهینه‌شده برای موبایل
   ============================================================ */

import { h, mount, playSound, toast, stats, fmtTime, toFa, normalizeFa, firstLetter } from '../core.js';
import { ESF_CATEGORIES, ESF_LETTERS, ESF_HINTS } from '../content.js';
import { createRound, nextLetter, scoreRound, pickCategories } from '../engines/esmfamil.js';
import { gameHeader, sheet, btn, icon, helpBlock, callout } from '../ui/kit.js';

const HELP = {
  steps: [
    'تعداد بازیکن‌ها را انتخاب کن. هرکس یک برگه‌ی خط‌دار دارد — در این نسخه، برگه روی خود گوشی است.',
    'برنامه یک حرف تصادفی و چند دسته (اسم، فامیل، شهر…) نشان می‌دهد.',
    'زمان شروع می‌شود. هرکس برای هر دسته یک پاسخ با همان حرف می‌نویسد. گوشی دست‌به‌دست می‌شود.',
    'وقتی زمان تمام شد، برنامه پاسخ‌ها را امتیاز می‌دهد: پاسخ یکتا ۱۰، تکراری ۵، خالی یا با حرف اشتباه ۰.',
    'اختلاف‌ها را جمع داوری می‌کند؛ برنامه فقط امتیاز می‌دهد و داور نهایی نیست.'
  ],
  example: 'مثال: حرف «س». دسته‌ی شهر: سارا «ساوه» می‌نویسد (۱۰ امتیاز)، رضا هم «ساوه» می‌نویسد (۵ امتیاز)، نگار «تهران» می‌نویسد (۰ چون حرفش «ت» است).',
  note: 'نرمال‌سازی خودکار: «ي/ی» و «ك/ک» یکی حساب می‌شوند، «آ» با «ا» هم‌ارز است و اعراب نادیده گرفته می‌شود.'
};

export function mountGame(root, { onExit }) {
  let state = { screen: 'setup', playerCount: 2, seconds: 90, catCount: 5, usedLetters: [], roundNo: 0 };

  const render = () => mount(root, draw());
  render();

  function draw() {
    switch (state.screen) {
      case 'setup': return drawSetup();
      case 'help': return drawHelp();
      case 'play': return drawPlay();
      case 'score': return drawScore();
      case 'result': return drawResult();
      default: return drawSetup();
    }
  }

  /* ------------------------------ آماده‌سازی ------------------------------ */
  function drawSetup() {
    const counter = (value, onChange, min, max) => h('div', { style: { display: 'flex', alignItems: 'center', gap: '.6rem', justifyContent: 'center' } },
      h('button', { class: 'btn', style: { width: '44px', padding: '.4rem 0' }, onclick: () => { playSound('tap'); onChange(Math.max(min, value - 1)); } }, '−'),
      h('div', { style: { fontSize: '1.25rem', fontWeight: 700, minWidth: '56px', textAlign: 'center' } }, toFa(value)),
      h('button', { class: 'btn', style: { width: '44px', padding: '.4rem 0' }, onclick: () => { playSound('tap'); onChange(Math.min(max, value + 1)); } }, '+')
    );

    return h('div', {},
      gameHeader({ title: 'اسم و فامیل', onBack: onExit }),
      sheet({ cls: 'sheet--lined', title: 'برگه‌ی بازی', iconName: 'book', children: h('div', {},
        h('p', { style: { margin: '0 0 .5rem', fontSize: '.88rem' } }, 'امروز چند نفر برگه دارند؟'),
        counter(state.playerCount, v => { state.playerCount = v; render(); }, 2, 8)
      ) }),
      sheet({ title: 'زمان هر دور', iconName: 'clock', children: h('div', {},
        h('p', { style: { margin: '0 0 .5rem', fontSize: '.88rem' } }, '۹۰ ثانیه استاندارد است؛ برای جمع تازه‌کار ۱۲۰ ثانیه بهتر است.'),
        h('div', { style: { display: 'flex', gap: '.4rem', justifyContent: 'center' } },
          ...[60, 90, 120, 180].map(s => h('button', {
            class: 'chip', 'aria-pressed': state.seconds === s ? 'true' : 'false',
            onclick: () => { state.seconds = s; playSound('tap'); render(); }
          }, `${toFa(s / 60 === 1 ? '۱' : s / 60)} دقیقه`))
        )
      ) }),
      sheet({ title: 'چند دسته؟', iconName: 'spark', children: h('div', {},
        h('p', { style: { margin: '0 0 .5rem', fontSize: '.88rem' } }, 'دسته‌های کمتر = دور سریع‌تر.'),
        counter(state.catCount, v => { state.catCount = v; render(); }, 3, 10)
      ) }),
      h('div', { style: { display: 'grid', gap: '.5rem' } },
        btn('شروع دور اول', { variant: 'btn--primary btn--block', onClick: startRound }),
        btn('راهنمای کامل', { variant: 'btn--ghost btn--block', onClick: () => { state.screen = 'help'; render(); } })
      )
    );
  }

  function drawHelp() {
    return h('div', {},
      gameHeader({ title: 'راهنمای اسم و فامیل', onBack: () => { state.screen = 'setup'; render(); } }),
      sheet({ cls: 'sheet--lined', title: 'قدم به قدم', iconName: 'book', children: helpBlock(HELP) }),
      btn('فهمیدم', { variant: 'btn--block', onClick: () => { state.screen = 'setup'; render(); } })
    );
  }

  /* ------------------------------ اجرای دور ------------------------------ */
  function startRound() {
    const letter = nextLetter(state.usedLetters);
    state.usedLetters = [...state.usedLetters, letter];
    state.roundNo += 1;
    state.round = createRound({
      letter,
      categories: pickCategories(ESF_CATEGORIES, state.catCount),
      players: Array.from({ length: state.playerCount }, (_, i) => `بازیکن ${toFa(i + 1)}`),
      seconds: state.seconds
    });
    state.timeLeft = state.seconds;
    state.currentPlayer = 0;
    state.screen = 'play';
    startTimer();
    playSound('paper-flip');
    render();
  }

  let timerId = null;
  function startTimer() {
    clearInterval(timerId);
    timerId = setInterval(() => {
      state.timeLeft -= 1;
      const el = root.querySelector('[data-timer]');
      if (el) el.textContent = fmtTime(state.timeLeft);
      if (state.timeLeft <= 0) {
        clearInterval(timerId);
        state.screen = 'score';
        playSound('seal');
        finishRound();
      }
    }, 1000);
  }

  function finishRound() {
    if (!state.round) return;
    const scored = scoreRound(state.round);
    state.scoredRound = scored;
    state.screen = 'score';
    render();
  }

  function drawPlay() {
    const r = state.round;
    if (!r) { state.screen = 'setup'; return draw(); }
    const player = r.players[state.currentPlayer];
    if (!player) { finishRound(); return h('div'); }

    const answers = r.answers[player.id] || {};
    const inputs = {};

    return h('div', {},
      gameHeader({ title: `دور ${toFa(state.roundNo)} · حرف «${r.letter}»`, onBack: () => { clearInterval(timerId); onExit(); } }),
      h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.5rem' } },
        h('div', { style: { fontSize: '1.05rem', fontWeight: 700, color: '#f7efdd', textShadow: '0 2px 6px #000' } }, player.name),
        h('div', {
          class: `timer ${state.timeLeft <= 15 ? 'timer--warn' : ''}`,
          style: { fontSize: '1.5rem', fontWeight: 700, color: '#f7efdd', textShadow: '0 2px 6px #000' }
        }, h('span', { dataset: { timer: '1' }, class: 'tnum' }, fmtTime(state.timeLeft)))
      ),
      sheet({ cls: 'sheet--lined', children: h('div', {},
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '.6rem', marginBottom: '.7rem' } },
          h('div', {
            style: {
              width: '56px', height: '56px', display: 'grid', placeItems: 'center',
              background: 'var(--mustard-deep)', color: '#fff8e7', fontSize: '1.6rem', fontWeight: 700,
              boxShadow: 'var(--lift-2)', transform: 'rotate(-3deg)'
            }
          }, r.letter),
          h('div', { style: { fontSize: '.84rem', lineHeight: 1.8 } },
            h('div', {}, 'همه‌ی پاسخ‌ها باید با این حرف شروع شوند.'),
            h('div', { style: { opacity: .7, fontSize: '.76rem' } }, 'خالی گذاشتن مجاز است؛ امتیاز نمی‌گیرد.')
          )
        ),
        h('div', { style: { display: 'grid', gap: '.55rem' } },
          ...r.categories.map(cat => {
            const hint = ESF_HINTS[cat.id]?.[normalizeFa(r.letter, { afToAlef: true })[0]] || [];
            const input = h('input', {
              type: 'text', value: answers[cat.id] || '', placeholder: cat.label, maxlength: '24',
              style: {
                width: '100%', padding: '.6rem .7rem', font: 'inherit', fontSize: '.95rem',
                border: 'none', borderBottom: '2px solid rgba(90,70,50,.35)',
                background: 'transparent', outline: 'none'
              },
              'aria-label': cat.label,
              oninput: (e) => {
                state.round = { ...state.round, answers: { ...state.round.answers, [player.id]: { ...(state.round.answers[player.id] || {}), [cat.id]: e.target.value } } };
                // راهنمای زنده: اولین حرف درست است؟
                const ok = e.target.value.trim() && firstLetter(e.target.value) === r.letter;
                e.target.style.borderBottomColor = e.target.value.trim() ? (ok ? '#2f6f68' : '#a33d2c') : 'rgba(90,70,50,.35)';
              }
            });
            inputs[cat.id] = input;
            return h('label', { style: { display: 'block' } },
              h('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '.8rem', marginBottom: '.15rem' } },
                h('span', { style: { fontWeight: 700 } }, cat.emoji, ' ', cat.label),
                hint.length ? h('span', { style: { opacity: .6, fontSize: '.72rem' } }, 'مثال: ', hint.slice(0, 2).join('، ')) : null
              ),
              input
            );
          })
        )
      ) }),
      btn(state.currentPlayer < r.players.length - 1 ? 'ثبت و نفر بعد' : 'ثبت و دیدن امتیازها', {
        variant: 'btn--primary btn--block',
        onClick: () => {
          playSound('paper-flip');
          if (state.currentPlayer < r.players.length - 1) {
            state.currentPlayer += 1;
            render();
          } else {
            clearInterval(timerId);
            finishRound();
          }
        }
      }),
      callout('زمان که تمام شود، برگه خودکار بسته می‌شود — پس هرچه زودتر بنویس.', 'clock')
    );
  }

  /* ------------------------------ امتیاز ------------------------------ */
  function drawScore() {
    const r = state.scoredRound || scoreRound(state.round);
    const total = Object.values(r.scores).reduce((a, b) => a + b, 0);

    return h('div', {},
      gameHeader({ title: 'امتیازهای این دور', onBack: () => { state.screen = 'result'; render(); } }),
      sheet({ cls: 'sheet--lined', title: `حرف «${r.letter}»`, iconName: 'check', children: h('div', { style: { display: 'grid', gap: '.6rem' } },
        ...r.players.map(p => {
          const d = r.detail?.[p.id] || {};
          return h('div', { style: { borderBottom: '1px dashed rgba(0,0,0,.15)', paddingBottom: '.45rem' } },
            h('div', { style: { display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '.9rem' } },
              h('span', {}, p.name), h('span', { class: 'tnum' }, `${toFa(r.scores[p.id] || 0)} امتیاز`)
            ),
            h('div', { style: { fontSize: '.78rem', display: 'flex', flexWrap: 'wrap', gap: '.35rem', marginTop: '.2rem' } },
              ...Object.entries(d).map(([catId, info]) => {
                const cat = r.categories.find(c => c.id === catId);
                return h('span', {
                  style: {
                    padding: '.1rem .4rem',
                    background: info.duplicate ? 'rgba(176,128,31,.18)' : 'rgba(47,111,104,.16)',
                    fontSize: '.74rem'
                  }
                }, `${cat?.label || catId}: ${toFa(info.points)}${info.duplicate ? ' (تکراری)' : ''}`);
              })
            )
          );
        })
      ) }),
      h('div', { class: 'score-row' },
        h('span', { class: 'score-pill' }, `مجموع دور: ${toFa(total)}`),
        r.isTie ? h('span', { class: 'score-pill' }, 'مساوی!') :
          h('span', { class: 'score-pill score-pill--active' }, `برنده: ${r.players.find(p => r.winners.includes(p.id))?.name}`)
      ),
      h('div', { style: { display: 'grid', gap: '.5rem', marginTop: '.7rem' } },
        btn('دور بعد با حرف تازه', { variant: 'btn--primary btn--block', onClick: startRound }),
        btn('پایان بازی', { variant: 'btn--ghost btn--block', onClick: () => { state.screen = 'result'; render(); } })
      )
    );
  }

  function drawResult() {
    if (!state.recorded) {
      state.recorded = true;
      stats.record('esmfamil', { label: `${toFa(state.roundNo)} دور` });
      playSound('win');
    }
    return h('div', {},
      gameHeader({ title: 'پایان اسم و فامیل', onBack: onExit }),
      sheet({ cls: 'stamp', children: h('div', { class: 'result-banner' },
        h('div', { style: { fontSize: '2rem' } }, '✒️'),
        h('div', { class: 'result-banner__verdict' }, 'برگه‌ها بسته شد'),
        h('div', { class: 'result-banner__sub' }, `${toFa(state.roundNo)} دور بازی کردید.`)
      ) }),
      h('div', { style: { display: 'grid', gap: '.5rem' } },
        btn('بازی دوباره', { variant: 'btn--primary btn--block', onClick: () => { state = { screen: 'setup', playerCount: 2, seconds: 90, catCount: 5, usedLetters: [], roundNo: 0 }; render(); } }),
        btn('بازگشت به خانه', { variant: 'btn--ghost btn--block', onClick: onExit })
      )
    );
  }

  return () => clearInterval(timerId);
}

void ESF_LETTERS;
void icon;
