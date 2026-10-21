import { describe, expect, it } from "vitest";
import { describeDbUrl, normalizeDbUrl } from "./client";

const HOST = "@aws-1-eu-central-1.pooler.example.com:6543/postgres";

describe("normalizeDbUrl", () => {
  it("encodes passwords with symbols so the URL parses", () => {
    const url = normalizeDbUrl(`postgresql://postgres.ref:pa#ss/w?rd@x${HOST}`);
    const parsed = new URL(url);
    expect(decodeURIComponent(parsed.password)).toBe("pa#ss/w?rd@x");
    expect(parsed.port).toBe("6543");
  });

  it("leaves already-encoded passwords unchanged", () => {
    const url = `postgresql://postgres.ref:pa%23ss${HOST}`;
    expect(normalizeDbUrl(url)).toBe(url);
  });

  it("trims spaces and wrapping quotes", () => {
    expect(normalizeDbUrl(` "postgresql://postgres.ref:abc123${HOST}"\n`)).toBe(
      `postgresql://postgres.ref:abc123${HOST}`,
    );
  });
});

describe("describeDbUrl", () => {
  it("never includes the password", () => {
    const text = describeDbUrl(`postgresql://postgres.ref:Secret#1${HOST}`);
    expect(text).not.toContain("Secret");
    expect(text).toContain("***@aws-1-eu-central-1.pooler.example.com:6543/postgres");
  });
});
