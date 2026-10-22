import "server-only";
import type { CheckResult } from "./sql";
import { ConnectorError } from "./sql";

/**
 * HubSpot CRM, read only. The client creates a private app in HubSpot with read scopes only
 * (for example crm.objects.contacts.read) and pastes its access token. Wyrm asks HubSpot which
 * scopes the token has and refuses it if any can write.
 */

const API = "https://api.hubapi.com";

const PROPERTIES: Record<string, string[]> = {
  contacts: [
    "firstname",
    "lastname",
    "email",
    "phone",
    "company",
    "jobtitle",
    "lifecyclestage",
    "hs_lead_status",
  ],
  companies: ["name", "domain", "phone", "city", "country", "industry", "lifecyclestage"],
  deals: ["dealname", "amount", "dealstage", "pipeline", "closedate", "hs_lastmodifieddate"],
  tickets: [
    "subject",
    "hs_pipeline_stage",
    "hs_ticket_priority",
    "createdate",
    "hs_lastmodifieddate",
  ],
};

async function call(path: string, token: string, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    redirect: "error",
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  if (!res) throw new ConnectorError("HubSpot didn't answer.");
  if (res.status === 401) throw new ConnectorError("HubSpot refused the token.");
  if (res.status === 403)
    throw new ConnectorError("The token doesn't have the read scope this needs.");
  if (res.status === 429) throw new ConnectorError("HubSpot is rate limiting. Try again shortly.");
  if (!res.ok) throw new ConnectorError("HubSpot returned an error.");
  return res.json() as Promise<Record<string, unknown>>;
}

/** Only scopes that end in ".read" (plus the basic "oauth") are allowed. */
export function writeScopes(scopes: string[]) {
  return scopes.filter((s) => s !== "oauth" && !s.endsWith(".read"));
}

export async function checkHubspot(token: string): Promise<CheckResult> {
  try {
    const info = await call("/oauth/v2/private-apps/get/access-token-info", token, {
      method: "POST",
      body: JSON.stringify({ tokenKey: token }),
    });
    const scopes = Array.isArray(info.scopes) ? info.scopes.map(String) : [];
    if (!scopes.length)
      return {
        ok: false,
        note: "",
        error: "Couldn't confirm the token's scopes. Use a private app access token.",
      };
    const writes = writeScopes(scopes);
    if (writes.length)
      return {
        ok: false,
        note: "",
        error: `This token can change data (${writes.slice(0, 4).join(", ")}). Create a private app with read scopes only.`,
      };
    return {
      ok: true,
      note: `Read-only token: ${scopes.length} read scope(s) (${scopes.slice(0, 4).join(", ")}).`,
    };
  } catch (e) {
    return {
      ok: false,
      note: "",
      error: e instanceof ConnectorError ? e.message : "HubSpot check failed.",
    };
  }
}

/** Searches one CRM object type by words (HubSpot's own search), returning at most 10 records. */
export async function searchHubspot(token: string, object: string, words: string) {
  const properties = PROPERTIES[object];
  if (!properties) throw new ConnectorError("Unknown HubSpot object.");
  const data = await call(`/crm/v3/objects/${object}/search`, token, {
    method: "POST",
    body: JSON.stringify({ query: words.slice(0, 200), limit: 10, properties }),
  });
  const results = Array.isArray(data.results) ? data.results : [];
  return results.map((r) => {
    const props = ((r as { properties?: Record<string, unknown> }).properties ?? {}) as Record<
      string,
      unknown
    >;
    const row: Record<string, unknown> = {};
    for (const p of properties)
      if (props[p] !== null && props[p] !== undefined && props[p] !== "") row[p] = props[p];
    return row;
  });
}
