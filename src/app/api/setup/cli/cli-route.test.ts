/**
 * Covers the two things `GET /api/setup/cli` decides on its own: which origin
 * it bakes into the script it hands back, and when it refuses to bake one at
 * all. Everything else the returned script does is the two installer routes'
 * behavior, covered by `../setup-routes.test.ts`.
 */
import { describe, expect, it } from "vitest";

import { GET } from "./route";

function request(
  headers: Record<string, string> = {},
  query = "",
): Request {
  return new Request(`http://127.0.0.1:3000/api/setup/cli${query}`, {
    headers,
  });
}

async function body(headers?: Record<string, string>): Promise<string> {
  const response = await GET(request(headers));
  return response.text();
}

async function windowsBody(): Promise<string> {
  const response = await GET(request({}, "?os=windows"));
  return response.text();
}

describe("GET /api/setup/cli", () => {
  it("serves the script as a shell script", async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "text/x-shellscript; charset=utf-8",
    );
  });

  it("leaves no unsubstituted placeholder in the rendered script", async () => {
    expect(await body()).not.toContain("{{");
  });

  it("bakes in the request's own origin when no proxy headers are present", async () => {
    expect(await body()).toContain('ORIGIN="http://127.0.0.1:3000"');
  });

  it("prefers the Host header over the internal request URL", async () => {
    const script = await body({ host: "vps.example.com:3300" });
    expect(script).toContain('ORIGIN="http://vps.example.com:3300"');
  });

  it("honors X-Forwarded-Proto and X-Forwarded-Host behind a TLS proxy", async () => {
    const script = await body({
      host: "127.0.0.1:3000",
      "x-forwarded-proto": "https",
      "x-forwarded-host": "setting.example.com",
    });
    expect(script).toContain('ORIGIN="https://setting.example.com"');
  });

  it("uses the first entry of a forwarded header chain", async () => {
    const script = await body({
      "x-forwarded-proto": "https,http",
      "x-forwarded-host": "setting.example.com, internal.lan",
    });
    expect(script).toContain('ORIGIN="https://setting.example.com"');
  });

  it("calls the installer routes it was rendered for", async () => {
    const script = await body();
    expect(script).toContain("/api/setup/claudecode");
    expect(script).toContain("/api/setup/codex");
  });

  it("rejects a host that could inject shell syntax into the script", async () => {
    const response = await GET(request({ host: 'example.com"; rm -rf /; #' }));
    expect(response.status).toBe(400);
    expect(await response.text()).toContain("host");
  });

  it("rejects a forwarded protocol that is not http or https", async () => {
    const response = await GET(
      request({ host: "example.com", "x-forwarded-proto": "javascript" }),
    );
    expect(response.status).toBe(400);
  });

  describe("?os=windows", () => {
    it("serves the PowerShell script as plain text", async () => {
      const response = await GET(request({}, "?os=windows"));
      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe(
        "text/plain; charset=utf-8",
      );
    });

    it("serves the PowerShell prompt loop, not the POSIX one", async () => {
      const script = await windowsBody();
      expect(script).toContain("$ErrorActionPreference");
      expect(script).not.toContain("#!/bin/sh");
    });

    it("bakes the origin into the PowerShell script too", async () => {
      const script = await windowsBody();
      expect(script).toContain('$ORIGIN = "http://127.0.0.1:3000"');
      expect(script).not.toContain("{{");
    });

    it("asks the installer routes for their Windows scripts", async () => {
      const script = await windowsBody();
      expect(script).toContain('os       = "windows"');
      expect(script).toContain('os            = "windows"');
    });
  });
});
