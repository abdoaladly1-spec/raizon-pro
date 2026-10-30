#!/usr/bin/env node
/**
 * مولّد مفاتيح ترخيص RaiZon Pro (Ed25519) — أداة داخلية لا تُشحن مع التطبيق.
 *
 * الاستخدام:
 *   node tools/make-license.mjs --machine <MACHINE_ID> [--exp 2027-12-31] [--plan pro]
 *
 * - المفتاح الخاص يُقرأ من tools/keys/license-private.pem (أو LICENSE_PRIVATE_KEY).
 * - المفتاح العام مضمّن في electron/main.js.
 * - احتفظ بالمفتاح الخاص في مكان آمن/offline ولا ترفعه إلى Git أبداً.
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KEY_PATH = process.env.LICENSE_PRIVATE_KEY || path.join(__dirname, 'keys', 'license-private.pem');

const args = process.argv.slice(2);
const getArg = (name, fallback = '') => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const machine = getArg('machine');
const exp = getArg('exp');
const plan = getArg('plan', 'pro');

if (!machine) {
  console.error('Usage: node tools/make-license.mjs --machine <MACHINE_ID> [--exp YYYY-MM-DD] [--plan pro]');
  process.exit(1);
}
if (!fs.existsSync(KEY_PATH)) {
  console.error(`Private key not found: ${KEY_PATH}`);
  console.error('أنشئ زوج المفاتيح أولاً واحتفظ بالخاص بعيداً عن المستودع.');
  process.exit(1);
}

const payload = {
  app: 'RAIZON_PRO',
  mid: machine,
  plan,
  iat: new Date().toISOString().slice(0, 10),
  ...(exp ? { exp } : {}),
};

const payloadPart = Buffer.from(JSON.stringify(payload)).toString('base64url');
const signature = crypto.sign(null, Buffer.from(payloadPart), fs.readFileSync(KEY_PATH));
const license = `${payloadPart}.${signature.toString('base64url')}`;

console.log(license);
console.error(`\nMachine: ${machine}`);
console.error(`Plan: ${plan}${exp ? ` | Expires: ${exp}` : ' | Perpetual'}`);
