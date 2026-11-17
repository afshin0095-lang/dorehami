/* ============================================================
   مافیا — رابط کاربری کامل با پرده‌ی حریم و کارت نقش
   ============================================================ */

import { h, mount, playSound, toast, stats, fmtTime, toFa } from '../core.js';
import { createGame, ROLES, aliveSeats, seatById, roleOf, mafiaSeats, submitNight, startDay, nominate, castVotes, tallyVotes, checkWin, removePlayer } from '../engines/mafia.js';
import { gameHeader, icon, helpBlock, sheet, btn, callout } from '../ui/kit.js';

const HELP = {
  steps: [
    'همه دور هم می‌نشینند و گوشی را می‌چرخانند. هر نفر یک‌بار روی کارت می‌زند، نقشش را می‌بیند و «دیدم» را می‌زند. کارت بعدی روی همان کاغذ پوشانده می‌شود.',
    'شب می‌شود: مافیا با هم یک نفر را برای حذف انتخاب می‌کند، پزشک یک نفر را نجات می‌دهد و کارآگاه یک نفر را استعلام می‌کند. صفحه‌ی هر نقش خصوصی است.',
    'صبح: برنامه اعلام می‌کند چه کسی حذف شد یا «شب آرام گذشت».',
    'روز: بحث می‌کنید، نامزدها را معرفی می‌کنید و رأی می‌دهید. کسی که بیشترین رأی را بیاورد حذف می‌شود.',
    'برد شهروندان: هیچ مافیایی نماند. برد مافیا: تعداد مافیا با شهروندان برابر شود.'
  ],
  example: 'مثال: ۷ نفر — ۲ مافیا، ۱ پزشک، ۱ کارآگاه و ۳ شهروند. اگر مافیا شب اول فرید را بزنند و پزشک هم فرید را نجات دهد، هیچ‌کس حذف نمی‌شود. کارآگاه می‌تواند هم‌شب استعلام بگیرد.',
  note: 'قانون: مافیا نمی‌تواند به هم‌تیمی خود شلیک کند، پزشک نمی‌تواند همان نفر را دو شب پیاپی نجات دهد و کارآگاه فقط «مافیا هست/نیست» را می‌بیند.'
};

export function mountGame(root, { onExit }) {
  let state = { screen: 'setup' }; // setup | help | reveal | night | nightResult | day | vote | result

  const draw = () => {
    switch (state.screen) {
      case 'setup': return drawSetup();
      case 'help': return drawHelp();
      case 'reveal': return drawReveal();
      case 'night': return drawNight();
      case 'nightResult': return drawNightResult();
      case 'day': return drawDay();
      case 'vote': return drawVote();
      case 'result': return drawResult();
      default: return drawSetup();
    }
  };

  const render = () => mount(root, draw());
  render();

  /* ------------------------------ آماده‌سازی ------------------------------ */
  function drawSetup() {
    let count = state.count || 7;
    const preview = h('div', { style: { fontSize: '.86rem', lineHeight: 1.9 } });

    const paint = () => {
      const m = count <= 6 ? 1 : count <= 9 ? 2 : 3;
      preview.replaceChildren(
        h('div', {}, `بازیکن: ${toFa(count)} نفر`),
        h('div', {}, `مافیا: ${toFa(m)} · شهروندان: ${toFa(count - m)}`),
        h('div', {}, count >= 5 ? 'شامل پزشک و کارآگاه' : 'حداقل ۵ نفر لازم است')
      );
    };

    const counter = (delta, label) => h('button', {
      class: 'btn', style: { width: '52px', padding: '.5rem 0', fontSize: '1.2rem' },
      onclick: () => {
        playSound('tap');
        count = Math.max(5, Math.min(12, count + delta));
        state.count = count;
        paint();
      }, 'aria-label': label
    }, delta > 0 ? '+' : '−');

    const nameInputs = () => h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.5rem', marginTop: '.7rem' } },
      ...Array.from({ length: count }, (_, i) => h('input', {
        type: 'text', placeholder: `بازیکن ${toFa(i + 1)}`, maxlength: '14', dataset: { nameIdx: i },
        style: { padding: '.5rem .55rem', font: 'inherit', fontSize: '.85rem', border: '1px solid rgba(0,0,0,.16)', borderRadius: '2px', background: 'rgba(255,255,255,.6)' }
      }))
    );

    const namesWrap = nameInputs();
    paint();

    const inner = h('div', {},
      gameHeader({ title: 'مافیا', onBack: onExit }),
      sheet({ title: 'چند نفر هستید؟', iconName: 'users', children: h('div', {},
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '.7rem' } },
          counter(-1, 'کمتر'), h('div', { style: { flex: 1, textAlign: 'center', fontSize: '2rem', fontWeight: 700 } }, toFa(count)), counter(1, 'بیشتر')
        ),
        preview
      ) }),
      sheet({ title: 'نام‌ها (اختیاری)', iconName: 'user', children: h('div', {},
        h('p', { style: { margin: 0, fontSize: '.84rem' } }, 'می‌توانی خالی بگذاری؛ بعدی‌ها خودکار نام می‌گیرند. نام واقعی لازم نیست.'),
        namesWrap
      ) }),
      h('div', { style: { display: 'grid', gap: '.5rem' } },
        btn('شروع بازی', { variant: 'btn--primary btn--block', onClick: start }),
        btn('راهنمای کامل', { variant: 'btn--ghost btn--block', onClick: () => { state.screen = 'help'; render(); } })
      )
    );
    void inner;

    return inner;

    function start() {
      const names = [...root.querySelectorAll('[data-name-idx]')].map(inp => inp.value.trim());
      const players = Array.from({ length: count }, (_, i) => names[i] || `بازیکن ${toFa(i + 1)}`);
      const g = createGame({ players });
      state = { screen: 'reveal', game: g, revealIndex: 0, revealOpen: false, round: 0 };
      playSound('card-deal');
      render();
    }
  }

  function drawHelp() {
    return h('div', {},
      gameHeader({ title: 'راهنمای مافیا', onBack: () => { state.screen = 'setup'; render(); } }),
      sheet({ title: 'قدم به قدم', iconName: 'book', children: helpBlock(HELP) }),
      sheet({ title: 'نقش‌ها', iconName: 'skull', children: h('div', { style: { display: 'grid', gap: '.5rem' } },
        ...Object.values(ROLES).map(r => h('div', { style: { display: 'flex', gap: '.5rem', fontSize: '.84rem', lineHeight: 1.8 } },
          h('div', { style: { width: '30px', height: '30px', flex: '0 0 30px', backgroundImage: `url(${r.art})`, backgroundSize: 'cover', mixBlendMode: 'multiply' } }),
          h('div', {}, h('strong', {}, r.label), ' — ', r.desc)
        ))
      ) }),
      btn('برگشت به آماده‌سازی', { variant: 'btn--block', onClick: () => { state.screen = 'setup'; render(); } })
    );
  }

  /* ------------------------------ پرده‌ی حریم / نقش ------------------------------ */
  function drawReveal() {
    const g = state.game;
    const seat = g.seats[state.revealIndex];

    if (!seat) {
      state.screen = 'night';
      state.round = 0;
      state.game = { ...g, phase: 'night', round: 0 };
      render();
      return h('div');
    }

    const role = ROLES[seat.roleId];
    const isOpen = state.revealOpen;
    const card = h('div', {
      class: 'private-card',
      dataset: { flipped: isOpen ? 'true' : 'false', private: isOpen ? 'open' : 'closed' },
      onclick: () => { playSound('card-deal'); state.revealOpen = !state.revealOpen; render(); }
    },
      h('div', { class: 'private-card__face private-card__back' },
        h('div', { style: { fontSize: '1.05rem', fontWeight: 700 } }, 'نقش مخفی'),
        h('div', { style: { fontSize: '.82rem', opacity: .85, lineHeight: 1.9 } },
          `${seat.name}، گوشی را جوری بگیر که کسی نبیند.`, h('br'), 'برای دیدن کارت، روی آن لمس کن.'),
        h('div', { style: { fontSize: '.74rem', opacity: .6, marginTop: '.5rem' } }, `${toFa(state.revealIndex + 1)} از ${toFa(g.seats.length)}`)
      ),
      h('div', { class: 'private-card__face private-card__front' },
        h('div', { class: 'private-card__art', style: { backgroundImage: `url(${role.art})` } }),
        h('div', { class: 'private-card__seal' }, role.team === 'mafia' ? 'مافیا' : 'شهر'),
        h('div', { class: 'private-card__label' },
          h('div', { class: 'private-card__role' }, role.label),
          h('div', { class: 'private-card__note' }, role.desc)
        )
      )
    );

    // پنهان‌سازی خودکار وقتی صفحه پنهان شود
    card.addEventListener('dy:hide', () => { state.revealOpen = false; render(); });

    return h('div', {},
      gameHeader({ title: 'نمایش نقش', onBack: onExit }),
      h('div', { class: 'reveal-stage' }, card),
      h('div', { style: { display: 'grid', gap: '.5rem' } },
        btn(isOpen ? 'دیدم، نفر بعد' : 'اول کارت را ببین', {
          variant: 'btn--primary btn--block',
          disabled: !isOpen,
          onClick: () => {
            state.revealIndex += 1;
            state.revealOpen = false;
            playSound('paper-flip');
            render();
          }
        }),
        callout('وقتی کارت را بستی، گوشی را به نفر بعد بده — نه قبلش.', 'help')
      )
    );
  }

  /* ------------------------------ شب ------------------------------ */
  function drawNight() {
    const g = state.game;
    const round = (state.round || 0) + 1;
    const step = state.nightStep || 0; // 0 mafia, 1 doctor, 2 detective
    const targets = aliveSeats(g);
    const mafias = mafiaSeats(g).filter(s => s.alive);
    const doctorAlive = aliveSeats(g).find(s => s.roleId === 'doctor');
    const detectiveAlive = aliveSeats(g).find(s => s.roleId === 'detective');

    const steps = [
      { key: 'mafia', title: 'مافیا بیدار می‌شود', who: mafias.map(m => m.name).join(' و ') || '—', art: ROLES.mafia.art },
      { key: 'doctor', title: 'پزشک بیدار می‌شود', who: doctorAlive?.name || '—', art: ROLES.doctor.art },
      { key: 'detective', title: 'کارآگاه بیدار می‌شود', who: detectiveAlive?.name || '—', art: ROLES.detective.art }
    ];
    const cur = steps[step];

    // پرش از مراحل مربوط به نقش‌های حذف‌شده
    if ((cur.key === 'doctor' && !doctorAlive) || (cur.key === 'detective' && !detectiveAlive)) {
      state.nightStep = step + 1;
      if (state.nightStep > 2) return finishNight();
      return drawNight();
    }
    if (step > 2) return finishNight();

    const choose = (seatId) => {
      if (cur.key === 'mafia') state.nightMafia = seatId;
      if (cur.key === 'doctor') state.nightDoctor = seatId;
      if (cur.key === 'detective') {
        state.nightDetective = seatId;
        const s = seatById(g, seatId);
        state.detectiveResult = s.roleId === 'mafia' ? 'mafia' : 'not-mafia';
      }
      playSound('seal');
      state.nightStep = step + 1;
      if (state.nightStep > 2) finishNight();
      else render();
    };

    const selected = cur.key === 'mafia' ? state.nightMafia : cur.key === 'doctor' ? state.nightDoctor : state.nightDetective;

    return h('div', {},
      gameHeader({ title: `شب ${toFa(round)}`, onBack: () => confirmExit() }),
      sheet({ title: cur.title, iconName: 'skull', children: h('div', {},
        h('div', { style: { display: 'flex', gap: '.6rem', alignItems: 'center', marginBottom: '.6rem' } },
          h('div', { style: { width: '52px', height: '52px', flex: '0 0 52px', backgroundImage: `url(${cur.art})`, backgroundSize: 'cover', mixBlendMode: 'multiply' } }),
          h('div', { style: { fontSize: '.86rem', lineHeight: 1.8 } },
            h('div', {}, 'فقط ', h('strong', {}, cur.who), ' نگاه کند.'),
            h('div', { style: { fontSize: '.78rem', opacity: .75 } }, 'بقیه چشم‌ها بسته.')
          )
        ),
        cur.key === 'detective' && state.detectiveResult
          ? callout(state.detectiveResult === 'mafia' ? 'نتیجه: عضو مافیا است.' : 'نتیجه: عضو مافیا نیست.', 'check')
          : h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.4rem' } },
              ...targets
                .filter(s => (cur.key === 'mafia' ? s.roleId !== 'mafia' : true))
                .map(s => h('button', {
                  class: 'btn btn--sm',
                  style: selected === s.id ? { background: 'var(--rust)', color: '#fff' } : {},
                  onclick: () => choose(s.id)
                }, s.name))
            )
      ) }),
      callout('انتخاب را با انگشت خودت بزن؛ برنامه فقط نتیجه را ثبت می‌کند و به کسی نشان نمی‌دهد.', 'help')
    );

    function finishNight() {
      const g2 = state.game;
      try {
        const next = submitNight(g2, {
          mafiaTarget: state.nightMafia,
          doctorTarget: state.nightDoctor,
          detectiveTarget: state.nightDetective
        });
        state.game = next;
        state.screen = 'nightResult';
        state.nightStep = 0;
        state.nightMafia = state.nightDoctor = state.nightDetective = null;
        state.detectiveResult = null;
        playSound(next.winner ? 'win' : 'tap');
      } catch (e) {
        toast(e.message, 'warn');
      }
      render();
      return h('div');
    }

    function confirmExit() {
      if (confirm('از بازی خارج شوی؟ نقش‌ها پاک می‌شوند.')) onExit();
    }
  }

  /* ------------------------------ نتیجه‌ی شب ------------------------------ */
  function drawNightResult() {
    const g = state.game;
    const killed = g.lastNight?.killed;
    const victim = killed ? seatById(g, killed) : null;

    return h('div', {},
      gameHeader({ title: 'صبح', onBack: () => { state.screen = 'day'; render(); } }),
      sheet({ cls: 'stamp', children: h('div', { class: 'result-banner' },
        h('div', { class: 'result-banner__verdict' }, victim ? 'شب آرامی نبود' : 'شب آرام گذشت'),
        h('div', { class: 'result-banner__sub' },
          victim ? `${victim.name} از بازی حذف شد.` : 'هیچ‌کس حذف نشد.')
      ) }),
      victim ? sheet({ title: 'نقش بازیکن حذف‌شده', iconName: 'skull', children: h('div', { style: { display: 'flex', gap: '.6rem', alignItems: 'center' } },
        h('div', { style: { width: '46px', height: '46px', backgroundImage: `url(${ROLES[victim.roleId].art})`, backgroundSize: 'cover', mixBlendMode: 'multiply' } }),
        h('div', {}, h('strong', {}, ROLES[victim.roleId].label))
      ) }) : null,
      btn('روز شروع شود', {
        variant: 'btn--primary btn--block',
        onClick: () => {
          if (g.phase === 'gameOver') { state.screen = 'result'; }
          else { state.game = startDay(g); state.screen = 'day'; }
          playSound('paper-flip');
          render();
        }
      })
    );
  }

  /* ------------------------------ روز ------------------------------ */
  function drawDay() {
    const g = state.game;
    const alive = aliveSeats(g);

    return h('div', {},
      gameHeader({ title: `روز ${toFa(g.round)}`, onBack: () => confirmExit() }),
      sheet({ title: 'زنده‌ها', iconName: 'users', children: h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '.35rem' } },
        ...alive.map(s => h('span', { class: 'score-pill' }, s.name))
      ) }),
      sheet({ title: 'بحث کنید', iconName: 'clock', children: h('div', {},
        h('p', { style: { margin: 0, fontSize: '.88rem' } }, 'چند دقیقه بحث کنید: چه کسی مشکوک است؟ چه کسی ساکت مانده؟'),
        h('div', { style: { marginTop: '.7rem' } }, btn('شروع نامزدی و رأی‌گیری', {
          variant: 'btn--teal btn--block',
          onClick: () => { state.screen = 'vote'; state.selectedNominees = []; render(); }
        }))
      ) }),
      sheet({ title: 'حذف بازیکن (اگر بازی را ترک کرد)', iconName: 'x', children: h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '.35rem' } },
        ...alive.map(s => h('button', {
          class: 'btn btn--sm',
          onclick: () => {
            if (!confirm(`${s.name} از بازی خارج شود؟`)) return;
            const next = removePlayer(g, s.id);
            state.game = next;
            if (next.phase === 'gameOver') state.screen = 'result';
            render();
          }
        }, s.name))
      ) })
    );

    function confirmExit() { if (confirm('از بازی خارج شوی؟')) onExit(); }
  }

  /* ------------------------------ رأی‌گیری ------------------------------ */
  function drawVote() {
    const g = state.game;
    const alive = aliveSeats(g);
    const nominees = state.selectedNominees || [];

    if (nominees.length === 0) {
      return h('div', {},
        gameHeader({ title: 'نامزدی', onBack: () => { state.screen = 'day'; render(); } }),
        sheet({ title: 'چه کسانی نامزد می‌شوند؟ (حداکثر ۳ نفر)', iconName: 'users', children: h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.4rem' } },
          ...alive.map(s => h('button', {
            class: 'btn btn--sm',
            style: nominees.includes(s.id) ? { background: 'var(--navy)', color: '#fff' } : {},
            onclick: () => {
              const idx = nominees.indexOf(s.id);
              if (idx >= 0) nominees.splice(idx, 1);
              else if (nominees.length < 3) nominees.push(s.id);
              else toast('حداکثر ۳ نامزد', 'warn');
              state.selectedNominees = [...nominees];
              render();
            }
          }, s.name))
        ) }),
        btn(`رأی‌گیری با ${toFa(nominees.length)} نامزد`, {
          variant: 'btn--primary btn--block',
          disabled: nominees.length === 0,
          onClick: () => { state.screen = 'ballot'; render(); }
        })
      );
    }

    // رأی مخفی: هر بازیکن زنده نوبتی رأی می‌دهد
    const voterIdx = state.voterIdx || 0;
    if (voterIdx >= alive.length) {
      const result = castVotes(g, state.ballots || {});
      state.game = result;
      state.screen = result.phase === 'vote' ? 'runoff' : 'voteResult';
      render();
      return h('div');
    }

    const voter = alive[voterIdx];
    const cast = (target) => {
      state.ballots = { ...(state.ballots || {}), [voter.id]: target };
      state.voterIdx = voterIdx + 1;
      playSound('tap');
      render();
    };

    return h('div', {},
      gameHeader({ title: 'رأی مخفی', onBack: () => { state.screen = 'day'; render(); } }),
      sheet({ children: h('div', {},
        h('div', { style: { textAlign: 'center', fontSize: '1.05rem', fontWeight: 700, marginBottom: '.3rem' } }, `${voter.name} رأی می‌دهد`),
        h('div', { style: { textAlign: 'center', fontSize: '.82rem', opacity: .75, marginBottom: '.8rem' } }, 'گوشی را جوری بگیر که کسی نبیند.'),
        h('div', { style: { display: 'grid', gap: '.4rem' } },
          ...nominees.map(id => h('button', { class: 'btn btn--block', onclick: () => cast(id) }, seatById(g, id).name)),
          h('button', { class: 'btn btn--ghost btn--block', onclick: () => cast('abstain') }, 'ممتنع')
        )
      ) })
    );
  }

  /* ------------------------------ نتیجه‌ی رأی / پایان ------------------------------ */
  function drawVoteResult() {
    const g = state.game;
    const last = g.log.filter(l => l.type === 'vote').at(-1);
    const eliminated = last?.eliminated ? seatById(g, last.eliminated) : null;

    return h('div', {},
      gameHeader({ title: 'نتیجه‌ی رأی', onBack: () => onExit() }),
      sheet({ cls: 'stamp', children: h('div', { class: 'result-banner' },
        h('div', { class: 'result-banner__verdict' }, eliminated ? `${eliminated.name} حذف شد` : 'کسی حذف نشد'),
        h('div', { class: 'result-banner__sub' }, eliminated ? ROLES[eliminated.roleId].label : 'آرای مساوی یا ممتنع')
      ) }),
      g.phase === 'gameOver'
        ? btn('دیدن نتیجه‌ی نهایی', { variant: 'btn--primary btn--block', onClick: () => { state.screen = 'result'; render(); } })
        : btn('شب بعد', { variant: 'btn--teal btn--block', onClick: () => { state.game = { ...g, phase: 'night' }; state.screen = 'night'; state.nightStep = 0; render(); } })
    );
  }

  function drawResult() {
    const g = state.game;
    const winner = g.winner;
    const isMafia = winner === 'mafia';
    if (!state.recorded) {
      state.recorded = true;
      stats.record('mafia', { label: isMafia ? 'برد مافیا' : 'برد شهروندان' });
      playSound(isMafia ? 'lose' : 'win');
    }

    return h('div', {},
      gameHeader({ title: 'پایان بازی', onBack: onExit }),
      sheet({ cls: 'stamp', children: h('div', { class: 'result-banner' },
        h('div', { style: { fontSize: '2rem', marginBottom: '.3rem' } }, isMafia ? '🎭' : '🏛️'),
        h('div', { class: 'result-banner__verdict' }, isMafia ? 'مافیا برد' : 'شهروندان بردند'),
        h('div', { class: 'result-banner__sub' }, `${toFa(g.round)} شب و روز بازی شد.`)
      ) }),
      sheet({ title: 'نقش همه', iconName: 'skull', children: h('div', { style: { display: 'grid', gap: '.35rem', fontSize: '.86rem' } },
        ...g.seats.map(s => h('div', { style: { display: 'flex', justifyContent: 'space-between', opacity: s.alive ? 1 : .55 } },
          h('span', {}, s.name, s.alive ? '' : ' (حذف)'),
          h('strong', {}, ROLES[s.roleId].label)
        ))
      ) }),
      h('div', { style: { display: 'grid', gap: '.5rem' } },
        btn('بازی دوباره', { variant: 'btn--primary btn--block', onClick: () => { state = { screen: 'setup', count: g.seats.length }; render(); } }),
        btn('بازگشت به خانه', { variant: 'btn--ghost btn--block', onClick: onExit })
      )
    );
  }

  return () => { /* پاک‌سازی: هیچ تایمر فعالی نیست */ };
}
