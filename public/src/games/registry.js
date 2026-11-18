/* ============================================================
   رجیستری بازی‌ها — یک فایل برای معرفی، یک تابع برای نصب
   هر بازی: { id, title, meta, playersText, timeText, art, cats, tags, solo, badge, load }
   ============================================================ */

export const CATEGORIES = [
  { id: 'group', label: 'دورهمی', glyph: '🪑', emblem: '/assets/art/cats/cat-group.jpg' },
  { id: 'duo', label: 'دونفره', glyph: '⚔️', emblem: '/assets/art/cats/cat-duo.jpg' },
  { id: 'solo', label: 'تکی', glyph: '🕯️', emblem: '/assets/art/cats/cat-solo.jpg' },
  { id: 'cards', label: 'ورق و تاس', glyph: '🃏', emblem: '/assets/art/cats/cat-cards.jpg' },
  { id: 'words', label: 'واژه', glyph: '✒️', emblem: '/assets/art/cats/cat-words.jpg' },
  { id: 'mind', label: 'فکری', glyph: '🧠', emblem: '/assets/art/cats/cat-mind.jpg' },
  { id: 'story', label: 'داستانی', glyph: '📖', emblem: '/assets/art/cats/cat-solo.jpg' }
];

export const GAMES = [
  {
    id: 'qwixx', title: 'کوییکس', meta: '۲ تا ۵ نفر · ۱۵–۲۰ دقیقه',
    playersText: '۲–۵ نفر', timeText: '۱۵–۲۰ دقیقه',
    art: '/assets/art/games/qwixx.jpg',
    cats: ['group', 'cards'], tags: ['تاس', 'همه با هم', 'امتیاز', 'بدون انتظار'],
    solo: false, badge: 'همه با هم', multi: false,
    load: () => import('./qwixx-ui.js')
  },
  {
    id: 'skyjo', title: 'اسکایجو', meta: '۲ تا ۴ نفر · ۱۵–۳۰ دقیقه',
    playersText: '۲–۴ نفر', timeText: '۱۵–۳۰ دقیقه',
    art: '/assets/art/games/skyjo.jpg',
    cats: ['group', 'cards'], tags: ['ورق', 'حافظه', 'کمترین امتیاز', 'حدس'],
    solo: false, badge: '۱۲ کارت', multi: false,
    load: () => import('./skyjo-ui.js')
  },
  {
    id: 'kittens', title: 'بچه گربه‌های منفجر شونده', meta: '۲ تا ۵ نفر · ۱۰–۲۰ دقیقه',
    playersText: '۲–۵ نفر', timeText: '۱۰–۲۰ دقیقه',
    art: '/assets/art/games/kittens.jpg',
    cats: ['group', 'cards'], tags: ['ورق', 'شانس', 'بلوف', 'خنده‌دار'],
    solo: false, badge: '💥', multi: false,
    load: () => import('./kittens-ui.js')
  },
  {
    id: 'liarsdice', title: 'تاس دروغگو', meta: '۲ تا ۶ نفر · ۱۰–۱۵ دقیقه',
    playersText: '۲–۶ نفر', timeText: '۱۰–۱۵ دقیقه',
    art: '/assets/art/games/liarsdice.jpg',
    cats: ['group', 'cards'], tags: ['تاس', 'بلوف', 'روان‌شناسی', 'ریسک'],
    solo: false, badge: 'بلوف', multi: false,
    load: () => import('./liar-ui.js')
  },
  {
    id: 'uno', title: 'اونو', meta: '۲ تا ۴ نفر · ۱۰–۲۰ دقیقه',
    playersText: '۲–۴ نفر', timeText: '۱۰–۲۰ دقیقه',
    art: '/assets/art/games/uno.jpg',
    cats: ['group', 'cards'], tags: ['ورق', 'اکشن', 'هم‌رنگ', 'سریع'],
    solo: false, badge: 'کلاسیک', multi: false,
    load: () => import('./uno-ui.js')
  },
  {
    id: 'eights', title: 'هفت خبیث', meta: '۲ تا ۴ نفر · ۵–۱۲ دقیقه',
    playersText: '۲–۴ نفر', timeText: '۵–۱۲ دقیقه',
    art: '/assets/art/games/crazy8.jpg',
    cats: ['group', 'cards'], tags: ['ورق', 'پاسور', 'ساده', 'سریع'],
    solo: false, badge: 'پاسور', multi: false,
    load: () => import('./cards-ui.js')
  },
  {
    id: 'blackjack', title: 'بیست‌ویک', meta: 'تکی · ۳–۸ دقیقه',
    playersText: '۱ نفر', timeText: '۳–۸ دقیقه',
    art: '/assets/art/games/blackjack.jpg',
    cats: ['solo', 'cards'], tags: ['پاسور', 'ریسک', 'عدد', 'تصمیم'],
    solo: true, badge: '۲۱', multi: false,
    load: () => import('./cards-ui.js')
  },
  {
    id: 'yahtzee', title: 'یاتزی', meta: '۱ تا ۴ نفر · ۱۵–۲۵ دقیقه',
    playersText: '۱–۴ نفر', timeText: '۱۵–۲۵ دقیقه',
    art: '/assets/art/games/yahtzee.jpg',
    cats: ['solo', 'cards'], tags: ['تاس', 'ترکیب', 'امتیاز', 'شانس'],
    solo: true, badge: '۱۳ خانه', multi: false,
    load: () => import('./dice-ui.js')
  },
  {
    id: 'farkle', title: 'فارکل', meta: '۱ تا ۴ نفر · ۱۰–۲۰ دقیقه',
    playersText: '۱–۴ نفر', timeText: '۱۰–۲۰ دقیقه',
    art: '/assets/art/games/farkle.jpg',
    cats: ['solo', 'cards'], tags: ['تاس', 'ریسک', 'طمع', 'امتیاز'],
    solo: true, badge: '۶ تاس', multi: false,
    load: () => import('./dice-ui.js')
  },
  {
    id: 'mafia', title: 'مافیا', meta: '۶ تا ۱۲ نفر · ۳۰–۴۵ دقیقه',
    playersText: '۶–۱۲ نفر', timeText: '۳۰–۴۵ دقیقه',
    art: '/assets/art/games/mafia.jpg',
    cats: ['group', 'mind'], tags: ['نقش مخفی', 'استنتاج', 'شب و روز'],
    solo: false, badge: 'پرده‌ی خصوصی', multi: true,
    load: () => import('./mafia-ui.js')
  },
  {
    id: 'hokm', title: 'حکم', meta: '۴ نفر · ۲ تیم · ۱۵–۲۵ دقیقه',
    playersText: '۴ نفر', timeText: '۱۵–۲۵ دقیقه',
    art: '/assets/art/games/hokm.jpg',
    cats: ['cards', 'group'], tags: ['ورق', 'تیمی', 'حکم'],
    solo: false, badge: 'ورق گوتیک', multi: true,
    load: () => import('./hokm-ui.js')
  },
  {
    id: 'esmfamil', title: 'اسم و فامیل', meta: '۲ تا ۸ نفر · ۱۰–۲۰ دقیقه',
    playersText: '۲–۸ نفر', timeText: '۱۰–۲۰ دقیقه',
    art: '/assets/art/games/esmfamil.jpg',
    cats: ['words', 'group'], tags: ['برگه', 'واژه', 'حرف'],
    solo: false, badge: 'برگه‌ی پانچ‌شده', multi: true,
    load: () => import('./esmfamil-ui.js')
  },
  {
    id: 'snake', title: 'مار و پله', meta: '۲ تا ۴ نفر · ۱۵–۲۵ دقیقه',
    playersText: '۲–۴ نفر', timeText: '۱۵–۲۵ دقیقه',
    art: '/assets/art/games/snake.jpg',
    cats: ['cards', 'group'], tags: ['تاس', 'تخته', 'شانس'],
    solo: false, badge: 'تاس چوبی', multi: true,
    load: () => import('./snake-ui.js')
  },
  {
    id: 'quiz', title: 'کوییز', meta: 'تکی یا دونفره · ۵–۱۰ دقیقه',
    playersText: '۱–۲ نفر', timeText: '۵–۱۰ دقیقه',
    art: '/assets/art/games/quiz.jpg',
    cats: ['solo', 'mind'], tags: ['دانستنی', 'اطلاعات عمومی', 'مسابقه'],
    solo: true, badge: '۳۰ سؤال', multi: true,
    load: () => import('./quiz-ui.js')
  },
  {
    id: 'riddle', title: 'چیستان', meta: 'تکی · ۳–۸ دقیقه',
    playersText: '۱ نفر', timeText: '۳–۸ دقیقه',
    art: '/assets/art/games/riddle.jpg',
    cats: ['solo', 'mind'], tags: ['معما', 'حدس', 'سرنخ'],
    solo: true, badge: 'فکری', multi: false,
    load: () => import('./riddle-ui.js')
  },
  {
    id: 'iq', title: 'تست هوش', meta: 'تکی · ۴–۱۰ دقیقه',
    playersText: '۱ نفر', timeText: '۴–۱۰ دقیقه',
    art: '/assets/art/games/iq.jpg',
    cats: ['solo', 'mind'], tags: ['منطق', 'الگو', 'تست'],
    solo: true, badge: 'منطقی', multi: false,
    load: () => import('./iq-ui.js')
  },
  {
    id: 'gk', title: 'تست اطلاعات عمومی', meta: 'تکی · ۵–۱۲ دقیقه',
    playersText: '۱ نفر', timeText: '۵–۱۲ دقیقه',
    art: '/assets/art/games/geo-quiz.jpg',
    cats: ['solo', 'mind'], tags: ['اطلاعات عمومی', 'جغرافیا', 'تاریخ', 'علوم', 'کوییز'],
    solo: true, badge: '۱۰۰۰+ سؤال', multi: false,
    load: () => import('./gk-ui.js')
  },
  {
    id: 'codenames', title: 'اسم رمز', meta: '۴ تا ۸ نفر · ۲ تیم · ۲۰–۳۰ دقیقه',
    playersText: '۴–۸ نفر', timeText: '۲۰–۳۰ دقیقه',
    art: '/assets/art/games/codenames.jpg',
    cats: ['group', 'words'], tags: ['تیمی', 'سرنخ', 'کدنیمز'],
    solo: false, badge: 'دو تیم', multi: true,
    load: () => import('./codenames-ui.js')
  },
  {
    id: 'lowball', title: 'کم‌ترین پیشنهاد', meta: '۲ تا ۴ نفر · ۱۰–۲۰ دقیقه',
    playersText: '۲–۴ نفر', timeText: '۱۰–۲۰ دقیقه',
    art: '/assets/art/games/lowball.jpg',
    cats: ['cards', 'duo'], tags: ['ورق', 'بلوف', 'مناقصه'],
    solo: false, badge: 'ورق نوآر', multi: true,
    load: () => import('./lowball-ui.js')
  },
  {
    id: 'story', title: 'قصه‌چین', meta: '۲ تا ۶ نفر · ۱۰–۱۵ دقیقه',
    playersText: '۲–۶ نفر', timeText: '۱۰–۱۵ دقیقه',
    art: '/assets/art/games/story.jpg',
    cats: ['duo', 'words'], tags: ['داستان', 'خلاقیت', 'نوبتی'],
    solo: false, badge: 'خلاقیت', multi: true,
    load: () => import('./story-ui.js')
  },
  {
    id: 'warden', title: 'پرونده‌ی وِردِن', meta: 'تکی · ۲۵–۴۰ دقیقه',
    playersText: '۱ نفر', timeText: '۲۵–۴۰ دقیقه',
    art: '/assets/art/games/warden.jpg',
    cats: ['solo', 'cards', 'mind'], tags: ['داستانی', 'ترسناک', 'کارتی', 'معمایی'],
    solo: true, badge: 'پرونده‌ی محقق', multi: false,
    load: () => import('./warden-ui.js')
  },
  {
    id: 'ring', title: 'همراهی حلقه', meta: 'تکی · ۱۵–۲۵ دقیقه',
    playersText: '۱ نفر', timeText: '۱۵–۲۵ دقیقه',
    art: '/assets/art/paper-cream.jpg',
    cats: ['solo', 'story'], tags: ['کارت', 'سفر', 'تهدید', 'تک‌نفره'],
    solo: true, badge: 'سفر حلقه', multi: false,
    load: () => import('./ring-ui.js')
  },
  {
    id: 'spirit', title: 'روح جزیره', meta: 'تکی · ۲۰–۳۰ دقیقه',
    playersText: '۱ نفر', timeText: '۲۰–۳۰ دقیقه',
    art: '/assets/art/games/spirit.jpg',
    cats: ['solo', 'cards', 'story'], tags: ['کارت', 'جزیره', 'ترس', 'تک‌نفره'],
    solo: true, badge: 'روح جزیره', multi: false,
    load: () => import('./spirit-ui.js')
  },
  {
    id: 'arkham', title: 'آرکام: نشانه‌های آشوب', meta: 'تکی · ۲۰–۳۵ دقیقه',
    playersText: '۱ نفر', timeText: '۲۰–۳۵ دقیقه',
    art: '/assets/art/games/arkham.jpg',
    cats: ['solo', 'story'], tags: ['کارت', 'تحقیق', 'هول', 'تک‌نفره'],
    solo: true, badge: 'کیسهٔ آشوب', multi: false,
    load: () => import('./arkham-ui.js')
  },
  {
    id: 'island', title: 'جزیرهٔ گم‌شده', meta: 'تکی · ۲۰–۳۰ دقیقه',
    playersText: '۱ نفر', timeText: '۲۰–۳۰ دقیقه',
    art: '/assets/art/velvet-board.jpg',
    cats: ['solo', 'mind'], tags: ['بقا', 'ساخت‌وساز', 'اکتشاف', 'تک‌نفره'],
    solo: true, badge: 'جزیره', multi: false,
    load: () => import('./island-ui.js')
  },
  {
    id: 'siege', title: 'شب‌های محاصره', meta: 'تکی · ۱۵–۲۵ دقیقه',
    playersText: '۱ نفر', timeText: '۱۵–۲۵ دقیقه',
    art: '/assets/art/games/siege.jpg',
    cats: ['solo', 'story'], tags: ['بقا', 'کارت', 'انتخاب', 'تک‌نفره'],
    solo: true, badge: 'بقا', multi: false,
    load: () => import('./siege-ui.js')
  },
  {
    id: 'gloom', title: 'غارهای گِلومهیون', meta: 'تکی · ۱۵–۳۰ دقیقه',
    playersText: '۱ نفر', timeText: '۱۵–۳۰ دقیقه',
    art: '/assets/art/games/gloom.jpg',
    cats: ['solo', 'mind'], tags: ['کارت', 'تاکتیک', 'غار', 'تک‌نفره'],
    solo: true, badge: 'کارت توانایی', multi: false,
    load: () => import('./gloom-ui.js')
  },
  {
    id: 'duz', title: 'دوز', meta: 'دو نفره · ۵–۱۵ دقیقه',
    playersText: '۲ نفر', timeText: '۵–۱۵ دقیقه',
    art: '/assets/art/games/duz.jpg',
    cats: ['duo', 'mind'], tags: ['تخته', 'چینی', 'کهن', 'استراتژی'],
    solo: false, badge: 'تختهٔ کهن', multi: true,
    load: () => import('./duz-ui.js')
  },
  {
    id: 'spot', title: 'تفاوت را پیدا کن', meta: 'تکی · ۳–۱۰ دقیقه',
    playersText: '۱ نفر', timeText: '۳–۱۰ دقیقه',
    art: '/assets/art/games/spot.jpg',
    cats: ['solo', 'mind'], tags: ['عکس واقعی', 'دقت', 'پیکسل', 'تک‌نفره'],
    solo: true, badge: '۵ صحنه', multi: false,
    load: () => import('./finddiff-ui.js')
  },
  {
    id: 'dream', title: 'دروازه‌های رؤیا', meta: 'تکی · ۱۰–۲۰ دقیقه',
    playersText: '۱ نفر', timeText: '۱۰–۲۰ دقیقه',
    art: '/assets/art/games/dream.jpg',
    cats: ['solo', 'cards', 'story'], tags: ['کارتی', 'خواب', 'کابوس', 'تک‌نفره'],
    solo: true, badge: 'هزارتوی خواب', multi: false,
    load: () => import('./dream-ui.js')
  },
  {
    id: 'logic', title: 'مهره‌چین', meta: 'تکی · ۵–۱۵ دقیقه',
    playersText: '۱ نفر', timeText: '۵–۱۵ دقیقه',
    art: '/assets/art/games/logic.jpg',
    cats: ['solo', 'mind'], tags: ['منطق', 'معما', 'استدلال'],
    solo: true, badge: 'معمای منطقی', multi: false,
    load: () => import('./logic-ui.js')
  }
];

export const byId = id => GAMES.find(g => g.id === id);

/** فهرست با احترام به بازی‌های پنهان‌شده در پنل مدیریت */
export function visibleGames(hiddenIds = []) {
  const hidden = new Set(hiddenIds);
  return GAMES.filter(g => !hidden.has(g.id));
}

/* ------------------------------------------------------------------
   heckmeck (کرم کبابی) — موتور و رابط آماده‌اند (engines/worms.js،
   games/worms-ui.js) ولی هنوز ثبت نشده، چون تصویر جلدش ساخته نشده است.
   برای فعال‌سازی: تصویر را در پوشهٔ art/games بساز، این بلوک را به GAMES
   برگردان، فیلد art را پر کن و همان مسیر را در sw.js precache کن.
   ------------------------------------------------------------------ */
