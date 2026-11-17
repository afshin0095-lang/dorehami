/* ============================================================
   «روح جزیره» — رابط بقای جزیره
   سه زمین، نوار ترس و بیماری، دست قدرت‌ها.
   ============================================================ */

import { h, mount, playSound, stats, toFa } from '../core.js';
import {
  LANDS, LAND_BY_ID, SPIRITS, SPIRIT_BY_ID, POWERS, POWER_BY_ID, DIFFICULTY,
  BLIGHT_LIMIT, FEAR_TARGET, ROUNDS, RULES,
  createSpirit, playPower, endRound, isOver, spiritOf,
  totalInvaders, blightPct, fearPct, scoreOf
} from '../engines/spirit.js';
import { gameHeader, sheet, btn, helpBlock } from '../ui/kit.js';

const HELP = RULES;

export function mountGame(root, { onExit } = {}) {
  let screen = 'intro';
  let difficulty = 'normal';
  let spiritId = 'river';
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
    game = createSpirit({
      seed: (Date.now() ^ Math.random() * 1e9) >>> 0,
      spiritId, difficulty
    });
    msg = '';
    screen = 'play';
    playSound('paper-flip');
    render();
  }

  function finish() {
    if (!game || game._recorded) return;
    game._recorded = true;
    playSound(game.winner === 'spirit' ? 'seal' : 'error');
    stats.record('spirit', {
      key: 'spirit-best', best: scoreOf(game), higherIsBetter: true, label: 'بهترین امتیاز'
    });
    screen = 'end';
    render();
  }

  /* ------------------------------ مقدمه ------------------------------ */
  function drawIntro() {
    const sp = SPIRIT_BY_ID[spiritId] || SPIRITS[0];
    return h('div', {},
      gameHeader({ title: 'روح جزیره', onBack: onExit }),

      h('section', { class: 'sp-hero print-edge' },
        h('div', { class: 'sp-hero__frame', 'aria-hidden': 'true' }, h('span', {}, '❧')),
        h('div', { class: 'sp-hero__text' },
          h('div', { class: 'sp-hero__kicker' }, 'کارتی-همیار · تک‌نفره'),
          h('h1', {}, 'جزیره با تو نفس می‌کشد'),
          h('p', {}, 'هر دور دو قدرت بازی می‌کنی. ترس را تا سر حد ببر تا مهاجمان بروند — ولی بیماری هم بالا می‌رود.')
        )
      ),

      sheet({ title: 'روح', iconName: 'spark', children: h('div', { class: 'sp-spirits' },
        ...SPIRITS.map(s => h('button', {
          class: `sp-spirit${spiritId === s.id ? ' is-on' : ''}`,
          style: `--who:${s.hex}`,
          'aria-pressed': String(spiritId === s.id),
          onclick: () => { spiritId = s.id; playSound('tap'); render(); }
        },
          h('span', { class: 'sp-spirit__name' }, s.name),
          h('span', { class: 'sp-spirit__role' }, s.role),
          h('span', { class: 'sp-spirit__perk' }, s.perk)
        ))
      ) }),

      sheet({ title: 'سختی', iconName: 'crown', children: h('div', { class: 'level-row' },
        ...Object.entries(DIFFICULTY).map(([id, d]) => h('button', {
          class: `level-card${difficulty === id ? ' is-on' : ''}`,
          'aria-pressed': String(difficulty === id),
          onclick: () => { difficulty = id; playSound('tap'); render(); }
        },
          h('div', { class: 'level-card__name' }, d.label),
          h('div', { class: 'level-card__meta' }, d.invaders + ' مهاجم')
        ))
      ) }),

      h('div', { class: 'sp-brief' },
        h('strong', {}, sp.name),
        h('span', {}, sp.desc),
        h('span', { class: 'sp-brief__goal' },
          `هدف: ${toFa(FEAR_TARGET)} ترس · خطر: ${toFa(BLIGHT_LIMIT)} بیماری`)
      ),

      h('div', { class: 'spot-actions' },
        btn('بیدار کردن روح', { variant: 'btn--primary btn--block', onClick: start }),
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
    const sp = spiritOf(game);
    const canPlay = game.played.length < 2;

    return h('div', {},
      gameHeader({
        title: sp.name,
        onBack: () => { screen = 'intro'; render(); },
        children: [
          h('span', { class: 'score-pill' }, `دور ${toFa(game.round)}/${toFa(game.maxRounds)}`),
          h('span', { class: 'score-pill' }, `انرژی ${toFa(game.energy)}`),
          h('span', { class: 'score-pill' }, `قدرت ${toFa(game.played.length)}/۲`)
        ]
      }),

      /* نوار دوگانه */
      h('div', { class: 'sp-gauges' },
        gauge('ترس', game.fear, FEAR_TARGET, '#6b4a7a', fearPct(game), false),
        gauge('بیماری', game.blight, BLIGHT_LIMIT, '#8a4a3a', blightPct(game), true)
      ),

      /* زمین‌ها */
      h('section', { class: 'sp-lands', 'aria-label': 'زمین‌ها' },
        ...game.lands.map(l => {
          const base = LAND_BY_ID[l.id];
          return h('div', {
            class: `sp-land${l.invaders === 0 ? ' is-clear' : ''}${l.invaders >= 5 ? ' is-heavy' : ''}`,
            style: `--land:${base.hex}`
          },
            h('span', { class: 'sp-land__glyph', 'aria-hidden': 'true' }, base.glyph),
            h('span', { class: 'sp-land__name' }, base.name),
            h('span', { class: 'sp-land__count' }, toFa(l.invaders)),
            h('span', { class: 'sp-land__label' }, 'مهاجم')
          );
        })
      ),

      game.defend > 0 ? h('div', { class: 'sp-defend' },
        h('span', { 'aria-hidden': 'true' }, '⛨'),
        `دفاع این دور: ${toFa(game.defend)}`
      ) : null,

      /* دست */
      h('section', { class: 'sp-hand', 'aria-label': 'قدرت‌ها' },
        ...game.hand.map(id => {
          const p = POWER_BY_ID[id];
          if (!p) return null;
          const affordable = game.energy >= p.cost && canPlay;
          return h('button', {
            class: `sp-power${affordable ? '' : ' is-locked'}${p.speed === 'fast' ? ' is-fast' : ' is-slow'}`,
            style: `--pw:${p.hex}`,
            disabled: !affordable,
            onclick: () => chooseTarget(p)
          },
            h('span', { class: 'sp-power__speed' }, p.speed === 'fast' ? 'سریع' : 'کند'),
            h('span', { class: 'sp-power__cost' }, toFa(p.cost)),
            h('span', { class: 'sp-power__name' }, p.name),
            h('span', { class: 'sp-power__text' }, p.text)
          );
        })
      ),

      msg ? h('div', { class: 'spot-msg' }, msg) : null,

      /* هدف‌گیری */
      canPlay ? h('section', { class: 'sp-target' },
        h('h3', { class: 'sp-target__title' }, 'زمین هدف'),
        h('div', { class: 'sp-target__row' },
          ...game.lands.map(l => h('div', {
            class: 'sp-target__cell',
            style: `--land:${LAND_BY_ID[l.id].hex}`
          },
            h('span', { class: 'sp-target__name' }, LAND_BY_ID[l.id].name),
            h('span', { class: 'sp-target__count' }, `${toFa(l.invaders)} مهاجم`)
          ))
        ),
        h('p', { class: 'sp-target__hint' }, 'با کلیک روی قدرت، خودکار به پرجمعیت‌ترین زمین می‌رود.')
      ) : null,

      h('div', { class: 'sp-actions' },
        btn('پایان دور', {
          variant: 'btn--primary btn--block',
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
      game.log.length ? h('section', { class: 'sp-log' },
        h('h3', {}, 'گزارش'),
        ...[...game.log].reverse().slice(0, 6).map(l => h('p', { class: 'sp-log__row' },
          h('span', { class: 'sp-log__round' }, `د${toFa(l.round)}`),
          h('span', {}, l.text)
        ))
      ) : null
    );
  }

  function gauge(label, value, max, color, pct, invert) {
    return h('div', { class: `sp-gauge${invert ? ' is-inv' : ''}` },
      h('div', { class: 'sp-gauge__head' },
        h('span', { class: 'sp-gauge__label' }, label),
        h('span', { class: 'sp-gauge__val' }, `${toFa(value)}/${toFa(max)}`)
      ),
      h('div', {
        class: 'sp-gauge__track',
        role: 'img',
        'aria-label': `${label}: ${value} از ${max}`
      },
        h('span', { class: 'sp-gauge__fill', style: `width:${pct}%;--fill:${color}` })
      )
    );
  }

  function chooseTarget(power) {
    // هدف: پرجمعیت‌ترین زمین
    const target = game.lands.slice().sort((a, b) => b.invaders - a.invaders)[0];
    const r = playPower(game, power.id, target?.id);
    if (!r.ok) { msg = r.error; playSound('error'); render(); return; }
    game = r.game;
    msg = r.events.join(' · ');
    if (isOver(game)) { finish(); return; }
    playSound('paper-flip');
    render();
  }

  /* ------------------------------ پایان ------------------------------ */
  function drawEnd() {
    const won = game.winner === 'spirit';
    return h('div', {},
      gameHeader({ title: won ? 'جزیره آزاد' : 'مهاجمان ماندند', onBack: onExit }),
      h('section', { class: 'spot-end' },
        h('div', { class: 'spot-end__seal', 'aria-hidden': 'true' }, won ? '❧' : '✕'),
        h('h2', {}, won ? 'وحشت همه را گرفت' : 'بیماری چیره شد'),
        h('div', { class: 'spot-end__stats' },
          h('span', {}, `دور: ${toFa(game.round)}`),
          h('span', {}, `ترس: ${toFa(game.fear)}`),
          h('span', {}, `بیماری: ${toFa(game.blight)}`),
          h('span', {}, `مهاجم: ${toFa(totalInvaders(game))}`),
          h('span', { class: 'spot-end__score' }, `امتیاز: ${toFa(scoreOf(game))}`)
        ),
        h('div', { class: 'btn-row' },
          btn('دوباره', { variant: 'btn--primary', onClick: start }),
          btn('روح دیگر', { onClick: () => { screen = 'intro'; render(); } })
        )
      )
    );
  }

  return () => { mounted = false; game = null; };
}
