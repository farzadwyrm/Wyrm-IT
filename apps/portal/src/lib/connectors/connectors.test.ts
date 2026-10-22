import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { writeScopes as hubspotWrites } from "./hubspot";
import { signRequest } from "./search-api";
import { writeScopes as microsoftWrites } from "./sharepoint";
import { explainSqlError } from "./sql";

describe("read-only checks", () => {
  it("accepts only HubSpot read scopes", () => {
    expect(hubspotWrites(["oauth", "crm.objects.contacts.read"])).toEqual([]);
    expect(
      hubspotWrites(["crm.objects.contacts.read", "crm.objects.contacts.write", "tickets"]),
    ).toEqual(["crm.objects.contacts.write", "tickets"]);
  });

  it("spots Microsoft write permissions", () => {
    expect(microsoftWrites("openid email Files.Read.All Sites.Read.All User.Read")).toEqual([]);
    expect(microsoftWrites("Files.ReadWrite.All Sites.Manage.All")).toEqual([
      "Files.ReadWrite.All",
      "Sites.Manage.All",
    ]);
  });
});

describe("search API signature", () => {
  it("signs timestamp and body with HMAC-SHA256", () => {
    const body = '{"question":"Where is order A-1?"}';
    expect(signRequest("fictional-shared-secret", "1700000000", body)).toBe(
      `sha256=${createHmac("sha256", "fictional-shared-secret").update(`1700000000.${body}`).digest("hex")}`,
    );
  });
});

describe("explainSqlError", () => {
  it("gives short messages and never echoes the driver text", () => {
    const leaky = new Error('password authentication failed for user "wyrm" secret=hunter2');
    expect(explainSqlError(leaky)).toBe("The user name or password was refused.");
    expect(explainSqlError(Object.assign(new Error("x"), { code: "ENOTFOUND" }))).toBe(
      "The host name wasn't found.",
    );
    expect(explainSqlError(new Error("something odd"))).toBe("The database returned an error.");
  });
});
