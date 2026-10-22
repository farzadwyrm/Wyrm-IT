import "server-only";
import { htmlToText } from "./site-import";

/**
 * Turns a document into plain text for "Ask your documents": PDF, Word (.docx), text, Markdown,
 * CSV, HTML and JSON from uploads, and Google Docs, Sheets, Slides or files from Google Drive.
 * Nothing is stored except the text (the original file is not kept).
 */

export const MAX_FILE_BYTES = 4 * 1024 * 1024;

export class DocumentError extends Error {}

const TEXT_TYPES = /^(text\/|application\/(json|xml|csv))/;

const EXTENSIONS: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
  md: "text/markdown",
  markdown: "text/markdown",
  csv: "text/csv",
  html: "text/html",
  htm: "text/html",
  json: "application/json",
};

/** The file's type from its name when the browser didn't say (or said something generic). */
export function documentType(name: string, declared: string) {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (declared && declared !== "application/octet-stream") return declared;
  return EXTENSIONS[ext] ?? declared;
}

export function isSupported(type: string) {
  return (
    type === EXTENSIONS.pdf || type === EXTENSIONS.docx || TEXT_TYPES.test(type) || type === ""
  );
}

export async function extractText(bytes: Uint8Array, type: string): Promise<string> {
  if (bytes.byteLength > MAX_FILE_BYTES) throw new DocumentError("too_big");
  if (type === EXTENSIONS.pdf) {
    const { extractText: pdfText, getDocumentProxy } = await import("unpdf");
    try {
      const pdf = await getDocumentProxy(new Uint8Array(bytes));
      const { text } = await pdfText(pdf, { mergePages: true });
      return text;
    } catch {
      throw new DocumentError("unreadable");
    }
  }
  if (type === EXTENSIONS.docx) {
    const mammoth = (await import("mammoth")).default;
    try {
      const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
      return value;
    } catch {
      throw new DocumentError("unreadable");
    }
  }
  if (TEXT_TYPES.test(type) || type === "") {
    const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    if (type === "text/html") return htmlToText(text);
    // A binary file wearing a text name: lots of replacement characters.
    if ((text.match(/�/g)?.length ?? 0) > text.length / 20) throw new DocumentError("unsupported");
    return text;
  }
  throw new DocumentError("unsupported");
}

// ---------------------------------------------------------------------------------------------
// Google Drive (files the user picked with the Google Picker; scope drive.file)

const DRIVE = "https://www.googleapis.com/drive/v3/files";
const EXPORTS: Record<string, string> = {
  "application/vnd.google-apps.document": "text/plain",
  "application/vnd.google-apps.spreadsheet": "text/csv",
  "application/vnd.google-apps.presentation": "text/plain",
};

export const DRIVE_ID = /^[A-Za-z0-9_-]{10,200}$/;

export interface DriveDocument {
  id: string;
  name: string;
  mime: string;
  text: string;
}

async function limitedBytes(res: Response): Promise<Uint8Array> {
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > MAX_FILE_BYTES) throw new DocumentError("too_big");
  const buffer = new Uint8Array(await res.arrayBuffer());
  if (buffer.byteLength > MAX_FILE_BYTES) throw new DocumentError("too_big");
  return buffer;
}

/**
 * Reads one picked file with the user's short-lived access token. The token is used for these
 * requests only: it is never stored or logged.
 */
export async function readDriveFile(accessToken: string, fileId: string): Promise<DriveDocument> {
  if (!DRIVE_ID.test(fileId)) throw new DocumentError("bad_file");
  const headers = { Authorization: `Bearer ${accessToken}` };
  const timeout = () => AbortSignal.timeout(15_000);
  const metaRes = await fetch(
    `${DRIVE}/${fileId}?fields=id,name,mimeType,size&supportsAllDrives=true`,
    { headers, signal: timeout() },
  ).catch(() => null);
  if (!metaRes?.ok) throw new DocumentError(metaRes?.status === 404 ? "bad_file" : "drive_denied");
  const meta = (await metaRes.json()) as {
    id: string;
    name: string;
    mimeType: string;
    size?: string;
  };
  const exportAs = EXPORTS[meta.mimeType];
  if (!exportAs && meta.mimeType.startsWith("application/vnd.google-apps."))
    throw new DocumentError("unsupported");
  if (!exportAs && Number(meta.size ?? 0) > MAX_FILE_BYTES) throw new DocumentError("too_big");
  const type = exportAs ?? documentType(meta.name, meta.mimeType);
  if (!exportAs && !isSupported(type)) throw new DocumentError("unsupported");
  const url = exportAs
    ? `${DRIVE}/${fileId}/export?mimeType=${encodeURIComponent(exportAs)}`
    : `${DRIVE}/${fileId}?alt=media&supportsAllDrives=true`;
  const res = await fetch(url, { headers, signal: timeout() }).catch(() => null);
  if (!res?.ok) throw new DocumentError(res?.status === 403 ? "too_big" : "drive_denied");
  const text = await extractText(await limitedBytes(res), type);
  return { id: meta.id, name: meta.name.slice(0, 200), mime: meta.mimeType, text };
}
