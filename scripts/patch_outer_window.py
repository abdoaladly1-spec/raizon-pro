with open('electron/main.js', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Update BrowserWindow options in createWindow
old_win_block = """function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webviewTag: false,
      spellcheck: false,
    },
    icon: path.join(__dirname, '../public/icon.ico')
  });

  mainWindow = win;

  const isDev = !app.isPackaged;

    const isPatcher = process.argv.includes('--patcher');"""

new_win_block = """function createWindow() {
  const isPatcher = process.argv.includes('--patcher');
  const win = new BrowserWindow({
    width: isPatcher ? 580 : 1200,
    height: isPatcher ? 350 : 800,
    resizable: !isPatcher,
    maximizable: !isPatcher,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webviewTag: false,
      spellcheck: false,
    },
    icon: path.join(__dirname, '../public/icon.ico')
  });

  mainWindow = win;

  const isDev = !app.isPackaged;"""

if old_win_block in text:
    text = text.replace(old_win_block, new_win_block)
    print("Updated createWindow with conditional width/height/resizable")
else:
    print("Could not find exact old_win_block, using regex...")
    import re
    text = re.sub(
        r"function createWindow\(\) \{\s*const win = new BrowserWindow\(\{[\s\S]*?icon: path\.join\(__dirname, '\.\./public/icon\.ico'\)\s*\}\);\s*mainWindow = win;\s*const isDev = !app\.isPackaged;\s*const isPatcher = process\.argv\.includes\('--patcher'\);",
        new_win_block,
        text
    )

# 2. Add patcher:set-window-size handler
handler_code = """
// التحكم في مقاس النافذة الخارجية (BrowserWindow) من أجل الباتشر
let savedWindowBounds = null;

ipcMain.handle('patcher:set-window-size', (event, opts = {}) => {
    try {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (!win) return { ok: false };
        const { state, width, height } = opts;

        if (state === 'login') {
            if (!savedWindowBounds) {
                savedWindowBounds = win.getBounds();
            }
            win.setResizable(false);
            win.setMaximizable(false);
            win.setSize(width || 580, height || 350, true);
            win.center();
        } else if (state === 'dashboard') {
            win.setResizable(true);
            win.setMaximizable(true);
            win.setSize(width || 1100, height || 750, true);
            win.center();
        } else if (state === 'restore') {
            win.setResizable(true);
            win.setMaximizable(true);
            if (savedWindowBounds) {
                win.setBounds(savedWindowBounds);
                savedWindowBounds = null;
            } else {
                win.setSize(1200, 800, true);
                win.center();
            }
        }
        return { ok: true };
    } catch (e) {
        return { ok: false, error: e?.message };
    }
});
"""

if "patcher:set-window-size" not in text:
    text += handler_code
    print("Added patcher:set-window-size IPC handler")

with open('electron/main.js', 'w', encoding='utf-8') as f:
    f.write(text)

print("Updated electron/main.js successfully")
