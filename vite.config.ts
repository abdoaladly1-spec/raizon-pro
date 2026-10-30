import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';

/**
 * حقن سياسة أمان المحتوى (CSP) في نسخة الإنتاج فقط.
 * لا نضيفها في التطوير لأن Vite يستخدم سكربتات/تقييم مضمّن (HMR).
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob:",
  "connect-src 'self' http: https: ws: wss:",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const cspPlugin = (): Plugin => ({
  name: 'raizon-csp',
  apply: 'build',
  transformIndexHtml(html) {
    const meta = `    <meta http-equiv="Content-Security-Policy" content="${CSP}">\n`;
    return html.replace(/<head>/, `<head>\n${meta}`);
  },
});

export default defineConfig({
  server: {
    port: 4189,
    host: '0.0.0.0',
    watch: {
      // ملفات يكتبها السيرفر/البناء لا تُسبب إعادة تحميل الصفحة أثناء التطوير
      ignored: ['**/server/backups/**', '**/server/*.db', '**/release/**', '**/node_modules/**'],
    },
  },
  plugins: [react(), cspPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  },
  build: {
    rollupOptions: {
      output: {
        // فصل المكتبات الخارجية عن كود التطبيق لتقليل حجم الحزمة الأولية
        manualChunks(id) {
          if (id.includes('node_modules')) {
            return id.includes('react') ? 'vendor-react' : 'vendor';
          }
        },
      },
    },
  },
  base: './', // Ensure relative paths for Electron
});
