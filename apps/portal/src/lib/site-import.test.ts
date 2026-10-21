import { describe, expect, it } from "vitest";
import {
  disallowedPaths,
  htmlToText,
  isPrivateAddress,
  normalizeSiteUrl,
  pickLinks,
} from "./site-import";

describe("normalizeSiteUrl", () => {
  it("accepts public web addresses and adds https", () => {
    expect(normalizeSiteUrl("brightsmile.com")?.toString()).toBe("https://brightsmile.com/");
    expect(normalizeSiteUrl("http://www.brightsmile.com/about#team")?.toString()).toBe(
      "http://www.brightsmile.com/about",
    );
  });

  it("refuses internal, numeric, odd-port and non-web addresses", () => {
    for (const bad of [
      "localhost",
      "http://127.0.0.1",
      "http://[::1]/",
      "http://10.0.0.5",
      "intranet.corp",
      "https://site.com:8080",
      "ftp://site.com",
      "javascript:alert(1)",
      "https://user:pass@site.com",
      "service.internal",
    ]) {
      expect(normalizeSiteUrl(bad), bad).toBeNull();
    }
  });
});

describe("isPrivateAddress", () => {
  it("blocks private, loopback, link-local, metadata and mapped addresses", () => {
    for (const ip of [
      "10.1.2.3",
      "127.0.0.1",
      "169.254.169.254",
      "172.16.0.1",
      "192.168.1.1",
      "100.64.0.1",
      "0.0.0.0",
      "::1",
      "fd00::1",
      "fe80::1",
      "::ffff:10.0.0.1",
    ]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
    expect(isPrivateAddress("93.184.216.34")).toBe(false);
    expect(isPrivateAddress("2606:4700::1111")).toBe(false);
  });
});

describe("reading pages", () => {
  it("keeps visible text only", () => {
    const text = htmlToText(
      "<html><style>p{}</style><script>alert(1)</script><h1>Bright Smile</h1><p>Open Mon&nbsp;9&ndash;5 &amp; Sat</p></html>",
    );
    expect(text).toContain("Bright Smile");
    expect(text).toContain("Open Mon 9");
    expect(text).not.toContain("alert");
  });

  it("picks useful same-site links first and skips files and other sites", () => {
    const base = new URL("https://brightsmile.com/");
    const links = pickLinks(
      '<a href="/blog/post">Blog</a><a href="/prices">Our prices</a><a href="https://other.com/contact">x</a><a href="/files/menu.pdf">PDF</a><a href="/contact?x=1">Contact</a>',
      base,
    );
    expect(links.slice(0, 2)).toEqual([
      "https://brightsmile.com/prices",
      "https://brightsmile.com/contact",
    ]);
    expect(links).not.toContain("https://other.com/contact");
    expect(links.some((l) => l.endsWith(".pdf"))).toBe(false);
  });

  it("reads robots.txt rules for every crawler", () => {
    expect(
      disallowedPaths(
        "User-agent: Googlebot\nDisallow: /x\n\nUser-agent: *\nDisallow: /private\nDisallow:\n",
      ),
    ).toEqual(["/private"]);
  });
});
