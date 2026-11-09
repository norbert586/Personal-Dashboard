/**
 * The access gate's decision logic (ADR-004). Pure functions, so they can be unit-tested.
 *
 * Fail closed: a production server with no ACCESS_MODE refuses everyone. The dev server
 * is always allowed because it only listens on localhost by default.
 *
 * Caveat for `private-network`: a local tunnel or reverse proxy (Tailscale Funnel, ngrok,
 * cloudflared) forwards outside visitors from 127.0.0.1, so they look local. Only use this
 * mode behind tunnels that authenticate (Tailscale Serve, Cloudflare Access).
 */
export type AccessMode = 'private-network';

export interface AccessInput {
  mode: AccessMode | undefined;
  isDev: boolean;
  clientAddress: string | undefined;
}

export interface AccessDecision {
  allowed: boolean;
  /** For server logs only; never shown to visitors. */
  reason: string;
}

export function decideAccess({ mode, isDev, clientAddress }: AccessInput): AccessDecision {
  if (isDev) return { allowed: true, reason: 'Dev server.' };

  if (mode === undefined) {
    return {
      allowed: false,
      reason: 'ACCESS_MODE is not set, so the production server refuses every request.',
    };
  }

  if (mode === 'private-network') {
    if (clientAddress !== undefined && isPrivateAddress(clientAddress)) {
      return { allowed: true, reason: `${clientAddress} is on a private network.` };
    }
    return {
      allowed: false,
      reason: `${clientAddress ?? 'An unknown address'} is outside the private network.`,
    };
  }

  return { allowed: false, reason: `Unknown ACCESS_MODE "${String(mode)}".` };
}

/**
 * True for loopback, LAN (RFC 1918), Tailscale/CGNAT (100.64.0.0/10), link-local and
 * IPv6 unique-local (fc00::/7, which includes Tailscale's fd7a:115c:a1e0::/48) addresses.
 * Anything unparseable is treated as public, because the gate fails closed.
 */
export function isPrivateAddress(raw: string): boolean {
  const ip =
    raw
      .trim()
      .toLowerCase()
      .replace(/^\[|\]$/g, '')
      .split('%')[0] ?? '';
  if (ip === '') return false;

  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(ip);
  if (mapped?.[1]) return isPrivateIPv4(mapped[1]);

  if (ip.includes(':')) return isPrivateIPv6(ip);
  return isPrivateIPv4(ip);
}

function parseIPv4(ip: string): number[] | null {
  const parts = ip.split('.');
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) return null;
  const octets = parts.map(Number);
  return octets.every((octet) => octet <= 255) ? octets : null;
}

function isPrivateIPv4(ip: string): boolean {
  const octets = parseIPv4(ip);
  if (!octets) return false;
  const [a = -1, b = -1] = octets;
  return (
    a === 127 || // loopback
    a === 10 || // RFC 1918
    (a === 172 && b >= 16 && b <= 31) || // RFC 1918
    (a === 192 && b === 168) || // RFC 1918
    (a === 100 && b >= 64 && b <= 127) || // CGNAT, used by Tailscale
    (a === 169 && b === 254) // link-local
  );
}

/** Expand an IPv6 address into eight 16-bit groups, or null if it isn't one. */
function expandIPv6(ip: string): number[] | null {
  if (!/^[0-9a-f:]+$/.test(ip)) return null;
  const double = ip.indexOf('::');
  if (double !== ip.lastIndexOf('::')) return null;

  let groups: string[];
  if (double === -1) {
    groups = ip.split(':');
  } else {
    const left = ip.slice(0, double);
    const right = ip.slice(double + 2);
    const head = left === '' ? [] : left.split(':');
    const tail = right === '' ? [] : right.split(':');
    const missing = 8 - head.length - tail.length;
    if (missing < 1) return null;
    groups = [...head, ...Array<string>(missing).fill('0'), ...tail];
  }

  if (groups.length !== 8 || groups.some((group) => !/^[0-9a-f]{1,4}$/.test(group))) return null;
  return groups.map((group) => parseInt(group, 16));
}

function isPrivateIPv6(ip: string): boolean {
  const groups = expandIPv6(ip);
  if (!groups) return false;
  const first = groups[0] ?? 0;

  const isLoopback = groups.slice(0, 7).every((group) => group === 0) && groups[7] === 1;
  const isUniqueLocal = (first & 0xfe00) === 0xfc00; // fc00::/7
  const isLinkLocal = (first & 0xffc0) === 0xfe80; // fe80::/10

  const isMappedIPv4 = groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff;
  if (isMappedIPv4) {
    const high = groups[6] ?? 0;
    const low = groups[7] ?? 0;
    return isPrivateIPv4([high >> 8, high & 0xff, low >> 8, low & 0xff].join('.'));
  }

  return isLoopback || isUniqueLocal || isLinkLocal;
}
