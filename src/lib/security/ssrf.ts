/**
 * SSRF (Server-Side Request Forgery) Protection Utility
 * Validates external URLs to prevent access to private IP ranges,
 * cloud metadata endpoints (169.254.169.254), loopback addresses, and unauthorized schemes.
 */

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "0.0.0.0",
  "169.254.169.254", // AWS, GCP, Azure metadata endpoint
  "metadata.google.internal",
  "instance-data",
]);

/**
 * Checks whether an IPv4 address falls into private/reserved subnets:
 * - 10.0.0.0/8
 * - 172.16.0.0/12
 * - 192.168.0.0/16
 * - 127.0.0.0/8
 * - 169.254.0.0/16
 * - 0.0.0.0/8
 */
function isPrivateOrReservedIp(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return false;
  }

  // 0.0.0.0/8
  if (parts[0] === 0) return true;
  // 127.0.0.0/8 (Loopback)
  if (parts[0] === 127) return true;
  // 10.0.0.0/8 (Private)
  if (parts[0] === 10) return true;
  // 172.16.0.0/12 (Private)
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  // 192.168.0.0/16 (Private)
  if (parts[0] === 192 && parts[1] === 168) return true;
  // 169.254.0.0/16 (Link-local / Cloud Metadata)
  if (parts[0] === 169 && parts[1] === 254) return true;

  return false;
}

export function validateSafeUrl(urlString: string): {
  isSafe: boolean;
  url?: URL;
  error?: string;
} {
  if (!urlString || typeof urlString !== "string") {
    return { isSafe: false, error: "URL string is empty or invalid." };
  }

  try {
    const parsed = new URL(urlString.trim());

    // Only allow HTTP and HTTPS
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return {
        isSafe: false,
        error: `Invalid protocol '${parsed.protocol}'. Only http: and https: are permitted.`,
      };
    }

    const hostname = parsed.hostname.toLowerCase();

    // Check blocked hostnames
    if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
      return {
        isSafe: false,
        error: `Access to internal host '${hostname}' is prohibited.`,
      };
    }

    // Check if hostname is directly an IP
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)) {
      if (isPrivateOrReservedIp(hostname)) {
        return {
          isSafe: false,
          error: `Access to private or link-local IP '${hostname}' is prohibited by SSRF defense.`,
        };
      }
    }

    return { isSafe: true, url: parsed };
  } catch {
    return { isSafe: false, error: "Malformed URL syntax." };
  }
}
