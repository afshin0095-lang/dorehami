/* ============================================================
   «همراهی حلقه» — رابط سفر
   قهرمانان، نوار تهدید، مرحلهٔ سفر، یاری‌ها، دشمنان درگیر.
   ============================================================ */

import { h, mount, playSound, stats, toFa } from '../core.js';
import {
  HEROES, HERO_BY_ID, STAGES, ENEMIES, ALLIES, ALLY_BY_ID, DIFFICULTY, THREAT_LIMIT,
  createRing, groupWill, groupAttack, groupDefense, groupHp, currentStage,
  playAlly, discardForResource, quest, attackEnemy, defend, endRound,
  isOver, scoreOf, RULES as HELP_REAL
} from '../engines/ring.js';
import { gameHeader, sheet, btn, helpBlock } from '../ui/kit.js';

export function mountGame(root, { onExit } = {}) {
  let screen = 'intro';
  let difficulty = 'normal';
  let heroIds = ['aragorn', 'legolas', 'gimli'];
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
    game = createRing({
      seed: (Date.now() ^ Math.random() * 1e9) >>> 0,
      heroIds, difficulty
    });
    msg = '';
    screen = 'play';
    playSound('paper-flip');
    render();
  }

  function finish() {
    if (!game || game._recorded) return;
    game._recorded = true;
    playSound(game.winner === 'fellowship' ? 'seal' : 'error');
    stats.record('ring', {
      key: 'ring-best', best: scoreOf(game), higherIsBetter: true, label: 'بهترین امتیاز'
    });
    screen = 'end';
    render();
  }

  /* ------------------------------ مقدمه ------------------------------ */
  function drawIntro() {
    return h('div', {},
      gameHeader({ title: 'همراهی حلقه', onBack: onExit }),

      h('section', { class: 'ring-hero print-edge' },
        h('div', { class: 'ring-hero__frame', 'aria-hidden': 'true' }, h('span', {}, '⟡')),
        h('div', { class: 'ring-hero__text' },
          h('div', { class: 'ring-hero__kicker' }, 'کارتی-ماجرایی · تک‌نفره'),
          h('h1', {}, 'سه قهرمان، یک حلقه'),
          h('p', {}, 'هر دور سه منبع داری. اراده‌ات را بالا ببر تا از مراحل بگذری — ولی تهدید هر دور بالا می‌رود و هیچ راه برگشتی نیست.')
        )
      ),

      sheet({ title: 'قهرمانان', iconName: 'user', children: h('div', { class: 'ring-heroes' },
        ...HEROES.map(hh => {
          const on = heroIds.includes(hh.id);
          return h('button', {
            class: `ring-hero-pick${on ? ' is-on' : ''}`,
            style: `--who:${hh.hex}`,
            'aria-pressed': String(on),
            onclick: () => toggleHero(hh.id)
          },
            h('span', { class: 'ring-hero-pick__name' }, hh.name),
            h('span', { class: 'ring-hero-pick__role' }, hh.role),
            h('span', { class: 'ring-hero-pick__stats' },
              `${toFa(hh.will)}/${toFa(hh.attack)}/${toFa(hh.defense)} · جان ${toFa(hh.hp)}`)
          );
        })
      ) }),

      sheet({ title: 'سختی', iconName: 'crown', children: h('div', { class: 'level-row' },
        ...Object.entries(DIFFICULTY).map(([id, d]) => h('button', {
          class: `level-card${difficulty === id ? ' is-on' : ''}`,
          'aria-pressed': String(difficulty === id),
          onclick: () => { difficulty = id; playSound('tap'); render(); }
        },
          h('div', { class: 'level-card__name' }, d.label),
          h('div', { class: 'level-card__meta' }, `${toFa(d.handStart)} کارت`)
        ))
      ) }),

      h('div', { class: 'ring-brief' },
        h('strong', {}, 'تهدید شروع'),
        h('span', {}, heroIds.map(id => HERO_BY_ID[id]?.threat || 0).reduce((a, b) => a + b, 0)
          + (DIFFICULTY[difficulty]?.startThreat || 0) + ` از ${toFa(THREAT_LIMIT)}`),
        h('span', { class: 'ring-brief__note' }, 'هر دور ۱ تهدید اضافه می‌شود')
      ),

      msg ? h('div', { class: 'spot-msg is-err' }, msg) : null,

      h('div', { class: 'spot-actions' },
        btn('شروع سفر', {
          variant: 'btn--primary btn--block',
          disabled: heroIds.length < 2,
          onClick: () => {
            if (heroIds.length < 2) { msg = 'دست‌کم دو قهرمان انتخاب کن.'; render(); return; }
            start();
          }
        }),
        btn('راهنما', { onClick: () => { screen = 'help'; render(); } })
      )
    );
  }

  function toggleHero(id) {
    if (heroIds.includes(id)) {
      if (heroIds.length <= 2) { msg = 'دست‌کم دو قهرمان لازم است.'; render(); return; }
      heroIds = heroIds.filter(x => x !== id);
    } else {
      if (heroIds.length >= 3) { msg = 'بیشتر از سه قهرمان نمی‌شود.'; render(); return; }
      heroIds = [...heroIds, id];
    }
    msg = '';
    playSound('tap');
    render();
  }

  function drawHelp() {
    return h('div', {},
      gameHeader({ title: 'راهنمای حلقه', onBack: () => { screen = 'intro'; render(); } }),
      sheet({ title: 'قواعد', iconName: 'book', children: helpBlock(HELP_REAL) }),
      h('div', { class: 'stack' },
        btn('فهمیدم', { variant: 'btn--primary btn--block', onClick: () => { screen = 'intro'; render(); } })
      )
    );
  }

  /* ------------------------------ بازی ------------------------------ */
  function drawPlay() {
    if (!game) return drawIntro();
    const stage = currentStage(game);
    const threatPct = Math.min(100, (game.threat / THREAT_LIMIT) * 100);

    return h('div', {},
      gameHeader({
        title: `مرحلهٔ ${toFa(game.stageIndex + 1)} از ${toFa(STAGES.length)}`,
        onBack: () => { screen = 'intro'; render(); },
        children: [
          h('span', { class: 'score-pill' }, `دور ${toFa(game.round)}`),
          h('span', { class: 'score-pill' }, `منبع ${toFa(game.res)}`),
          h('span', { class: 'score-pill' }, `تهدید ${toFa(game.threat)}`)
        ]
      }),

      /* نوار تهدید */
      h('div', { class: `ring-threat${game.threat >= THREAT_LIMIT - 10 ? ' is-hot' : ''}` },
        h('div', { class: 'ring-threat__head' },
          h('span', { class: 'ring-threat__label' }, 'تهدید'),
          h('span', { class: 'ring-threat__val' }, `${toFa(game.threat)} / ${toFa(THREAT_LIMIT)}`)
        ),
        h('div', { class: 'ring-threat__track', role: 'img', 'aria-label': `تهدید ${game.threat} از ${THREAT_LIMIT}` },
          h('span', { class: 'ring-threat__fill', style: `width:${threatPct}%` })
        )
      ),

      /* مرحلهٔ سفر */
      h('section', { class: 'ring-stage' },
        h('h3', { class: 'ring-stage__name' }, stage.name),
        h('p', { class: 'ring-stage__intro' }, stage.intro),
        h('div', { class: 'ring-stage__bars' },
          h('span', {}, `پیشرفت ${toFa(game.progress)}/${toFa(stage.need)}`),
          h('span', {}, `تهدید مرحله ${toFa(stage.threat)}`)
        ),
        h('div', { class: 'ring-stage__track' },
          h('span', {
            class: 'ring-stage__fill',
            style: `width:${Math.min(100, (game.progress / stage.need) * 100)}%`
          })
        )
      ),

      /* قدرت گروه */
      h('div', { class: 'ring-stats' },
        h('div', { class: 'ring-stat' }, h('span', { class: 'ring-stat__label' }, 'اراده'), h('span', { class: 'ring-stat__num' }, toFa(groupWill(game)))),
        h('div', { class: 'ring-stat' }, h('span', { class: 'ring-stat__label' }, 'حمله'), h('span', { class: 'ring-stat__num' }, toFa(groupAttack(game)))),
        h('div', { class: 'ring-stat' }, h('span', { class: 'ring-stat__label' }, 'دفاع'), h('span', { class: 'ring-stat__num' }, toFa(groupDefense(game)))),
        h('div', { class: 'ring-stat' }, h('span', { class: 'ring-stat__label' }, 'جان'), h('span', { class: 'ring-stat__num' }, toFa(groupHp(game))))
      ),

      /* قهرمانان */
      h('div', { class: 'ring-crew' },
        ...game.heroes.map(hh => {
          const base = HERO_BY_ID[hh.id];
          return h('div', {
            class: `ring-crew__row${hh.alive ? '' : ' is-dead'}`,
            style: `--who:${base.hex}`
          },
            h('span', { class: 'ring-crew__name' }, base.name),
            h('span', { class: 'ring-crew__hp' }, `${toFa(hh.hp)}/${toFa(hh.maxHp)}`)
          );
        })
      ),

      /* یاری‌ها */
      game.allies.length ? h('div', { class: 'ring-allies' },
        ...game.allies.map(id => h('span', { class: 'ring-ally', style: `--ast:${ALLY_BY_ID[id].hex}` },
          ALLY_BY_ID[id].name))
      ) : null,

      /* دشمنان */
      game.engaged.length ? h('section', { class: 'ring-foes' },
        h('h3', { class: 'ring-foes__title' }, 'درگیر'),
        ...game.engaged.map(e => {
          const base = ENEMIES.find(x => x.id === e.id);
          return h('button', {
            class: 'ring-foe',
            style: `--foe:${base.hex}`,
            onclick: () => doAttack(e.uid)
          },
            h('span', { class: 'ring-foe__glyph', 'aria-hidden': 'true' }, base.glyph),
            h('span', { class: 'ring-foe__name' }, base.name),
            h('span', { class: 'ring-foe__hp' }, `${toFa(e.hp)}/${toFa(e.maxHp)}`),
            h('span', { class: 'ring-foe__atk' }, `حمله ${toFa(base.attack)}`)
          );
        })
      ) : null,

      /* دست */
      h('section', { class: 'ring-hand', 'aria-label': 'دست' },
        ...game.hand.map(id => {
          const a = ALLY_BY_ID[id];
          if (!a) return null;
          const can = game.res >= a.cost;
          return h('div', { class: 'ring-card-slot' },
            h('button', {
              class: `ring-card${can ? '' : ' is-locked'}`,
              style: `--ast:${a.hex}`,
              disabled: !can,
              onclick: () => doPlay(id)
            },
              h('span', { class: 'ring-card__cost' }, toFa(a.cost)),
              h('span', { class: 'ring-card__name' }, a.name),
              h('span', { class: 'ring-card__text' }, a.text)
            ),
            h('button', {
              class: 'ring-card__discard',
              'aria-label': `دور انداختن ${a.name} برای یک منبع`,
              onclick: () => doDiscard(id)
            }, '→')
          );
        })
      ),

      msg ? h('div', { class: 'spot-msg' }, msg) : null,

      /* کنش‌ها */
      h('div', { class: 'ring-actions' },
        btn('جست‌وجو', { variant: 'btn--primary', onClick: doQuest }),
        btn('نبرد', { disabled: !game.engaged.length, onClick: () => doAttack() }),
        btn('دفاع', { onClick: doDefend })
      ),

      h('div', { class: 'ring-footer' },
        btn('پایان دور', {
          variant: 'btn--block',
          onClick: () => {
            const r = endRound(game);
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
      game.log.length ? h('section', { class: 'ring-log' },
        h('h3', {}, 'گزارش'),
        ...[...game.log].reverse().slice(0, 6).map(l => h('p', { class: 'ring-log__row' },
          h('span', { class: 'ring-log__round' }, `د${toFa(l.round)}`),
          h('span', {}, l.text)
        ))
      ) : null
    );
  }

  function applyResult(r) {
    if (!r.ok) { msg = r.error; playSound('error'); render(); return; }
    game = r.game;
    if (isOver(game)) { finish(); return; }
    playSound('paper-flip');
    render();
  }

  function doPlay(id) { applyResult(playAlly(game, id)); }
  function doDiscard(id) { applyResult(discardForResource(game, id)); }
  function doQuest() { applyResult(quest(game)); }
  function doAttack(uid) { applyResult(attackEnemy(game, uid)); }
  function doDefend() { applyResult(defend(game)); }

  /* ------------------------------ پایان ------------------------------ */
  function drawEnd() {
    const won = game.winner === 'fellowship';
    return h('div', {},
      gameHeader({ title: won ? 'دروازه بسته شد' : 'سایه چیره شد', onBack: onExit }),
      h('section', { class: 'spot-end' },
        h('div', { class: 'spot-end__seal', 'aria-hidden': 'true' }, won ? '⟡' : '✕'),
        h('h2', {}, won ? 'همراهی به پایان رسید' : 'تهدید تو را گرفت'),
        h('div', { class: 'spot-end__stats' },
          h('span', {}, `دور: ${toFa(game.round)}`),
          h('span', {}, `مرحله: ${toFa(game.stageIndex + 1)}`),
          h('span', {}, `تهدید: ${toFa(game.threat)}`),
          h('span', {}, `جان: ${toFa(groupHp(game))}`),
          h('span', { class: 'spot-end__score' }, `امتیاز: ${toFa(scoreOf(game))}`)
        ),
        h('div', { class: 'btn-row' },
          btn('دوباره', { variant: 'btn--primary', onClick: start }),
          btn('قهرمانان دیگر', { onClick: () => { screen = 'intro'; render(); } })
        )
      )
    );
  }

  return () => { mounted = false; game = null; };
}
