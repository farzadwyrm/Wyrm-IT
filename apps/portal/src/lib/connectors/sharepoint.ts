import "server-only";
import {
  DocumentError,
  documentType,
  extractText,
  isSupported,
  MAX_FILE_BYTES,
} from "../documents";
import { ConnectorError } from "./sql";

/**
 * SharePoint and OneDrive through Microsoft Graph, read only. A manager signs in with Microsoft
 * and grants read access (Sites.Read.All, Files.Read.All: no write scopes are requested); Wyrm
 * keeps the refresh token encrypted, the manager picks one document library (and optional
 * folder), and "Sync now" copies the text of new or changed files into the agent's documents.
 * Switched off until MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET are set.
 */

const LOGIN = "https://login.microsoftonline.com/organizations/oauth2/v2.0";
const GRAPH = "https://graph.microsoft.com/v1.0";
export const MICROSOFT_SCOPES =
  "offline_access openid email User.Read Sites.Read.All Files.Read.All";

export function microsoftConfig() {
  const clientId = process.env.MICROSOFT_CLIENT_ID?.trim();
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export const microsoftRedirect = (host: string) =>
  `https://${host}/api/connections/microsoft/callback`;

export function authorizeUrl(clientId: string, host: string, state: string) {
  const url = new URL(`${LOGIN}/authorize`);
  url.search = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: microsoftRedirect(host),
    response_mode: "query",
    scope: MICROSOFT_SCOPES,
    state,
    prompt: "select_account",
  }).toString();
  return url;
}

/** Any granted scope that could change data (we never ask for one, but check what came back). */
export function writeScopes(scope: string) {
  return scope.split(/\s+/).filter((s) => /write|manage|fullcontrol/i.test(s));
}

async function token(body: Record<string, string>) {
  const config = microsoftConfig();
  if (!config) throw new ConnectorError("Microsoft sign-in isn't switched on yet.");
  const res = await fetch(`${LOGIN}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      scope: MICROSOFT_SCOPES,
      ...body,
    }),
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  if (!res?.ok) throw new ConnectorError("Microsoft didn't accept the sign-in. Sign in again.");
  return (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    scope?: string;
    id_token?: string;
  };
}

export const exchangeCode = (code: string, host: string) =>
  token({ grant_type: "authorization_code", code, redirect_uri: microsoftRedirect(host) });

export const refreshAccess = (refreshToken: string) =>
  token({ grant_type: "refresh_token", refresh_token: refreshToken });

async function graph<T>(accessToken: string, path: string): Promise<T> {
  const res = await fetch(path.startsWith("https://") ? path : `${GRAPH}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10000),
  }).catch(() => null);
  if (!res) throw new ConnectorError("Microsoft didn't answer.");
  if (res.status === 401) throw new ConnectorError("The Microsoft sign-in expired. Sign in again.");
  if (res.status === 403) throw new ConnectorError("The account can't read that library.");
  if (res.status === 404) throw new ConnectorError("That library or folder wasn't found.");
  if (!res.ok) throw new ConnectorError("Microsoft returned an error.");
  return res.json() as Promise<T>;
}

export interface Library {
  siteId: string;
  siteName: string;
  driveId: string;
  driveName: string;
}

/** Document libraries the signed-in account can read (first 15 sites, plus their OneDrive). */
export async function listLibraries(accessToken: string): Promise<Library[]> {
  const sites = await graph<{ value: { id: string; displayName?: string; name?: string }[] }>(
    accessToken,
    "/sites?search=*&$top=15&$select=id,displayName,name",
  );
  const out: Library[] = [];
  for (const site of sites.value.slice(0, 15)) {
    const drives = await graph<{ value: { id: string; name: string; driveType: string }[] }>(
      accessToken,
      `/sites/${encodeURIComponent(site.id)}/drives?$select=id,name,driveType`,
    ).catch(() => ({ value: [] }));
    for (const d of drives.value.filter((x) => x.driveType === "documentLibrary"))
      out.push({
        siteId: site.id,
        siteName: (site.displayName ?? site.name ?? "Site").slice(0, 120),
        driveId: d.id,
        driveName: d.name.slice(0, 120),
      });
  }
  const mine = await graph<{ id: string; name: string }>(
    accessToken,
    "/me/drive?$select=id,name",
  ).catch(() => null);
  if (mine)
    out.push({ siteId: "me", siteName: "My OneDrive", driveId: mine.id, driveName: mine.name });
  return out.slice(0, 60);
}

export interface RemoteFile {
  id: string;
  path: string;
  modified: Date;
  size: number;
  mime: string;
}

interface DriveItem {
  id: string;
  name: string;
  size?: number;
  lastModifiedDateTime: string;
  file?: { mimeType?: string };
  folder?: { childCount: number };
}

/** Supported files in the library (or folder), up to 3 folders deep and 300 files. */
export async function listFiles(
  accessToken: string,
  driveId: string,
  folderPath: string,
): Promise<{ files: RemoteFile[]; complete: boolean }> {
  const root = folderPath.trim().replace(/^\/+|\/+$/g, "");
  const start = root
    ? `/drives/${encodeURIComponent(driveId)}/root:/${root.split("/").map(encodeURIComponent).join("/")}:/children`
    : `/drives/${encodeURIComponent(driveId)}/root/children`;
  const queue: { url: string; prefix: string; depth: number }[] = [
    {
      url: `${start}?$top=200&$select=id,name,size,lastModifiedDateTime,file,folder`,
      prefix: root,
      depth: 0,
    },
  ];
  const files: RemoteFile[] = [];
  let complete = true;
  let requests = 0;
  while (queue.length) {
    const next = queue.shift() as (typeof queue)[number];
    if (++requests > 40) {
      complete = false;
      break;
    }
    const page = await graph<{ value: DriveItem[]; "@odata.nextLink"?: string }>(
      accessToken,
      next.url,
    );
    if (page["@odata.nextLink"]) queue.push({ ...next, url: page["@odata.nextLink"] });
    for (const item of page.value) {
      const path = next.prefix ? `${next.prefix}/${item.name}` : item.name;
      if (item.folder) {
        if (next.depth < 3)
          queue.push({
            url: `/drives/${encodeURIComponent(driveId)}/items/${item.id}/children?$top=200&$select=id,name,size,lastModifiedDateTime,file,folder`,
            prefix: path,
            depth: next.depth + 1,
          });
        else complete = false;
        continue;
      }
      const mime = documentType(item.name, item.file?.mimeType ?? "");
      if (!item.file || !isSupported(mime) || mime === "" || (item.size ?? 0) > MAX_FILE_BYTES)
        continue;
      files.push({
        id: item.id,
        path: path.slice(0, 200),
        modified: new Date(item.lastModifiedDateTime),
        size: item.size ?? 0,
        mime,
      });
      if (files.length >= 300) return { files, complete: false };
    }
  }
  return { files, complete };
}

export async function readFile(accessToken: string, driveId: string, file: RemoteFile) {
  const res = await fetch(
    `${GRAPH}/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(file.id)}/content`,
    { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(15000) },
  ).catch(() => null);
  if (!res?.ok) throw new DocumentError("drive_denied");
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength > MAX_FILE_BYTES) throw new DocumentError("too_big");
  return extractText(bytes, file.mime);
}
