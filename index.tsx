import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// إدارة الـ Service Worker:
// 1) في بيئة التطوير (DEV) أو على localhost: نقوم بإلغاء التثبيت فوراً لمنع تعارض HMR والشاشة البيضاء
// 2) في بيئة الإنتاج الموزعة عبر HTTPS: نسجّل الـ Service Worker لتمكين دعم الـ PWA والعمل بدون إنترنت
if ('serviceWorker' in navigator) {
  const isLocalhost = location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.hostname === '[::1]';
  if (import.meta.env.DEV || isLocalhost) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const reg of registrations) {
        reg.unregister();
      }
    });
  } else if (/^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          registration.addEventListener('updatefound', () => {
            const next = registration.installing;
            if (!next) return;
            next.addEventListener('statechange', () => {
              if (next.state === 'activated' && navigator.serviceWorker.controller) {
                window.location.reload();
              }
            });
          });
        })
        .catch((registrationError) => {
          console.warn('SW registration failed: ', registrationError);
        });
    });
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
