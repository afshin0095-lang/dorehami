/* ============================================================
   «شب‌های محاصره» — رابط بقا
   کارت‌های رویداد با لبهٔ سوخته، تابلوی منابع، بازمانده‌های خسته.
   ============================================================ */

import { h, mount, playSound, stats, toFa } from '../core.js';
import {
  RESOURCES, SURVIVORS, DAY_JOBS, DIFFICULTY, RULES, DAYS,
  createSiege, doJob, chooseNight, needsOf, aliveSurvivors,
  isOver, scoreOf
} from '../engines/siege.js';
import { gameHeader, sheet, btn, helpBlock } from '../ui/kit.js';

const HELP = RULES;

const CONDITION = (s) => {
  if (!s.alive) return { text: 'از پا افتاد', cls: 'is-dead' };
  if (s.hp <= 3) return { text: 'در آستانه', cls: 'is-critical' };
  if (s.wound >= 2) return { text: 'زخمی', cls: 'is-hurt' };
  if (s.hunger >= 3) return { text: 'گرسنه', cls: 'is-hungry' };
  if (s.fatigue >= 3) return { text: 'خسته', cls: 'is-tired' };
  return { text: 'سالم', cls: '' };
};

export function mountGame(root, { onExit } = {}) {
  let screen = 'intro';
  let difficulty = 'normal';
  let game = null;
  let msg = '';
  let mounted = true;

  const render = () => mount(root, draw());
  render();

  function draw() {
    if (screen === 'help') return drawHelp();
    if (screen === 'play') return drawPlay();
    if (screen === 'end') return drawEnd();
    return drawIntro();
  }

  function start() {
    game = createSiege({ seed: (Date.now() ^ Math.random() * 1e9) >>> 0, difficulty });
    msg = '';
    screen = 'play';
    playSound('paper-flip');
    render();
  }

  function finish() {
    if (!game || game._recorded) return;
    game._recorded = true;
    playSound(game.winner === 'survivors' ? 'seal' : 'error');
    stats.record('siege', {
      key: 'siege-best', best: scoreOf(game), higherIsBetter: true, label: 'بهترین امتیاز'
    });
    screen = 'end';
    render();
  }

  /* ------------------------------ مقدمه ------------------------------ */
  function drawIntro() {
    return h('div', {},
      gameHeader({ title: 'شب‌های محاصره', onBack: onExit }),

      h('section', { class: 'siege-hero print-edge' },
        h('div', { class: 'siege-hero__frame', 'aria-hidden': 'true' }, h('span', {}, '❖')),
        h('div', { class: 'siege-hero__text' },
          h('div', { class: 'siege-hero__kicker' }, 'بازی بقا · تک‌نفره · کارتی'),
          h('h1', {}, 'دوازده روز، سه نفر، یک شهر'),
          h('p', {}, 'شهر محاصره شده. هر روز یک کار انتخاب می‌کنی، هر شب یک رویداد می‌آید. غذا کم است و هیچ انتخابی بی‌هزینه نیست.')
        )
      ),

      sheet({ title: 'سختی', iconName: 'crown', children: h('div', { class: 'level-row' },
        ...Object.entries(DIFFICULTY).map(([id, d]) => h('button', {
          class: `level-card${difficulty === id ? ' is-on' : ''}`,
          'aria-pressed': String(difficulty === id),
          onclick: () => { difficulty = id; playSound('tap'); render(); }
        },
          h('div', { class: 'level-card__name' }, d.label),
          h('div', { class: 'level-card__meta' },
            id === 'easy' ? 'نیاز کم' : id === 'normal' ? 'نیاز میانه' : 'نیاز زیاد')
        ))
      ) }),

      h('div', { class: 'siege-brief' },
        h('strong', {}, 'بازمانده‌ها'),
        ...SURVIVORS.map(s => h('span', { class: 'siege-brief__row' },
          h('span', { class: 'siege-brief__name' }, s.name),
          h('span', { class: 'siege-brief__role' }, s.role)
        ))
      ),

      h('div', { class: 'spot-actions' },
        btn('شروع محاصره', { variant: 'btn--primary btn--block', onClick: start }),
        btn('راهنما', { onClick: () => { screen = 'help'; render(); } })
      )
    );
  }

  function drawHelp() {
    return h('div', {},
      gameHeader({ title: 'راهنمای محاصره', onBack: () => { screen = 'intro'; render(); } }),
      sheet({ title: 'قواعد', iconName: 'book', children: helpBlock(HELP) }),
      h('div', { class: 'stack' },
        btn('فهمیدم', { variant: 'btn--primary btn--block', onClick: () => { screen = 'intro'; render(); } })
      )
    );
  }

  /* ------------------------------ بازی ------------------------------ */
  function drawPlay() {
    if (!game) return drawIntro();
    const need = needsOf(game);
    const isDay = game.phase === 'day';
    const canAfford = (job) => Object.entries(job.costs).every(([k, v]) =>
      k === 'fatigue' || (game.res[k] || 0) >= v);

    return h('div', {},
      gameHeader({
        title: `روز ${toFa(game.day)} از ${toFa(game.maxDays)}`,
        onBack: () => { screen = 'intro'; render(); },
        children: [
          h('span', { class: 'score-pill' }, `جان ${toFa(aliveSurvivors(game).reduce((a, s) => a + s.hp, 0))}`),
          h('span', { class: 'score-pill' }, `اخلاق ${toFa(game.morale)}`)
        ]
      }),

      /* منابع */
      h('section', { class: 'siege-res', 'aria-label': 'منابع' },
        ...Object.values(RESOURCES).map(r => h('div', {
          class: `siege-res__item${r.id === 'food' && game.res.food < need ? ' is-low' : ''}`,
          style: `--res:${r.hex}`
        },
          h('span', { class: 'siege-res__glyph', 'aria-hidden': 'true' }, r.glyph),
          h('span', { class: 'siege-res__num' }, toFa(game.res[r.id] || 0)),
          h('span', { class: 'siege-res__name' }, r.name)
        )),
        h('div', { class: 'siege-res__item is-need' },
          h('span', { class: 'siege-res__glyph', 'aria-hidden': 'true' }, '⌂'),
          h('span', { class: 'siege-res__num' }, toFa(game.defense)),
          h('span', { class: 'siege-res__name' }, 'استحکام')
        )
      ),

      /* بازمانده‌ها */
      h('section', { class: 'siege-crew', 'aria-label': 'بازمانده‌ها' },
        ...game.survivors.map(s => {
          const c = CONDITION(s);
          return h('div', { class: `siege-person ${c.cls}`, style: `--who:${s.hex}` },
            h('div', { class: 'siege-person__top' },
              h('span', { class: 'siege-person__name' }, s.name),
              h('span', { class: 'siege-person__cond' }, c.text)
            ),
            h('div', { class: 'siege-person__bar', role: 'img', 'aria-label': `جان ${s.hp} از ۱۰` },
              h('span', { class: 'siege-person__fill', style: `width:${Math.max(0, Math.min(100, s.hp * 10))}%` })
            ),
            h('div', { class: 'siege-person__tags' },
              s.hunger >= 2 ? h('span', { class: 'siege-tag' }, `گرسنگی ${toFa(s.hunger)}`) : null,
              s.wound >= 1 ? h('span', { class: 'siege-tag is-warn' }, `زخم ${toFa(s.wound)}`) : null,
              s.fatigue >= 2 ? h('span', { class: 'siege-tag' }, `خستگی ${toFa(s.fatigue)}`) : null,
              !s.hunger && !s.wound && !s.fatigue ? h('span', { class: 'siege-tag is-ok' }, 'آسوده') : null
            )
          );
        })
      ),

      /* فاز روز: کارها */
      isDay ? h('section', { class: 'siege-jobs' },
        h('h3', { class: 'siege-jobs__title' }, 'کار امروز'),
        ...DAY_JOBS.map(job => {
          const ok = canAfford(job);
          return h('button', {
            class: `siege-job${ok ? '' : ' is-locked'}`,
            disabled: !ok,
            onclick: () => takeJob(job.id)
          },
            h('span', { class: 'siege-job__name' }, job.name),
            h('span', { class: 'siege-job__desc' }, job.desc),
            h('span', { class: 'siege-job__cost' },
              Object.entries(job.costs).map(([k, v]) =>
                k === 'fatigue' ? `${toFa(v)} خستگی` : `${toFa(v)} ${RESOURCES[k].name}`
              ).join(' · ') || 'بی‌هزینه'
            )
          );
        })
      ) : null,

      /* فاز شب: کارت رویداد */
      !isDay && game.nightCard ? h('section', { class: 'siege-card' },
        h('div', { class: 'siege-card__kind' },
          game.nightCard.kind === 'threat' ? 'تهدید'
            : game.nightCard.kind === 'moral' ? 'تصمیم اخلاقی'
            : game.nightCard.kind === 'crisis' ? 'بحران' : 'اقبال'),
        h('h3', { class: 'siege-card__title' }, game.nightCard.title),
        h('p', { class: 'siege-card__body' }, game.nightCard.body),
        h('div', { class: 'siege-card__choices' },
          ...game.nightCard.choices.map(ch => h('button', {
            class: 'siege-choice',
            onclick: () => takeChoice(ch.id)
          },
            h('span', { class: 'siege-choice__label' }, ch.label),
            ch.note ? h('span', { class: 'siege-choice__note' }, ch.note) : null
          ))
        )
      ) : null,

      msg ? h('div', { class: 'spot-msg' }, msg) : null,

      /* گزارش */
      game.log.length ? h('section', { class: 'siege-log' },
        h('h3', {}, 'دفترچه'),
        ...[...game.log].reverse().slice(0, 6).map(l => h('p', { class: 'siege-log__row' },
          h('span', { class: 'siege-log__day' }, `ر${toFa(l.day)}`),
          h('span', {}, l.text)
        ))
      ) : null
    );
  }

  function takeJob(id) {
    const r = doJob(game, id);
    if (!r.ok) { msg = r.error; playSound('error'); render(); return; }
    game = r.game;
    msg = game.lastReport;
    playSound('card-slide');
    render();
  }

  function takeChoice(id) {
    const r = chooseNight(game, id);
    if (!r.ok) { msg = r.error; playSound('error'); render(); return; }
    game = r.game;
    msg = game.lastReport;
    if (isOver(game)) { finish(); return; }
    playSound('paper-flip');
    render();
  }

  /* ------------------------------ پایان ------------------------------ */
  function drawEnd() {
    const won = game.winner === 'survivors';
    const alive = aliveSurvivors(game);
    return h('div', {},
      gameHeader({ title: won ? 'صبح آزادی' : 'شهر ساکت شد', onBack: onExit }),
      h('section', { class: 'spot-end' },
        h('div', { class: 'spot-end__seal', 'aria-hidden': 'true' }, won ? '❖' : '✕'),
        h('h2', {}, won ? 'تا پایان دوام آوردی' : 'کسی نماند'),
        h('div', { class: 'spot-end__stats' },
          h('span', {}, `روز: ${toFa(game.day)}`),
          h('span', {}, `زنده: ${toFa(alive.length)}`),
          h('span', {}, `اخلاق: ${toFa(game.morale)}`),
          h('span', { class: 'spot-end__score' }, `امتیاز: ${toFa(scoreOf(game))}`)
        ),
        h('div', { class: 'siege-endcrew' },
          ...game.survivors.map(s => h('span', { class: `siege-endcrew__row${s.alive ? '' : ' is-dead'}` },
            `${s.name}${s.alive ? '' : ' — نیست'}`))
        ),
        h('div', { class: 'btn-row' },
          btn('دوباره', { variant: 'btn--primary', onClick: start }),
          btn('تغییر سختی', { onClick: () => { screen = 'intro'; render(); } })
        )
      )
    );
  }

  return () => { mounted = false; game = null; };
}
