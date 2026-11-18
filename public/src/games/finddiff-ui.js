/* ============================================================
   «تفاوت را پیدا کن» — دو عکس واقعی کنار هم
   کلیک با مختصات نسبی به پیکسل عکس نگاشت می‌شود، پس کاربر
   باید دقیقاً روی همان جای تغییرکرده بزند.
   ============================================================ */

import { h, mount, playSound, stats, toFa } from '../core.js';
import {
  SCENES, FRAME_W, FRAME_H, RULES, TOLERANCE,
  createFindDiff, tap, warmth, useHint, isDone, remaining, score
} from '../engines/finddiff.js';
import { gameHeader, sheet, btn, helpBlock, callout } from '../ui/kit.js';
import { tableNote } from '../ui/tablekit.js';

const WARMTH_LABEL = { hot: 'خیلی نزدیک!', warm: 'نزدیک شدی', cold: 'دور است', done: '' };
const WARMTH_TONE = { hot: 'info', warm: 'info', cold: 'bad', done: 'info' };

export function mountGame(root, { onExit, game } = {}) {
  let screen = 'intro';
  let state = null;
  let sceneId = null;
  let note = ''; let noteTone = 'info';
  let hintIndex = null;
  let wrongMarks = [];
  let startedAt = 0;

  const render = () => mount(root, draw());
  render();

  function draw() {
    if (screen === 'help') return drawHelp();
    if (screen === 'play') return drawPlay();
    if (screen === 'over') return drawOver();
    return drawIntro();
  }

  function start(id) {
    sceneId = id || null;
    note = ''; noteTone = 'info'; hintIndex = null; wrongMarks = [];
    state = createFindDiff({ sceneId, seed: (Date.now() ^ Math.random() * 1e6) >>> 0 });
    startedAt = Date.now();
    screen = 'play';
    playSound('card-deal');
    render();
  }

  function finish() {
    if (!state || state._recorded) return;
    state._recorded = true;
    const s = score(state);
    const seconds = Math.round((Date.now() - startedAt) / 1000);
    stats.record('spot', {
      key: 'spot-best', best: s, higherIsBetter: true,
      label: `${s} امتیاز · ${toFa(seconds)} ثانیه`
    });
    playSound('win');
    screen = 'over';
    render();
  }

  /* ------------------------------ مقدمه ------------------------------ */

  function drawIntro() {
    return h('div', {},
      gameHeader({ title: 'تفاوت را پیدا کن', onBack: onExit }),
      h('section', { class: 'fd-hero print-edge' },
        h('div', { class: 'fd-hero__pair', 'aria-hidden': 'true' },
          h('span', { class: 'fd-hero__frame', style: `background-image:url(${SCENES[0].artA})` }),
          h('span', { class: 'fd-hero__frame', style: `background-image:url(${SCENES[0].artB})` })
        ),
        h('div', { class: 'fd-hero__text' },
          h('div', { class: 'fd-hero__kicker' }, '۵ صحنه · عکس واقعی'),
          h('h1', {}, 'کدام چیز عوض شده؟'),
          h('p', {}, 'روی همان جای تغییرکرده بزن. کلیک کنارش خطا حساب می‌شود.')
        )
      ),

      sheet({ title: 'یک صحنه انتخاب کن', iconName: 'spark', children:
        h('div', { class: 'fd-scenes' },
          ...SCENES.map(s => h('button', {
            class: 'fd-scene', 'aria-label': `${s.title} — ${s.hotspots.length} تفاوت`,
            onclick: () => { playSound('card-deal'); start(s.id); }
          },
            h('span', { class: 'fd-scene__art', style: `background-image:url(${s.artA})` }),
            h('span', { class: 'fd-scene__name' }, s.title),
            h('span', { class: 'fd-scene__meta' }, `${toFa(s.hotspots.length)} تفاوت`)
          ))
        )
      }),

      h('div', { class: 'stack' },
        btn('صحنهٔ تصادفی', { variant: 'btn--primary btn--block', onClick: () => start(null) }),
        btn('راهنما', { variant: 'btn--ghost btn--block', onClick: () => { screen = 'help'; render(); } })
      )
    );
  }

  function drawHelp() {
    return h('div', {},
      gameHeader({ title: 'راهنمای تفاوت‌یابی', onBack: () => { screen = 'intro'; render(); } }),
      sheet({ title: 'قواعد', iconName: 'book', children: helpBlock(RULES) }),
      h('div', { class: 'stack' },
        btn('فهمیدم', { variant: 'btn--primary btn--block', onClick: () => { screen = 'intro'; render(); } })
      )
    );
  }

  /* ------------------------------ بازی ------------------------------ */

  function drawPlay() {
    const g = state;
    const scene = g.scene;
    const left = remaining(g);

    return h('div', {},
      gameHeader({
        title: scene.title,
        onBack: () => { screen = 'intro'; render(); },
        children: [
          h('span', { class: 'score-pill' }, `${toFa(g.found.length)}/${toFa(g.total)}`),
          h('span', { class: 'score-pill' }, `${toFa(score(g))} امتیاز`)
        ]
      }),

      h('div', { class: 'fd-status' },
        h('span', { class: 'fd-status__left' }, `${toFa(left)} تفاوت مانده`),
        g.misses ? h('span', { class: 'fd-status__miss' }, `${toFa(g.misses)} خطا`) : null
      ),

      /* دو عکس: هر کلیک با مختصات نسبی به hotspot نگاشت می‌شود */
      h('div', { class: 'fd-pair' },
        ...['A', 'B'].map(tag => {
          const art = tag === 'A' ? scene.artA : scene.artB;
          const marks = g.found.map((idx, k) => {
            const hs = scene.hotspots[idx];
            return h('span', {
              class: 'fd-mark',
              style: `left:${(hs.x / FRAME_W) * 100}%;top:${(hs.y / FRAME_H) * 100}%;` +
                     `width:${(hs.w / FRAME_W) * 100}%;height:${(hs.h / FRAME_H) * 100}%`,
              'aria-label': `تفاوت پیدا‌شده: ${hs.name}`
            }, h('span', { class: 'fd-mark__n' }, toFa(k + 1)));
          });
          const wrong = wrongMarks.filter(m => m.tag === tag).map(m =>
            h('span', { class: 'fd-mark fd-mark--wrong', style: `left:${m.x}%;top:${m.y}%` }));
          const hint = hintIndex !== null && !g.found.includes(hintIndex)
            ? (() => {
                const hs = scene.hotspots[hintIndex];
                return h('span', {
                  class: 'fd-mark fd-mark--hint',
                  style: `left:${(hs.x / FRAME_W) * 100}%;top:${(hs.y / FRAME_H) * 100}%;` +
                         `width:${(hs.w / FRAME_W) * 100}%;height:${(hs.h / FRAME_H) * 100}%`
                });
              })()
            : null;

          return h('div', { class: 'fd-frame' },
            h('div', {
              class: 'fd-frame__img',
              role: 'button',
              tabindex: '0',
              'aria-label': `عکس ${tag} — برای پیدا کردن تفاوت بزن`,
              style: `background-image:url(${art})`,
              onclick: (e) => onTap(e, tag),
              onkeydown: null
            },
              ...marks, ...wrong, hint ? [hint] : []
            ),
            h('span', { class: 'fd-frame__tag' }, tag === 'A' ? 'عکس ۱' : 'عکس ۲')
          );
        })
      ),

      note ? tableNote(note, { tone: noteTone }) : null,

      h('div', { class: 'fd-actions' },
        btn(g.hints ? 'راهنمای بعدی (−۳۰)' : 'راهنما (−۳۰ امتیاز)', {
          variant: 'btn--teal btn--block',
          onClick: onHint
        }),
        btn('صحنهٔ دیگر', { variant: 'btn--ghost btn--block', onClick: () => { screen = 'intro'; render(); } })
      ),

      h('section', { class: 'fd-log' },
        ...[...g.log].reverse().slice(0, 4).map(t => h('p', { class: 'fd-log__row' }, t))
      )
    );
  }

  /**
   * نگاشت دقیق کلیک: مختصات نسبی داخل خود عکس.
   * چون عکس با object-fit/cover پوشانده شده، نسبت‌ها از getBoundingClientRect
   * گرفته می‌شود تا در هر اندازه‌ای درست باشد.
   */
  function onTap(e, tag) {
    if (!state || isDone(state)) return;
    const el = e?.currentTarget;
    let relX = 0.5, relY = 0.5;
    if (el) {
      const r = typeof el.getBoundingClientRect === 'function' ? el.getBoundingClientRect() : null;
      if (r && r.width > 0 && r.height > 0 && e.clientX != null) {
        relX = (e.clientX - r.left) / r.width;
        relY = (e.clientY - r.top) / r.height;
      } else if (el.offsetWidth > 0 && el.offsetHeight > 0 && e.offsetX != null) {
        // پشتوانه: مختصات نسبت به خود عنصر
        relX = e.offsetX / el.offsetWidth;
        relY = e.offsetY / el.offsetHeight;
      }
    }
    // اگر هیچ مختصاتی نداشتیم، کلیک را نادیده بگیر (بهتر از حدس زدن وسط عکس)
    if (!Number.isFinite(relX) || !Number.isFinite(relY)) return;
    relX = Math.max(0, Math.min(1, relX));
    relY = Math.max(0, Math.min(1, relY));

    const before = state.misses;
    const r = tap(state, relX, relY);
    if (!r.ok) { note = r.error; noteTone = 'bad'; render(); return; }
    state = r.game;

    if (r.hit) {
      note = `پیدا شد: ${r.name} (${toFa(state.found.length)}/${toFa(state.total)})`;
      noteTone = 'info';
      hintIndex = null;
      playSound('win');
      if (isDone(state)) { render(); setTimeout(finish, 380); return; }
    } else {
      const w = warmth(state, relX, relY);
      note = WARMTH_LABEL[w] || 'این‌جا نبود';
      noteTone = WARMTH_TONE[w] || 'bad';
      if (before !== state.misses) {
        wrongMarks = [...wrongMarks.slice(-6), { tag, x: relX * 100, y: relY * 100 }];
      }
      playSound('error');
    }
    render();
  }

  function onHint() {
    if (!state) return;
    const r = useHint(state);
    if (!r.ok) { note = r.error; noteTone = 'bad'; render(); return; }
    state = r.game;
    hintIndex = r.index;
    note = `راهنما: دنبال «${state.scene.hotspots[r.index].name}» باش`;
    noteTone = 'info';
    playSound('tap');
    render();
  }

  /* ------------------------------ پایان ------------------------------ */

  function drawOver() {
    const s = state ? score(state) : 0;
    const seconds = startedAt ? Math.round((Date.now() - startedAt) / 1000) : 0;
    return h('div', {},
      gameHeader({ title: 'صحنه تمام شد', onBack: onExit }),
      h('section', { class: 'fd-result is-win' },
        h('div', { class: 'fd-result__seal', 'aria-hidden': 'true' }, '❧'),
        h('h2', {}, 'همهٔ تفاوت‌ها را پیدا کردی'),
        h('div', { class: 'fd-result__stats' },
          h('div', { class: 'fd-result__stat' }, h('strong', {}, toFa(s)), h('span', {}, 'امتیاز')),
          h('div', { class: 'fd-result__stat' }, h('strong', {}, toFa(state?.misses ?? 0)), h('span', {}, 'خطا')),
          h('div', { class: 'fd-result__stat' }, h('strong', {}, toFa(state?.hints ?? 0)), h('span', {}, 'راهنما')),
          h('div', { class: 'fd-result__stat' }, h('strong', {}, toFa(seconds)), h('span', {}, 'ثانیه'))
        )
      ),
      h('div', { class: 'stack' },
        btn('همین صحنه دوباره', { variant: 'btn--primary btn--block', onClick: () => start(state?.scene?.id) }),
        btn('صحنهٔ دیگر', { variant: 'btn--teal btn--block', onClick: () => { screen = 'intro'; render(); } }),
        btn('بازگشت', { variant: 'btn--ghost btn--block', onClick: onExit })
      )
    );
  }

  return () => { state = null; };
}
