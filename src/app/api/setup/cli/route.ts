/**
 * `GET /api/setup/cli` — the interactive terminal setup script.
 *
 * Returns a script that asks, in the terminal, for the same fields the
 * web UI asks for and then calls `/api/setup/claudecode` and
 * `/api/setup/codex` with the answers. Validation therefore stays entirely in
 * those routes; this one renders a prompt loop and nothing else. `?os=windows`
 * selects the PowerShell twin of that prompt loop, the same way the installer
 * routes select their own Windows templates.
 *
 * The only value substituted into the script is the origin it should call
 * back to. It is derived from the request rather than configuration so the
 * script works unchanged from `localhost`, a bare VPS IP:port, or a domain
 * behind a TLS-terminating reverse proxy.
 *
 * Like the other setup routes: no logging of any kind, standard Web
 * `Request`/`Response` so the handler is testable without booting a server,
 * and explicitly dynamic because the response depends on request headers.
 */

import { ALL_SCRIPT_TEMPLATES, isWindows, renderScript } from "@/lib/script";

export const dynamic = "force-dynamic";

/**
 * An origin is interpolated into a script the caller then executes, so it is
 * checked against a closed character set before it can get anywhere near the
 * script body — a `Host` header is attacker-controllable, and a value
 * containing `"` or `$(` would otherwise become shell code. Hostnames,
 * IPv4/IPv6 literals and an optional port all fit within this set; anything
 * else is rejected rather than escaped.
 */
const ORIGIN_PATTERN = /^https?:\/\/[A-Za-z0-9.\-:[\]]+$/;

/**
 * Resolves the public origin of this request.
 *
 * Behind a reverse proxy (the documented Caddy/nginx deployment) `request.url`
 * reports the internal `http://127.0.0.1:3000` the proxy forwarded to, which
 * would bake an unreachable origin into the script. `X-Forwarded-Proto` and
 * `X-Forwarded-Host` carry what the client actually asked for, so they win
 * when present, then `Host`, and only then the request URL.
 */
function resolveOrigin(request: Request): string | null {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost ?? request.headers.get("host");

  if (host === null) {
    const origin = new URL(request.url).origin;
    return ORIGIN_PATTERN.test(origin) ? origin : null;
  }

  // A proxy chain may forward a comma-separated list; the first entry is the
  // value the original client sent.
  const proto =
    request.headers.get("x-forwarded-proto")?.split(",")[0].trim() ??
    new URL(request.url).protocol.replace(":", "");

  const origin = `${proto}://${host.split(",")[0].trim()}`;
  return ORIGIN_PATTERN.test(origin) ? origin : null;
}

export async function GET(request: Request): Promise<Response> {
  const origin = resolveOrigin(request);

  if (origin === null) {
    return new Response("host must be a valid origin", {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const windows = isWindows(
    new URL(request.url).searchParams.get("os") ?? undefined,
  );

  const script = renderScript(
    ALL_SCRIPT_TEMPLATES[windows ? "cli-windows.ps1.tpl" : "cli-posix.sh.tpl"],
    { ORIGIN: origin },
  );

  // Matches the installer routes: PowerShell is served as plain text, since
  // there is no registered media type for it that a shell would honor.
  const contentType = windows
    ? "text/plain; charset=utf-8"
    : "text/x-shellscript; charset=utf-8";

  return new Response(script, {
    status: 200,
    headers: { "Content-Type": contentType },
  });
}
