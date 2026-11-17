/* ============================================================
   «دوز» — تختهٔ ۹×۹ روی کاغذ کهنه با نقش‌مایهٔ چینی
   تخته با SVG کشیده می‌شود تا مهره‌ها دقیقاً روی تقاطع‌ها بنشینند.
   ============================================================ */

import { h, mount, playSound, stats, toFa } from '../core.js';
import { gameHeader, sheet, btn, helpBlock, callout, icon } from '../ui/kit.js';
import {
  SIZE, NODES, UNIQUE_MILLS, PIECES_EACH, MILLS_TO_WIN,
  createDuz, placePiece, movePiece, removePiece, selectPiece,
  removableBy, neighbors, botTurn, millAt, other_player, pieceCount,
  BOT_LEVELS
} from '../engines/duz.js';

const LEVEL_LABEL = { easy: 'آسان', normal: 'میانه', hard: 'سخت‌گیر' };
const LEVEL_HINT = {
  easy: 'ربات گاهی اشتباه می‌کند — برای یاد گرفتن',
  normal: 'ربات خوب بازی می‌کند',
  hard: 'ربات کامل بازی می‌کند — باخت قطعی با بازی کامل'
};

const HELP = {
  steps: [
    'مهره‌ها روی تقاطع خط‌ها می‌نشینند، نه داخل خانه‌ها. برای گذاشتن، روی نقطه بزن.',
    'هر بازیکن ۹ مهره دارد. اول همه مهره‌ها را می‌گذاری، بعد نوبت حرکت می‌رسد.',
    'در فاز حرکت، مهره‌ات را انتخاب کن و بعد روی نقطهٔ خالیِ همسایه بزن.',
    'سه مهرهٔ هم‌رنگ روی یک خط = آسیاب. با هر آسیاب یک مهره از حریف برمی‌داری (مهره‌های داخل آسیاب حریف مصون‌اند، مگر همه در آسیاب باشند).',
    'سه آسیاب بزنی، بردی. اگر حریف کمتر از سه مهره داشته باشد یا نتواند حرکت کند، هم بردی.',
    'اگر حریف دقیقاً سه مهره داشته باشد، می‌تواند «پرواز» کند و به هر نقطهٔ خالی برود.'
  ],
  example: 'مثال: سه مهره‌ات در گوشه‌ی بالا-چپ، وسط بالا و گوشه‌ی بالا-راست آسیاب می‌سازند. یک مهره از حریف برمی‌داری — بهترین گزینه مهره‌ای است که خودش داشت آسیاب می‌ساخت.',
  note: 'دوز یکی از کهن‌ترین بازی‌های تخته‌ای جهان است؛ نمونه‌هایش از مصر باستان تا چین باستان پیدا شده. تختهٔ ما با نقش‌مایهٔ اژدها و ابر چینی تزئین شده.'
};

/* ------------------------------ تخته ------------------------------ */

const CELL = 48;                 // فاصلهٔ هر خط
const PAD = 28;                  // حاشیه
const W = (SIZE - 1) * CELL + PAD * 2;

const px = (x) => PAD + x * CELL;

function drawBoard(game, { onNode, highlight = [] } = {}) {
  const svgNs = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNs, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${W}`);
  svg.setAttribute('class', 'duz-svg');
  svg.setAttribute('role', 'group');
  svg.setAttribute('aria-label', 'تختهٔ دوز');

  const add = (tag, attrs, parent = svg) => {
    const n = document.createElementNS(svgNs, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
    parent.append(n);
    return n;
  };

  // کاغذ و نقش‌مایه
  add('rect', { x: 0, y: 0, width: W, height: W, fill: 'transparent' });
  // ابرهای چینی گوشه‌ها
  for (const [cx, cy, r] of [[0, 0, 60], [W, 0, 60], [0, W, 60], [W, W, 60]]) {
    add('circle', { cx, cy, r, class: 'duz-cloud' });
  }

  // خطوط تخته: سه مربع هم‌مرکز + خطوط اتصال
  const boxes = [
    [0, 0, SIZE - 1],
    [1, 1, SIZE - 3],
    [2, 2, SIZE - 5]
  ];
  for (const [x0, y0, span] of boxes) {
    add('rect', {
      x: px(x0), y: px(y0), width: span * CELL, height: span * CELL,
      class: 'duz-line', rx: 1.5
    });
  }
  // خطوط اتصال بین مربع‌ها (نیمه‌ی هر ضلع)
  const mids = [
    // بالا و پایین
    [4, 0, 4, 1], [4, 2, 4, 3], [4, SIZE - 3, 4, SIZE - 1], [4, SIZE - 5, 4, SIZE - 4],
    // چپ و راست
    [0, 4, 1, 4], [2, 4, 3, 4], [SIZE - 3, 4, SIZE - 1, 4], [SIZE - 5, 4, SIZE - 4, 4]
  ];
  for (const [x1, y1, x2, y2] of mids) {
    add('line', { x1: px(x1), y1: px(y1), x2: px(x2), y2: px(y2), class: 'duz-line' });
  }

  // نقاط
  for (const node of NODES) {
    const owner = game.board[node.id];
    const isHL = highlight.includes(node.id);
    const group = add('g', {
      class: `duz-node${owner ? ` is-${owner}` : ''}${isHL ? ' is-target' : ''}`,
      'data-node': node.id,
      tabindex: '0',
      role: 'button',
      'aria-label': nodeLabel(game, node.id)
    });

    // دایرهٔ لمس بزرگ‌تر، شفاف
    add('circle', { cx: px(node.x), cy: px(node.y), r: 20, class: 'duz-hit' }, group);
    // خودِ نقطه
    add('circle', { cx: px(node.x), cy: px(node.y), r: owner ? 15 : 4.5, class: 'duz-dot' }, group);

    if (owner) {
      add('circle', { cx: px(node.x), cy: px(node.y), r: 15, class: 'duz-piece' }, group);
      // نقش اژدهای کوچک روی مهره
      add('path', {
        d: dragonPath(px(node.x), px(node.y)),
        class: 'duz-piece-mark'
      }, group);
    }

    if (game.selected === node.id) {
      add('circle', { cx: px(node.x), cy: px(node.y), r: 19, class: 'duz-selected' }, group);
    }

    group.addEventListener('click', () => onNode?.(node.id));
    group.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNode?.(node.id); }
    });
  }

  return svg;
}

function nodeLabel(game, id) {
  const owner = game.board[id];
  const where = `نقطهٔ ${id + 1}`;
  if (!owner) return `${where}، خالی`;
  return `${where}، مهرهٔ ${owner === 'A' ? 'تو' : 'حریف'}`;
}

/** یک نقش سادهٔ اژدها برای روی مهره */
function dragonPath(cx, cy) {
  return `M${cx - 7},${cy + 3} q3,-6 7,-3 q4,3 7,-3 M${cx - 5},${cy - 3} q2,-3 5,0`;
}

/* ------------------------------ بازی ------------------------------ */

export function mountGame(root, { onExit } = {}) {
  let screen = 'intro';
  let game = null;
  let mode = 'bot';          // bot | duo
  let level = 'normal';      // easy | normal | hard
  let msg = '';
  let lastBotAt = 0;
  let recorded = false;

  const render = () => mount(root, draw());
  render();

  function draw() {
    if (screen === 'help') return drawHelp();
    if (screen === 'play') return drawPlay();
    return drawIntro();
  }

  function startGame() {
    game = createDuz({ firstPlayer: 'A' });
    msg = '';
    recorded = false;
    screen = 'play';
    playSound('shuffle');
    render();
    // اگر ربات اول است
    if (mode === 'bot' && game.turn === 'B') setTimeout(botMove, 320);
  }

  function drawIntro() {
    const s = stats.get();
    const wins = s.records?.['duz-wins'] || 0;
    return h('div', {},
      gameHeader({ title: 'دوز', onBack: onExit }),

      h('section', { class: 'paper duz-hero print-edge' },
        h('div', { class: 'duz-hero__deco', 'aria-hidden': 'true' }, '☯'),
        h('div', { class: 'duz-hero__text' },
          h('div', { class: 'duz-hero__kicker' }, 'تختهٔ کهن · دو نفره'),
          h('h1', {}, 'دوز'),
          h('p', {}, 'نه مهره، بیست‌وچهار تقاطع، و یک قانون ساده: سه‌تا که هم‌خط شد، یکی از حریف را برمی‌داری.')
        )
      ),

      sheet({ title: 'حالت بازی', iconName: 'users', children:
        h('div', { class: 'level-row' },
          ...[
            { id: 'bot', name: 'با رایانه', meta: 'همین حالا' },
            { id: 'duo', name: 'دو نفره', meta: 'روی یک گوشی' }
          ].map(m => h('button', {
            class: `level-card${mode === m.id ? ' is-on' : ''}`,
            'aria-pressed': String(mode === m.id),
            onclick: () => { mode = m.id; playSound('tap'); render(); }
          },
            h('div', { class: 'level-card__name' }, m.name),
            h('div', { class: 'level-card__meta' }, m.meta)
          ))
        )
      }),

      mode === 'bot' ? sheet({ title: 'سختی ربات', iconName: 'wand', children:
        h('div', { class: 'level-row' },
          ...['easy', 'normal', 'hard'].map(id => h('button', {
            class: `level-card${level === id ? ' is-on' : ''}`,
            'aria-pressed': String(level === id),
            onclick: () => { level = id; playSound('tap'); render(); }
          },
            h('div', { class: 'level-card__name' }, LEVEL_LABEL[id]),
            h('div', { class: 'level-card__meta' }, LEVEL_HINT[id])
          ))
        )
      }) : null,

      sheet({ title: 'قواعد کوتاه', iconName: 'book', children:
        h('ul', { class: 'duz-rules' },
          h('li', {}, 'مهره روی تقاطع خط‌ها می‌نشیند، نه داخل خانه.'),
          h('li', {}, `هر کس ${toFa(PIECES_EACH)} مهره: اول همه گذاشته می‌شوند، بعد حرکت می‌کنند.`),
          h('li', {}, 'سه مهرهٔ هم‌رنگ روی یک خط = آسیاب → یک مهره از حریف بردار.'),
          h('li', {}, `${toFa(MILLS_TO_WIN)} آسیاب = برد.`)
        )
      }),

      h('div', { class: 'stack' },
        btn('شروع بازی', { variant: 'btn--primary btn--block', onClick: startGame }),
        btn('راهنمای کامل', { variant: 'btn--ghost btn--block', onClick: () => { screen = 'help'; render(); } }),
        btn('بازگشت', { variant: 'btn--ghost btn--block', onClick: onExit })
      ),

      wins ? callout(`${toFa(wins)} بار برده‌ای. مهره‌های طلایی منتظرند.`, 'crown') : null
    );
  }

  function drawHelp() {
    return h('div', {},
      gameHeader({ title: 'راهنمای دوز', onBack: () => { screen = 'intro'; render(); } }),
      sheet({ title: 'قواعد', iconName: 'book', children: helpBlock(HELP) }),
      h('div', { class: 'stack' },
        btn('فهمیدم', { variant: 'btn--primary btn--block', onClick: () => { screen = 'intro'; render(); } })
      )
    );
  }

  function drawPlay() {
    const isBot = mode === 'bot';
    const myTurn = !isBot || game.turn === 'A';
    const removable = game.mustRemove ? removableBy(game.board, game.turn) : [];
    const targets = computeTargets();

    const boardHost = h('div', { class: 'duz-board paper paper--moss print-edge' });
    boardHost.append(drawBoard(game, { onNode: onNodeClick, highlight: targets }));

    return h('div', {},
      gameHeader({
        title: 'دوز',
        onBack: () => { screen = 'intro'; render(); },
        children: [h('span', { class: 'score-pill' }, phaseLabel(game))]
      }),

      /* نوار وضعیت */
      h('div', { class: 'duz-status' },
        playerCard('A', 'تو', game, game.turn === 'A' && game.phase !== 'over', isBot ? 'A' : 'A'),
        h('div', { class: 'duz-vs', 'aria-hidden': 'true' }, '⚔'),
        playerCard('B', isBot ? 'رایانه' : 'بازیکن ۲', game, game.turn === 'B' && game.phase !== 'over', 'B')
      ),

      boardHost,

      /* پیام */
      msg ? h('div', { class: 'duz-msg is-err', role: 'alert' }, msg) : null,
      game.mustRemove
        ? h('div', { class: 'duz-msg', role: 'status' },
          game.turn === 'A' || !isBot
            ? 'آسیاب ساختی! یکی از مهره‌های حریف را انتخاب کن.'
            : 'حریف آسیاب ساخت و دارد مهره برمی‌دارد…')
        : null,

      /* راهنمای کنش */
      h('div', { class: 'duz-hint' },
        icon(game.phase === 'placing' ? 'plus' : 'arrow', 15),
        h('span', {}, actionHint(game, isBot, myTurn))
      ),

      /* دکمه‌ها */
      h('div', { class: 'btn-row' },
        btn('بازی تازه', { variant: 'btn--ghost', onClick: startGame }),
        btn('قواعد', { variant: 'btn--ghost', onClick: () => { screen = 'help'; render(); } }),
        btn('خروج', { variant: 'btn--ghost', onClick: onExit })
      ),

      game.phase === 'over' ? drawEnd() : null
    );
  }

  function playerCard(id, name, g, isTurn, seat) {
    const onBoard = g.onBoard[id];
    const inHand = g.inHand[id];
    return h('div', {
      class: `duz-player is-${id}${isTurn ? ' is-turn' : ''}`,
      'aria-label': `${name}: ${onBoard} مهره روی تخته، ${inHand} در دست${isTurn ? '، نوبت اوست' : ''}`
    },
      h('span', { class: `duz-player__dot is-${id}`, 'aria-hidden': 'true' }),
      h('span', { class: 'duz-player__name' }, name),
      h('span', { class: 'duz-player__count' }, `${toFa(onBoard)}/${toFa(PIECES_EACH)}`),
      h('span', { class: 'duz-player__meta' }, inHand > 0 ? `${toFa(inHand)} در دست` : `${toFa(g.mills[id])} آسیاب`),
      isTurn ? h('span', { class: 'duz-player__turn' }, 'نوبت') : null
    );
  }

  function phaseLabel(g) {
    if (g.phase === 'over') return g.winner === 'A' ? 'بردی' : 'باختی';
    if (g.mustRemove) return 'برداشتن مهره';
    if (g.phase === 'placing') return 'چیدن مهره';
    if (g.phase === 'flying') return 'پرواز';
    return 'حرکت';
  }

  function actionHint(g, isBot, myTurn) {
    if (g.phase === 'over') return 'بازی تمام شد.';
    if (!myTurn) return 'نوبت حریف است…';
    if (g.mustRemove) return 'روی یکی از مهره‌های حریف بزن تا برداشته شود.';
    if (g.phase === 'placing') return 'روی یک تقاطع خالی بزن تا مهره‌ات بنشیند.';
    if (g.selected !== null) return 'حالا روی نقطهٔ خالیِ همسایه بزن تا مهره حرکت کند.';
    return 'اول یکی از مهره‌های خودت را انتخاب کن.';
  }

  /** نقاطی که با کلیک باید برجسته شوند */
  function computeTargets() {
    if (!game || game.phase === 'over') return [];
    if (game.mustRemove) return removableBy(game.board, game.turn);
    if (game.selected !== null) {
      if (game.phase === 'flying') {
        return game.board.map((v, i) => (v === null ? i : -1)).filter(i => i >= 0);
      }
      return neighbors(game.selected).filter(n => game.board[n] === null);
    }
    return [];
  }

  function onNodeClick(id) {
    if (game.phase === 'over') return;
    if (mode === 'bot' && game.turn === 'B') return;    // نوبت ربات
    msg = '';

    try {
      // برداشتن مهره
      if (game.mustRemove) {
        game = removePiece(game, id);
        playSound('seal');
        render();
        afterMove();
        return;
      }

      // گذاشتن مهره
      if (game.phase === 'placing') {
        if (game.board[id] !== null) { msg = 'این نقطه پر است.'; render(); return; }
        game = placePiece(game, id);
        playSound('card-deal');
        render();
        afterMove();
        return;
      }

      // حرکت
      if (game.selected === null) {
        if (game.board[id] !== game.turn) {
          msg = mode === 'duo' && game.board[id] ? 'این مهره‌ی حریف است.' : 'اول یکی از مهره‌های خودت را انتخاب کن.';
          render();
          return;
        }
        game = selectPiece(game, id);
        playSound('tap');
        render();
        return;
      }

      // انتخاب دوباره
      if (game.board[id] === game.turn) {
        game = selectPiece(game, id);
        playSound('tap');
        render();
        return;
      }

      game = movePiece(game, game.selected, id);
      playSound('card-deal');
      render();
      afterMove();
    } catch (e) {
      msg = e.message;
      playSound('error');
      render();
    }
  }

  function afterMove() {
    if (game.phase === 'over') { finish(); return; }
    if (mode === 'bot' && game.turn === 'B') {
      setTimeout(botMove, 340);
    }
  }

  function botMove() {
    if (!game || game.phase === 'over') return;
    if (game.turn !== 'B') return;
    const now = Date.now();
    if (now - lastBotAt < 200) return;
    lastBotAt = now;

    const res = botTurn(game, { level });
    game = res.game;
    playSound('tap');
    render();

    if (game.phase === 'over') { finish(); return; }
    // اگر ربات باید دوباره بازی کند (مثلاً برداشتن مهره)
    if (game.mustRemove && game.turn === 'B') {
      setTimeout(botMove, 320);
    } else if (mode === 'duo' && game.turn === 'B') {
      // دو نفره: نوبت آدم دوم
    }
  }

  function finish() {
    if (recorded) return;
    recorded = true;
    const won = game.winner === 'A';
    stats.record('duz', {
      key: 'duz-wins',
      best: (stats.get().records?.['duz-wins'] || 0) + (mode === 'bot' && won ? 1 : 0),
      higherIsBetter: true,
      label: mode === 'bot'
        ? (won ? 'برد در دوز' : 'باخت در دوز')
        : (won ? 'برد بازیکن ۱' : 'برد بازیکن ۲')
    });
    playSound(mode === 'bot' && won ? 'win' : 'lose');
  }

  function drawEnd() {
    const won = game.winner === 'A';
    const title = mode === 'bot'
      ? (won ? 'بردی' : 'باختی')
      : (won ? 'بازیکن ۱ برد' : 'بازیکن ۲ برد');
    return h('section', { class: `duz-end${won ? ' is-win' : ' is-lose'}` },
      h('div', { class: 'duz-end__seal', 'aria-hidden': 'true' }, won ? '龍' : '☯'),
      h('h2', {}, title),
      h('div', { class: 'duz-end__stats' },
        h('span', {}, `آسیاب تو: ${toFa(game.mills.A)}`),
        h('span', {}, `آسیاب حریف: ${toFa(game.mills.B)}`),
        h('span', {}, `حرکت‌ها: ${toFa(game.moveCount)}`)
      ),
      h('div', { class: 'btn-row' },
        btn('دوباره', { variant: 'btn--primary', onClick: startGame }),
        btn('برگشت به منو', { variant: 'btn--ghost', onClick: () => { screen = 'intro'; render(); } })
      )
    );
  }

  return () => { game = null; };
}

export { SIZE, PIECES_EACH };
