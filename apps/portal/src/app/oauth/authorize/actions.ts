"use server";

import { createAuthCode, DomainError } from "@wyrm/core";
import { redirect } from "next/navigation";
import { getAccess } from "@/lib/auth";
import { serverDb } from "@/lib/db";
import { portalBase } from "@/lib/mcp";
import { backToApp, parseAuthRequest } from "./request";

/** The signed-in member allows (or refuses) an AI app for one of their organisations. */
export async function authorizeAction(form: FormData) {
  const params = Object.fromEntries(
    [
      "client_id",
      "redirect_uri",
      "state",
      "code_challenge",
      "code_challenge_method",
      "resource",
    ].map((k) => [k, String(form.get(k) ?? "")]),
  );
  const parsed = await parseAuthRequest({ ...params, response_type: "code" });
  if (!parsed.ok) redirect(`/oauth/authorize?problem=${encodeURIComponent(parsed.problem)}`);
  const { request } = parsed;
  const iss = await portalBase();
  if (form.get("decision") !== "allow")
    redirect(backToApp(request.redirectUri, { error: "access_denied", state: request.state, iss }));

  const access = await getAccess();
  const db = serverDb();
  const tenantId = String(form.get("tenantId") ?? "");
  // Only an organisation this login actually belongs to.
  const membership = access?.tenants.find((t) => t.tenantId === tenantId);
  if (!access || !db || !membership)
    redirect(backToApp(request.redirectUri, { error: "access_denied", state: request.state, iss }));

  let code = "";
  try {
    code = await createAuthCode(db, {
      clientId: request.clientId,
      userId: access.userId,
      tenantId,
      redirectUri: request.redirectUri,
      codeChallenge: request.codeChallenge,
      resource: request.resource,
    });
  } catch (e) {
    const reason = e instanceof DomainError ? e.code : "server_error";
    redirect(
      backToApp(request.redirectUri, {
        error: reason === "access_denied" ? "access_denied" : "server_error",
        state: request.state,
        iss,
      }),
    );
  }
  redirect(backToApp(request.redirectUri, { code, state: request.state, iss }));
}
