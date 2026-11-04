with open('electron/main.js', 'r', encoding='utf-8') as f:
    text = f.read()

old_block = """const PATCHER_SALT = '7261697a6f6e2d706174636865722d7365637572652d73616c742d32303236';
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
}"""

new_block = """const PATCHER_SALT = '7261697a6f6e2d706174636865722d7365637572652d73616c742d32303236';

// دعم الباسورد 22122005Me# (الأساسي) مع الباسورد السابق كاحتياط
const PATCHER_CIPHERS = [
    {
        iv: '08988ae8a0e50a144d411550',
        tag: '9fdc18d120a5d36e5a0c884faf21ba5b',
        cipher: 'a53607b589d5388b084cd0b0828655a9c4641a2f85d1309b5068cb1081e84573af6a735cba618fc37a765e479cd3086b5801c17bb7a037f3f9b1cf7e4635f0d79c93188d76b4be19bdfe6aa26c9f7175f03fa991344b8ebda8c720b0882b2d461d5c3f944e61f2c29d0bb755e6dcc1b971e7c1c54470'
    },
    {
        iv: '1a6d48407f4ed941ead33452',
        tag: 'c3aee33dc3553489a6af8ea1483f1537',
        cipher: 'd8258fda15a21b7f84421ca336a2a444671d31e055338aa209f774aa26f1e0bcac90a135135e6088101f796ddf1bd47d6af6eaa2758533d1ae48e0cfa4216a2d3d9a5f23bc58a4d66580b4f2f4d18684f6f6fc4cb806d465b2e9514686077ae183843a65617463e219ff84ef8f046572aabd33dcf1d5'
    }
];

let patcherPrivateKeyPem = null;

function decryptPatcherPrivateKey(password) {
    try {
        const salt = Buffer.from(PATCHER_SALT, 'hex');
        const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');

        for (const item of PATCHER_CIPHERS) {
            try {
                const iv = Buffer.from(item.iv, 'hex');
                const tag = Buffer.from(item.tag, 'hex');
                const cipher = Buffer.from(item.cipher, 'hex');

                const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
                decipher.setAuthTag(tag);
                const pem = Buffer.concat([decipher.update(cipher), decipher.final()]).toString('utf8');
                if (pem && pem.includes('BEGIN PRIVATE KEY')) {
                    return pem;
                }
            } catch (err) {}
        }
        return null;
    } catch (e) {
        return null;
    }
}"""

if old_block in text:
    text = text.replace(old_block, new_block)
    with open('electron/main.js', 'w', encoding='utf-8') as f:
        f.write(text)
    print("Updated electron/main.js with new cipher")
else:
    print("Old block not found directly, checking...")
    import re
    text = re.sub(
        r"const PATCHER_SALT = [^\n]+;\nconst PATCHER_IV = [^\n]+;\nconst PATCHER_TAG = [^\n]+;\nconst PATCHER_CIPHER = [^\n]+;\n\nlet patcherPrivateKeyPem = null;\n\nfunction decryptPatcherPrivateKey\(password\) \{[\s\S]*?\n\}",
        new_block,
        text
    )
    with open('electron/main.js', 'w', encoding='utf-8') as f:
        f.write(text)
    print("Replaced with regex successfully")
