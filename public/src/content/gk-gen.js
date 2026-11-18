/* ============================================================
   تولید سؤال از جدول‌های واقعیت
   برای هر ردیف یک سؤال چهارگزینه‌ای ساخته می‌شود؛ گزینه‌های غلط
   از همان دسته گرفته می‌شوند تا سؤال منطقی بماند.
   تولید قطعی است: با دانهٔ ثابت، همیشه همان گزینه‌ها می‌آید.
   ============================================================ */

import { mulberry32 } from '../core.js';
import {
  COUNTRIES, ELEMENTS, ANIMALS, WORKS, FILMS,
  LANDMARKS, WATERS, IRAN_CITIES, INVENTIONS,
  CAPITALS_EXTRA, INSTRUMENTS, SPORTS, FLAGS,
  TERMS, SPACE, HEALTH, WORLD_CITIES,
  LANGUAGES, DISCOVERIES, WORLD_CUP, ATOMIC, BODY, FOLKLORE
} from './gk-tables.js';

/** چهار گزینه با یک پاسخ درست، بدون تکرار */
function quad(question, correct, pool, rnd, cat, note, f) {
  const wrong = [];
  const seen = new Set([correct]);
  const shuffled = [...pool].sort(() => rnd() - 0.5);
  for (const c of shuffled) {
    if (wrong.length >= 3) break;
    if (seen.has(c)) continue;
    seen.add(c);
    wrong.push(c);
  }
  if (wrong.length < 3) return null;
  const opts = [correct, ...wrong].sort(() => rnd() - 0.5);
  return {
    q: f ? `${f} ${question}` : question,
    a: opts,
    c: opts.indexOf(correct),
    cat,
    note
  };
}

export function buildGenerated(seed = 20261117) {
  const rnd = mulberry32(seed);
  const out = [];
  const add = (x) => { if (x && x.a && x.a.length === 4 && x.c >= 0) out.push(x); };

  /* ---- کشورها: پایتخت، قاره، واحد پول ---- */
  const caps = COUNTRIES.map(c => c.cap);
  const conts = [...new Set(COUNTRIES.map(c => c.cont))];
  const curs = [...new Set(COUNTRIES.map(c => c.cur))];
  for (const c of COUNTRIES) {
    add(quad(`پایتخت ${c.f} ${c.n} کدام است؟`, c.cap, caps, rnd, 'جغرافیا',
      `پایتخت ${c.n} ${c.cap} است.`));
    add(quad(`${c.f} ${c.n} در کدام قاره است؟`, c.cont, conts, rnd, 'جغرافیا',
      `${c.n} در ${c.cont} قرار دارد.`));
    // واحد پول فقط برای کشورهای شاخص — وگرنه جغرافیا باقی دسته‌ها را می‌بلعد
    if (COUNTRIES.indexOf(c) % 2 === 0 && curs.filter(x => x !== c.cur).length >= 3) {
      add(quad(`واحد پول ${c.f} ${c.n} کدام است؟`, c.cur, curs, rnd, 'جغرافیا',
        `واحد پول ${c.n} ${c.cur} است.`));
    }
  }

  /* ---- عناصر: نماد شیمیایی ---- */
  const syms = ELEMENTS.map(e => e.s);
  for (const e of ELEMENTS) {
    add(quad(`نماد شیمیایی «${e.n}» کدام است؟`, e.s, syms, rnd, 'علوم',
      `نماد ${e.n} در جدول تناوبی ${e.s} است.`));
    add(quad(`عنصری که نمادش «${e.s}» است چه نام دارد؟`, e.n, ELEMENTS.map(x => x.n), rnd, 'علوم',
      `${e.s} نماد ${e.n} است.`));
  }

  /* ---- جانوران: گروه زیستی ---- */
  const groups = [...new Set(ANIMALS.map(a => a.g))];
  const animalsOf = (g) => ANIMALS.filter(a => a.g === g).map(a => a.n);
  for (const a of ANIMALS) {
    // گزینه‌های غلط: جانورانی از گروه‌های دیگر
    const others = ANIMALS.filter(x => x.g !== a.g).map(x => x.n);
    add(quad(`«${a.n}» در کدام گروه جانوری است؟`, a.g, groups, rnd, 'علوم',
      `${a.n} از ${a.g}هاست.`));
    add(quad(`کدام‌یک ${a.g} است؟`, a.n, [...animalsOf(a.g), ...others.slice(0, 6)], rnd, 'علوم',
      `${a.n} از ${a.g}هاست.`));
  }

  /* ---- آثار: نویسنده ---- */
  const authors = [...new Set(WORKS.map(w => w.a))];
  for (const w of WORKS) {
    add(quad(`کتاب «${w.t}» نوشتهٔ چه کسی است؟`, w.a, authors, rnd, 'ادبیات',
      `«${w.t}» اثر ${w.a} است.`));
  }

  /* ---- فیلم: کارگردان ---- */
  const directors = [...new Set(FILMS.map(f => f.d))];
  for (const f of FILMS) {
    add(quad(`فیلم «${f.t}» را چه کسی کارگردانی کرد؟`, f.d, directors, rnd, 'سینما',
      `«${f.t}» ساختهٔ ${f.d} است.`));
  }

  /* ---- بنا: کشور ---- */
  const countries = [...new Set(LANDMARKS.map(l => l.c))];
  for (const l of LANDMARKS) {
    add(quad(`«${l.l}» در کدام کشور است؟`, l.c, countries, rnd, 'جغرافیا',
      `${l.l} در ${l.c} قرار دارد.`));
  }

  /* ---- آب‌ها: مجاورت ---- */
  const nears = [...new Set(WATERS.map(w => w.near))];
  for (const w of WATERS) {
    if (nears.length < 4) break;
    add(quad(`«${w.w}» کنار کدام منطقه است؟`, w.near, nears, rnd, 'جغرافیا',
      `${w.w} نزدیک ${w.near} است.`));
  }

  /* ---- شهرهای ایران: استان ---- */
  const provs = [...new Set(IRAN_CITIES.map(x => x.p))];
  for (const x of IRAN_CITIES) {
    add(quad(`شهر «${x.c}» در کدام استان است؟`, x.p, provs, rnd, 'جغرافیا',
      `${x.c} در استان ${x.p} است.`));
  }

  /* ---- اختراع: مخترع ---- */
  const inventors = [...new Set(INVENTIONS.map(i => i.by))];
  for (const i of INVENTIONS) {
    add(quad(`«${i.i}» را چه کسی ساخت؟`, i.by, inventors, rnd, 'فناوری',
      `${i.i} به ${i.by} نسبت داده می‌شود.`));
  }

  /* ---- پایتخت‌های بیشتر جهان ---- */
  const extraCaps = CAPITALS_EXTRA.map(c => c.cap);
  const extraNames = CAPITALS_EXTRA.map(c => c.n);
  for (const c of CAPITALS_EXTRA) {
    add(quad(`پایتخت «${c.n}» کدام است؟`, c.cap, extraCaps, rnd, 'جغرافیا',
      `پایتخت ${c.n} ${c.cap} است.`));
    // جهت معکوس برای کشورهای اصلی نگه داشته می‌شود؛ برای فهرست فرعی
    // فقط در یک‌سوم موارد تا بانک از جغرافیا اشباع نشود.
    if (extraCaps.indexOf(c.cap) % 3 === 0) {
      add(quad(`«${c.cap}» پایتخت کدام کشور است؟`, c.n, extraNames, rnd, 'جغرافیا',
        `${c.cap} پایتخت ${c.n} است.`));
    }
  }

  /* ---- سازها: خانواده ---- */
  const fams = [...new Set(INSTRUMENTS.map(i => i.fam))];
  for (const i of INSTRUMENTS) {
    add(quad(`ساز «${i.n}» در کدام خانواده است؟`, i.fam, fams, rnd, 'موسیقی',
      `${i.n} از سازهای ${i.fam} است.`));
  }

  /* ---- ورزش‌ها: تعداد بازیکن ---- */
  const counts = [...new Set(SPORTS.map(s => String(s.p)))].map(Number);
  for (const sp of SPORTS) {
    add(quad(`«${sp.n}» چند بازیکن در هر تیم دارد؟`, String(sp.p),
      counts.map(String), rnd, 'ورزش', `${sp.n} ${sp.p} بازیکن در هر تیم دارد.`));
  }

  /* ---- پرچم‌ها ---- */
  const flagNames = FLAGS.map(f => f.n);
  for (const f of FLAGS) {
    add(quad(`پرچم ${f.f} از کدام کشور است؟`, f.n, flagNames, rnd, 'جغرافیا',
      `${f.f} پرچم ${f.n} است.`));
  }

  /* ---- اصطلاح → رشته ---- */
  const fields = [...new Set(TERMS.map(t => t.f))];
  for (const t of TERMS) {
    add(quad(`«${t.t}» به کدام رشته تعلق دارد؟`, t.f, fields, rnd, 'علوم',
      `${t.t} از مفاهیم ${t.f} است.`));
  }

  /* ---- جرم آسمانی → ویژگی ---- */
  const feats = SPACE.map(x => x.f);
  for (const x of SPACE) {
    add(quad(`کدام گزینه دربارهٔ «${x.o}» درست است؟`, x.f, feats, rnd, 'علوم',
      `${x.o}: ${x.f}.`));
  }

  /* ---- بیماری → عامل ---- */
  const causes = [...new Set(HEALTH.map(h => h.by))];
  for (const h of HEALTH) {
    add(quad(`عامل یا ویژگی «${h.d}» کدام است؟`, h.by, causes, rnd, 'پزشکی',
      `${h.d} با ${h.by} شناخته می‌شود.`));
  }

  /* ---- شهرهای جهان → کشور ---- */
  const wc = [...new Set(WORLD_CITIES.map(c => c.n))];
  for (const c of WORLD_CITIES) {
    add(quad(`شهر «${c.c}» در کدام کشور است؟`, c.n, wc, rnd, 'جغرافیا',
      `${c.c} در ${c.n} است.`));
  }

  /* ---- زبان رسمی ---- */
  const langs = [...new Set(LANGUAGES.map(x => x.l))];
  for (const x of LANGUAGES) {
    add(quad(`زبان رسمی ${x.n} کدام است؟`, x.l, langs, rnd, 'فرهنگ',
      `زبان رسمی ${x.n} ${x.l} است.`));
  }

  /* ---- رویداد تاریخی → سال ---- */
  const years = [...new Set(DISCOVERIES.map(x => x.y))];
  for (const x of DISCOVERIES) {
    if (years.length < 4) break;
    add(quad(`«${x.d}» به چه سالی مربوط است؟`, x.y, years, rnd, 'تاریخ',
      `${x.d} در حدود سال ${x.y} بود.`));
  }

  /* ---- جام جهانی ---- */
  const champs = [...new Set(WORLD_CUP.map(x => x.w))];
  for (const x of WORLD_CUP) {
    add(quad(`قهرمان جام جهانی فوتبال در سال ${x.year} کدام کشور بود؟`, x.w, champs, rnd, 'ورزش',
      `در ${x.year} تیم ${x.w} قهرمان شد.`));
  }

  /* ---- عدد اتمی ---- */
  const els = ATOMIC.map(x => x.n);
  for (const x of ATOMIC) {
    add(quad(`عدد اتمی «${x.n}» چند است؟`, String(x.z),
      ATOMIC.map(y => String(y.z)), rnd, 'علوم', `عدد اتمی ${x.n} ${x.z} است.`));
    add(quad(`عنصری با عدد اتمی ${x.z} چه نام دارد؟`, x.n, els, rnd, 'علوم',
      `عدد اتمی ${x.z} از آنِ ${x.n} است.`));
  }

  /* ---- دستگاه بدن ---- */
  const systems = [...new Set(BODY.map(x => x.s))];
  for (const x of BODY) {
    add(quad(`«${x.o}» در کدام دستگاه بدن است؟`, x.s, systems, rnd, 'پزشکی',
      `${x.o} بخشی از دستگاه ${x.s} است.`));
  }

  /* ---- آیین‌ها و جشن‌ها ---- */
  const feasts = [...new Set(FOLKLORE.map(x => x.f))];
  for (const x of FOLKLORE) {
    add(quad(`«${x.n}» چیست؟`, x.f, feasts, rnd, 'فرهنگ', `${x.n}: ${x.f}.`));
  }

  return out;
}
