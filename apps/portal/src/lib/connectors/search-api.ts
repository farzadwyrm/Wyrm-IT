import "server-only";
import { createHmac } from "node:crypto";
import { assertPublicHost } from "../site-import";
import { type CheckResult, ConnectorError } from "./sql";

/**
 * The client's own search API: for systems Wyrm doesn't connect to directly, or data that must
 * stay on the client's servers. Wyrm POSTs the question and who is asking; their service
 * searches with that person's permissions and returns passages. Requests are signed so the
 * client can check they come from Wyrm. Contract: docs/plans/ask-your-documents.md.
 *
 *   POST <url>   { "question": "...", "user": "staff@client.example", "limit": 4 }
 *   headers      X-Wyrm-Timestamp: <unix seconds>
 *                X-Wyrm-Signature: sha256=<hex HMAC-SHA256(secret, timestamp + "." + body)>
 *   200 reply    { "results": [{ "title": "...", "text": "...", "url": "https://..." }] }
 */

const MAX_BYTES = 200_000;

export function signRequest(secret: string, timestamp: string, body: string) {
  return `sha256=${createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`;
}

export async function querySearchApi(
  url: string,
  secret: string,
  question: string,
  user: string | null,
): Promise<{ title: string; text: string; url: string | null }[]> {
  const target = new URL(url);
  if (target.protocol !== "https:") throw new ConnectorError("The search API must use https://.");
  await assertPublicHost(target.hostname).catch(() => {
    throw new ConnectorError("The search API isn't on a public address.");
  });
  const body = JSON.stringify({ question: question.slice(0, 1000), user, limit: 4 });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const res = await fetch(target, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "WyrmAgent/1.0",
      "X-Wyrm-Timestamp": timestamp,
      "X-Wyrm-Signature": signRequest(secret, timestamp, body),
    },
    body,
    redirect: "error",
    signal: AbortSignal.timeout(6000),
  }).catch(() => null);
  if (!res) throw new ConnectorError("The search API didn't answer within 6 seconds.");
  if (res.status === 401 || res.status === 403)
    throw new ConnectorError("The search API refused Wyrm's signature.");
  if (!res.ok) throw new ConnectorError(`The search API returned ${res.status}.`);
  const text = await res.text();
  if (text.length > MAX_BYTES) throw new ConnectorError("The search API's reply is too large.");
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ConnectorError("The search API didn't return JSON.");
  }
  const results = (data as { results?: unknown }).results;
  if (!Array.isArray(results)) throw new ConnectorError('The reply needs a "results" list.');
  return results.slice(0, 4).flatMap((r) => {
    const o = (r ?? {}) as Record<string, unknown>;
    const title = typeof o.title === "string" ? o.title.slice(0, 150) : "Result";
    const passage = typeof o.text === "string" ? o.text.slice(0, 1800) : "";
    const link =
      typeof o.url === "string" && /^https:\/\//.test(o.url) ? o.url.slice(0, 500) : null;
    return passage.trim() ? [{ title, text: passage, url: link }] : [];
  });
}

export async function checkSearchApi(url: string, secret: string): Promise<CheckResult> {
  try {
    const results = await querySearchApi(url, secret, "Wyrm connection test", null);
    return {
      ok: true,
      note: `Search API answered (${results.length} result(s) for a test question).`,
    };
  } catch (e) {
    return {
      ok: false,
      note: "",
      error: e instanceof ConnectorError ? e.message : "The search API check failed.",
    };
  }
}
