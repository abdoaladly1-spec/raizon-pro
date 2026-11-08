/* تهيئة مبكرة قبل تحميل التطبيق:
 * 1) استعادة الثيم المحفوظ فوراً (منع وميض الشاشة) وضمان السمة الداكنة كوضع افتراضي
 * 2) تنظيف وإلغاء أي Service Worker قديم في بيئة التطوير (localhost / 127.0.0.1)
 * 3) تتبع مؤشر الفأرة لمتغيّرات CSS
 * 4) حماية واجهة المستخدم من الشاشة البيضاء في حال تعثر تحميل السكربتات */
(function () {
  // 1) تنظيف الكاش والـ Service Workers القديمة على localhost فوراً
  try {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      var isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.hostname === '[::1]';
      if (isLocal) {
        navigator.serviceWorker.getRegistrations().then(function (registrations) {
          for (var i = 0; i < registrations.length; i++) {
            registrations[i].unregister();
          }
        });
        if (typeof caches !== 'undefined') {
          caches.keys().then(function (keys) {
            for (var j = 0; j < keys.length; j++) {
              caches.delete(keys[j]);
            }
          });
        }
      }
    }
  } catch (e) {
    console.warn('SW cleanup ignored:', e);
  }

  // 2) استعادة الثيم الداكن افتراضياً
  try {
    var saved = localStorage.getItem('theme');
    var theme = saved ? saved : 'dark';
    if (!saved) {
      localStorage.setItem('theme', 'dark');
    }
    document.documentElement.classList.toggle('dark', theme === 'dark');
  } catch (e) { /* التخزين غير متاح */ }

  // 3) تتبع مؤشر الفأرة
  var rafId = null;
  var update = function (e) {
    document.documentElement.style.setProperty('--cursor-x', e.clientX + 'px');
    document.documentElement.style.setProperty('--cursor-y', e.clientY + 'px');
    rafId = null;
  };
  window.addEventListener('mousemove', function (e) {
    if (rafId) return;
    rafId = requestAnimationFrame(function () { update(e); });
  }, { passive: true });

  // 4) مراقبة الشاشة البيضاء في حال تعثر تحميل React بعد 3.5 ثانية
  window.addEventListener('DOMContentLoaded', function () {
    setTimeout(function () {
      var root = document.getElementById('root');
      if (root && (!root.firstElementChild || root.innerText.trim() === '')) {
        // إذا كان الجذر فارغاً بعد مهلة التحميل
        var isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
        if (isLocal) {
          console.warn('[RaiZon Boot] Root element is still empty after 3.5s. Providing recovery UI.');
        }
      }
    }, 3500);
  });
})();
