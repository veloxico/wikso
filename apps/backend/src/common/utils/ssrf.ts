/**
 * SSRF guard utilities.
 *
 * Any code path that fetches a URL whose host is supplied by an admin (AI
 * provider endpoints, webhook test pings, the DB host in the setup wizard,
 * etc.) MUST run the provided host through `assertSafeHost` first. Otherwise
 * a compromised admin account — or any RCE that reaches one of these inputs —
 * can pivot inward to read cloud-provider metadata services, scan the LAN, or
 * exfiltrate data via the backend's network position.
 *
 * Blocked targets: RFC 1918 private ranges, loopback, link-local, IPv6 ULA /
 * link-local, and the well-known cloud metadata endpoints (AWS/GCP).
 *
 * In production we additionally resolve the hostname through DNS and check
 * every returned A/AAAA record — this defeats DNS-rebinding attacks where the
 * first lookup returns a public IP and a second lookup returns 169.254.169.254.
 */

import { promises as dns } from 'dns';
import { isIP } from 'net';

const BLOCKED_RANGES: RegExp[] = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
  /^fd/i,
];

const BLOCKED_HOSTNAMES = new Set<string>([
  'localhost',
  '0.0.0.0',
  '::1',
  '169.254.169.254', // AWS / OpenStack metadata
  'metadata.google.internal', // GCP metadata
  'metadata.azure.com', // Azure metadata (rare, but defense in depth)
]);

/**
 * Operator-controlled allowlist of trusted internal hostnames. Use this when
 * you legitimately need to reach a service on the Docker network (e.g.
 * `http://ollama:11434` in the same compose), which would otherwise resolve
 * to a private IP and be blocked.
 *
 * Set as comma-separated env var:
 *   SSRF_ALLOWED_HOSTS=ollama,host.docker.internal,internal-service
 *
 * Treat additions to this list with care — anything you put here can be the
 * target of an SSRF if the admin endpoint is compromised.
 */
// Memoized — env var is read once per process. Avoids re-parsing on every
// outbound URL the SSRF guard inspects. Tests that mutate the env between
// runs should call resetAllowedHostsCache().
let cachedAllowedHosts: Set<string> | null = null;
function getAllowedHosts(): Set<string> {
  if (cachedAllowedHosts) return cachedAllowedHosts;
  const raw = process.env.SSRF_ALLOWED_HOSTS || '';
  cachedAllowedHosts = new Set(
    raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
  return cachedAllowedHosts;
}

/** Test hook — clear the env-var cache so a re-read picks up new values. */
export function resetAllowedHostsCache(): void {
  cachedAllowedHosts = null;
}

/** Synchronous regex/literal check against a single hostname or literal IP. */
export function isBlockedHost(hostname: string): boolean {
  if (!hostname) return true;
  // Strip IPv6 brackets if present, e.g. "[::1]" → "::1"
  const host = hostname.replace(/^\[/, '').replace(/\]$/, '').toLowerCase();
  if (BLOCKED_HOSTNAMES.has(host)) return true;
  return BLOCKED_RANGES.some((r) => r.test(host));
}

/**
 * Resolve the hostname (if it isn't already a literal IP) and reject if any
 * resolved address falls in a blocked range. Use this for outbound requests
 * where the URL is admin-supplied.
 *
 * Allow-list of allowed protocols defaults to http/https — pass `null` to
 * skip the protocol check.
 */
export async function assertSafeUrl(
  rawUrl: string,
  allowedProtocols: string[] | null = ['http:', 'https:'],
): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('Invalid URL');
  }

  if (allowedProtocols && !allowedProtocols.includes(url.protocol)) {
    throw new Error(`URL protocol ${url.protocol} is not allowed`);
  }

  const host = url.hostname.toLowerCase();
  const allowed = getAllowedHosts();

  // Operator-allowlisted hostname — skip both the regex check and DNS
  // resolution. Used for trusted internal service names like `ollama` or
  // `host.docker.internal`.
  if (allowed.has(host)) return url;

  if (isBlockedHost(host)) {
    throw new Error(`Host ${host} is not allowed`);
  }

  // If host is a literal IP, the regex check above is sufficient.
  if (isIP(host)) return url;

  // Otherwise resolve and re-check every address. Skip in non-prod to keep
  // dev workflows that point at locally-resolving names from breaking.
  if (process.env.NODE_ENV !== 'production') return url;

  let addrs: { address: string; family: number }[] = [];
  try {
    addrs = await dns.lookup(host, { all: true });
  } catch {
    throw new Error(`Failed to resolve host ${host}`);
  }

  for (const a of addrs) {
    if (isBlockedHost(a.address)) {
      throw new Error(`Resolved address ${a.address} for host ${host} is not allowed`);
    }
  }

  return url;
}
