/* تهيئة مبكرة قبل تحميل التطبيق:
 * 1) استعادة الثيم المحفوظ فوراً (منع وميض الشاشة)
 * 2) تتبع مؤشر الفأرة لمتغيّرات CSS
 * نُقلت هنا من index.html حتى تعمل سياسة CSP الصارمة (script-src 'self') */
(function () {
  try {
    var saved = localStorage.getItem('theme');
    var theme = saved ? saved : 'dark';
    localStorage.setItem('theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
  } catch (e) { /* التخزين غير متاح */ }

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
})();
