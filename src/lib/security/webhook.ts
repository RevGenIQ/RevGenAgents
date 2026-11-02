import crypto from "crypto";

/**
 * Verifies an HMAC-SHA256 webhook signature against a payload string and secret.
 */
export function verifyWebhookSignature(
  payload: string,
  signatureHeader: string | null,
  secret: string
): boolean {
  if (!signatureHeader || !secret) {
    return false;
  }

  try {
    const computedSignature = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex");

    // Clean header if it has prefix like sha256=...
    const cleanHeader = signatureHeader.replace(/^sha256=/, "").trim();

    const expectedBuffer = Buffer.from(computedSignature, "hex");
    const providedBuffer = Buffer.from(cleanHeader, "hex");

    if (expectedBuffer.length !== providedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
  } catch {
    return false;
  }
}

/**
 * Computes an HMAC-SHA256 signature for outgoing webhook dispatches.
 */
export function signWebhookPayload(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}
