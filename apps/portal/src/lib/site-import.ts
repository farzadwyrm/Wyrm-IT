import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Reads a business's public website (at most 10 pages) so the AI can draft facts for the owner
 * to confirm. Server only. Guards: public http(s) hosts only, no private or internal addresses
 * (checked again after every redirect), robots.txt respected, size and time limits.
 */

export const MAX_PAGES = 10;
const MAX_BYTES = 400_000;
const TIMEOUT_MS = 8_000;
const AGENT = "WyrmAI-SiteImport/1.0 (+https://wyrm-portal.vercel.app)";

/** The site's home page as an https/http URL, or null if it isn't a public web address. */
export function normalizeSiteUrl(input: string): URL | null {
  const raw = input.trim();
  if (!raw || raw.length > 300) return null;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;
  if (url.port && url.port !== "80" && url.port !== "443") return null;
  const host = url.hostname.toLowerCase();
  if (isIP(host.replace(/^\[|\]$/g, "")) || !host.includes(".")) return null;
  if (/(^|\.)(localhost|local|internal|intranet|lan|home|corp|test|example|invalid)$/.test(host))
    return null;
  url.hash = "";
  return url;
}

/** Private, loopback, link-local, CGNAT, metadata and other non-public addresses. */
export function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a = 0, b = 0] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  const v6 = ip.toLowerCase();
  if (v6 === "::" || v6 === "::1") return true;
  if (
    v6.startsWith("fc") ||
    v6.startsWith("fd") ||
    v6.startsWith("fe8") ||
    v6.startsWith("fe9") ||
    v6.startsWith("fea") ||
    v6.startsWith("feb")
  )
    return true;
  const mapped = v6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return mapped ? isPrivateAddress(mapped[1] as string) : false;
}

async function assertPublicHost(host: string) {
  const addresses = await lookup(host, { all: true });
  if (addresses.length === 0 || addresses.some((a) => isPrivateAddress(a.address)))
    throw new Error("not_public");
}

/** Visible text of an HTML page: no scripts, styles, tags or repeated whitespace. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|li|h[1-6]|tr|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim()
    .slice(0, 12_000);
}

const USEFUL =
  /(about|contact|service|treatment|price|pricing|fees|hours|opening|faq|question|team|visit|location|book|menu)/i;

/** Same-site links worth reading, most useful first. */
export function pickLinks(html: string, base: URL, limit = MAX_PAGES - 1): string[] {
  const found = new Map<string, number>();
  for (const m of html.matchAll(/<a\s[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    let url: URL;
    try {
      url = new URL(m[1] as string, base);
    } catch {
      continue;
    }
    if (url.hostname !== base.hostname || !/^https?:$/.test(url.protocol)) continue;
    if (/\.(pdf|jpe?g|png|gif|webp|svg|zip|mp4|mp3|docx?|xlsx?)$/i.test(url.pathname)) continue;
    url.hash = "";
    url.search = "";
    const key = url.toString();
    if (key === base.toString()) continue;
    const score = (USEFUL.test(url.pathname) ? 2 : 0) + (USEFUL.test(m[2] ?? "") ? 1 : 0);
    found.set(key, Math.max(found.get(key) ?? 0, score));
  }
  return [...found.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([u]) => u);
}

/** Paths robots.txt forbids for every crawler ("User-agent: *"). */
export function disallowedPaths(robots: string): string[] {
  const out: string[] = [];
  let applies = false;
  for (const line of robots.split(/\r?\n/)) {
    const [rawKey, ...rest] = line.split(":");
    const key = rawKey?.trim().toLowerCase();
    const value = rest.join(":").trim();
    if (key === "user-agent") applies = value === "*";
    else if (applies && key === "disallow" && value) out.push(value);
  }
  return out;
}

const allowed = (path: string, rules: string[]) => !rules.some((r) => path.startsWith(r));

async function fetchLimited(url: URL, accept: string): Promise<{ text: string; url: URL } | null> {
  let current = url;
  for (let hop = 0; hop < 4; hop++) {
    await assertPublicHost(current.hostname);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(current, {
        redirect: "manual",
        signal: controller.signal,
        headers: { "User-Agent": AGENT, Accept: accept },
      });
      if (res.status >= 300 && res.status < 400) {
        const next = res.headers.get("location");
        const target = next ? normalizeSiteUrl(new URL(next, current).toString()) : null;
        if (!target) return null;
        current = target;
        continue;
      }
      if (!res.ok || !res.body) return null;
      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done || !value) break;
        size += value.length;
        if (size > MAX_BYTES) {
          await reader.cancel();
          break;
        }
        chunks.push(value);
      }
      return { text: new TextDecoder().decode(Buffer.concat(chunks)), url: current };
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

export interface ImportedSite {
  url: string;
  pages: { url: string; text: string }[];
  blockedByRobots: boolean;
}

/** Reads the home page and up to 9 useful pages of the same site. */
export async function readSite(input: string): Promise<ImportedSite> {
  const home = normalizeSiteUrl(input);
  if (!home) throw new Error("bad_url");
  const robots = await fetchLimited(new URL("/robots.txt", home), "text/plain").catch(() => null);
  const rules = robots ? disallowedPaths(robots.text) : [];
  if (!allowed(home.pathname, rules))
    return { url: home.toString(), pages: [], blockedByRobots: true };
  const first = await fetchLimited(home, "text/html");
  if (!first) throw new Error("unreachable");
  const pages = [{ url: first.url.toString(), text: htmlToText(first.text) }];
  for (const link of pickLinks(first.text, first.url)) {
    if (pages.length >= MAX_PAGES) break;
    const url = new URL(link);
    if (!allowed(url.pathname, rules)) continue;
    const page = await fetchLimited(url, "text/html").catch(() => null);
    if (page) pages.push({ url: page.url.toString(), text: htmlToText(page.text) });
  }
  return { url: home.toString(), pages, blockedByRobots: false };
}
