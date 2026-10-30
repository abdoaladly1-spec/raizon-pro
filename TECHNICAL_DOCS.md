# ProCashier System - Security & Activation Guide

## 1. New Activation System (Product Key)
The system now uses an **Encrypted Product Key** mechanism.
- You generate keys using the `generate_keys.js` script.
- You give a key to the client.
- The client enters the key *once*.
- The system validates the key, then **locks itself to the client's hardware**.
- Future updates or restarts check this hardware lock.

## 2. How to Generate Keys
1. Open the project folder in terminal.
2. Run the generator script:
   ```bash
   node generate_keys.js
   ```
3. Copy one of the generated keys (they look like `iv_hex:encrypted_data_hex`).
4. Send this key to the salon owner.

## 3. How It Works
1. **Validation:** The app attempts to decrypt the key using the internal `SECRET_SALT`.
2. **Verification:** It checks if the decrypted data contains `app: "PROCASHIER"` and `valid: true`.
3. **Locking:** If valid, it saves a `license.key` file that binds the **Product Key** to the **Machine ID**.
4. **Persistence:**
   - If the user restarts the app -> It checks the lock -> Valid.
   - If the user copies the app to another PC -> Hardware ID changes -> Lock Fails -> Asks for Activation again.
   - Since the user (presumably) doesn't have the generator, they cannot generate a new key for the second PC. (You control the keys).

## 4. Security Details
- **Algorithm:** AES-256-CBC Encryption.
- **Integrity Check:** HMAC-SHA256 hash ensures the local license file hasn't been tampered with.
- **Hardware Binding:** CPU Model, Network Interfaces, Hostname.

## 5. Troubleshooting
- If a legitimate user changes their PC hardware significantly, the license might fail. In this case, simply give them the same key again (or a new one) to reactivate on the "new" hardware.
