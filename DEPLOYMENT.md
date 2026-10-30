# ProCashier Deployment Guide

This guide explains how to deploy the ProCashier system as a standalone desktop application (EXE) and how to manage the system.

## 1. Turning the Web App into an EXE

Since this is a React web application, you can use **Electron** to wrap it into a desktop application.

### Prerequisites
- Node.js installed on your machine.

### Steps
1.  **Initialize Electron**:
    Run the following command in the project root:
    ```bash
    npm install --save-dev electron electron-builder wait-on concurrently
    ```

2.  **Create `electron/main.js`**:
    Create a file named `main.js` in an `electron` folder with the following content:
    ```javascript
    const { app, BrowserWindow } = require('electron');
    const path = require('path');

    function createWindow() {
      const win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false
        },
        icon: path.join(__dirname, '../public/favicon.ico') // Ensure you have an icon
      });

      // In production, load the built file
      // win.loadFile(path.join(__dirname, '../dist/index.html'));
      
      // In development, load the dev server
      win.loadURL('http://localhost:5173'); 
    }

    app.whenReady().then(createWindow);

    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });
    ```

3.  **Update `package.json`**:
    Add the following scripts and configuration:
    ```json
    "main": "electron/main.js",
    "scripts": {
      "electron": "concurrently \"npm run dev\" \"wait-on http://localhost:5173 && electron .\"",
      "electron:build": "npm run build && electron-builder"
    },
    "build": {
      "appId": "com.procashier.system",
      "productName": "ProCashier",
      "win": {
        "target": "nsis",
        "icon": "public/favicon.ico"
      }
    }
    ```

4.  **Build the EXE**:
    Run the build command:
    ```bash
    npm run electron:build
    ```
    This will generate an EXE file in the `dist` folder.

## 2. System Reset & Security

### Factory Reset
- Go to **Settings > Data Management**.
- Click **"Restore Factory Defaults"**.
- **Note**: The system will automatically download a backup JSON file before resetting.

### User Management
- **Default Admin**: `ibrahim` / `h12341234`
- **Hidden Developer**: `abdo1` / `admin123` (Use `Ctrl+Shift+L` or hidden login if implemented, otherwise standard login works but user is hidden from lists).
- **Password Recovery**: If a cashier forgets their password, they must contact the Admin. The Admin can reset passwords in **Settings > Users**.

## 3. Backup & Restore
- **Backup**: Go to **Settings > Data Management** and click **"Backup Data"**. This downloads a JSON file.
- **Restore**: Currently, restoration is manual. Keep the JSON file safe. To restore, a developer would need to load this JSON state into the application (feature to be added in future updates).

## 4. Troubleshooting
- **White Screen on Print**: Ensure the printer settings in **Settings > General** match your paper size (80mm vs A4).
- **Connection Refused**: Restart the application using the desktop shortcut.

## 5. Intellectual Property
This software is developed by **Eng. Abdelrahman Fathy El-Adly**.
- The source code is protected.
- The EXE file prevents casual modification of the code.
- Ensure `LICENSE` file is included in the distribution.
