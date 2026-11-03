import crypto from "crypto";

const PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
const MIN_CUSTOM_PASSWORD_LENGTH = 12;

/**
 * Generates a random password from a CSPRNG (about 99 bits of entropy at the default length).
 */
export function generateStrongPassword(length = 17): string {
  const chars = Array.from({ length }, () => PASSWORD_ALPHABET[crypto.randomInt(PASSWORD_ALPHABET.length)]);
  return chars.join("");
}

/**
 * Generates a hard-to-guess numeric suffix for login IDs.
 */
export function generateIdSuffix(): string {
  return String(crypto.randomInt(100000, 1000000));
}

/**
 * Returns the admin-supplied password when it is long enough, otherwise a generated one.
 */
export function resolvePassword(custom: unknown): string {
  const trimmed = typeof custom === "string" ? custom.trim() : "";
  return trimmed.length >= MIN_CUSTOM_PASSWORD_LENGTH ? trimmed : generateStrongPassword();
}

export const MIN_CLIENT_PASSWORD_LENGTH = MIN_CUSTOM_PASSWORD_LENGTH;
const MAX_PASSWORD_LENGTH = 200;
const SCRYPT_N = 16384;
const SCRYPT_KEYLEN = 64;

/** Why a self-chosen password is unacceptable, or null when it is fine. */
export function passwordProblem(password: string): string | null {
  if (password.length < MIN_CLIENT_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_CLIENT_PASSWORD_LENGTH} characters.`;
  }
  if (password.length > MAX_PASSWORD_LENGTH) return "Password is too long.";
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return "Password must contain letters and numbers.";
  }
  return null;
}

/** Hashes a password as `scrypt$N$saltHex$hashHex` (salted, memory-hard). */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN, { N: SCRYPT_N });
  return `scrypt$${SCRYPT_N}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

/** Constant-time check of a password against a stored `hashPassword` value. */
export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  const parts = String(stored || "").split("$");
  if (parts.length !== 4 || parts[0] !== "scrypt") return false;
  const n = Number(parts[1]);
  if (!Number.isInteger(n) || n < 1024 || n > 1 << 20) return false;
  const expected = Buffer.from(parts[3], "hex");
  if (expected.length !== SCRYPT_KEYLEN) return false;
  const actual = crypto.scryptSync(password, Buffer.from(parts[2], "hex"), SCRYPT_KEYLEN, { N: n });
  return crypto.timingSafeEqual(actual, expected);
}
