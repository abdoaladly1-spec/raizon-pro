import re

with open('electron/main.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update verifyLicenseKey to handle ISO timestamps and detailed expiration
old_verify = """        if (payload.exp) {
            const exp = Date.parse(`${payload.exp}T23:59:59Z`);
            if (!Number.isFinite(exp) || Date.now() > exp) return { ok: false, reason: 'expired' };
        }
        return { ok: true, payload };"""

new_verify = """        if (payload.exp) {
            const exp = payload.exp.includes('T') ? Date.parse(payload.exp) : Date.parse(`${payload.exp}T23:59:59Z`);
            if (!Number.isFinite(exp) || Date.now() > exp) {
                return { ok: false, reason: 'expired', expiresAt: new Date(exp).toISOString() };
            }
        }
        return { ok: true, payload };"""

if old_verify in content:
    content = content.replace(old_verify, new_verify)
    print("Replaced verifyLicenseKey logic")

# 2. Update verifyLicense to return remainingMs, expiresAt, isPerpetual
old_verify_lic = """function verifyLicense() {
    const machineId = getMachineId();
    try {
        if (!fs.existsSync(LICENSE_FILE)) return { valid: false, machineId, reason: 'missing' };
        const licenseData = JSON.parse(fs.readFileSync(LICENSE_FILE, 'utf8'));
        const res = verifyLicenseKey(licenseData.key);
        if (!res.ok) return { valid: false, machineId, reason: res.reason };
        return { valid: true, machineId, payload: res.payload };
    } catch {
        return { valid: false, machineId, reason: 'error' };
    }
}"""

new_verify_lic = """function verifyLicense() {
    const machineId = getMachineId();
    try {
        if (!fs.existsSync(LICENSE_FILE)) return { valid: false, machineId, reason: 'missing' };
        const licenseData = JSON.parse(fs.readFileSync(LICENSE_FILE, 'utf8'));
        const res = verifyLicenseKey(licenseData.key);
        if (!res.ok) return { valid: false, machineId, reason: res.reason };

        let remainingMs = null;
        let expiresAt = null;
        let isPerpetual = true;
        if (res.payload && res.payload.exp) {
            const expMs = res.payload.exp.includes('T') ? Date.parse(res.payload.exp) : Date.parse(`${res.payload.exp}T23:59:59Z`);
            remainingMs = Math.max(0, expMs - Date.now());
            expiresAt = new Date(expMs).toISOString();
            isPerpetual = false;
        }

        return {
            valid: true,
            machineId,
            payload: res.payload,
            remainingMs,
            expiresAt,
            isPerpetual,
        };
    } catch {
        return { valid: false, machineId, reason: 'error' };
    }
}"""

if old_verify_lic in content:
    content = content.replace(old_verify_lic, new_verify_lic)
    print("Replaced verifyLicense logic")

# 3. Add Patcher Constants and IPC Handlers before the end of main.js
patcher_block = """
// -------------------------------------------------------------
// PATCHER SYSTEM (المولّد والمتحكم في التراخيص للمطور)
// -------------------------------------------------------------
const PATCHER_SALT = '7261697a6f6e2d706174636865722d7365637572652d73616c742d32303236';
const PATCHER_IV = '1a6d48407f4ed941ead33452';
const PATCHER_TAG = 'c3aee33dc3553489a6af8ea1483f1537';
const PATCHER_CIPHER = 'd8258fda15a21b7f84421ca336a2a444671d31e055338aa209f774aa26f1e0bcac90a135135e6088101f796ddf1bd47d6af6eaa2758533d1ae48e0cfa4216a2d3d9a5f23bc58a4d66580b4f2f4d18684f6f6fc4cb806d465b2e9514686077ae183843a65617463e219ff84ef8f046572aabd33dcf1d5';

let patcherPrivateKeyPem = null;

function decryptPatcherPrivateKey(password) {
    try {
        const salt = Buffer.from(PATCHER_SALT, 'hex');
        const iv = Buffer.from(PATCHER_IV, 'hex');
        const tag = Buffer.from(PATCHER_TAG, 'hex');
        const cipher = Buffer.from(PATCHER_CIPHER, 'hex');

        const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(tag);
        const pem = Buffer.concat([decipher.update(cipher), decipher.final()]).toString('utf8');
        if (pem && pem.includes('BEGIN PRIVATE KEY')) {
            return pem;
        }
        return null;
    } catch (e) {
        return null;
    }
}

function getPatcherClientsFile() {
    return path.join(app.getPath('userData'), 'patcher-clients.json');
}

function readPatcherClients() {
    try {
        const file = getPatcherClientsFile();
        if (fs.existsSync(file)) {
            const data = JSON.parse(fs.readFileSync(file, 'utf8'));
            if (Array.isArray(data)) return data;
        }
    } catch (e) {
        console.warn('[patcher] error reading clients:', e?.message || e);
    }
    return [];
}

function writePatcherClients(clients) {
    try {
        const file = getPatcherClientsFile();
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, JSON.stringify(clients, null, 2), 'utf8');
        return true;
    } catch (e) {
        console.warn('[patcher] error writing clients:', e?.message || e);
        return false;
    }
}

// 1. تسجيل دخول المطور
ipcMain.handle('patcher:login', (event, { username, password }) => {
    if (username !== 'admin') {
        return { ok: false, error: 'اسم المستخدم غير صحيح' };
    }
    const pem = decryptPatcherPrivateKey(password);
    if (!pem) {
        return { ok: false, error: 'كلمة المرور غير صحيحة' };
    }
    patcherPrivateKeyPem = pem;
    return { ok: true, currentMachineId: getMachineId() };
});

// 2. جلب قائمة العملاء
ipcMain.handle('patcher:get-clients', () => {
    return readPatcherClients();
});

// 3. حذف سجل عميل من القائمة
ipcMain.handle('patcher:delete-client', (event, id) => {
    const clients = readPatcherClients().filter(c => c.id !== id);
    writePatcherClients(clients);
    return { ok: true, clients };
});

// 4. معرف الجهاز الحالي
ipcMain.handle('patcher:get-current-mid', () => {
    return getMachineId();
});

// 5. توليد مفتاح ترخيص فريد وحفظه في قائمة العملاء
ipcMain.handle('patcher:generate', (event, { machineId, clientName, duration }) => {
    if (!patcherPrivateKeyPem) {
        return { ok: false, error: 'جلسة المطور منتهية، يرجى تسجيل الدخول مجدداً' };
    }
    if (!machineId || !machineId.trim()) {
        return { ok: false, error: 'يرجى إدخال معرف الجهاز (Machine ID)' };
    }
    if (!clientName || !clientName.trim()) {
        return { ok: false, error: 'يرجى إدخال اسم العميل' };
    }

    try {
        const now = new Date();
        const iat = now.toISOString();
        const tid = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(8).toString('hex');
        
        let exp = null;
        let durationLabel = '';

        switch (duration) {
            case '30m':
                exp = new Date(now.getTime() + 30 * 60 * 1000).toISOString();
                durationLabel = '30 دقيقة';
                break;
            case '1d':
                exp = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
                durationLabel = '1 يوم';
                break;
            case '7d':
                exp = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
                durationLabel = 'أسبوع (7 أيام)';
                break;
            case '30d':
                exp = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
                durationLabel = 'شهر (30 يوم)';
                break;
            case '3m':
                exp = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();
                durationLabel = '3 شهور';
                break;
            case '6m':
                exp = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000).toISOString();
                durationLabel = '6 شهور';
                break;
            case '1y':
                exp = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString();
                durationLabel = '1 سنة';
                break;
            case 'lifetime':
            case 'perpetual':
            default:
                exp = null;
                durationLabel = 'طوال الحياة (مدى الحياة)';
                break;
        }

        const payload = {
            app: RAIZON_APP_ID,
            mid: machineId.trim(),
            tid,
            client: clientName.trim(),
            iat,
            ...(exp ? { exp } : {})
        };

        const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
        const sig = crypto.sign(null, Buffer.from(payloadB64), patcherPrivateKeyPem).toString('base64url');
        const licenseKey = `${payloadB64}.${sig}`;

        const record = {
            id: 'cli_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
            tid,
            clientName: clientName.trim(),
            machineId: machineId.trim(),
            durationLabel,
            durationValue: duration,
            createdAt: iat,
            expiresAt: exp,
            licenseKey,
            status: 'active'
        };

        const clients = readPatcherClients();
        // أحدث مفتاح يوضع في الأول
        clients.unshift(record);
        writePatcherClients(clients);

        return { ok: true, licenseKey, record, clients };
    } catch (e) {
        console.error('[patcher] generation error:', e);
        return { ok: false, error: e?.message || 'فشل في توليد المفتاح' };
    }
});

// 6. تفعيل فوري للجهاز الحالي بدون الحاجة للنسخ واللصق
ipcMain.handle('patcher:activate-current', (event, key) => {
    const res = verifyLicenseKey(key);
    if (!res.ok) {
        return { ok: false, error: 'المفتاح غير صالح للجهاز الحالي' };
    }
    try {
        fs.writeFileSync(LICENSE_FILE, JSON.stringify({
            machineId: getMachineId(),
            key: String(key).trim(),
            activatedAt: new Date().toISOString(),
        }));
        return { ok: true };
    } catch (e) {
        return { ok: false, error: 'فشل حفظ ملف الترخيص' };
    }
});
"""

if 'PATCHER SYSTEM' not in content:
    content += patcher_block
    with open('electron/main.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Added Patcher backend handlers to electron/main.js")
else:
    print("Patcher handlers already exist in electron/main.js")
