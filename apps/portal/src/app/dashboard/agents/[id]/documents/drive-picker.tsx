"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { importDriveAction } from "./actions";

/* Minimal shapes of the Google scripts this uses (loaded on click, not on page load). */
interface TokenResponse {
  access_token?: string;
  error?: string;
}
interface GoogleApis {
  accounts: {
    oauth2: {
      initTokenClient(config: {
        client_id: string;
        scope: string;
        callback: (r: TokenResponse) => void;
        error_callback?: () => void;
      }): { requestAccessToken(options?: { prompt?: string }): void };
    };
  };
  picker: {
    PickerBuilder: new () => PickerBuilder;
    DocsView: new () => {
      setMimeTypes(types: string): unknown;
      setIncludeFolders(v: boolean): unknown;
    };
    Feature: { MULTISELECT_ENABLED: string };
    Action: { PICKED: string; CANCEL: string };
  };
}
interface PickerBuilder {
  addView(view: unknown): PickerBuilder;
  enableFeature(feature: string): PickerBuilder;
  setOAuthToken(token: string): PickerBuilder;
  setDeveloperKey(key: string): PickerBuilder;
  setAppId(id: string): PickerBuilder;
  setTitle(title: string): PickerBuilder;
  setCallback(cb: (data: { action: string; docs?: { id: string }[] }) => void): PickerBuilder;
  build(): { setVisible(v: boolean): void };
}
declare global {
  interface Window {
    google?: GoogleApis;
    gapi?: { load(name: string, cb: () => void): void };
  }
}

const MIME_TYPES = [
  "application/vnd.google-apps.document",
  "application/vnd.google-apps.spreadsheet",
  "application/vnd.google-apps.presentation",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
  "text/csv",
].join(",");

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("script"));
    document.head.appendChild(s);
  });
}

/**
 * "Choose from Google Drive": Google's own sign-in popup asks for access to the files the person
 * picks (scope drive.file, nothing else), then Google's file picker opens. The short-lived token
 * goes to the server once to download those files and is not kept.
 */
export function DrivePicker({
  agentId,
  clientId,
  apiKey,
}: {
  agentId: string;
  clientId: string;
  apiKey: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function open() {
    setBusy(true);
    setStatus(null);
    try {
      await Promise.all([
        loadScript("https://accounts.google.com/gsi/client"),
        loadScript("https://apis.google.com/js/api.js"),
      ]);
      await new Promise<void>((resolve) => window.gapi?.load("picker", resolve));
    } catch {
      setBusy(false);
      setStatus("Google Drive couldn't load. Check your connection or ad blocker and try again.");
      return;
    }
    const google = window.google;
    if (!google) {
      setBusy(false);
      return;
    }
    const tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: "https://www.googleapis.com/auth/drive.file",
      error_callback: () => {
        setBusy(false);
        setStatus("Google access wasn't granted.");
      },
      callback: (token) => {
        if (!token.access_token) {
          setBusy(false);
          setStatus("Google access wasn't granted.");
          return;
        }
        const accessToken = token.access_token;
        const view = new google.picker.DocsView();
        view.setMimeTypes(MIME_TYPES);
        view.setIncludeFolders(true);
        new google.picker.PickerBuilder()
          .addView(view)
          .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
          .setOAuthToken(accessToken)
          .setDeveloperKey(apiKey)
          .setAppId(clientId.split("-")[0] ?? "")
          .setTitle("Choose documents for your agent")
          .setCallback(async (data) => {
            if (data.action === google.picker.Action.CANCEL) {
              setBusy(false);
              return;
            }
            if (data.action !== google.picker.Action.PICKED) return;
            const ids = (data.docs ?? []).map((d) => d.id);
            setStatus(`Reading ${ids.length} file${ids.length === 1 ? "" : "s"}…`);
            const result = await importDriveAction(agentId, accessToken, ids);
            setBusy(false);
            setStatus(
              result.error
                ? "That didn't work. You may not have permission to change this agent."
                : `${result.added} added${result.failed.length ? `, ${result.failed.length} couldn't be read (unsupported, too big or empty)` : ""}.`,
            );
            router.refresh();
          })
          .build()
          .setVisible(true);
      },
    });
    tokenClient.requestAccessToken({ prompt: "" });
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={open}
        disabled={busy}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line px-4 font-semibold hover:border-ink-muted disabled:opacity-60"
      >
        {busy ? "Working…" : "Choose from Google Drive"}
      </button>
      {status && (
        <p role="status" className="text-sm text-ink-muted">
          {status}
        </p>
      )}
    </div>
  );
}
