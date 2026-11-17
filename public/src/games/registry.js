/* ============================================================
   رجیستری بازی‌ها — یک فایل برای معرفی، یک تابع برای نصب
   هر بازی: { id, title, meta, playersText, timeText, art, cats, tags, solo, badge, load }
   ============================================================ */

export const CATEGORIES = [
  { id: 'group', label: 'دورهمی' },
  { id: 'duo', label: 'دونفره' },
  { id: 'solo', label: 'تکی' },
  { id: 'cards', label: 'ورق و تاس' },
  { id: 'words', label: 'واژه' },
  { id: 'mind', label: 'فکری' },
  { id: 'story', label: 'داستانی' }
];

export const GAMES = [
  {
    id: 'mafia', title: 'مافیا', meta: '۶ تا ۱۲ نفر · ۳۰–۴۵ دقیقه',
    playersText: '۶–۱۲ نفر', timeText: '۳۰–۴۵ دقیقه',
    art: '/assets/art/mafia-role.jpg',
    cats: ['group', 'mind'], tags: ['نقش مخفی', 'استنتاج', 'شب و روز'],
    solo: false, badge: 'پرده‌ی خصوصی', multi: true,
    load: () => import('./mafia-ui.js')
  },
  {
    id: 'hokm', title: 'حکم', meta: '۴ نفر · ۲ تیم · ۱۵–۲۵ دقیقه',
    playersText: '۴ نفر', timeText: '۱۵–۲۵ دقیقه',
    art: '/assets/art/persian-gold.jpg',
    cats: ['cards', 'group'], tags: ['ورق', 'تیمی', 'حکم'],
    solo: false, badge: 'ورق گوتیک', multi: true,
    load: () => import('./hokm-ui.js')
  },
  {
    id: 'esmfamil', title: 'اسم و فامیل', meta: '۲ تا ۸ نفر · ۱۰–۲۰ دقیقه',
    playersText: '۲–۸ نفر', timeText: '۱۰–۲۰ دقیقه',
    art: '/assets/art/notebook-page.jpg',
    cats: ['words', 'group'], tags: ['برگه', 'واژه', 'حرف'],
    solo: false, badge: 'برگه‌ی پانچ‌شده', multi: true,
    load: () => import('./esmfamil-ui.js')
  },
  {
    id: 'snake', title: 'مار و پله', meta: '۲ تا ۴ نفر · ۱۵–۲۵ دقیقه',
    playersText: '۲–۴ نفر', timeText: '۱۵–۲۵ دقیقه',
    art: '/assets/art/velvet-board.jpg',
    cats: ['cards', 'group'], tags: ['تاس', 'تخته', 'شانس'],
    solo: false, badge: 'تاس چوبی', multi: true,
    load: () => import('./snake-ui.js')
  },
  {
    id: 'quiz', title: 'کوییز', meta: 'تکی یا دونفره · ۵–۱۰ دقیقه',
    playersText: '۱–۲ نفر', timeText: '۵–۱۰ دقیقه',
    art: '/assets/art/citizen-role.jpg',
    cats: ['solo', 'mind'], tags: ['دانستنی', 'اطلاعات عمومی', 'مسابقه'],
    solo: true, badge: '۳۰ سؤال', multi: true,
    load: () => import('./quiz-ui.js')
  },
  {
    id: 'riddle', title: 'چیستان', meta: 'تکی · ۳–۸ دقیقه',
    playersText: '۱ نفر', timeText: '۳–۸ دقیقه',
    art: '/assets/art/detective-role.jpg',
    cats: ['solo', 'mind'], tags: ['معما', 'حدس', 'سرنخ'],
    solo: true, badge: 'فکری', multi: false,
    load: () => import('./riddle-ui.js')
  },
  {
    id: 'iq', title: 'تست هوش', meta: 'تکی · ۴–۱۰ دقیقه',
    playersText: '۱ نفر', timeText: '۴–۱۰ دقیقه',
    art: '/assets/art/doctor-role.jpg',
    cats: ['solo', 'mind'], tags: ['منطق', 'الگو', 'تست'],
    solo: true, badge: 'منطقی', multi: false,
    load: () => import('./iq-ui.js')
  },
  {
    id: 'codenames', title: 'اسم رمز', meta: '۴ تا ۸ نفر · ۲ تیم · ۲۰–۳۰ دقیقه',
    playersText: '۴–۸ نفر', timeText: '۲۰–۳۰ دقیقه',
    art: '/assets/art/desk-bg.jpg',
    cats: ['group', 'words'], tags: ['تیمی', 'سرنخ', 'کدنیمز'],
    solo: false, badge: 'دو تیم', multi: true,
    load: () => import('./codenames-ui.js')
  },
  {
    id: 'lowball', title: 'کم‌ترین پیشنهاد', meta: '۲ تا ۴ نفر · ۱۰–۲۰ دقیقه',
    playersText: '۲–۴ نفر', timeText: '۱۰–۲۰ دقیقه',
    art: '/assets/art/noir-leather.jpg',
    cats: ['cards', 'duo'], tags: ['ورق', 'بلوف', 'مناقصه'],
    solo: false, badge: 'ورق نوآر', multi: true,
    load: () => import('./lowball-ui.js')
  },
  {
    id: 'story', title: 'قصه‌چین', meta: '۲ تا ۶ نفر · ۱۰–۱۵ دقیقه',
    playersText: '۲–۶ نفر', timeText: '۱۰–۱۵ دقیقه',
    art: '/assets/art/paper-cream.jpg',
    cats: ['duo', 'words'], tags: ['داستان', 'خلاقیت', 'نوبتی'],
    solo: false, badge: 'خلاقیت', multi: true,
    load: () => import('./story-ui.js')
  },
  {
    id: 'warden', title: 'پرونده‌ی وِردِن', meta: 'تکی · ۲۵–۴۰ دقیقه',
    playersText: '۱ نفر', timeText: '۲۵–۴۰ دقیقه',
    art: '/assets/art/noir-leather.jpg',
    cats: ['solo', 'cards', 'mind'], tags: ['داستانی', 'ترسناک', 'کارتی', 'معمایی'],
    solo: true, badge: 'پرونده‌ی محقق', multi: false,
    load: () => import('./warden-ui.js')
  },
  {
    id: 'arkham', title: 'آرکام: نشانه‌های آشوب', meta: 'تکی · ۲۰–۳۵ دقیقه',
    playersText: '۱ نفر', timeText: '۲۰–۳۵ دقیقه',
    art: '/assets/art/noir-leather.jpg',
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
    art: '/assets/art/notebook-page.jpg',
    cats: ['solo', 'story'], tags: ['بقا', 'کارت', 'انتخاب', 'تک‌نفره'],
    solo: true, badge: 'بقا', multi: false,
    load: () => import('./siege-ui.js')
  },
  {
    id: 'gloom', title: 'غارهای گِلومهیون', meta: 'تکی · ۱۵–۳۰ دقیقه',
    playersText: '۱ نفر', timeText: '۱۵–۳۰ دقیقه',
    art: '/assets/art/noir-leather.jpg',
    cats: ['solo', 'mind'], tags: ['کارت', 'تاکتیک', 'غار', 'تک‌نفره'],
    solo: true, badge: 'کارت توانایی', multi: false,
    load: () => import('./gloom-ui.js')
  },
  {
    id: 'duz', title: 'دوز', meta: 'دو نفره · ۵–۱۵ دقیقه',
    playersText: '۲ نفر', timeText: '۵–۱۵ دقیقه',
    art: '/assets/art/notebook-page.jpg',
    cats: ['duo', 'mind'], tags: ['تخته', 'چینی', 'کهن', 'استراتژی'],
    solo: false, badge: 'تختهٔ کهن', multi: true,
    load: () => import('./duz-ui.js')
  },
  {
    id: 'spot', title: 'تفاوت را پیدا کن', meta: 'تکی · ۳–۱۰ دقیقه',
    playersText: '۱ نفر', timeText: '۳–۱۰ دقیقه',
    art: '/assets/art/notebook-page.jpg',
    cats: ['solo', 'mind'], tags: ['تابلو', 'اروپایی', 'دقت', 'تک‌نفره'],
    solo: true, badge: 'تابلوی قدیمی', multi: false,
    load: () => import('./spot-ui.js')
  },
  {
    id: 'dream', title: 'دروازه‌های رؤیا', meta: 'تکی · ۱۰–۲۰ دقیقه',
    playersText: '۱ نفر', timeText: '۱۰–۲۰ دقیقه',
    art: '/assets/art/notebook-page.jpg',
    cats: ['solo', 'cards', 'story'], tags: ['کارتی', 'خواب', 'کابوس', 'تک‌نفره'],
    solo: true, badge: 'هزارتوی خواب', multi: false,
    load: () => import('./dream-ui.js')
  },
  {
    id: 'logic', title: 'مهره‌چین', meta: 'تکی · ۵–۱۵ دقیقه',
    playersText: '۱ نفر', timeText: '۵–۱۵ دقیقه',
    art: '/assets/art/notebook-page.jpg',
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
