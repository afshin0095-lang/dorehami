/* ============================================================
   «غارهای گِلومهیون» — رابط کارتی-تاکتیکی
   کارت‌های توانایی کاغذی، رد iniciativa، دشمنان مهره‌ای.
   ============================================================ */

import { h, mount, playSound, stats, toFa } from '../core.js';
import {
  CARDS, CARD_BY_ID, SCENARIOS, DIFFICULTY, RULES,
  createGloom, chooseCards, playTurn, aliveEnemies, isOver,
  cardsInHand, scoreOf, HERO_HP, HAND_START
} from '../engines/gloom.js';
import { gameHeader, sheet, btn, helpBlock, callout } from '../ui/kit.js';

const HELP = RULES;

const DIFF_LABEL = { easy: 'آسان', normal: 'میانه', hard: 'سخت' };

export function mountGame(root, { onExit } = {}) {
  let screen = 'intro';
  let scenarioId = 'crypt';
  let difficulty = 'normal';
  let game = null;
  let picked = [];          // کارت‌های انتخاب‌شده
  let use = 'both';
  let targetUid = null;
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
    game = createGloom({ seed: (Date.now() ^ Math.random() * 1e9) >>> 0, scenarioId, difficulty });
    picked = [];
    use = 'both';
    targetUid = null;
    msg = '';
    screen = 'play';
    playSound('paper-flip');
    render();
  }

  function finish() {
    if (!game || game._recorded) return;
    game._recorded = true;
    playSound(game.winner === 'heroes' ? 'seal' : 'error');
    stats.record('gloom', {
      key: 'gloom-best',
      best: scoreOf(game),
      higherIsBetter: true,
      label: 'بهترین امتیاز'
    });
    screen = 'end';
    render();
  }

  /* ------------------------------ مقدمه ------------------------------ */
  function drawIntro() {
    const scenario = SCENARIOS.find(s => s.id === scenarioId) || SCENARIOS[0];
    return h('div', {},
      gameHeader({ title: 'غارهای گِلومهیون', onBack: onExit }),

      h('section', { class: 'gloom-hero print-edge' },
        h('div', { class: 'gloom-hero__frame', 'aria-hidden': 'true' }, h('span', {}, '✦')),
        h('div', { class: 'gloom-hero__text' },
          h('div', { class: 'gloom-hero__kicker' }, 'بازی کارتی-تاکتیکی · تک‌نفره'),
          h('h1', {}, 'دو کارت، یک دور، یک غار'),
          h('p', {}, 'هر دور دو کارت توانایی بازی می‌کنی. کارت پیشرو iniciativa را تعیین می‌کند و بالای یکی را با پایین دیگری ترکیب می‌کنی. کارت‌ها برنمی‌گردند.')
        )
      ),

      sheet({ title: 'صحنه', iconName: 'map', children: h('div', { class: 'gloom-scenarios' },
        ...SCENARIOS.map(sc => h('button', {
          class: `gloom-scenario${scenarioId === sc.id ? ' is-on' : ''}`,
          'aria-pressed': String(scenarioId === sc.id),
          onclick: () => { scenarioId = sc.id; playSound('tap'); render(); }
        },
          h('span', { class: 'gloom-scenario__name' }, sc.name),
          h('span', { class: 'gloom-scenario__goal' }, `هدف: ${toFa(sc.goal)} کشته`)
        ))
      ) }),

      sheet({ title: 'سختی', iconName: 'crown', children: h('div', { class: 'level-row' },
        ...Object.entries(DIFFICULTY).map(([id, d]) => h('button', {
          class: `level-card${difficulty === id ? ' is-on' : ''}`,
          'aria-pressed': String(difficulty === id),
          onclick: () => { difficulty = id; playSound('tap'); render(); }
        },
          h('div', { class: 'level-card__name' }, d.label),
          h('div', { class: 'level-card__meta' }, `${toFa(HAND_START)} کارت`)
        ))
      ) }),

      h('div', { class: 'gloom-brief' },
        h('strong', {}, scenario.name),
        h('span', {}, scenario.intro)
      ),

      h('div', { class: 'spot-actions' },
        btn('شروع', { variant: 'btn--primary btn--block', onClick: start }),
        btn('راهنما', { onClick: () => { screen = 'help'; render(); } })
      )
    );
  }

  function drawHelp() {
    return h('div', {},
      gameHeader({ title: 'راهنمای گِلومهیون', onBack: () => { screen = 'intro'; render(); } }),
      sheet({ title: 'قواعد', iconName: 'book', children: helpBlock(HELP) }),
      h('div', { class: 'stack' },
        btn('فهمیدم', { variant: 'btn--primary btn--block', onClick: () => { screen = 'intro'; render(); } })
      )
    );
  }

  /* ------------------------------ بازی ------------------------------ */
  function drawPlay() {
    if (!game) return drawIntro();
    const hero = game.heroes[0];
    const alive = aliveEnemies(game);
    const hand = cardsInHand(game);
    const chosen = picked.length === 2;
    const initiative = chosen ? CARD_BY_ID[picked[0]].initiative : null;

    if (!targetUid && alive.length) targetUid = alive[0].uid;

    return h('div', {},
      gameHeader({
        title: game.scenarioId === 'crypt' ? 'دخمهٔ سیاه'
          : game.scenarioId === 'woods' ? 'بیشهٔ خفه'
          : game.scenarioId === 'ridge' ? 'گردنهٔ کمانداران' : 'لانهٔ دیو',
        onBack: () => { screen = 'intro'; render(); },
        children: [
          h('span', { class: 'score-pill' }, `جان ${toFa(hero.hp)}/${toFa(hero.maxHp)}`),
          h('span', { class: 'score-pill' }, `دور ${toFa(game.round)}/${toFa(game.maxRounds)}`),
          h('span', { class: 'score-pill' }, `${toFa(game.kills)}/${toFa(game.goal)}`)
        ]
      }),

      /* دشمنان */
      h('section', { class: 'gloom-enemies' },
        ...game.enemies.map(e => h('button', {
          class: `gloom-enemy${e.alive ? '' : ' is-dead'}${targetUid === e.uid ? ' is-target' : ''}`,
          style: `--enemy:${e.hex}`,
          disabled: !e.alive,
          'aria-pressed': String(targetUid === e.uid),
          onclick: () => { if (e.alive) { targetUid = e.uid; playSound('tap'); render(); } }
        },
          h('span', { class: 'gloom-enemy__glyph', 'aria-hidden': 'true' }, e.glyph),
          h('span', { class: 'gloom-enemy__name' }, e.name),
          h('span', { class: 'gloom-enemy__hp' }, e.alive ? `${toFa(e.hp)}/${toFa(e.maxHp)}` : 'افتاد'),
          h('span', { class: 'gloom-enemy__atk' }, `حمله ${toFa(e.attack)}`)
        ))
      ),

      /* ردیف iniciativa */
      h('div', { class: 'gloom-track' },
        h('div', { class: 'gloom-track__slot' },
          h('span', { class: 'gloom-track__label' }, 'تو'),
          h('span', { class: 'gloom-track__val' }, initiative == null ? '—' : toFa(initiative))
        ),
        h('div', { class: 'gloom-track__slot is-enemy' },
          h('span', { class: 'gloom-track__label' }, 'دشمن'),
          h('span', { class: 'gloom-track__val' }, alive.length ? toFa(Math.min(...alive.map(e => e.initiative))) : '—')
        ),
        initiative != null && alive.length
          ? h('div', { class: 'gloom-track__verdict' },
              initiative <= Math.min(...alive.map(e => e.initiative)) ? 'زودتر می‌زنی' : 'دیرتر می‌زنی')
          : null
      ),

      /* دست */
      h('section', { class: 'gloom-hand', 'aria-label': 'کارت‌های توانایی' },
        ...hand.map(c => cardNode(c, picked.includes(c.id)))
      ),

      /* ترکیب */
      picked.length === 2 ? combinePanel(picked) : null,

      msg ? h('div', { class: 'spot-msg' }, msg) : null,

      h('div', { class: 'spot-actions' },
        btn(picked.length === 2 ? 'اجرای نوبت' : 'دو کارت انتخاب کن', {
          variant: 'btn--primary btn--block',
          disabled: picked.length !== 2 || game.phase === 'over',
          onClick: doTurn
        }),
        btn('پاک کردن', {
          disabled: !picked.length,
          onClick: () => { picked = []; msg = ''; playSound('paper-flip'); render(); }
        })
      ),

      /* گزارش */
      game.log.length ? h('section', { class: 'gloom-log' },
        h('h3', {}, 'گزارش'),
        ...[...game.log].reverse().slice(0, 8).map(l => h('p', { class: 'gloom-log__row' },
          h('span', { class: 'gloom-log__round' }, `د${toFa(l.round)}`),
          h('span', {}, l.text)
        ))
      ) : null
    );
  }

  function cardNode(card, on) {
    if (!card) return null;
    return h('button', {
      class: `ability-card${on ? ' is-on' : ''}`,
      'aria-pressed': String(on),
      onclick: () => toggleCard(card.id)
    },
      h('div', { class: 'ability-card__init' }, toFa(card.initiative)),
      h('div', { class: 'ability-card__name' }, card.name),
      h('div', { class: 'ability-card__half ability-card__half--top' },
        h('span', { class: 'ability-card__tag' }, 'بالا'),
        h('span', { class: 'ability-card__text' }, card.top.text)
      ),
      h('div', { class: 'ability-card__half ability-card__half--bottom' },
        h('span', { class: 'ability-card__tag' }, 'پایین'),
        h('span', { class: 'ability-card__text' }, card.bottom.text)
      ),
      card.lost ? h('span', { class: 'ability-card__lost' }, 'یک‌بارمصرف') : null
    );
  }

  function combinePanel([aId, bId]) {
    const a = CARD_BY_ID[aId], b = CARD_BY_ID[bId];
    const opts = [
      { id: 'both', label: `بالای «${a.name}» + پایین «${b.name}»` },
      { id: 'bottom-first', label: `بالای «${b.name}» + پایین «${a.name}»` }
    ];
    return h('section', { class: 'gloom-combine' },
      h('h3', {}, 'کدام ترکیب؟'),
      ...opts.map(o => h('button', {
        class: `gloom-combine__opt${use === o.id ? ' is-on' : ''}`,
        'aria-pressed': String(use === o.id),
        onclick: () => { use = o.id; playSound('tap'); render(); }
      }, o.label))
    );
  }

  function toggleCard(id) {
    if (game.phase === 'over') return;
    if (picked.includes(id)) {
      picked = picked.filter(x => x !== id);
    } else {
      if (picked.length >= 2) { msg = 'فقط دو کارت می‌توانی انتخاب کنی. یکی را بردار.'; playSound('error'); render(); return; }
      picked = [...picked, id];
    }
    msg = '';
    playSound('paper-flip');
    render();
  }

  function doTurn() {
    if (picked.length !== 2) return;
    const chose = chooseCards(game, picked);
    if (!chose.ok) { msg = chose.error; playSound('error'); render(); return; }
    const alive = aliveEnemies(chose.game);
    const res = playTurn(chose.game, { use, targetUid: targetUid || alive[0]?.uid });
    if (!res.ok) { msg = res.error; playSound('error'); render(); return; }
    game = res.game;
    picked = [];
    use = 'both';
    if (game.phase === 'over') { finish(); return; }
    playSound('card-slide');
    render();
  }

  /* ------------------------------ پایان ------------------------------ */
  function drawEnd() {
    const won = game.winner === 'heroes';
    const hero = game.heroes[0];
    return h('div', {},
      gameHeader({ title: won ? 'پیروزی' : 'شکست', onBack: onExit }),
      h('section', { class: 'spot-end' },
        h('div', { class: 'spot-end__seal', 'aria-hidden': 'true' }, won ? '✦' : '✕'),
        h('h2', {}, won ? 'از غار بیرون آمدی' : 'غار تو را نگه داشت'),
        h('div', { class: 'spot-end__stats' },
          h('span', {}, `جان: ${toFa(hero.hp)}/${toFa(hero.maxHp)}`),
          h('span', {}, `کشته: ${toFa(game.kills)}`),
          h('span', {}, `دور: ${toFa(game.round)}`),
          h('span', { class: 'spot-end__score' }, `امتیاز: ${toFa(scoreOf(game))}`)
        ),
        h('div', { class: 'btn-row' },
          btn('دوباره', { variant: 'btn--primary', onClick: start }),
          btn('صحنهٔ دیگر', { onClick: () => { screen = 'intro'; render(); } })
        )
      )
    );
  }

  return () => { mounted = false; game = null; };
}
