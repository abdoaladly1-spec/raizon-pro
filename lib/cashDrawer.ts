// وحدة فتح درج النقدية التلقائي (Cash Drawer Controller)
// تدعم نبضات طابعات الفواتير القياسية (ESC/POS Drawer Kick عبر RJ11/RJ12) مع مؤثر صوتي فوري

/**
 * إرسال إشارة نبضة فتح درج النقدية الميكانيكي (ESC/POS Drawer Kick)
 * متوافق مع كافة طابعات الفواتير والإيصالات الحرارية القياسية (Epson, Xprinter, Star, Rongta, etc.)
 */
export const openCashDrawerDevice = () => {
  // 1. إرسال أمر النبضة القياسي إلى الطابعة عبر iframe صامت
  try {
    const frame = document.createElement('iframe');
    frame.style.position = 'fixed';
    frame.style.right = '0';
    frame.style.bottom = '0';
    frame.style.width = '0';
    frame.style.height = '0';
    frame.style.border = '0';
    document.body.appendChild(frame);

    // أوامر ESC/POS القياسية لطابعات الفواتير لفتح الدرج (Pin 2 + Pin 5):
    // ESC p 0 25 250 (\x1B\x70\x00\x19\xFA)
    // ESC p 1 25 250 (\x1B\x70\x01\x19\xFA)
    // DLE DC4 1 0 5 (\x10\x14\x01\x00\x05)
    const kickCommands = '\x1B\x70\x00\x19\xFA\x1B\x70\x01\x19\xFA\x10\x14\x01\x00\x05';

    const doc = frame.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(`<!DOCTYPE html><html><head><style>@page{size:1mm auto;margin:0;}body{margin:0;padding:0;}</style></head><body><pre style="display:none;">${kickCommands}</pre></body></html>`);
      doc.close();

      try {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
      } catch (err) {
        // تجاهل أي قيود صامتة للمتصفح
      }

      setTimeout(() => {
        try {
          if (frame.parentNode) {
            document.body.removeChild(frame);
          }
        } catch (e) {}
      }, 1500);
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
