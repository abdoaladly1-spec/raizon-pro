import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 4189,
        host: '0.0.0.0',
        watch: {
          // ملفات يكتبها السيرفر/البناء لا تُسبب إعادة تحميل الصفحة أثناء التطوير
          ignored: ['**/server/backups/**', '**/server/*.db', '**/release/**', '**/node_modules/**'],
        },
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
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
    };
});
