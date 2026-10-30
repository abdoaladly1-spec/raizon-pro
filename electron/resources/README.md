# موردّات Electron المضمّنة

هذا المجلد مصدر `extraResources` في `package.json`.

## السيرفر المضمَّن

يُنتج `npm run server:build` الملف:

```
electron/resources/procashier-server.exe
```

ويُنسخ تلقائياً إلى جذر موارد التطبيق عند التثبيت (`process.resourcesPath`).
الملف التنفيذي **غير مُتتبَّع في Git** (يُبنى محلياً على كل جهاز بناء).
