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
