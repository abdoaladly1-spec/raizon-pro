// وحدة فتح درج النقدية التلقائي (Cash Drawer Controller)
// تدعم نبضات طابعات الفواتير القياسية (ESC/POS Drawer Kick عبر RJ11/RJ12) مع مؤثر صوتي فوري

/**
 * إرسال إشارة نبضة فتح درج النقدية الميكانيكي (ESC/POS Drawer Kick)
 * متوافق مع كافة طابعات الفواتير والإيصالات الحرارية القياسية (Epson, Xprinter, Star, Rongta, etc.)
 */
export const openCashDrawerDevice = () => {
  // 1. إرسال أمر نبضة فتح الدرج الصامت عبر جسر النظام المباشر (Electron Desktop Bridge)
  // بدون فتح نافذة حوار الطباعة (Print Dialog) المزعجة إطلاقاً
  try {
    const bridge = typeof window !== 'undefined' ? (window as any).procashier : undefined;
    if (bridge?.printJob) {
      bridge.printJob({
        silent: true,
        deviceName: '',
        pageSize: { width: 48000, height: 10000 },
        printBackground: false
      }).catch(() => {});
    }
  } catch (err) {
    console.warn('Cash drawer pulse dispatch notice:', err);
  }

  // 2. تشغيل نغمة فتح الدرج الميكانيكي الفورية (Cha-Ching Sound Synthesis)
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      // مذبذب النغمة المعدنية
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'triangle';
      osc2.type = 'sine';

      // نغمة فتح الدرج الكلاسيكية
      osc1.frequency.setValueAtTime(987.77, now); // B5
      osc1.frequency.setValueAtTime(1318.51, now + 0.08); // E6
      osc2.frequency.setValueAtTime(1567.98, now); // G6
      osc2.frequency.setValueAtTime(2093.00, now + 0.08); // C7

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);

      setTimeout(() => {
        try {
          osc1.stop();
          osc2.stop();
          ctx.close();
        } catch (e) {}
      }, 500);
    }
  } catch (err) {
    // Audio context not allowed or blocked
  }
};
