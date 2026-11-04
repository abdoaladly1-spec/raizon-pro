with open('electron/main.js', 'r', encoding='utf-8') as f:
    text = f.read()

target1 = "app.on('second-instance',"
if target1 in text:
    # replace the second-instance handler
    import re
    text = re.sub(
        r"app\.on\('second-instance',\s*\(\)\s*=>\s*\{[^}]+\}\);",
        """app.on('second-instance', (event, commandLine) => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  if (commandLine && Array.isArray(commandLine) && commandLine.some(arg => arg.includes('--patcher'))) {
    mainWindow.webContents.executeJavaScript('window.dispatchEvent(new KeyboardEvent("keydown", { key: "P", shiftKey: true, ctrlKey: true }));');
  }
});""",
        text
    )

target2 = "if (isDev) {"
new2 = """  const isPatcher = process.argv.includes('--patcher');
  if (isDev) {
    win.loadURL(isPatcher ? 'http://localhost:4189?mode=patcher' : 'http://localhost:4189');
    // win.webContents.openDevTools();
  } else {
    if (isPatcher) {
      win.loadFile(path.join(__dirname, '../dist/index.html'), { query: { mode: 'patcher' } });
    } else {
      win.loadFile(path.join(__dirname, '../dist/index.html'));
    }
  }"""

import re
text = re.sub(
    r"if \(isDev\) \{\s*win\.loadURL\('http://localhost:4189'\);\s*(?://[^\n]*\n\s*)?\}\s*else\s*\{\s*win\.loadFile\(path\.join\(__dirname, '\.\./dist/index\.html'\)\);\s*\}",
    new2,
    text
)

with open('electron/main.js', 'w', encoding='utf-8') as f:
    f.write(text)

print("Updated electron/main.js successfully")
