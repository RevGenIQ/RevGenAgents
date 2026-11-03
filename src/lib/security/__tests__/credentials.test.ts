import { describe, expect, it } from "vitest";
import { hashPassword, passwordProblem, verifyPassword } from "../credentials";

describe("client passwords", () => {
  it("verifies the right password and rejects others", () => {
    const stored = hashPassword("correct horse 42 battery");
    expect(stored).toMatch(/^scrypt\$16384\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
    expect(verifyPassword("correct horse 42 battery", stored)).toBe(true);
    expect(verifyPassword("correct horse 42 batterY", stored)).toBe(false);
  });

  it("salts every hash", () => {
    expect(hashPassword("same password 123")).not.toBe(hashPassword("same password 123"));
  });

  it("rejects malformed or missing stored hashes", () => {
    expect(verifyPassword("anything 123", null)).toBe(false);
    expect(verifyPassword("anything 123", "plaintext")).toBe(false);
    expect(verifyPassword("anything 123", "scrypt$99999999$aa$bb")).toBe(false);
  });

  it("explains weak passwords", () => {
    expect(passwordProblem("short1")).toMatch(/at least 12/);
    expect(passwordProblem("onlyletterslong")).toMatch(/letters and numbers/);
    expect(passwordProblem("letters and 123")).toBeNull();
  });
});
