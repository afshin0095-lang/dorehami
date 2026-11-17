/* ============================================================
   «پرونده‌ی وِردِن» — بازی کارتی-داستانی تک‌نفره با تم معمایی و ترسناک
   الهام‌گرفته از ساختار بازی‌های کارتی روایی (مثل Arkham Horror LCG)
   ولی با داستان، مکان‌ها، شخصیت‌ها و مکانیک کاملاً اصیل.

   هسته‌ی مکانیک:
   • ۴ محقق، هر کدام ۴ ویژگی (ذهن، چابکی، اراده، تن) و یک ضعف
   • ۹ مکان در شهر؛ هر مکان می‌تواند «مهر» شود
   • هر دور ۳ کنش: کاوش، مهر، استراحت، یا رویارویی
   • آزمون: ۱ت۶ + پاداش ویژگی در برابر سختی
   • ساعت هول (Doom) ۰ تا ۸؛ پر شدنش = باخت
   • ۳ سرنخ برای باز کردن رویارویی نهایی
   ============================================================ */

import { mulberry32 } from '../core.js';

/* ------------------------------ محقق‌ها ------------------------------ */
export const INVESTIGATORS = [
  {
    id: 'parisa',
    name: 'پریسا کاویانی',
    role: 'روزنامه‌نگار',
    art: 'detective',
    stats: { mind: 4, agility: 2, will: 3, body: 2 },
    perk: 'سرنخ‌ها را ارزان‌تر می‌خری: کاوش یک کنش کمتر می‌خواهد.',
    weakness: 'بی‌خوابی — هر ۳ دور یک هول اضافه می‌گیرد.',
    blurb: 'شش ماه است دنبال پرونده‌ای است که هیچ‌کس نمی‌خواهد چاپ شود.'
  },
  {
    id: 'ardalan',
    name: 'اردلان مهرابی',
    role: 'پزشک',
    art: 'doctor',
    stats: { mind: 3, agility: 2, will: 2, body: 4 },
    perk: 'استراحت دو کنش لازم دارد ولی ۲ سلامت برمی‌گرداند.',
    weakness: 'سوگ — با هر شکست در آزمون تن، یک هول اضافه.',
    blurb: 'در بیمارستان شهر، سه جسد را دیده که هیچ‌کدام نباید مرده باشند.'
  },
  {
    id: 'shirin',
    name: 'شیرین آذرمهر',
    role: 'مترجم خطوط کهن',
    art: 'citizen',
    stats: { mind: 3, agility: 3, will: 4, body: 2 },
    perk: 'مهر کردن مکان‌ها ارزان‌تر است (اراده به‌جای کنش اضافه).',
    weakness: 'وسواس — نمی‌تواند دو بار پشت‌سرهم یک مکان را مهر کند.',
    blurb: 'کتابی را ترجمه می‌کند که هر شب یک صفحه‌اش بیشتر می‌شود.'
  },
  {
    id: 'kamran',
    name: 'کامران رستگار',
    role: 'کارآگاه',
    art: 'mafia',
    stats: { mind: 4, agility: 3, will: 2, body: 3 },
    perk: 'در رویارویی، از ویژگی بالاتر استفاده می‌کند.',
    weakness: 'بدگمانی — با هر کارت هول، یک هول اضافه.',
    blurb: 'پرونده‌های بسته‌شده را دوباره باز می‌کند؛ این یکی بسته نشده بود.'
  }
];

/* ------------------------------ مکان‌ها ------------------------------ */
export const LOCATIONS = [
  { id: 'archive', name: 'آرشیو شهرداری', art: 'persian-gold', hint: 'کاغذهای پوسیده و پرونده‌های گم‌شده.', stat: 'mind', diff: 4 },
  { id: 'harbor', name: 'اسکله‌ی متروکه', art: 'noir-leather', hint: 'طوفان و کابل‌های پاره.', stat: 'agility', diff: 4 },
  { id: 'chapel', name: 'کلیسای سنگی', art: 'velvet-board', hint: 'نقش‌برجسته‌های نیمه‌تراشیده.', stat: 'will', diff: 5 },
  { id: 'hospital', name: 'بیمارستان قدیمی', art: 'paper-cream', hint: 'راهرویی که انتهایش دیده نمی‌شود.', stat: 'body', diff: 4 },
  { id: 'library', name: 'کتابخانه‌ی خصوصی', art: 'desk-bg', hint: 'قفسه‌هایی که خودشان مرتب می‌شوند.', stat: 'mind', diff: 5 },
  { id: 'marsh', name: 'باتلاق شمالی', art: 'moss', hint: 'مهی که صداها را نگه می‌دارد.', stat: 'will', diff: 4 },
  { id: 'theatre', name: 'تئاتر متروک', art: 'notebook-page', hint: 'پرده‌ای که هر شب باز است.', stat: 'agility', diff: 5 },
  { id: 'tower', name: 'برج ساعت', art: 'persian-gold', hint: 'ساعت‌ها یک دقیقه عقب‌اند.', stat: 'mind', diff: 6 },
  { id: 'cellar', name: 'زیرزمین میخانه', art: 'noir-leather', hint: 'دری که از سمت دیگر قفل است.', stat: 'body', diff: 5 }
];

/* ------------------------------ صحنه‌ها (داستان) ------------------------------ */
export const SCENES = [
  {
    id: 's1', title: 'نامه‌ی بی‌امضا', location: 'archive',
    text: 'در آرشیو شهرداری، پوشه‌ای پیدا می‌کنی که تاریخش فردا است. داخلش نقشه‌ی شهر است با نه علامت — یکی روی همان آرشیو.',
    choices: [
      { label: 'نقشه را با دقت بخوان', stat: 'mind', diff: 4, clue: true, success: 'یکی از علامت‌ها را رمزگشایی می‌کنی. یک سرنخ به دست آوردی.', fail: 'کاغذ در دستت خرد می‌شود و فقط گرد و خاک می‌ماند.' },
      { label: 'قفسه‌ها را بگرد', stat: 'agility', diff: 4, clue: false, success: 'دفتر خاطرات یک کارمند قدیمی پیدا می‌کنی؛ اسم «وِردِن» تکرار می‌شود.', fail: 'قفسه فرو می‌ریزد و سر و صدا نگهبان را بیدار می‌کند.' }
    ]
  },
  {
    id: 's2', title: 'مه‌ی اسکله', location: 'harbor',
    text: 'در اسکله، ملوان‌ها از قایقی حرف می‌زنند که سه شب پیش با خدمه‌ای بیشتر از ظرفیتش برگشته.',
    choices: [
      { label: 'با ملوان حرف بزن', stat: 'will', diff: 4, clue: true, success: 'ملوان می‌لرزد و اسم یک مکان را می‌گوید: برج ساعت.', fail: 'ملوان دهانش را می‌بندد و دور می‌شود.' },
      { label: 'قایق را بازرسی کن', stat: 'agility', diff: 5, clue: true, success: 'در انبار قایق، یک نشان مومی با علامت نه‌پر پیدا می‌کنی.', fail: 'پلکان می‌شکند و در آب سرد می‌افتی.' }
    ]
  },
  {
    id: 's3', title: 'کلیسای نیمه‌ساخته', location: 'chapel',
    text: 'کلیسا هنوز ساخته نشده، ولی ناقوسش سه بار در شب می‌زند. روی سنگ‌ها نوشته‌هایی هست که با هیچ خطی نمی‌خوانند.',
    choices: [
      { label: 'نوشته‌ها را بخوان', stat: 'mind', diff: 5, clue: true, success: 'ترجمه‌ای ناقص: «آن‌که می‌شمارد، خودش شمرده می‌شود.»', fail: 'حروف در چشمت می‌چرخند و ساعتی را از دست می‌دهی.' },
      { label: 'محراب را بگرد', stat: 'body', diff: 4, clue: false, success: 'زیر سنگ محراب، کیسه‌ای با سه سکه‌ی قدیمی است.', fail: 'سنگ جابه‌جا نمی‌شود و دستت زخم برمی‌دارد.' }
    ]
  },
  {
    id: 's4', title: 'اتاق ۹', location: 'hospital',
    text: 'در بیمارستان، اتاق ۹ همیشه پر است — ولی هیچ پرونده‌ای برایش نیست. پرستار شب می‌گوید کسی وارد نمی‌شود.',
    choices: [
      { label: 'در را باز کن', stat: 'body', diff: 5, clue: true, success: 'تخت خالی است، ولی روی ملافه جای نشستن کسی مانده که همین حالا بلند شده.', fail: 'در قفل است و صدای خنده‌ی کوتاهی از پشتش می‌آید.' },
      { label: 'پرونده‌ها را چک کن', stat: 'mind', diff: 4, clue: true, success: 'پرونده‌ی گم‌شده را میان برگه‌های خالی پیدا می‌کنی: مرگ در تاریخ فردا.', fail: 'پرونده‌ها بی‌ترتیب می‌شوند و ردی از خود باقی نمی‌گذارد.' }
    ]
  },
  {
    id: 's5', title: 'کتابی که نفس می‌کشد', location: 'library',
    text: 'در کتابخانه‌ی خصوصی، کتابی روی میز باز است و صفحه‌اش خودش ورق می‌خورد. هر بار یک کلمه بیشتر.',
    choices: [
      { label: 'ورق بزن و بخوان', stat: 'will', diff: 5, clue: true, success: 'جمله‌ی کامل را می‌خوانی: «دروازه با نه مهر بسته و با نه مهر باز می‌شود.»', fail: 'چشمت سیاهی می‌رود و بیدار که می‌شوی صبح است.' },
      { label: 'کتاب را ببند', stat: 'body', diff: 4, clue: false, success: 'کتاب بسته می‌شود — و زیر جلدش کلیدی پنهان است.', fail: 'کتاب بسته نمی‌شود و دستت را می‌سوزاند.' }
    ]
  },
  {
    id: 's6', title: 'آواز باتلاق', location: 'marsh',
    text: 'در باتلاق شمالی، مه صداها را نگه می‌دارد. صدای خودت را می‌شنوی که از دور صدایت می‌زند.',
    choices: [
      { label: 'به صدا جواب بده', stat: 'will', diff: 5, clue: true, success: 'صدا جواب می‌دهد: «زیر برج، سه سنگ.» یک سرنخ دیگر.', fail: 'صدا با اسم کوچکت صدایت می‌زند و تو فرار می‌کنی.' },
      { label: 'دنبال رد پا بگرد', stat: 'agility', diff: 4, clue: false, success: 'رد پاهایی پیدا می‌کنی که برمی‌گردند — بدون اینکه کسی برگردد.', fail: 'در گل گیر می‌کنی و وقتت تلف می‌شود.' }
    ]
  },
  {
    id: 's7', title: 'پرده‌ی همیشه‌باز', location: 'theatre',
    text: 'تئاتر متروک هر شب نمایش دارد. صندلی‌ها پر است از کسانی که پشتشان به توست.',
    choices: [
      { label: 'روی صحنه برو', stat: 'agility', diff: 5, clue: true, success: 'پشت پرده، دیوار نوشته‌ای هست با نه اسم — اسم تو آخرش است.', fail: 'چراغ‌ها خاموش می‌شوند و وقتی روشن می‌شوند، صندلی‌ها خالی‌اند.' },
      { label: 'در ردیف آخر بنشین', stat: 'will', diff: 5, clue: true, success: 'بازی را تا آخر می‌بینی؛ آخرش دقیقاً همان چیزی است که فردا اتفاق می‌افتد.', fail: 'نمی‌توانی بلند شوی تا پرده بیفتد.' }
    ]
  },
  {
    id: 's8', title: 'یک دقیقه عقب', location: 'tower',
    text: 'برج ساعت یک دقیقه عقب است. در دفتر برج، نُه ساعت جیبی پیدا می‌کنی که همه روی ۱۱:۵۹ مانده‌اند.',
    choices: [
      { label: 'ساعت‌ها را هم‌زمان کوک کن', stat: 'mind', diff: 6, clue: true, success: 'وقتی هر نه ساعت به ۱۲ می‌رسند، زمین یک لحظه ساکت می‌شود و یک سرنخ ظاهر می‌شود.', fail: 'ساعت‌ها با هم می‌شکنند و هول بالا می‌رود.' },
      { label: 'از پنجره شهر را ببین', stat: 'agility', diff: 4, clue: false, success: 'از بالا، نه علامت روی نقشه را می‌بینی که یک شکل می‌سازند.', fail: 'سرگیجه می‌گیری و پایین آمدن طول می‌کشد.' }
    ]
  },
  {
    id: 's9', title: 'درِ پشت‌رو', location: 'cellar',
    text: 'در زیرزمین میخانه، دری هست که فقط از سمت دیگر باز می‌شود. پشتش صدای شمارش می‌آید.',
    choices: [
      { label: 'در بزن', stat: 'will', diff: 5, clue: true, success: 'شمارش قطع می‌شود. یک تکه کاغذ از زیر در می‌آید: «سه مهر کم داری.»', fail: 'شمارش بلندتر می‌شود و تا صبح ادامه دارد.' },
      { label: 'دور در را بگرد', stat: 'body', diff: 5, clue: true, success: 'پشت بشکه‌ها، مهرِ نهم را پیدا می‌کنی — شکسته.', fail: 'بشکه‌ها می‌افتند و صدایشان تا بالای میخانه می‌رود.' }
    ]
  }
];

/* ------------------------------ کارت‌های هول ------------------------------ */
export const HORROR_DECK = [
  { id: 'h1', title: 'قدم‌های پشت سر', text: 'یک هول بگیر. اگر اراده‌ات ۳ یا بیشتر است، فقط نیمی از اثر.', doom: 1 },
  { id: 'h2', title: 'آینه‌ی دیر', text: 'تصویرت یک لحظه دیر حرکت می‌کند. یک هول.', doom: 1 },
  { id: 'h3', title: 'شمارش بی‌صدا', text: 'کسی تا نه می‌شمارد. اگر مکان مهر نشده باشد، دو هول.', doom: 2 },
  { id: 'h4', title: 'نامه‌ای با دست‌خط خودت', text: 'نامه را خودت نوشته‌ای، ولی هنوز ننوشته‌ای. یک هول و یک کنش کمتر.', doom: 1, loseAction: true },
  { id: 'h5', title: 'دروازه‌ی نیمه‌باز', text: 'هوا سرد می‌شود. یک هول؛ اگر سرنخ کافی نداری، دو هول.', doom: 2 },
  { id: 'h6', title: 'همسایه‌ای که نیست', text: 'همسایه‌ات سراغت را می‌گیرد؛ همسایه‌ای که سال‌ها پیش رفته. یک هول.', doom: 1 }
];

/* ------------------------------ راه‌اندازی ------------------------------ */
const DOOM_MAX = 12;
const CLUES_NEEDED = 3;
const ACTIONS_PER_ROUND = 3;

export function createRun({ investigatorId = 'parisa', seed = Date.now() } = {}) {
  const inv = INVESTIGATORS.find(i => i.id === investigatorId) || INVESTIGATORS[0];
  const rnd = mulberry32(seed);
  // ترتیب صحنه‌ها تصادفی، ولی همیشه هر ۹ صحنه در دسترس
  const order = [...SCENES].sort(() => rnd() - 0.5).map(s => s.id);
  return {
    investigatorId: inv.id,
    seed,
    rngState: seed >>> 0,
    round: 1,
    actionsLeft: ACTIONS_PER_ROUND,
    doom: 0,
    doomMax: DOOM_MAX,
    clues: 0,
    cluesNeeded: CLUES_NEEDED,
    health: 6,
    warded: [],            // شناسه‌ی مکان‌های مهرشده
    visited: [],
    sceneOrder: order,
    sceneIndex: 0,
    cycle: 1,               // پرده‌ی اول، دوم… هر پرده سخت‌تر
    current: null,         // { sceneId, location }
    horrorDrawn: [],
    status: 'active',      // active | won | lost
    ending: null,
    log: [],
    lastCheck: null,
    lastHorror: null
  };
}

const nextRnd = (state) => {
  // تولید عدد تصادفی قطعی از وضعیت — قابل بازتولید با seed یکسان
  let t = state.rngState = (state.rngState + 0x6D2B79F5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export function investigatorOf(run) {
  return INVESTIGATORS.find(i => i.id === run.investigatorId) || INVESTIGATORS[0];
}

export function currentScene(run) {
  if (!run.current) return null;
  return SCENES.find(s => s.id === run.current.sceneId) || null;
}

export function locationOf(id) {
  return LOCATIONS.find(l => l.id === id) || null;
}

/** میزان موفقیت یک آزمون با توجه به ویژگی و سختی (برای نمایش به بازیکن) */
export function checkOdds(statValue, difficulty) {
  const bonus = Math.max(0, statValue - 2);
  let wins = 0;
  for (let roll = 1; roll <= 6; roll++) if (roll + bonus >= difficulty) wins++;
  return wins / 6;
}

/** انجام یک آزمون: ۱ت۶ + پاداش ویژگی ≥ سختی */
export function rollCheck(run, { stat, difficulty }) {
  const inv = investigatorOf(run);
  const value = inv.stats[stat] ?? 2;
  const bonus = Math.max(0, value - 2);
  const roll = 1 + Math.floor(nextRnd(run) * 6);
  const total = roll + bonus;
  return { roll, bonus, total, difficulty, success: total >= difficulty, stat, value };
}

/* ------------------------------ کنش‌ها ------------------------------ */

/**
 * شروع صحنه‌ی بعدی.
 * اگر هر ۹ صحنه تمام شود، پرده‌ی بعد آغاز می‌شود: صحنه‌ها با ترتیب تازه و
 * سختی بیشتر برمی‌گردند و شهر سخت‌تر نفس می‌کشد. این کار بازی را هرگز قفل نمی‌کند.
 */
export function beginScene(run) {
  if (run.status !== 'active') return run;
  let next = run;

  if (next.sceneIndex >= next.sceneOrder.length) {
    // پرده‌ی تازه: ترتیب تازه + یک هول به‌عنوان گذر زمان
    const shuffled = [...next.sceneOrder].sort(() => nextRnd(next) - 0.5);
    next = {
      ...next,
      cycle: next.cycle + 1,
      sceneOrder: shuffled,
      sceneIndex: 0,
      doom: Math.min(next.doomMax, next.doom + 1),
      log: [...next.log, { kind: 'act', text: `پرده‌ی ${next.cycle} — شهر سخت‌تر می‌شود` }]
    };
    // اگر همین یک هول کار را تمام کرد، دیگر صحنه‌ای لازم نیست
    if (next.doom >= next.doomMax) return checkEnd(next);
  }

  const id = next.sceneOrder[next.sceneIndex];
  const scene = SCENES.find(s => s.id === id);
  return {
    ...next,
    current: { sceneId: id, location: scene.location },
    visited: next.visited.includes(scene.location) ? next.visited : [...next.visited, scene.location],
    log: [...next.log, { kind: 'scene', text: `صحنه: ${scene.title}` }]
  };
}

/** سختی واقعی یک گزینه در پرده‌ی فعلی — هر پرده یک واحد سخت‌تر */
export function difficultyOf(run, choice) {
  return choice.diff + Math.min(2, run.cycle - 1);
}

/** انتخاب یکی از دو گزینه‌ی صحنه و اجرای آزمونش */
export function resolveSceneChoice(run, choiceIndex) {
  const scene = currentScene(run);
  if (!scene) throw new Error('صحنه‌ای برای تصمیم‌گیری نیست');
  const choice = scene.choices[choiceIndex];
  if (!choice) throw new Error('این گزینه وجود ندارد');
  if (run.actionsLeft <= 0) throw new Error('کنشی برایت نمانده — دور را تمام کن');

  const check = rollCheck(run, { stat: choice.stat, difficulty: difficultyOf(run, choice) });
  let clues = run.clues;
  let doom = run.doom;
  let health = run.health;

  if (check.success) {
    if (choice.clue) clues = Math.min(run.cluesNeeded, clues + 1);
    else health = Math.min(6, health + 1);
  } else {
    doom = Math.min(run.doomMax, doom + 1);
    health = Math.max(0, health - 1);
  }

  // ضعف محقق: کامران با هر شکست یک هول اضافه
  if (!check.success && run.investigatorId === 'kamran') doom = Math.min(run.doomMax, doom + 1);

  const next = {
    ...run,
    clues,
    doom,
    health,
    actionsLeft: run.actionsLeft - 1,
    sceneIndex: run.sceneIndex + 1,
    current: null,
    lastCheck: { ...check, label: choice.label, text: check.success ? choice.success : choice.fail },
    log: [...run.log, {
      kind: 'check',
      text: `${choice.label} — ${check.success ? 'موفق' : 'شکست'} (تاس ${check.roll}+${check.bonus} در برابر ${check.difficulty})`
    }]
  };
  return finishCheck(next);
}

/** مهر کردن مکان فعلی — کاهش هول آینده و باز کردن مسیر نهایی */
export function wardLocation(run, locationId) {
  if (run.actionsLeft <= 0) throw new Error('کنشی برایت نمانده');
  if (run.warded.includes(locationId)) throw new Error('این مکان قبلاً مهر شده');
  const cost = run.investigatorId === 'shirin' ? 1 : 2;
  const loc = locationOf(locationId);
  if (!loc) throw new Error('مکان نامعتبر');
  const next = {
    ...run,
    warded: [...run.warded, locationId],
    actionsLeft: Math.max(0, run.actionsLeft - cost),
    log: [...run.log, { kind: 'ward', text: `مکان «${loc.name}» مهر شد` }]
  };
  // هر ۳ مهر، یک هول کمتر در آینده
  const doomRelief = next.warded.length % 3 === 0 ? 1 : 0;
  return { ...next, doom: Math.max(0, next.doom - doomRelief) };
}

/** استراحت: بازیابی سلامت به قیمت کنش */
export function rest(run) {
  if (run.actionsLeft <= 0) throw new Error('کنشی برایت نمانده');
  const cost = run.investigatorId === 'ardalan' ? 2 : 1;
  const heal = run.investigatorId === 'ardalan' ? 2 : 1;
  if (run.actionsLeft < cost) throw new Error('کنش کافی نداری');
  return {
    ...run,
    health: Math.min(6, run.health + heal),
    actionsLeft: run.actionsLeft - cost,
    log: [...run.log, { kind: 'rest', text: `استراحت — ${heal} سلامت برگشت` }]
  };
}

/** کشیدن کارت هول — همیشه یک پیامد دارد */
export function drawHorror(run) {
  const idx = Math.floor(nextRnd(run) * HORROR_DECK.length);
  const card = HORROR_DECK[idx];
  let doom = Math.min(run.doomMax, run.doom + card.doom);
  // اگر مکان فعلی مهر شده، یک واحد از اثر کم می‌شود
  const loc = run.current?.location;
  if (loc && run.warded.includes(loc)) doom = Math.max(0, doom - 1);
  const next = {
    ...run,
    doom,
    horrorDrawn: [...run.horrorDrawn, card.id],
    actionsLeft: card.loseAction ? Math.max(0, run.actionsLeft - 1) : run.actionsLeft,
    lastHorror: card,
    log: [...run.log, { kind: 'horror', text: `کارت هول: ${card.title}` }]
  };
  return checkEnd(next);
}

/** پایان دور: کنش‌ها پر می‌شوند، هول نفس می‌کشد */
export function endRound(run) {
  let doom = run.doom;
  // بی‌خوابی پریسا
  if (run.investigatorId === 'parisa' && run.round % 3 === 0) doom = Math.min(run.doomMax, doom + 1);
  // سقف سخت: بعد از ۳۰ دور، شب تمام می‌شود
  if (run.round >= 30) {
    return checkEnd({
      ...run,
      round: run.round + 1,
      doom: run.doomMax,
      status: 'active',
      log: [...run.log, { kind: 'round', text: 'سپیده‌دم بدون بستن دروازه' }]
    });
  }
  const next = {
    ...run,
    round: run.round + 1,
    actionsLeft: ACTIONS_PER_ROUND,
    doom,
    current: null,
    log: [...run.log, { kind: 'round', text: `دور ${run.round + 1} آغاز شد` }]
  };
  return checkEnd(next);
}

/** رویارویی نهایی — فقط با سرنخ کافی */
export function canConfront(run) {
  return run.clues >= run.cluesNeeded && run.status === 'active';
}

export function confront(run) {
  if (!canConfront(run)) throw new Error('هنوز سرنخ کافی نداری');
  const inv = investigatorOf(run);
  // کامران از بالاترین ویژگی استفاده می‌کند
  const stat = run.investigatorId === 'kamran'
    ? Object.entries(inv.stats).sort((a, b) => b[1] - a[1])[0][0]
    : 'will';
  const difficulty = 5 + run.warded.length;   // هر مهر، کار را آسان‌تر می‌کند (بونوس در rollCheck نیست، پس سختی را کم می‌کنیم)
  const realDiff = Math.max(3, difficulty - Math.floor(run.warded.length / 2));
  const check = rollCheck(run, { stat, difficulty: realDiff });
  if (check.success) {
    return {
      ...run,
      status: 'won',
      ending: `با ${run.warded.length} مهر و ${run.clues} سرنخ، دروازه بسته می‌شود. شهر تا صبح نفس می‌کشد.`,
      lastCheck: { ...check, label: 'رویارویی نهایی', text: 'دروازه بسته شد.' },
      log: [...run.log, { kind: 'win', text: 'رویارویی نهایی با موفقیت' }]
    };
  }
  const next = {
    ...run,
    doom: Math.min(run.doomMax, run.doom + 2),
    health: Math.max(0, run.health - 2),
    lastCheck: { ...check, label: 'رویارویی نهایی', text: 'دروازه باز ماند و چیزی از آن بیرون آمد.' },
    log: [...run.log, { kind: 'fail', text: 'رویارویی نهایی شکست خورد' }]
  };
  return checkEnd(next);
}

/* ------------------------------ پایان ------------------------------ */
function finishCheck(run) { return checkEnd(run); }

export function checkEnd(run) {
  if (run.status !== 'active') return run;
  if (run.doom >= run.doomMax) {
    return { ...run, status: 'lost', ending: 'ساعت هول پر شد. شهر تا صبح دوام نمی‌آورد.' };
  }
  if (run.health <= 0) {
    return { ...run, status: 'lost', ending: 'تاب نیاوردی. پرونده بی‌صاحب ماند.' };
  }
  return run;
}

/** درصد پیشرفت برای نوار وضعیت */
export function progressOf(run) {
  const cluePart = Math.min(1, run.clues / run.cluesNeeded) * 0.6;
  const wardPart = Math.min(1, run.warded.length / 6) * 0.25;
  const doomPart = (1 - run.doom / run.doomMax) * 0.15;
  return Math.max(0, Math.min(1, cluePart + wardPart + doomPart));
}

export const RULES = {
  doomMax: DOOM_MAX,
  cluesNeeded: CLUES_NEEDED,
  actionsPerRound: ACTIONS_PER_ROUND
};
