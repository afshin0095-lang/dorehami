/* ============================================================
   قصه‌چین — داستان جمله‌به‌جمله، ۲ تا ۶ نفر
   ============================================================ */

import { h, mount, playSound, toast, stats, toFa } from '../core.js';
import { STORY_OPENINGS } from '../content.js';
import { STORY_OPENINGS_EXTRA, DILEMMAS_EXTRA } from '../content-more.js';
import { DILEMMAS } from '../content.js';
import { gameHeader, sheet, btn, helpBlock, callout } from '../ui/kit.js';

const HELP = {
  steps: [
    'برنامه یک جمله‌ی آغازین می‌دهد. نفر اول یک جمله اضافه می‌کند تا داستان ادامه پیدا کند.',
    'گوشی به نفر بعد می‌رسد و او یک جمله‌ی تازه اضافه می‌کند — بدون تکرار و بدون رد کردن نوبت.',
    'هر نفر می‌تواند یک «پیچش» بگذارد: یک اتفاق غیرمنتظره که داستان را عوض کند.',
    'بعد از تعداد دورهای تعیین‌شده، داستان خوانده می‌شود و جمع بهترین پیچش را انتخاب می‌کند.',
    'هدف خندیدن و ساختن است، نه بردن. داوری نهایی با جمع است.'
  ],
  example: 'شروع: «در شهری که همه ساعت‌ها یک دقیقه عقب بودند، ناگهان…» — نفر ۱: «همه‌ی ساعت‌ها یک دقیقه جلو رفتند.» — نفر ۲ (پیچش): «و معلوم شد شهردار زمان را می‌دزدد.»',
  note: 'هیچ محتوای حساس یا تحقیرآمیزی مجاز نیست؛ اگر جمله‌ای آزاردهنده بود، میزبان می‌تواند آن را حذف کند.'
};

export function mountGame(root, { onExit }) {
  const openings = [...STORY_OPENINGS, ...STORY_OPENINGS_EXTRA];
  const dilemmas = [...DILEMMAS, ...DILEMMAS_EXTRA];
  let state = { screen: 'setup', count: 3, rounds: 3, mode: 'story' };

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
      gameHeader({ title: 'قصه‌چین', onBack: onExit }),
      sheet({ title: 'حالت', iconName: 'book', children: h('div', { style: { display: 'grid', gap: '.4rem' } },
        ...[['story', 'داستان زنجیره‌ای'], ['dilemma', 'دوراهی جمع']].map(([id, label]) => h('button', {
          class: 'btn btn--block',
          style: state.mode === id ? { background: 'var(--teal)', color: '#f4fbf8' } : {},
          onclick: () => { state.mode = id; playSound('tap'); render(); }
        }, label))
      ) }),
      sheet({ title: 'چند نفر؟', iconName: 'users', children: h('div', { style: { display: 'flex', gap: '.35rem', justifyContent: 'center', flexWrap: 'wrap' } },
        ...[2, 3, 4, 5, 6].map(n => h('button', {
          class: 'chip', 'aria-pressed': String(state.count === n),
          onclick: () => { state.count = n; playSound('tap'); render(); }
        }, `${toFa(n)} نفر`))
      ) }),
      sheet({ title: 'چند دور؟', iconName: 'clock', children: h('div', { style: { display: 'flex', gap: '.35rem', justifyContent: 'center' } },
        ...[2, 3, 5].map(n => h('button', {
          class: 'chip', 'aria-pressed': String(state.rounds === n),
          onclick: () => { state.rounds = n; playSound('tap'); render(); }
        }, toFa(n)))
      ) }),
      h('div', { style: { display: 'grid', gap: '.5rem' } },
        btn('شروع', {
          variant: 'btn--primary btn--block',
          onClick: () => {
            state.screen = 'play';
            state.turn = 0;
            state.round = 1;
            state.lines = [];
            state.prompt = state.mode === 'story'
              ? openings[Math.floor(Math.random() * openings.length)]
              : dilemmas[Math.floor(Math.random() * dilemmas.length)];
            playSound('paper-flip');
            render();
          }
        }),
        btn('راهنما', { variant: 'btn--ghost btn--block', onClick: () => { state.screen = 'help'; render(); } })
      )
    );
  }

  function drawHelp() {
    return h('div', {},
      gameHeader({ title: 'راهنمای قصه‌چین', onBack: () => {
        if (state.lines?.length) { state.screen = 'play'; } else { state.screen = 'setup'; }
        render();
      } }),
      sheet({ cls: 'sheet--lined', title: 'قدم به قدم', iconName: 'book', children: helpBlock(HELP) }),
      btn('فهمیدم', { variant: 'btn--block', onClick: () => { state.screen = state.lines?.length ? 'play' : 'setup'; render(); } })
    );
  }

  function drawPlay() {
    const totalTurns = state.count * state.rounds;
    const done = state.turn >= totalTurns;
    if (done) { state.screen = 'done'; return drawDone(); }
    const who = `بازیکن ${toFa((state.turn % state.count) + 1)}`;
    let text = '';

    return h('div', {},
      gameHeader({ title: `${state.mode === 'story' ? 'قصه' : 'دوراهی'} · نوبت ${who}`,
        onBack: () => { if (confirm('از بازی خارج شوی؟')) onExit(); } },
        h('span', { class: 'score-pill' }, `${toFa(state.turn + 1)} / ${toFa(totalTurns)}`)),

      sheet({ cls: 'sheet--lined', children: h('div', {},
        h('div', { style: { fontSize: '.74rem', opacity: .65, marginBottom: '.3rem' } }, 'آغاز / سؤال'),
        h('div', { style: { fontSize: '.95rem', fontWeight: 700, lineHeight: 2, marginBottom: '.6rem' } }, state.prompt),

        state.lines.length
          ? h('div', { style: { display: 'grid', gap: '.3rem', marginBottom: '.7rem' } },
              ...state.lines.map((l, i) => h('div', { style: { fontSize: '.84rem', lineHeight: 1.9, paddingInlineStart: '.5rem', borderInlineStart: '2px solid rgba(163,61,44,.35)' } },
                h('strong', { style: { fontSize: '.72rem', opacity: .65 } }, `بازیکن ${toFa(l.by + 1)}: `), l.text
              ))
            )
          : h('div', { style: { fontSize: '.82rem', opacity: .65, marginBottom: '.7rem' } }, 'اولین جمله را همین حالا بساز.'),

        h('input', {
          type: 'text', placeholder: state.mode === 'story' ? 'جمله‌ی تو…' : 'انتخاب یا دلیلت…',
          style: {
            width: '100%', padding: '.65rem .7rem', font: 'inherit', fontSize: '.92rem',
            border: 'none', borderBottom: '2px solid rgba(90,70,50,.4)', background: 'transparent', outline: 'none'
          },
          oninput: (e) => { text = e.target.value; },
          onkeydown: (e) => { if (e.key === 'Enter') submit(false); }
        })
      ) }),

      h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.5rem' } },
        btn('ثبت جمله', { variant: 'btn--primary', onClick: () => submit(false) }),
        btn('ثبت با پیچش', { variant: 'btn--mustard', onClick: () => submit(true) })
      ),
      callout('پیچش = یک اتفاق غیرمنتظره که داستان را می‌چرخاند.', 'spark')
    );

    function submit(twist) {
      const t = text.trim();
      if (!t) { toast('یک جمله بنویس', 'warn'); return; }
      state.lines = [...state.lines, { text: twist ? `${t} (پیچش!)` : t, by: state.turn % state.count }];
      state.turn += 1;
      if (state.turn % state.count === 0) {
        state.round += 1;
        if (state.mode === 'dilemma' && state.turn < state.count * state.rounds) {
          state.prompt = dilemmas[Math.floor(Math.random() * dilemmas.length)];
        }
      }
      playSound('paper-flip');
      render();
    }
  }

  function drawDone() {
    if (!state.recorded) {
      state.recorded = true;
      stats.record('story', { label: `${toFa(state.lines.length)} جمله` });
      playSound('win');
    }
    return h('div', {},
      gameHeader({ title: 'قصه‌ی شما', onBack: onExit }),
      sheet({ cls: 'sheet--lined', title: 'داستان کامل', iconName: 'book', children: h('div', {},
        h('div', { style: { fontSize: '.9rem', fontWeight: 700, lineHeight: 2, marginBottom: '.5rem' } }, state.prompt),
        h('div', { style: { display: 'grid', gap: '.35rem' } },
          ...state.lines.map(l => h('div', { style: { fontSize: '.86rem', lineHeight: 1.95 } },
            h('strong', { style: { fontSize: '.72rem', opacity: .6 } }, `ب ${toFa(l.by + 1)}: `), l.text
          ))
        )
      ) }),
      h('div', { style: { display: 'grid', gap: '.5rem' } },
        btn('قصه‌ی تازه', { variant: 'btn--primary btn--block', onClick: () => { state = { screen: 'setup', count: state.count, rounds: state.rounds, mode: state.mode }; render(); } }),
        btn('بازگشت', { variant: 'btn--ghost btn--block', onClick: onExit })
      )
    );
  }

  return () => {};
}
