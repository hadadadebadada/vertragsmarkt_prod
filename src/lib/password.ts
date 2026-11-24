import "server-only";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;
const KEY_LENGTH = 64;

/** Hashes a password as `scrypt$<salt>$<hash>` (base64). */
export async function hashPassword(password: string): Promise<string> {
	const salt = randomBytes(16);
	const hash = await scryptAsync(password.normalize("NFKC"), salt, KEY_LENGTH);
	return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
	const [algo, saltB64, hashB64] = stored.split("$");
	if (algo !== "scrypt" || !saltB64 || !hashB64) return false;
	const expected = Buffer.from(hashB64, "base64");
	const actual = await scryptAsync(
		password.normalize("NFKC"),
		Buffer.from(saltB64, "base64"),
		expected.length,
	);
	return timingSafeEqual(actual, expected);
}

/** Verified against when the email is unknown, so login timing doesn't reveal which emails exist. */
export const DUMMY_HASH = `scrypt$${Buffer.alloc(16).toString("base64")}$${Buffer.alloc(KEY_LENGTH).toString("base64")}`;
