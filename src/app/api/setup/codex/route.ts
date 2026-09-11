/**
 * `GET /api/setup/codex` — the Codex CLI one-line installer route
 * (design.md D1, D2, D6, D8; specs/cli-config/setup-script, "One-line
 * installer route handlers").
 *
 * Every query parameter is validated in full BEFORE any part of the script
 * is rendered, so an invalid request can never leak a partially rendered
 * script body (spec scenarios "Invalid key rejected by the route" and
 * "Missing required parameter rejected").
 *
 * This handler performs no logging of its own — no `console.*`, no
 * analytics, nothing that writes the request URL, query string or key
 * anywhere (design.md D8; spec "Secrets are never persisted or logged").
 *
 * Uses the standard Web `Request`/`Response` API (not `NextRequest` /
 * `NextResponse`) so the handler is trivially testable by constructing a
 * `Request` directly and calling `GET` — no server needs to be booted.
 *
 * Reading query parameters from `request.url` per call already makes this
 * route dynamic; `dynamic = "force-dynamic"` makes that explicit so Next.js
 * never attempts to prerender it (design.md D8).
 */

import {
  CODEX_MODEL_TIERS,
  resolveModelTiers,
  validateApiKey,
  validateResolvedTiers,
  normalizeBaseUrl,
  validateProviderId,
  deriveProviderId,
  deriveProviderName,
  type CodexModelTier,
  type TierOverrides,
} from "@/lib/validation";
import { isWindows, renderCodexScript } from "@/lib/script";

export const dynamic = "force-dynamic";

/**
 * A plain-text 400 whose body is exactly the validation failure's message.
 * Every message produced by `src/lib/validation.ts` already starts with the
 * offending field's name (e.g. `"base_url must be a valid absolute URL"`),
 * which is what satisfies the spec's "the body names the offending field"
 * requirement — no need to echo the field name a second time. No message
 * ever reflects the submitted value back (so a rejected key never appears
 * in the body).
 */
function badRequest(message: string): Response {
  return new Response(message, {
    status: 400,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);

  const os = searchParams.get("os") ?? undefined;

  const keyResult = validateApiKey(searchParams.get("key") ?? "", "key");
  if (!keyResult.ok) {
    return badRequest(keyResult.message);
  }

  const baseUrlResult = normalizeBaseUrl(searchParams.get("base_url") ?? "");
  if (!baseUrlResult.ok) {
    return badRequest(baseUrlResult.message);
  }

  // `small`/`medium`/`large` are the only tier parameters this route
  // accepts — there is no separate "primary model" parameter, mirroring
  // the Claude Code route: the client resolves every tier from its
  // primary-model-plus-overrides form before building this URL. As there,
  // `resolveModelTiers` is called with an empty-string `primaryModel` so a
  // tier missing from the query string entirely is rejected by
  // `validateResolvedTiers` exactly like an explicitly empty one, naming
  // that tier — never silently filled in from another tier.
  const overrides: TierOverrides<CodexModelTier> = {};
  for (const tier of CODEX_MODEL_TIERS) {
    if (searchParams.has(tier)) {
      overrides[tier] = searchParams.get(tier) ?? "";
    }
  }
  const resolvedTiers = resolveModelTiers(CODEX_MODEL_TIERS, "", overrides);
  const tiersResult = validateResolvedTiers(resolvedTiers, CODEX_MODEL_TIERS);
  if (!tiersResult.ok) {
    return badRequest(tiersResult.message);
  }

  // Hostname of the normalized base_url, used to derive default provider
  // identity (design.md D6) when the client omits provider_id/provider_name.
  const hostname = new URL(baseUrlResult.value).hostname;

  // Decision: `provider_id` absent from the query string derives a default
  // via `deriveProviderId(hostname)` (design.md D6 — always a valid TOML
  // bare key, so no further validation is needed on the derived value).
  // `provider_id` present (even as `provider_id=`) is validated with
  // `validateProviderId` and rejected with 400 naming `provider_id` if it
  // does not match the bare-key grammar.
  let providerId: string;
  if (searchParams.has("provider_id")) {
    const providerIdResult = validateProviderId(
      searchParams.get("provider_id") ?? "",
    );
    if (!providerIdResult.ok) {
      return badRequest(providerIdResult.message);
    }
    providerId = providerIdResult.value;
  } else {
    providerId = deriveProviderId(hostname);
  }

  // Decision: `provider_name` absent derives a default via
  // `deriveProviderName(hostname)` (design.md D6). `provider_name` present
  // is used verbatim, including an explicitly empty string — there is no
  // `validateProviderName` in src/lib/validation.ts (the display name is
  // unrestricted free text, TOML-escaped by `buildCodexConfigToml` /
  // `renderCodexScript`), so this route does not invent a restriction the
  // shared validation layer does not define.
  const providerName = searchParams.has("provider_name")
    ? (searchParams.get("provider_name") ?? "")
    : deriveProviderName(hostname);

  // Every input is validated at this point — nothing below can fail, so no
  // partially rendered script can leak into a response body.
  const script = renderCodexScript({
    os,
    endpointUrl: baseUrlResult.value,
    apiKey: keyResult.value,
    resolvedTiers: tiersResult.value,
    providerId,
    providerName,
  });

  const contentType = isWindows(os)
    ? "text/plain; charset=utf-8"
    : "text/x-shellscript; charset=utf-8";

  return new Response(script, {
    status: 200,
    headers: { "Content-Type": contentType },
  });
}
