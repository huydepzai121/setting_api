import { describe, expect, it } from "vitest";

import { GET as claudeCodeGet } from "./claudecode/route";
import { GET as codexGet } from "./codex/route";

const ORIGIN = "http://localhost";

function claudeCodeUrl(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) search.set(k, v);
  }
  return `${ORIGIN}/api/setup/claudecode?${search.toString()}`;
}

function codexUrl(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) search.set(k, v);
  }
  return `${ORIGIN}/api/setup/codex?${search.toString()}`;
}

const VALID_CLAUDE_CODE_PARAMS = {
  key: "sk-ant_api03.abc-123:xyz",
  base_url: "https://api.example.com",
  haiku: "claude-haiku-4-6",
  sonnet: "claude-sonnet-4-6",
  opus: "claude-opus-4-6",
  subagent: "claude-sonnet-4-6",
};

const VALID_CODEX_PARAMS = {
  key: "sk-ant_api03.abc-123:xyz",
  base_url: "https://api.example.com",
  small: "gpt-5-small",
  medium: "gpt-5-medium",
  large: "gpt-5-large",
  provider_id: "example",
  provider_name: "Example",
};

/**
 * Substrings that only ever appear inside a rendered script body (POSIX or
 * PowerShell), never inside a plain-text validation error. Used to assert a
 * 400 response carries no partially rendered script (spec: "Invalid key
 * rejected by the route" / tasks.md 7.4).
 */
const SCRIPT_MARKERS = [
  "#!/bin/sh",
  "$ErrorActionPreference",
  "ENDPOINT_URL",
  "API_KEY=",
];

function assertNoScriptContent(body: string): void {
  for (const marker of SCRIPT_MARKERS) {
    expect(body).not.toContain(marker);
  }
}

describe("GET /api/setup/claudecode", () => {
  it("returns a POSIX shell script with the POSIX content type when os is absent", async () => {
    const res = await claudeCodeGet(
      new Request(claudeCodeUrl(VALID_CLAUDE_CODE_PARAMS)),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe(
      "text/x-shellscript; charset=utf-8",
    );
    const body = await res.text();
    expect(body).toContain("#!/bin/sh");
    expect(body).toContain("https://api.example.com");
    expect(body).toContain("claude-haiku-4-6");
    expect(body).toContain("claude-sonnet-4-6");
    expect(body).toContain("claude-opus-4-6");
    expect(body).not.toMatch(/\{\{[A-Z_]+\}\}/);
  });

  it("returns a POSIX shell script for os=linux", async () => {
    const res = await claudeCodeGet(
      new Request(claudeCodeUrl({ ...VALID_CLAUDE_CODE_PARAMS, os: "linux" })),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe(
      "text/x-shellscript; charset=utf-8",
    );
  });

  it("returns a PowerShell script with the Windows content type for os=windows", async () => {
    const res = await claudeCodeGet(
      new Request(
        claudeCodeUrl({ ...VALID_CLAUDE_CODE_PARAMS, os: "windows" }),
      ),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
    const body = await res.text();
    expect(body).toContain("$ErrorActionPreference");
  });

  it("selects the Windows script case-insensitively for os=WIN", async () => {
    const res = await claudeCodeGet(
      new Request(claudeCodeUrl({ ...VALID_CLAUDE_CODE_PARAMS, os: "WIN" })),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
  });

  it("rejects a key containing a space with 400 and no script content", async () => {
    const res = await claudeCodeGet(
      new Request(
        claudeCodeUrl({ ...VALID_CLAUDE_CODE_PARAMS, key: "has a space" }),
      ),
    );
    expect(res.status).toBe(400);
    expect(res.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
    const body = await res.text();
    expect(body).toContain("key");
    expect(body).not.toContain("has a space");
    assertNoScriptContent(body);
  });

  it("rejects a missing base_url with 400 naming the base_url field", async () => {
    const params = { ...VALID_CLAUDE_CODE_PARAMS } as Record<
      string,
      string | undefined
    >;
    delete params.base_url;
    const res = await claudeCodeGet(new Request(claudeCodeUrl(params)));
    expect(res.status).toBe(400);
    const body = await res.text();
    expect(body).toContain("base_url");
    assertNoScriptContent(body);
  });

  it("rejects a tier missing from the query string entirely, naming that tier", async () => {
    const params = { ...VALID_CLAUDE_CODE_PARAMS } as Record<
      string,
      string | undefined
    >;
    delete params.haiku;
    const res = await claudeCodeGet(new Request(claudeCodeUrl(params)));
    expect(res.status).toBe(400);
    const body = await res.text();
    expect(body).toContain("haiku");
    assertNoScriptContent(body);
  });

  it("rejects an explicitly empty tier the same way as an absent one", async () => {
    const res = await claudeCodeGet(
      new Request(claudeCodeUrl({ ...VALID_CLAUDE_CODE_PARAMS, opus: "" })),
    );
    expect(res.status).toBe(400);
    const body = await res.text();
    expect(body).toContain("opus");
  });

  it("defaults an absent subagent to the resolved sonnet tier", async () => {
    const params = { ...VALID_CLAUDE_CODE_PARAMS } as Record<
      string,
      string | undefined
    >;
    delete params.subagent;
    const res = await claudeCodeGet(new Request(claudeCodeUrl(params)));
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('SUBAGENT_MODEL="claude-sonnet-4-6"');
  });

  it("rejects an explicitly empty subagent rather than defaulting it", async () => {
    const res = await claudeCodeGet(
      new Request(
        claudeCodeUrl({ ...VALID_CLAUDE_CODE_PARAMS, subagent: "" }),
      ),
    );
    expect(res.status).toBe(400);
    const body = await res.text();
    expect(body).toContain("subagent");
  });
});

describe("GET /api/setup/codex", () => {
  it("returns a POSIX shell script with the POSIX content type when os is absent", async () => {
    const res = await codexGet(new Request(codexUrl(VALID_CODEX_PARAMS)));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe(
      "text/x-shellscript; charset=utf-8",
    );
    const body = await res.text();
    expect(body).toContain("#!/bin/sh");
    expect(body).toContain("gpt-5-small");
    expect(body).toContain("gpt-5-medium");
    expect(body).toContain("gpt-5-large");
    expect(body).toContain("example");
    expect(body).not.toMatch(/\{\{[A-Z_]+\}\}/);
  });

  it("returns a PowerShell script with the Windows content type for os=windows", async () => {
    const res = await codexGet(
      new Request(codexUrl({ ...VALID_CODEX_PARAMS, os: "windows" })),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
    const body = await res.text();
    expect(body).toContain("$ErrorActionPreference");
  });

  it("rejects a key containing a space with 400 and no script content", async () => {
    const res = await codexGet(
      new Request(codexUrl({ ...VALID_CODEX_PARAMS, key: "has a space" })),
    );
    expect(res.status).toBe(400);
    expect(res.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
    const body = await res.text();
    expect(body).toContain("key");
    expect(body).not.toContain("has a space");
    assertNoScriptContent(body);
  });

  it("rejects a missing base_url with 400 naming the base_url field", async () => {
    const params = { ...VALID_CODEX_PARAMS } as Record<
      string,
      string | undefined
    >;
    delete params.base_url;
    const res = await codexGet(new Request(codexUrl(params)));
    expect(res.status).toBe(400);
    const body = await res.text();
    expect(body).toContain("base_url");
    assertNoScriptContent(body);
  });

  it("derives provider_id and provider_name from the base_url hostname when absent", async () => {
    const params = { ...VALID_CODEX_PARAMS } as Record<
      string,
      string | undefined
    >;
    delete params.provider_id;
    delete params.provider_name;
    const res = await codexGet(new Request(codexUrl(params)));
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('PROVIDER_ID="api-example-com"');
    expect(body).toContain('PROVIDER_NAME="api.example.com"');
  });

  it("rejects an invalid explicit provider_id with 400 naming provider_id", async () => {
    const res = await codexGet(
      new Request(
        codexUrl({ ...VALID_CODEX_PARAMS, provider_id: "Not Valid!" }),
      ),
    );
    expect(res.status).toBe(400);
    const body = await res.text();
    expect(body).toContain("provider_id");
    assertNoScriptContent(body);
  });
});
