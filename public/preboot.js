/* ============================================================
   پیش‌راه‌انداز — بیرون از ماژول‌ها، همیشه تازه

   چرا این فایل وجود دارد؟
   وقتی نسخهٔ قدیمی در سرویس‌ورکر/کش مانده باشد، *هر* اسکریپتی که
   با ماژول‌ها می‌آید هم کهنه است و کاربر در حلقهٔ «هیچ تغییری ندیدم»
   می‌ماند. این فایل با `no-store` سرو می‌شود و با آدرس نسخه‌دار در
   HTML می‌نشیند، پس همیشه تازه است و می‌تواند پیش از بارگذاری کد
   اصلی، کش و سرویس‌ورکر راست‌شده را پاک کند.

   کارش سه چیز است:
     ۱) اگر ?fresh= در آدرس هست → کش و سرویس‌ورکر کامل پاک شوند
     ۲) اگر نسخهٔ سرویس‌ورکر عوض شده → نسخه‌های قدیمی کش حذف شوند
     ۳) نشان‌دادن نسخهٔ در حال اجرا در کنسول (کمک به عیب‌یابی)
   ============================================================ */
(function () {
  'use strict';

  var BUILD = document.documentElement.getAttribute('data-build') || 'boot';
  var CACHE_PREFIX = 'dorehami-shell-';

  // نسخهٔ اجرا برای اطمینان: dyVersion() در کنسول هم هست، این پیش از آن است
  globalThis.__DY_BUILD = BUILD;

  function url(name) { return String(name); }

  function clearCaches() {
    if (!globalThis.caches || !caches.keys) return Promise.resolve();
    return caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) { return caches.delete(k); }));
    }).catch(function () {});
  }

  function unregisterWorkers() {
    if (!('serviceWorker' in navigator)) return Promise.resolve();
    return navigator.serviceWorker.getRegistrations().then(function (regs) {
      return Promise.all(regs.map(function (r) { return r.unregister().catch(function () {}); }));
    }).catch(function () {});
  }

  /**
   * پاک‌کردن نسخه‌های قدیمیِ کش بر اساس نسخه‌ای که سرویس‌ورکر تازه
   * درخواست می‌کند. سرویس‌ورکر خودش هم در activate این کار را می‌کند،
   * ولی اگر ثبت سرویس‌ورکر شکست بخورد، این‌جا اطمینان می‌گیریم.
   */
  function pruneOldShellCaches() {
    if (!globalThis.caches || !caches.keys) return Promise.resolve();
    return fetch('/sw.js', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.text() : ''; })
      .then(function (src) {
        var m = src.match(/dorehami-shell-v(\d+)/);
        if (!m) return;
        var current = CACHE_PREFIX + 'v' + m[1];
        return caches.keys().then(function (keys) {
          return Promise.all(keys.map(function (k) {
            if (k.indexOf(CACHE_PREFIX) === 0 && k !== current) return caches.delete(k);
            return Promise.resolve();
          }));
        });
      })
      .catch(function () {});
  }

  var params = new URLSearchParams(location.search);
  var wantFresh = params.has('fresh');

  if (wantFresh) {
    // بارگذاری تازه: همه‌چیز از صفر، و پارامتر از آدرس برداشته می‌شود
    clearCaches()
      .then(unregisterWorkers)
      .then(function () {
        try {
          history.replaceState(null, '', location.pathname + location.hash);
        } catch (e) { /* بی‌اهمیت */ }
        window.dispatchEvent(new CustomEvent('dy:cache-cleared'));
      });
  } else {
    pruneOldShellCaches();
  }


  /**
   * دیده‌بان تصاویر برند — اگر لوگو یا پارچه واقعاً بارگذاری نشد،
   * به‌جای «هیچ‌چیز دیده نمی‌شود»، یک نشانهٔ متنی و یک پیام در کنسول
   * می‌گذاریم. سکوت بدترین حالت است: آدم نمی‌داند تصویر شکسته یا
   * هنوز کش کهنه است.
   */
  function watchBrandArt() {
    var BAD = [
      '/assets/brand/seal-v28-512.png',
      '/assets/brand/weave-v28-sm.jpg',
      '/assets/brand/weave-v28.jpg'
    ];
    BAD.forEach(function (src) {
      var probe = new Image();
      probe.onerror = function () {
        try {
          // eslint-disable-next-line no-console
          console.warn('[دورهمی‌یار] تصویر بارگذاری نشد: ' + src +
            ' — احتمالاً کش کهنه است. با ?fresh=1 باز کن.');
        } catch (e) { /* */ }
        document.documentElement.setAttribute('data-artfail', '1');
      };
      probe.src = src + (src.indexOf('?') === -1 ? '?probe=' + Date.now() : '');
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', watchBrandArt, { once: true });
  } else {
    watchBrandArt();
  }

  /**
   * راه فرار همیشگی: اگر کاربر هیچ راه دیگری ندارد، آدرس
   * `?fresh=1` همه‌چیز را از نو می‌آورد. این را در کنسول هم
   * اعلام می‌کنیم تا پشتیبانی بداند.
   */
  try {
    // eslint-disable-next-line no-console
    console.info(
      '%cدورهمی‌یار — ساخت ' + BUILD,
      'color:#7d1f24;font-weight:700',
      '\nبرای پاک‌کردن کامل کش:  dyFix()   ·   یا آدرس ?fresh=1'
    );
  } catch (e) { /* بی‌اهمیت */ }

  void url;
})();
