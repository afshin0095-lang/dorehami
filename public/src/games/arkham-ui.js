/* ============================================================
   «آرکام: نشانه‌های آشوب» — رابط کارتی-تحقیقی
   کیف آشوب، کارت پژوهشگر، اجندای عذاب، دارایی‌های در بازی.
   ============================================================ */

import { h, mount, playSound, stats, toFa } from '../core.js';
import {
  SKILLS, INVESTIGATORS, ASSETS, ASSET_BY_ID, ACTS, AGENDAS, ENEMIES, DIFFICULTY, RULES,
  createArkham, investigatorOf, effectiveStat, maxHpOf, maxSanityOf,
  investigate, fight, evade, playAsset, drawCard, rest, endTurn,
  isOver, currentAct, currentAgenda, spawnEnemy, scoreOf
} from '../engines/arkham.js';
import { gameHeader, sheet, btn, helpBlock, levelArt } from '../ui/kit.js';

const HELP = RULES;

export function mountGame(root, { onExit } = {}) {
  let screen = 'intro';
  let difficulty = 'normal';
  let investigatorId = 'roland';
  let game = null;
  let msg = '';
  let lastTest = null;
  let envelope = false;      // نمایش کارت آخر
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
    game = createArkham({
      seed: (Date.now() ^ Math.random() * 1e9) >>> 0,
      investigatorId, difficulty
    });
    msg = ''; lastTest = null; envelope = false;
    screen = 'play';
    playSound('paper-flip');
    render();
  }

  function finish() {
    if (!game || game._recorded) return;
    game._recorded = true;
    playSound(game.winner === 'investigator' ? 'seal' : 'error');
    stats.record('arkham', {
      key: 'arkham-best', best: scoreOf(game), higherIsBetter: true, label: 'بهترین امتیاز'
    });
    screen = 'end';
    render();
  }

  /* ------------------------------ مقدمه ------------------------------ */
  function drawIntro() {
    const inv = INVESTIGATORS.find(i => i.id === investigatorId) || INVESTIGATORS[0];
    return h('div', {},
      gameHeader({ title: 'آرکام: نشانه‌های آشوب', onBack: onExit }),

      h('section', { class: 'ark-hero print-edge' },
        h('div', { class: 'ark-hero__frame', 'aria-hidden': 'true' }, h('span', {}, '◈')),
        h('div', { class: 'ark-hero__text' },
          h('div', { class: 'ark-hero__kicker' }, 'کارتی-تحقیقی · تک‌نفره'),
          h('h1', {}, 'کیسهٔ آشوب را بردار'),
          h('p', {}, 'سه کنش در نوبت. هر آزمون از کیف نشانه می‌کشد — نشانهٔ چادر همیشه شکست است. اجندا هر نوبت یک عذاب می‌گیرد.')
        )
      ),

      sheet({ title: 'پژوهشگر', iconName: 'user', children: h('div', { class: 'ark-investigators' },
        ...INVESTIGATORS.map(i => h('button', {
          class: `ark-inv${investigatorId === i.id ? ' is-on' : ''}`,
          style: `--inv:${i.hex}`,
          'aria-pressed': String(investigatorId === i.id),
          onclick: () => { investigatorId = i.id; playSound('tap'); render(); }
        },
          h('span', { class: 'ark-inv__name' }, i.name),
          h('span', { class: 'ark-inv__role' }, i.role),
          h('span', { class: 'ark-inv__stats' },
            `${toFa(i.stats.will)}/${toFa(i.stats.intellect)}/${toFa(i.stats.combat)}/${toFa(i.stats.agility)}`),
          h('span', { class: 'ark-inv__perk' }, i.perk)
        ))
      ) }),

      sheet({ title: 'سختی', iconName: 'crown', children: h('div', { class: 'level-row' },
        ...Object.entries(DIFFICULTY).map(([id, d]) => h('button', {
          class: `level-card${difficulty === id ? ' is-on' : ''}`,
          'aria-pressed': String(difficulty === id),
          style: `--lvl-art:url('${levelArt(id)}')`,
          onclick: () => { difficulty = id; playSound('tap'); render(); }
        },
          h('div', { class: 'level-card__name' }, d.label),
          h('div', { class: 'level-card__meta' }, `${toFa(d.actions)} کنش`)
        ))
      ) }),

      h('div', { class: 'ark-brief' },
        h('strong', {}, 'این پژوهشگر'),
        h('span', {}, `${inv.name} — ${inv.role}`),
        h('span', { class: 'ark-brief__perk' }, inv.perk),
        h('span', { class: 'ark-brief__stat' },
          `جان ${toFa(inv.hp)} · روان ${toFa(inv.sanity)}`)
      ),

      h('div', { class: 'spot-actions' },
        btn('شروع تحقیق', { variant: 'btn--primary btn--block', onClick: start }),
        btn('راهنما', { onClick: () => { screen = 'help'; render(); } })
      )
    );
  }

  function drawHelp() {
    return h('div', {},
      gameHeader({ title: 'راهنمای آرکام', onBack: () => { screen = 'intro'; render(); } }),
      sheet({ title: 'قواعد', iconName: 'book', children: helpBlock(HELP) }),
      h('div', { class: 'stack' },
        btn('فهمیدم', { variant: 'btn--primary btn--block', onClick: () => { screen = 'intro'; render(); } })
      )
    );
  }

  /* ------------------------------ بازی ------------------------------ */
  function drawPlay() {
    if (!game) return drawIntro();
    const inv = investigatorOf(game);
    const act = currentAct(game);
    const agenda = currentAgenda(game);
    const hpMax = maxHpOf(game), sanMax = maxSanityOf(game);

    return h('div', {},
      gameHeader({
        title: inv.name,
        onBack: () => { screen = 'intro'; render(); },
        children: [
          h('span', { class: 'score-pill' }, `کنش ${toFa(game.actionsLeft)}`),
          h('span', { class: 'score-pill' }, `جان ${toFa(game.hp)}`),
          h('span', { class: 'score-pill' }, `روان ${toFa(game.sanity)}`),
          h('span', { class: 'score-pill' }, `منبع ${toFa(game.res)}`)
        ]
      }),

      /* نوارهای جان/روان */
      h('div', { class: 'ark-bars' },
        bar('جان', game.hp, hpMax, '#8a4a3a'),
        bar('روان', game.sanity, sanMax, '#4a5a8a'),
        bar('عذاب', game.doom, agenda.doomMax, '#6b3a5a', true)
      ),

      /* اجندا و پرده */
      h('div', { class: 'ark-track' },
        h('div', { class: 'ark-track__slot' },
          h('span', { class: 'ark-track__label' }, 'پرده'),
          h('span', { class: 'ark-track__name' }, act.name),
          h('span', { class: 'ark-track__prog' }, `${toFa(game.actClues)}/${toFa(act.need)} سرنخ`)
        ),
        h('div', { class: 'ark-track__slot is-doom' },
          h('span', { class: 'ark-track__label' }, 'اجندا'),
          h('span', { class: 'ark-track__name' }, agenda.name),
          h('span', { class: 'ark-track__prog' }, `${toFa(game.doom)}/${toFa(agenda.doomMax)} عذاب`)
        )
      ),

      /* دشمنان درگیر */
      game.engaged.length ? h('section', { class: 'ark-enemies' },
        h('h3', { class: 'ark-enemies__title' }, 'درگیر'),
        ...game.engaged.map(e => {
          const base = ENEMIES.find(x => x.id === e.id);
          return h('button', {
            class: 'ark-enemy',
            style: `--foe:${base.hex}`,
            onclick: () => doFight(e.uid)
          },
            h('span', { class: 'ark-enemy__glyph', 'aria-hidden': 'true' }, base.glyph),
            h('span', { class: 'ark-enemy__name' }, base.name),
            h('span', { class: 'ark-enemy__hp' }, `${toFa(e.hp)}/${toFa(e.maxHp)}`),
            h('span', { class: 'ark-enemy__atk' }, `نبرد ${toFa(base.fight)}`)
          );
        })
      ) : null,

      /* آزمون آخر */
      lastTest ? testCard(lastTest) : null,

      /* دارایی‌های در بازی */
      game.assetsInPlay.length ? h('div', { class: 'ark-assets' },
        ...game.assetsInPlay.map(id => {
          const a = ASSET_BY_ID[id];
          return h('span', { class: 'ark-asset', style: `--ast:${a.hex}` }, a.name);
        })
      ) : null,

      /* دست کارت‌ها */
      h('section', { class: 'ark-hand', 'aria-label': 'دست' },
        ...game.hand.map(id => {
          const a = ASSET_BY_ID[id];
          if (!a) return null;
          const affordable = game.res >= a.cost;
          return h('button', {
            class: `ark-card${affordable ? '' : ' is-locked'}${envelope ? ' is-env' : ''}`,
            style: `--ast:${a.hex}`,
            disabled: !affordable || game.actionsLeft <= 0,
            onclick: () => doPlay(id)
          },
            h('span', { class: 'ark-card__cost' }, toFa(a.cost)),
            h('span', { class: 'ark-card__name' }, a.name),
            h('span', { class: 'ark-card__text' }, a.text)
          );
        })
      ),

      /* کنش‌ها */
      h('div', { class: 'ark-actions' },
        actionBtn('بررسی', 'intellect', doInvestigate),
        actionBtn('نبرد', 'combat', () => doFight()),
        actionBtn('فرار', 'agility', doEvade),
        actionBtn('استراحت', null, doRest),
        h('button', {
          class: 'ark-act is-draw',
          disabled: game.actionsLeft <= 0 || !game.deck.length,
          onclick: doDraw
        },
          h('span', { class: 'ark-act__name' }, 'کشیدن'),
          h('span', { class: 'ark-act__meta' }, `منبع +۱`)
        )
      ),

      msg ? h('div', { class: 'spot-msg' }, msg) : null,

      h('div', { class: 'ark-footer' },
        btn('پایان نوبت', {
          variant: 'btn--primary btn--block',
          onClick: () => {
            const r = endTurn(game);
            if (!r.ok) { msg = r.error; render(); return; }
            game = r.game;
            msg = '';
            if (isOver(game)) { finish(); return; }
            playSound('card-slide');
            render();
          }
        })
      ),

      /* گزارش */
      game.log.length ? h('section', { class: 'ark-log' },
        h('h3', {}, 'گزارش'),
        ...[...game.log].reverse().slice(0, 6).map(l => h('p', { class: 'ark-log__row' },
          h('span', { class: 'ark-log__turn' }, `ن${toFa(l.turn)}`),
          h('span', {}, l.text)
        ))
      ) : null
    );
  }

  function bar(label, value, max, color, invert = false) {
    const pct = Math.max(0, Math.min(100, (value / max) * 100));
    return h('div', { class: 'ark-bar', role: 'img', 'aria-label': `${label}: ${value} از ${max}` },
      h('span', { class: 'ark-bar__label' }, label),
      h('span', { class: 'ark-bar__track' },
        h('span', { class: `ark-bar__fill${invert ? ' is-inv' : ''}`, style: `width:${pct}%;--bar:${color}` })
      ),
      h('span', { class: 'ark-bar__num' }, `${toFa(value)}/${toFa(max)}`)
    );
  }

  function testCard(t) {
    const skill = SKILLS[t.stat];
    return h('section', { class: `ark-test${t.success ? ' is-ok' : ' is-fail'}` },
      h('div', { class: 'ark-test__head' },
        h('span', { class: 'ark-test__label' }, t.label || 'آزمون'),
        h('span', { class: 'ark-test__verdict' }, t.success ? 'موفق' : 'ناموفق')
      ),
      h('div', { class: 'ark-test__math' },
        h('span', {}, `${skill?.name || ''} ${toFa(t.base)}`),
        t.bonus ? h('span', { class: 'ark-test__plus' }, `+${toFa(t.bonus)}` ) : null,
        h('span', { class: `ark-test__token${t.autoFail ? ' is-auto' : ''}` },
          `${t.tokenLabel}${t.autoFail ? '' : ` ${t.tokenValue >= 0 ? '+' : ''}${toFa(t.tokenValue)}`}`),
        h('span', {}, '='),
        h('span', { class: 'ark-test__total' }, toFa(t.total)),
        h('span', {}, `≥ ${toFa(t.difficulty)}`)
      )
    );
  }

  function actionBtn(label, stat, fn) {
    const disabled = game.actionsLeft <= 0;
    return h('button', {
      class: 'ark-act',
      disabled,
      onclick: fn
    },
      h('span', { class: 'ark-act__name' }, label),
      stat ? h('span', { class: 'ark-act__meta' },
        `${SKILLS[stat].name} ${toFa(effectiveStat(game, stat))}`) : null
    );
  }

  function applyResult(r) {
    if (!r.ok) { msg = r.error; playSound('error'); render(); return; }
    game = r.game;
    if (r.test) lastTest = r.test;
    if (isOver(game)) { finish(); return; }
    playSound(r.test && !r.test.success ? 'error' : 'paper-flip');
    render();
  }

  function doInvestigate() { applyResult(investigate(game)); }
  function doFight(uid) {
    if (!game.engaged.length) { msg = 'دشمنی درگیر نیست.'; render(); return; }
    applyResult(fight(game, uid));
  }
  function doEvade() {
    if (!game.engaged.length) { msg = 'دشمنی درگیر نیست.'; render(); return; }
    applyResult(evade(game));
  }
  function doRest() { applyResult(rest(game)); }
  function doDraw() { applyResult(drawCard(game)); }
  function doPlay(id) { applyResult(playAsset(game, id)); }

  /* ------------------------------ پایان ------------------------------ */
  function drawEnd() {
    const won = game.winner === 'investigator';
    const inv = investigatorOf(game);
    return h('div', {},
      gameHeader({ title: won ? 'آیین شکست' : 'آرکام سقوط کرد', onBack: onExit }),
      h('section', { class: 'spot-end' },
        h('div', { class: 'spot-end__seal', 'aria-hidden': 'true' }, won ? '◈' : '☠'),
        h('h2', {}, won ? 'شهر نجات یافت' : 'دروازه باز شد'),
        h('p', {}, inv.name),
        h('div', { class: 'spot-end__stats' },
          h('span', {}, `نوبت: ${toFa(game.turn)}`),
          h('span', {}, `سرنخ: ${toFa(game.clues)}`),
          h('span', {}, `جان: ${toFa(game.hp)}`),
          h('span', {}, `روان: ${toFa(game.sanity)}`),
          h('span', { class: 'spot-end__score' }, `امتیاز: ${toFa(scoreOf(game))}`)
        ),
        h('div', { class: 'btn-row' },
          btn('دوباره', { variant: 'btn--primary', onClick: start }),
          btn('پژوهشگر دیگر', { onClick: () => { screen = 'intro'; render(); } })
        )
      )
    );
  }

  return () => { mounted = false; game = null; };
}
