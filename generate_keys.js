import crypto from 'crypto';

const SECRET_SALT = 'PRO_CASHIER_IBRAHIM_NAWAR_2025_SECURE_SALT';
const ENCRYPTION_KEY = crypto.scryptSync(SECRET_SALT, 'salt', 32); 
const IV_LENGTH = 16;

function encrypt(text) {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function generateKeys(count = 10) {
    console.log(`Generating ${count} Product Keys...`);
    console.log('--------------------------------------------------');
    
    for (let i = 0; i < count; i++) {
        const payload = JSON.stringify({
            valid: true,
            app: 'PROCASHIER',
            id: crypto.randomUUID().split('-')[0], // Short unique ID
            batch: 'BATCH_2025_PERMANENT'
        });
        
        const key = encrypt(payload);
        console.log(`KEY ${i+1}: ${key}`);
    }
    
    console.log('--------------------------------------------------');
    console.log('Give one of these keys to the client. They can use it to activate the software.');
}

generateKeys(10);
