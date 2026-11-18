/* ============================================================
   «دروازه‌های رؤیا» — رابط کاربری کارتی
   همه‌چیز ورق است: دست، زنجیره‌ی خواب، درها، کابوس.
   ============================================================ */

import { h, mount, playSound, stats, toFa } from '../core.js';
import { gameHeader, sheet, btn, helpBlock, callout, icon, levelArt } from '../ui/kit.js';
import {
  DREAMS, SIGNS, createDreamGame, playDream, discardDream, canPlay,
  playableCards, nightmareOptions, applyNightmare, dreamName, signName,
  dreamColor, doorsTarget, deckLeft, DIFFICULTY_LABEL, NIGHTMARE_COUNT,
  DOORS_NEEDED, HAND_SIZE, RULES
} from '../engines/dream.js';

const glyph = (sign) => SIGNS.find(s => s.id === sign)?.glyph || '◆';

const HELP = {
  steps: [
    'پنج کارت در دست داری. هر کارت یک «خواب» (رنگ) و یک «نماد» دارد: خورشید، ماه یا کلید.',
    'در هر نوبت یک کارت بازی می‌کنی یا دور می‌اندازی. کارتی که بازی می‌کنی نباید نمادش با کارت قبلیِ روی میز یکی باشد.',
    'سه کارت هم‌رنگ پشت‌سرهم بچین تا یک در از آن خواب باز شود. پنج در باز = بیداری و برد.',
    'اگر مجبور شوی دور بیندازی، سعی کن رنگ‌هایی را نگه داری که هنوز درشان باز نشده.',
    'کلید ارزشمند است: با کلید می‌شود درهای بسته را همان لحظه که از دسته بیرون می‌آیند باز کرد، و دورانداختنش یک پیش‌گویی به تو می‌دهد.',
    'کابوس که آمد، یکی از چهار پیامد را انتخاب می‌کنی. اگر دستت خالی بماند یا کارت‌های خواب تمام شوند، خواب بر تو چیره می‌شود.'
  ],
  example: 'مثال: روی میز «باغ · خورشید» است. نمی‌توانی «باغ · خورشید» یا «کتابخانه · خورشید» بگذاری، ولی «باغ · ماه» مجاز است و اگر پیش از آن هم کارت باغ گذاشته باشی، سه‌تای باغ کامل می‌شود.',
  note: 'درجه‌ی سخت‌تر فقط تعداد کابوس‌ها را زیاد می‌کند، نه شانس را. هر سه درجه با آزمون شبیه‌سازی متعادل شده‌اند.'
};

/* ------------------------------ اجزا ------------------------------ */

function dreamCard(card, { playable = false, small = false, dim = false, onClick = null, label = null } = {}) {
  const color = dreamColor(card.dream);
  const node = h('button', {
    type: 'button',
    class: `dream-card${playable ? ' is-playable' : ''}${small ? ' dream-card--sm' : ''}${dim ? ' is-dim' : ''}`,
    style: `--dream:${color}`,
    'aria-label': label || `${dreamName(card.dream)}، نماد ${signName(card.sign)}${playable ? '، قابل بازی' : ''}`,
    disabled: !onClick,
    onclick: onClick ? () => { playSound('paper-flip'); onClick(card); } : null
  },
    h('span', { class: 'dream-card__corner', 'aria-hidden': 'true' },
      h('span', { class: 'dream-card__sign' }, glyph(card.sign)),
      h('span', { class: 'dream-card__name' }, dreamName(card.dream))
    ),
    h('span', { class: 'dream-card__art', 'aria-hidden': 'true' },
      h('span', { class: 'dream-card__glyph' }, glyph(card.sign)),
      h('span', { class: 'dream-card__vignette' })
    ),
    h('span', { class: 'dream-card__foot' }, `${signName(card.sign)} · ${dreamName(card.dream)}`)
  );
  return node;
}

function doorSlot(dream, count) {
  const open = count > 0;
  return h('div', {
    class: `dream-door${open ? ' is-open' : ''}`,
    style: `--dream:${dreamColor(dream.id)}`,
    'aria-label': open ? `درِ ${dream.name} باز است` : `درِ ${dream.name} بسته است`
  },
    h('span', { class: 'dream-door__arch', 'aria-hidden': 'true' },
      open ? h('span', { class: 'dream-door__glyph' }, '⌂') : h('span', { class: 'dream-door__empty' }, '◇')
    ),
    h('span', { class: 'dream-door__name' }, dream.name),
    h('span', { class: 'dream-door__state' }, open ? 'باز' : 'بسته')
  );
}

/* ------------------------------ بازی ------------------------------ */

export function mountGame(root, { onExit } = {}) {
  let screen = 'intro';
  let difficulty = 'normal';
  let state = null;
  let selected = null;
  let peek = null;
  let msg = '';
  let recorded = false;

  const render = () => mount(root, draw());
  render();

  function draw() {
    if (screen === 'help') return drawHelp();
    if (screen === 'play') return drawPlay();
    return drawIntro();
  }

  function startGame() {
    state = createDreamGame({ seed: (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0, difficulty });
    selected = null;
    peek = null;
    msg = '';
    recorded = false;
    screen = 'play';
    playSound('shuffle');
    render();
  }

  /* ------------------------------ منو ------------------------------ */
  function drawIntro() {
    const best = stats.get().records?.['dream-doors'] || 0;
    return h('div', {},
      gameHeader({ title: 'دروازه‌های رؤیا', onBack: onExit }),
      h('section', { class: 'paper dream-hero print-edge' },
        h('div', { class: 'dream-hero__deco', 'aria-hidden': 'true' },
          h('span', {}, '☾'), h('span', {}, '⌂'), h('span', {}, '☀')),
        h('div', { class: 'dream-hero__text' },
          h('div', { class: 'dream-hero__kicker' }, 'بازی کارتی · تک‌نفره'),
          h('h1', {}, 'دروازه‌های رؤیا'),
          h('p', {}, 'در هزارتوی خواب گم شده‌ای. پنج در تا بیداری فاصله داری، و کابوس‌ها هم بیدارند.')
        )
      ),
      sheet({ title: 'درجه‌ی خواب', iconName: 'moon', children:
        h('div', { class: 'level-row' },
          ...['easy', 'normal', 'hard'].map(id => h('button', {
            class: `level-card${difficulty === id ? ' is-on' : ''}`,
            'aria-pressed': String(difficulty === id),
            style: `--lvl-art:url('${levelArt(id)}')`,
            onclick: () => { difficulty = id; playSound('tap'); render(); }
          },
            h('div', { class: 'level-card__name' }, DIFFICULTY_LABEL[id]),
            h('div', { class: 'level-card__meta' }, `${toFa(NIGHTMARE_COUNT[id])} کابوس در دسته`),
            h('div', { class: 'level-card__hint' }, id === 'easy' ? 'برای آشنایی' : id === 'normal' ? 'تعادل' : 'برای آزمودن')
          ))
        )
      }),
      sheet({ title: 'وضعیت تو', iconName: 'chart', children:
        h('div', { class: 'stat-row' },
          h('div', { class: 'stat' }, h('span', { class: 'stat__num' }, toFa(stats.get().byGame?.dream || 0)), h('span', { class: 'stat__label' }, 'دست بازی‌شده')),
          h('div', { class: 'stat' }, h('span', { class: 'stat__num' }, toFa(best)), h('span', { class: 'stat__label' }, 'بیشترین در'))
        )
      }),
      h('div', { class: 'stack' },
        btn('شروع خواب', { variant: 'btn--primary btn--block', onClick: startGame }),
        btn('راهنما', { variant: 'btn--ghost btn--block', onClick: () => { screen = 'help'; render(); } }),
        btn('بازگشت', { variant: 'btn--ghost btn--block', onClick: onExit })
      ),
      callout('هر کارت یک ورق واقعی است: روی آن کلیک کن، بعد «بازی کردن» یا «دور انداختن» را بزن.', 'cards')
    );
  }

  function drawHelp() {
    return h('div', {},
      gameHeader({ title: 'راهنمای دروازه‌های رؤیا', onBack: () => { screen = 'intro'; render(); } }),
      sheet({ title: 'قواعد', iconName: 'book', children: helpBlock(HELP) }),
      h('div', { class: 'stack' },
        btn('فهمیدم', { variant: 'btn--primary btn--block', onClick: () => { screen = 'intro'; render(); } })
      )
    );
  }

  /* ------------------------------ صفحه‌ی بازی ------------------------------ */
  function drawPlay() {
    const target = doorsTarget(state);
    const playable = state.status === 'playing' ? playableCards(state) : [];
    const left = deckLeft(state);
    const counts = {};
    for (const d of state.doors) counts[d] = (counts[d] || 0) + 1;
    const selCard = state.hand.find(c => c.id === selected) || null;
    const lastCard = state.chain[state.chain.length - 1] || null;

    return h('div', {},
      gameHeader({
        title: 'دروازه‌های رؤیا',
        onBack: () => { screen = 'intro'; render(); },
        children: [
          h('span', { class: 'score-pill' }, `${toFa(state.doors.length)}/${toFa(target)} در`)
        ]
      }),

      /* نوار وضعیت */
      h('div', { class: 'dream-status' },
        h('div', { class: `dream-meter${left <= 10 ? ' is-low' : ''}` },
          h('span', { class: 'dream-meter__label' }, 'دسته'),
          h('span', { class: 'dream-meter__value' }, toFa(left))
        ),
        h('div', { class: 'dream-meter' },
          h('span', { class: 'dream-meter__label' }, 'درها'),
          h('span', { class: 'dream-meter__value' }, `${toFa(state.doors.length)}/${toFa(target)}`)
        ),
        h('div', { class: 'dream-meter dream-meter--wide' },
          h('span', { class: 'dream-meter__label' }, 'نمی‌توانی بگذاری'),
          h('span', { class: 'dream-meter__value dream-meter__value--sign' },
            lastCard ? glyph(lastCard.sign) : '—')
        )
      ),

      /* درها */
      sheet({ title: 'درها', iconName: 'lock', cls: 'dream-doors-sheet', children:
        h('div', { class: 'dream-doors' }, ...DREAMS.map(d => doorSlot(d, counts[d.id] || 0)))
      }),

      /* زنجیره */
      sheet({ title: 'زنجیره‌ی خواب', iconName: 'cards', children:
        h('div', { class: 'dream-chain', 'aria-label': 'کارت‌های روی میز' },
          state.chain.length
            ? state.chain.slice(-8).map((c, i, arr) =>
              dreamCard(c, { small: true, dim: i < arr.length - 1 }))
            : h('p', { class: 'muted' }, 'هنوز چیزی بازی نکردی.')
        )
      }),

      /* پیام / کابوس */
      state.status === 'nightmare' ? drawNightmare() : null,

      msg ? h('div', { class: 'dream-notice', role: 'status' }, h('p', { class: 'dream-notice__err' }, msg)) : null,
      peek ? drawPeek() : null,

      /* دست */
      sheet({ title: `دست تو · ${toFa(state.hand.length)} از ${toFa(HAND_SIZE)}`, iconName: 'user', children:
        h('div', { class: 'dream-hand' },
          state.hand.length
            ? state.hand.map(c => dreamCard(c, {
              playable: canPlay(state, c),
              onClick: state.status === 'playing'
                ? (card) => { selected = selected === card.id ? null : card.id; msg = ''; render(); }
                : null
            }))
            : h('p', { class: 'muted' }, 'دستی نداری.')
        )
      }),

      /* انتخاب و دکمه‌ها */
      state.status === 'playing' ? h('div', { class: 'dream-actions' },
        selCard
          ? h('div', { class: 'dream-selected', 'aria-live': 'polite' },
            h('span', { class: 'dream-selected__label' }, 'انتخاب‌شده:'),
            h('strong', {}, `${dreamName(selCard.dream)} · ${signName(selCard.sign)}`),
            canPlay(state, selCard)
              ? h('span', { class: 'tag tag--ok' }, 'قابل بازی')
              : h('span', { class: 'tag tag--bad' }, `نمادش با کارت قبلی یکی است`)
          )
          : h('p', { class: 'muted dream-hint' }, playable.length
            ? 'یک ورق انتخاب کن. ورق‌های روشن همین حالا مجازند.'
            : 'هیچ ورقی مجاز نیست — مجبوری یکی را دور بیندازی.'),

        h('div', { class: 'btn-row' },
          btn('بازی کردن', {
            variant: 'btn--primary', disabled: !selCard || !canPlay(state, selCard),
            onClick: () => doPlay(selCard)
          }),
          btn('دور انداختن', {
            variant: 'btn--ghost', disabled: !selCard,
            onClick: () => doDiscard(selCard)
          })
        )
      ) : null,

      state.status === 'won' || state.status === 'lost' ? drawEnd(target) : null
    );
  }

  function drawNightmare() {
    return h('section', { class: 'dream-nightmare', role: 'alertdialog', 'aria-label': 'کابوس' },
      h('div', { class: 'dream-nightmare__head' },
        h('span', { class: 'dream-nightmare__eye', 'aria-hidden': 'true' }, '◉'),
        h('div', {},
          h('div', { class: 'dream-nightmare__title' }, 'کابوس'),
          h('div', { class: 'dream-nightmare__sub' }, 'یکی از پیامدها را انتخاب کن. هر انتخابی بهایی دارد.')
        )
      ),
      h('div', { class: 'dream-nightmare__opts' },
        ...nightmareOptions(state).map(opt =>
          h('button', {
            class: 'dream-opt',
            type: 'button',
            onclick: () => {
              playSound('unwrap');
              state = applyNightmare(state, opt.id);
              selected = null;
              msg = '';
              render();
            }
          },
            h('span', { class: 'dream-opt__label' }, opt.label),
            h('span', { class: 'dream-opt__detail' }, opt.detail)
          ))
      )
    );
  }

  function drawPeek() {
    return h('section', { class: 'dream-peek' },
      h('div', { class: 'dream-peek__title' }, 'پیش‌گویی کلید — پنج کارت روی دسته'),
      h('div', { class: 'dream-peek__row' },
        ...peek.map(c => c.kind === 'dream'
          ? dreamCard(c, { small: true, dim: true })
          : h('span', { class: `dream-peek__special${c.kind === 'nightmare' ? ' is-bad' : ''}` },
            c.kind === 'nightmare' ? 'کابوس' : 'در')
        )
      ),
      h('div', { class: 'btn-row' },
        btn('بستن', { variant: 'btn--ghost', onClick: () => { peek = null; render(); } })
      )
    );
  }

  function drawEnd(target) {
    const won = state.status === 'won';
    return h('section', { class: `dream-end${won ? ' is-win' : ' is-lose'}` },
      h('div', { class: 'dream-end__seal', 'aria-hidden': 'true' }, won ? '⌂' : '☾'),
      h('h2', { class: 'dream-end__title' }, won ? 'از هزارتو بیرون آمدی' : 'خواب بر تو چیره شد'),
      h('p', { class: 'dream-end__text' }, state.ending || ''),
      h('div', { class: 'dream-end__stats' },
        h('span', {}, `درها: ${toFa(state.doors.length)} از ${toFa(target)}`),
        h('span', {}, `ورق‌های بازی‌شده: ${toFa(state.chain.length)}`),
        h('span', {}, DIFFICULTY_LABEL[state.difficulty])
      ),
      h('div', { class: 'btn-row' },
        btn('دوباره', { variant: 'btn--primary', onClick: startGame }),
        btn('برگشت به منو', { variant: 'btn--ghost', onClick: () => { screen = 'intro'; render(); } })
      )
    );
  }

  /* ------------------------------ کنش‌ها ------------------------------ */
  function doPlay(card) {
    if (!card) return;
    try {
      state = playDream(state, card.id);
      selected = null;
      peek = null;
      msg = '';
      playSound('card-deal');
      if (state.status === 'won') finish(true);
      else if (state.status === 'lost') finish(false);
      render();
    } catch (e) {
      msg = e.message;
      playSound('error');
      render();
    }
  }

  function doDiscard(card) {
    if (!card) return;
    try {
      const res = discardDream(state, card.id);
      peek = res.peek || null;
      state = res;
      selected = null;
      msg = '';
      playSound('paper-flip');
      if (state.status === 'lost') finish(false);
      render();
    } catch (e) {
      msg = e.message;
      playSound('error');
      render();
    }
  }

  function finish(won) {
    if (recorded) return;
    recorded = true;
    stats.record('dream', {
      key: 'dream-doors',
      best: state.doors.length,
      label: won ? `برد خواب ${DIFFICULTY_LABEL[state.difficulty]}` : `باخت خواب ${DIFFICULTY_LABEL[state.difficulty]}`
    });
  }

  return () => { /* ریشه در main.js پاک می‌شود */ };
}

export { RULES, DOORS_NEEDED, HAND_SIZE };
