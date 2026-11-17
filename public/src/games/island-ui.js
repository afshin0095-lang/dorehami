/* ============================================================
   «جزیرهٔ گم‌شده» — رابط بقا و ساخت‌وساز
   کارت ماجراجویی، تابلوی منابع، نقشهٔ ساخت.
   ============================================================ */

import { h, mount, playSound, stats, toFa } from '../core.js';
import {
  GOODS, BUILDS, ACTIONS, SKILLS, DIFFICULTY, RULES,
  createIsland, act, canBuild, progressOf, isOver, scoreOf
} from '../engines/island.js';
import { gameHeader, sheet, btn, helpBlock } from '../ui/kit.js';

const HELP = RULES;

export function mountGame(root, { onExit } = {}) {
  let screen = 'intro';
  let difficulty = 'normal';
  let game = null;
  let msg = '';
  let showBuild = false;
  let lastCard = null;
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
    game = createIsland({ seed: (Date.now() ^ Math.random() * 1e9) >>> 0, difficulty });
    msg = ''; showBuild = false; lastCard = null;
    screen = 'play';
    playSound('paper-flip');
    render();
  }

  function finish() {
    if (!game || game._recorded) return;
    game._recorded = true;
    playSound(game.winner === 'castaway' ? 'seal' : 'error');
    stats.record('island', {
      key: 'island-best', best: scoreOf(game), higherIsBetter: true, label: 'بهترین امتیاز'
    });
    screen = 'end';
    render();
  }

  /* ------------------------------ مقدمه ------------------------------ */
  function drawIntro() {
    return h('div', {},
      gameHeader({ title: 'جزیرهٔ گم‌شده', onBack: onExit }),

      h('section', { class: 'island-hero print-edge' },
        h('div', { class: 'island-hero__frame', 'aria-hidden': 'true' }, h('span', {}, '⚓')),
        h('div', { class: 'island-hero__text' },
          h('div', { class: 'island-hero__kicker' }, 'بقا و ساخت‌وساز · تک‌نفره'),
          h('h1', {}, 'یک جزیره، دو کنش در روز'),
          h('p', {}, 'کشتی‌ات شکسته. باید پیش از آمدن زمستان قایق بسازی. هر کنش تاس می‌خواهد و هر دور آذوقه می‌سوزد.')
        )
      ),

      sheet({ title: 'سختی', iconName: 'crown', children: h('div', { class: 'level-row' },
        ...Object.entries(DIFFICULTY).map(([id, d]) => h('button', {
          class: `level-card${difficulty === id ? ' is-on' : ''}`,
          'aria-pressed': String(difficulty === id),
          onclick: () => { difficulty = id; playSound('tap'); render(); }
        },
          h('div', { class: 'level-card__name' }, d.label),
          h('div', { class: 'level-card__meta' }, `${toFa(d.rounds)} دور`)
        ))
      ) }),

      h('div', { class: 'island-brief' },
        h('strong', {}, 'چهار ساخت‌وساز'),
        ...BUILDS.map(b => h('span', { class: 'island-brief__row' },
          h('span', { class: 'island-brief__name' }, b.name),
          h('span', { class: 'island-brief__eff' }, b.effect)
        ))
      ),

      h('div', { class: 'spot-actions' },
        btn('پیاده شدن', { variant: 'btn--primary btn--block', onClick: start }),
        btn('راهنما', { onClick: () => { screen = 'help'; render(); } })
      )
    );
  }

  function drawHelp() {
    return h('div', {},
      gameHeader({ title: 'راهنمای جزیره', onBack: () => { screen = 'intro'; render(); } }),
      sheet({ title: 'قواعد', iconName: 'book', children: helpBlock(HELP) }),
      h('div', { class: 'stack' },
        btn('فهمیدم', { variant: 'btn--primary btn--block', onClick: () => { screen = 'intro'; render(); } })
      )
    );
  }

  /* ------------------------------ بازی ------------------------------ */
  function drawPlay() {
    if (!game) return drawIntro();
    const raft = progressOf(game).raft;

    return h('div', {},
      gameHeader({
        title: `دور ${toFa(game.round)} از ${toFa(game.maxRounds)}`,
        onBack: () => { screen = 'intro'; render(); },
        children: [
          h('span', { class: 'score-pill' }, `کنش ${toFa(game.actionsLeft)}`),
          h('span', { class: 'score-pill' }, `جان ${toFa(game.hp)}`),
          h('span', { class: 'score-pill' }, `روحیه ${toFa(game.morale)}`)
        ]
      }),

      /* منابع */
      h('section', { class: 'island-res', 'aria-label': 'منابع' },
        ...Object.values(GOODS).map(g => h('div', {
          class: 'island-res__item', style: `--res:${g.hex}`
        },
          h('span', { class: 'island-res__glyph', 'aria-hidden': 'true' }, g.glyph),
          h('span', { class: 'island-res__num' }, toFa(game.res[g.id] || 0)),
          h('span', { class: 'island-res__name' }, g.name)
        ))
      ),

      /* نوار وضعیت */
      h('div', { class: 'island-bars' },
        bar('جان', game.hp, game.maxHp, '#7d9b6a'),
        bar('روحیه', game.morale, 10, '#7a5a8a'),
        bar('زخم', game.wound, 5, '#a33d2c', true)
      ),

      /* ساخت‌شده‌ها */
      game.built.length ? h('div', { class: 'island-built' },
        ...game.built.map(id => {
          const b = BUILDS.find(x => x.id === id);
          return h('span', { class: 'island-built__chip', style: `--built:${b.hex}` },
            h('span', { 'aria-hidden': 'true' }, '✓'), b.name);
        })
      ) : null,

      /* کارت ماجراجویی آخر */
      lastCard ? h('section', { class: `island-card${lastCard.kind === 'peril' ? ' is-peril' : ''}` },
        h('div', { class: 'island-card__kind' }, lastCard.kind === 'peril' ? 'بلا' : 'یاری'),
        h('h3', { class: 'island-card__title' }, lastCard.title),
        h('p', { class: 'island-card__body' }, lastCard.text),
        h('div', { class: 'island-card__effects' },
          ...Object.entries(lastCard.effect).map(([k, v]) => h('span', {
            class: `island-eff${v < 0 ? ' is-neg' : ''}`
          }, `${GOODS[k]?.name || (k === 'morale' ? 'روحیه' : k === 'wound' ? 'زخم' : k)} ${v > 0 ? '+' : ''}${toFa(v)}`))
        )
      ) : null,

      /* کنش‌ها */
      game.phase === 'act' ? h('section', { class: 'island-actions' },
        h('h3', { class: 'island-actions__title' }, 'کنش'),
        ...ACTIONS.filter(a => a.id !== 'build').map(a => h('button', {
          class: 'island-action',
          disabled: game.actionsLeft <= 0,
          onclick: () => takeAction(a.id)
        },
          h('span', { class: 'island-action__name' }, a.name),
          h('span', { class: 'island-action__desc' }, a.desc),
          a.diff > 0 ? h('span', { class: 'island-action__diff' },
            `${SKILLS[a.skill]?.name || '—'} ${toFa(game.skills[a.skill] || 0)} · دشواری ${toFa(a.diff)}`) : null
        )),
        h('button', {
          class: 'island-action is-build',
          disabled: game.actionsLeft <= 0,
          onclick: () => { showBuild = !showBuild; playSound('tap'); render(); }
        },
          h('span', { class: 'island-action__name' }, 'ساخت‌وسازی'),
          h('span', { class: 'island-action__desc' }, showBuild ? 'بستن' : 'سرپناه، آتشگاه، تله، قایق')
        )
      ) : null,

      /* لیست ساخت */
      showBuild && game.phase === 'act' ? h('section', { class: 'island-builds' },
        ...BUILDS.map(b => {
          const ok = canBuild(game, b.id);
          const done = game.built.includes(b.id);
          return h('button', {
            class: `island-build${done ? ' is-done' : ''}${ok ? '' : ' is-locked'}`,
            disabled: !ok,
            onclick: () => takeAction('build', b.id)
          },
            h('span', { class: 'island-build__name' }, b.name),
            h('span', { class: 'island-build__eff' }, b.effect),
            h('span', { class: 'island-build__cost' },
              done ? 'ساخته شده' : Object.entries(b.cost)
                .map(([k, v]) => `${toFa(v)} ${GOODS[k].name}`).join(' · '))
          );
        })
      ) : null,

      msg ? h('div', { class: 'spot-msg' }, msg) : null,

      /* گزارش */
      game.log.length ? h('section', { class: 'island-log' },
        h('h3', {}, 'دفترچه'),
        ...[...game.log].reverse().slice(0, 7).map(l => h('p', { class: 'island-log__row' },
          h('span', { class: 'island-log__round' }, `د${toFa(l.round)}`),
          h('span', {}, l.text)
        ))
      ) : null
    );
  }

  function bar(label, value, max, color, invert = false) {
    const pct = Math.max(0, Math.min(100, (value / max) * 100));
    return h('div', { class: 'island-bar', role: 'img', 'aria-label': `${label}: ${value} از ${max}` },
      h('span', { class: 'island-bar__label' }, label),
      h('span', { class: 'island-bar__track' },
        h('span', {
          class: `island-bar__fill${invert ? ' is-inv' : ''}`,
          style: `width:${pct}%;--bar:${color}`
        })
      ),
      h('span', { class: 'island-bar__num' }, `${toFa(value)}/${toFa(max)}`)
    );
  }

  function takeAction(id, buildId) {
    if (game.actionsLeft <= 0) { msg = 'کنشی نمانده — دور عوض می‌شود.'; render(); return; }
    const r = act(game, id, { buildId });
    if (!r.ok) { msg = r.error; playSound('error'); render(); return; }
    game = r.game;
    if (r.card) lastCard = r.card;
    if (id === 'build') { showBuild = false; msg = 'ساخت انجام شد.'; }
    else if (id === 'explore' && r.card) msg = `ماجرا: ${r.card.title}`;
    else if (r.success === false) msg = 'ناموفق بود.';
    else msg = 'انجام شد.';
    if (isOver(game)) { finish(); return; }
    playSound(id === 'explore' ? 'card-slide' : 'paper-flip');
    render();
  }

  /* ------------------------------ پایان ------------------------------ */
  function drawEnd() {
    const won = game.winner === 'castaway';
    return h('div', {},
      gameHeader({ title: won ? 'آب‌های آزاد' : 'جزیره نگهت داشت', onBack: onExit }),
      h('section', { class: 'spot-end' },
        h('div', { class: 'spot-end__seal', 'aria-hidden': 'true' }, won ? '⚓' : '✕'),
        h('h2', {}, won ? 'قایق به آب افتاد' : 'زمستان آمد'),
        h('div', { class: 'spot-end__stats' },
          h('span', {}, `دور: ${toFa(game.round)}`),
          h('span', {}, `جان: ${toFa(game.hp)}`),
          h('span', {}, `روحیه: ${toFa(game.morale)}`),
          h('span', { class: 'spot-end__score' }, `امتیاز: ${toFa(scoreOf(game))}`)
        ),
        h('div', { class: 'island-endbuilt' },
          game.built.length
            ? game.built.map(id => BUILDS.find(b => b.id === id)?.name).join(' · ')
            : 'هیچ نساختی'
        ),
        h('div', { class: 'btn-row' },
          btn('دوباره', { variant: 'btn--primary', onClick: start }),
          btn('جزیرهٔ دیگر', { onClick: () => { screen = 'intro'; render(); } })
        )
      )
    );
  }

  return () => { mounted = false; game = null; };
}
