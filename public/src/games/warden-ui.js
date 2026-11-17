/* ============================================================
   «پرونده‌ی وِردِن» — بازی کارتی-داستانی تک‌نفره
   کاغذ کاهی با لبه‌ی سوخته، نقاشی دستی گوتیک، پرونده‌ی محقق.
   ============================================================ */

import { h, mount, playSound, stats, toFa, toast } from '../core.js';
import {
  INVESTIGATORS, LOCATIONS, SCENES, HORROR_DECK, RULES,
  createRun, beginScene, resolveSceneChoice, wardLocation, rest, endRound,
  drawHorror, confront, canConfront, currentScene, locationOf, investigatorOf,
  checkOdds, progressOf, difficultyOf
} from '../engines/v10.js';
import { gameHeader, sheet, btn, helpBlock, callout, icon } from '../ui/kit.js';

const HELP = {
  steps: [
    'یک محقق انتخاب کن. هر محقق چهار ویژگی دارد (ذهن، چابکی، اراده، تن) و یک ضعف که همیشه با توست.',
    'هر دور سه کنش داری. در هر صحنه یکی از دو گزینه را انتخاب کن؛ سکه‌ی سرنوشت (۱ت۶) به‌علاوه‌ی ویژگی‌ات با سختی مقایسه می‌شود.',
    'موفقیت سرنخ می‌دهد. شکست «هول» اضافه می‌کند و سلامت کم می‌کند.',
    'با کنش «مهر کردن» مکان‌ها را می‌بندی؛ هر سه مهر یک هول کمتر می‌کند و رویارویی نهایی را آسان‌تر.',
    'با ۳ سرنخ می‌توانی رویارویی نهایی را بخواهی. اگر هول به ۱۲ برسد یا سلامتت صفر شود، شب تمام است.'
  ],
  example: 'مثال: ذهن ۴ داری و سختی ۴ است. یکتاس ۲ می‌آوری: ۲+۲ (پاداش) = ۴ → موفق. اگر ۱ می‌آوردی، شکست می‌خوردی و یک هول می‌گرفتی.',
  note: 'هر نُه صحنه یک‌بار می‌آیند؛ بعد از آن پرده‌ی دوم شروع می‌شود و شهر سخت‌تر می‌شود. بازی هیچ‌وقت قفل نمی‌شود.'
};

const STAT_FA = { mind: 'ذهن', agility: 'چابکی', will: 'اراده', body: 'تن' };
const STAT_ICON = { mind: 'book', agility: 'spark', will: 'skull', body: 'crown' };

export function mountGame(root, { onExit }) {
  let state = { screen: 'intro', inv: 'parisa', run: null };

  const render = () => mount(root, draw());
  render();

  function draw() {
    switch (state.screen) {
      case 'help': return drawHelp();
      case 'play': return drawPlay();
      case 'end': return drawEnd();
      default: return drawIntro();
    }
  }

  /* ------------------------------ شروع ------------------------------ */
  function drawIntro() {
    return h('div', {},
      gameHeader({ title: 'پرونده‌ی وِردِن', onBack: onExit }),
      h('section', { class: 'paper warden-hero' },
        h('div', { class: 'warden-hero__art' }),
        h('div', { class: 'warden-hero__veil' }),
        h('div', { class: 'warden-hero__text' },
          h('div', { class: 'warden-hero__kicker' }, 'بازی کارتی-داستانی · تک‌نفره'),
          h('h1', {}, 'پرونده‌ی وِردِن'),
          h('p', {}, 'شهری که هر شب یک دقیقه عقب می‌ماند. نه مهر، نه سرنخ، و یک دروازه که فقط باز می‌شود.')
        )
      ),
      sheet({ title: 'محقق خود را انتخاب کن', iconName: 'users', children: h('div', { class: 'inv-grid' },
        ...INVESTIGATORS.map(inv => h('button', {
          class: `inv-card ${state.inv === inv.id ? 'is-on' : ''}`.trim(),
          'aria-pressed': String(state.inv === inv.id),
          onclick: () => { state.inv = inv.id; playSound('tap'); render(); }
        },
          h('div', { class: 'inv-card__art', style: { backgroundImage: `url(/assets/art/${inv.art === 'mafia' ? 'mafia-role' : inv.art === 'doctor' ? 'doctor-role' : inv.art === 'detective' ? 'detective-role' : 'citizen-role'}.jpg)` } }),
          h('div', { class: 'inv-card__body' },
            h('div', { class: 'inv-card__name' }, inv.name),
            h('div', { class: 'inv-card__role' }, inv.role)
          )
        ))
      ) }),
      invDetails(),
      sheet({ title: 'راهنمای کامل', iconName: 'book', children: helpBlock(HELP) }),
      btn('شروع پرونده', {
        variant: 'btn--primary btn--block',
        onClick: () => {
          state.run = beginScene(createRun({ investigatorId: state.inv }));
          state.screen = 'play';
          playSound('seal');
          render();
        }
      }),
      btn('بازگشت', { variant: 'btn--ghost btn--block', onClick: onExit })
    );
  }

  function invDetails() {
    const inv = INVESTIGATORS.find(i => i.id === state.inv);
    return sheet({ title: `${inv.role} · ${inv.name}`, iconName: 'user', children: h('div', {},
      h('p', { style: { fontSize: '.86rem', fontStyle: 'italic' } }, inv.blurb),
      h('div', { class: 'stat-row' },
        ...Object.entries(inv.stats).map(([k, v]) => h('span', { class: 'stat-chip' },
          icon(STAT_ICON[k], 13), ' ', STAT_FA[k], ' ', h('b', {}, toFa(v))))
      ),
      h('div', { class: 'callout callout--good' }, icon('spark', 16), h('div', {}, h('b', {}, 'مزیت: '), inv.perk)),
      h('div', { class: 'callout callout--bad' }, icon('skull', 16), h('div', {}, h('b', {}, 'ضعف: '), inv.weakness))
    ) });
  }

  function drawHelp() {
    return h('div', {},
      gameHeader({ title: 'راهنمای پرونده', onBack: () => { state.screen = 'play'; render(); } }),
      sheet({ cls: 'sheet--lined', title: 'قدم به قدم', iconName: 'book', children: helpBlock(HELP) }),
      btn('فهمیدم', { variant: 'btn--block', onClick: () => { state.screen = 'play'; render(); } })
    );
  }

  /* ------------------------------ میز بازی ------------------------------ */
  function drawPlay() {
    const run = state.run;
    if (!run) { state.screen = 'intro'; return draw(); }
    if (run.status !== 'active') { state.screen = 'end'; return drawEnd(); }

    const inv = investigatorOf(run);
    const scene = currentScene(run);
    const loc = run.current ? locationOf(run.current.location) : null;
    const doomPct = (run.doom / run.doomMax) * 100;
    const canAct = run.actionsLeft > 0;

    return h('div', {},
      gameHeader({
        title: `دور ${toFa(run.round)}`,
        onBack: () => { if (confirm('از پرونده خارج شوی؟ پیشرفت این شب از دست می‌رود.')) onExit(); },
        children: [h('span', { class: 'score-pill' }, icon('clock', 14), ' ', `${toFa(run.actionsLeft)} کنش`)]
      }),

      // نوار وضعیت: هول و سرنخ
      h('div', { class: 'warden-status' },
        h('div', { class: 'warden-meter' },
          h('div', { class: 'warden-meter__label' },
            icon('skull', 14), ' هول ', h('b', {}, `${toFa(run.doom)}/${toFa(run.doomMax)}`)),
          h('div', { class: 'warden-meter__bar' },
            h('div', {
              class: `warden-meter__fill ${doomPct > 70 ? 'is-danger' : ''}`.trim(),
              style: { width: `${doomPct}%` }
            })
          )
        ),
        h('div', { class: 'warden-meter' },
          h('div', { class: 'warden-meter__label' },
            icon('spark', 14), ' سرنخ ', h('b', {}, `${toFa(run.clues)}/${toFa(run.cluesNeeded)}`)),
          h('div', { class: 'warden-meter__bar warden-meter__bar--clue' },
            h('div', {
              class: 'warden-meter__fill',
              style: { width: `${(run.clues / run.cluesNeeded) * 100}%` }
            })
          )
        ),
        h('div', { class: 'warden-meter' },
          h('div', { class: 'warden-meter__label' }, icon('crown', 14), ' سلامتی ', h('b', {}, `${toFa(run.health)}/۶`)),
          h('div', { class: 'warden-meter__bar warden-meter__bar--hp' },
            h('div', { class: 'warden-meter__fill', style: { width: `${(run.health / 6) * 100}%` } })
          )
        )
      ),

      // صحنه
      scene
        ? h('section', { class: 'paper warden-scene' },
            h('div', { class: 'warden-scene__head' },
              h('span', { class: 'warden-scene__loc' }, icon(STAT_ICON[loc?.stat] || 'book', 14), ' ', loc?.name || ''),
              run.cycle > 1 ? h('span', { class: 'warden-scene__act' }, `پرده ${toFa(run.cycle)}`) : null
            ),
            h('h2', { class: 'warden-scene__title' }, scene.title),
            h('p', { class: 'warden-scene__text' }, scene.text),
            h('div', { class: 'warden-choices' },
              ...scene.choices.map((c, i) => {
                const diff = difficultyOf(run, c);
                const odds = Math.round(checkOdds(inv.stats[c.stat] ?? 2, diff) * 100);
                return h('button', {
                  class: 'warden-choice',
                  disabled: !canAct,
                  onclick: () => resolve(i)
                },
                  h('span', { class: 'warden-choice__label' }, c.label),
                  h('span', { class: 'warden-choice__meta' },
                    h('span', { class: 'stat-chip stat-chip--sm' }, icon(STAT_ICON[c.stat], 12), ' ', STAT_FA[c.stat]),
                    h('span', { class: `warden-odds ${odds >= 60 ? 'is-good' : odds >= 40 ? 'is-mid' : 'is-bad'}` }, `${toFa(odds)}٪`),
                    h('span', { class: 'warden-diff' }, `سختی ${toFa(diff)}`)
                  )
                );
              })
            ),
            !canAct ? h('div', { class: 'warden-note' }, 'کنشی نمانده — دور را تمام کن.')
              : null
          )
        : h('section', { class: 'paper warden-scene warden-scene--empty' },
            h('div', { class: 'warden-scene__title' }, 'شهر ساکت است…'),
            h('p', { class: 'warden-scene__text' }, 'اینجا هنوز صحنه‌ای باز نشده. یک کنش انجام بده یا دور را تمام کن.'),
            btn('صحنه‌ی بعدی', { variant: 'btn--primary btn--block', onClick: nextScene })
          ),

      // کنش‌های عمومی
      h('div', { class: 'warden-actions' },
        btn('مهر کردن این مکان', {
          variant: 'btn--teal btn--block',
          disabled: !canAct || !loc || run.warded.includes(loc.id),
          onClick: () => doWard(loc)
        }),
        h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.45rem' } },
          btn('استراحت', { variant: 'btn--block', disabled: !canAct, onClick: doRest }),
          btn('کارت هول', { variant: 'btn--ghost btn--block', onClick: doHorror })
        )
      ),

      canConfront(run)
        ? h('div', { style: { marginTop: '.6rem' } },
            btn('رویارویی نهایی با دروازه', { variant: 'btn--mustard btn--block', onClick: doConfront }),
            h('p', { style: { fontSize: '.78rem', textAlign: 'center', marginTop: '.3rem', color: '#e8dcc4' } },
              `با ${toFa(run.warded.length)} مهر، شانس تو بیشتر است.`)
          )
        : h('div', { class: 'warden-progress' },
            h('div', { class: 'warden-progress__bar' },
              h('div', { class: 'warden-progress__fill', style: { width: `${progressOf(run) * 100}%` } })),
            h('small', {}, `${toFa(run.cluesNeeded - run.clues)} سرنخ دیگر تا رویارویی نهایی`)
          ),

      h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.45rem', marginTop: '.6rem' } },
        btn('پایان دور', { variant: 'btn--primary', onClick: doEndRound }),
        btn('راهنما', { variant: 'btn--ghost', onClick: () => { state.screen = 'help'; render(); } })
      ),

      // گزارش
      run.lastCheck ? checkCard(run.lastCheck) : null,
      run.lastHorror ? horrorCard(run.lastHorror) : null
    );
  }

  function checkCard(c) {
    return h('div', { class: `warden-result ${c.success ? 'is-win' : 'is-fail'}` },
      h('div', { class: 'warden-result__head' },
        icon(c.success ? 'check' : 'x', 16), ' ', c.label),
      h('div', { class: 'warden-result__dice' },
        h('span', {}, `تاس ${toFa(c.roll)}`),
        h('span', {}, `+${toFa(c.bonus)}`),
        h('span', {}, `= ${toFa(c.total)}`),
        h('span', { class: 'warden-result__vs' }, `در برابر ${toFa(c.difficulty)}`)
      ),
      h('div', { class: 'warden-result__text' }, c.text)
    );
  }

  function horrorCard(card) {
    return h('div', { class: 'horror-card' },
      h('div', { class: 'horror-card__kicker' }, 'کارت هول'),
      h('div', { class: 'horror-card__title' }, card.title),
      h('div', { class: 'horror-card__text' }, card.text),
      h('div', { class: 'horror-card__doom' }, `+${toFa(card.doom)} هول`, card.loseAction ? ' · یک کنش کمتر' : '')
    );
  }

  /* ------------------------------ کنش‌ها ------------------------------ */
  function resolve(i) {
    try {
      state.run = resolveSceneChoice(state.run, i);
      playSound(state.run.lastCheck?.success ? 'win' : 'lose');
      render();
    } catch (e) { toast(e.message, 'warn'); }
  }

  function nextScene() {
    state.run = beginScene(state.run);
    playSound('paper-flip');
    render();
  }

  function doWard(loc) {
    try {
      state.run = wardLocation(state.run, loc.id);
      playSound('seal');
      toast(`«${loc.name}» مهر شد`, 'ok');
      render();
    } catch (e) { toast(e.message, 'warn'); }
  }

  function doRest() {
    try {
      state.run = rest(state.run);
      playSound('tap');
      render();
    } catch (e) { toast(e.message, 'warn'); }
  }

  function doHorror() {
    state.run = drawHorror(state.run);
    playSound('lose');
    render();
  }

  function doEndRound() {
    const hadScene = Boolean(state.run.current);
    state.run = endRound(state.run);
    if (state.run.status === 'active') state.run = beginScene(state.run);
    playSound(hadScene ? 'paper-flip' : 'tap');
    render();
  }

  function doConfront() {
    if (!confirm('رویارویی نهایی؟ اگر شکست بخوری، هول و سلامتت به‌شدت آسیب می‌بیند.')) return;
    state.run = confront(state.run);
    playSound(state.run.status === 'won' ? 'win' : 'lose');
    render();
  }

  /* ------------------------------ پایان ------------------------------ */
  function drawEnd() {
    const run = state.run;
    const won = run.status === 'won';
    if (!state.recorded) {
      state.recorded = true;
      stats.record('warden', {
        label: won ? 'دروازه بسته شد' : 'شب تمام شد',
        key: 'warden-best',
        best: run.clues * 10 + run.warded.length * 5,
        higherIsBetter: true
      });
    }
    return h('div', {},
      gameHeader({ title: won ? 'دروازه بسته شد' : 'شب تمام شد', onBack: onExit }),
      h('section', { class: `paper warden-end ${won ? 'is-win' : 'is-lose'}` },
        h('div', { class: 'warden-end__seal' }, won ? '✶' : '☾'),
        h('h2', { class: 'warden-end__title' }, run.ending || ''),
        h('div', { class: 'warden-end__stats' },
          h('span', { class: 'score-pill' }, `دور: ${toFa(run.round)}`),
          h('span', { class: 'score-pill' }, `سرنخ: ${toFa(run.clues)}`),
          h('span', { class: 'score-pill' }, `مهر: ${toFa(run.warded.length)}`)
        )
      ),
      sheet({ title: 'وقایع شب', iconName: 'book', children:
        h('div', { class: 'warden-log' },
          ...run.log.slice(-14).map(e => h('div', { class: 'warden-log__row' }, '• ', e.text))
        )
      }),
      h('div', { style: { display: 'grid', gap: '.5rem' } },
        btn('شب تازه با همین محقق', {
          variant: 'btn--primary btn--block',
          onClick: () => {
            state.recorded = false;
            state.run = beginScene(createRun({ investigatorId: state.inv }));
            state.screen = 'play';
            render();
          }
        }),
        btn('انتخاب محقق دیگر', {
          variant: 'btn--teal btn--block',
          onClick: () => { state.recorded = false; state.run = null; state.screen = 'intro'; render(); }
        }),
        btn('بازگشت به خانه', { variant: 'btn--ghost btn--block', onClick: onExit })
      )
    );
  }

  return () => { /* no timers */ };
}

void SCENES; void HORROR_DECK; void RULES;
