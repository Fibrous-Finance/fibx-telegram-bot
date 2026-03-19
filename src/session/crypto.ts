import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12; // NIST SP 800-38D optimal for AES-GCM
const TAG_LEN = 16;

function deriveKey(secret: string): Buffer {
	if (!/^[0-9a-f]{64}$/i.test(secret)) {
		throw new Error("BOT_ENCRYPTION_SECRET must be a 64-character hex string (32 bytes)");
	}
	return Buffer.from(secret, "hex");
}

/** Encrypt plaintext → hex string (iv + tag + ciphertext) */
export function encrypt(plaintext: string, secret: string): string {
	const key = deriveKey(secret);
	const iv = randomBytes(IV_LEN);

	const cipher = createCipheriv(ALGO, key, iv, { authTagLength: TAG_LEN });
	const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
	const tag = cipher.getAuthTag();

	return Buffer.concat([iv, tag, encrypted]).toString("hex");
}

/** Decrypt hex string → plaintext */
export function decrypt(hex: string, secret: string): string {
	const key = deriveKey(secret);
	const buf = Buffer.from(hex, "hex");

	const iv = buf.subarray(0, IV_LEN);
	const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
	const ciphertext = buf.subarray(IV_LEN + TAG_LEN);

	const decipher = createDecipheriv(ALGO, key, iv, { authTagLength: TAG_LEN });
	decipher.setAuthTag(tag);

	return decipher.update(ciphertext).toString("utf8") + decipher.final("utf8");
}
