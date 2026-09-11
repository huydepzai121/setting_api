/**
 * `GET /api/setup/claudecode` — the Claude Code one-line installer route
 * (design.md D1, D2, D8; specs/cli-config/setup-script, "One-line installer
 * route handlers").
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
  CLAUDE_CODE_MODEL_TIERS,
  DEFAULT_SUBAGENT_TIER,
  resolveModelTiers,
  resolveSubagentModel,
  validateApiKey,
  validateModelName,
  validateResolvedTiers,
  normalizeBaseUrl,
  type ClaudeCodeModelTier,
  type TierOverrides,
} from "@/lib/validation";
import { isWindows, renderClaudeCodeScript } from "@/lib/script";

export const dynamic = "force-dynamic";

/**
 * A plain-text 400 whose body is exactly the validation failure's message.
 * Every message produced by `src/lib/validation.ts` already starts with the
 * offending field's name (e.g. `"haiku must not be empty"`), which is what
 * satisfies the spec's "the body names the offending field" requirement —
 * no need to echo the field name a second time. No message ever reflects
 * the submitted value back (so a rejected key never appears in the body).
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

  // `haiku`/`sonnet`/`opus` are the only tier parameters this route
  // accepts — there is no separate "primary model" parameter, because the
  // client (the web UI / one-liner URL builder in src/lib/script.ts) has
  // already resolved every tier from its primary-model-plus-overrides form
  // before building this URL, so each tier always arrives as an explicit
  // value. `resolveModelTiers` is still used here, with an empty-string
  // `primaryModel`, purely so that a tier parameter which is missing from
  // the query string entirely (as opposed to present-but-empty) is folded
  // into the exact same rejection path as an explicitly empty one:
  // `validateResolvedTiers` rejects both with a "<tier> must not be empty"
  // error naming that tier. A missing tier is therefore never silently
  // filled in from another tier — it is always a 400.
  const overrides: TierOverrides<ClaudeCodeModelTier> = {};
  for (const tier of CLAUDE_CODE_MODEL_TIERS) {
    if (searchParams.has(tier)) {
      overrides[tier] = searchParams.get(tier) ?? "";
    }
  }
  const resolvedTiers = resolveModelTiers(CLAUDE_CODE_MODEL_TIERS, "", overrides);
  const tiersResult = validateResolvedTiers(resolvedTiers, CLAUDE_CODE_MODEL_TIERS);
  if (!tiersResult.ok) {
    return badRequest(tiersResult.message);
  }

  // `subagent` carries the already-resolved model name for whichever tier
  // the user picked client-side (design.md D5 — `CLAUDE_CODE_SUBAGENT_MODEL`
  // is a pointer to one of the three tiers, and that indirection is
  // resolved by the caller via `resolveSubagentModel` before this route
  // ever sees it). By the time it reaches here it is validated exactly
  // like any other model name.
  //
  // Decision: when `subagent` is entirely absent from the query string,
  // this route does NOT emit an empty value. It falls back to
  // `resolveSubagentModel(resolvedTiers, DEFAULT_SUBAGENT_TIER)` — the
  // resolved model for the "sonnet" tier — matching the same default the
  // web UI's advanced panel uses (design.md D5: "a three-way tier choice
  // defaulting to sonnet"). A `subagent` parameter that IS present, even as
  // `subagent=`, is validated and an empty value is rejected with 400
  // naming `subagent`; only true absence gets the default.
  let subagentModel: string;
  if (searchParams.has("subagent")) {
    const subagentResult = validateModelName(
      searchParams.get("subagent") ?? "",
      "subagent",
    );
    if (!subagentResult.ok) {
      return badRequest(subagentResult.message);
    }
    subagentModel = subagentResult.value;
  } else {
    subagentModel = resolveSubagentModel(
      tiersResult.value,
      DEFAULT_SUBAGENT_TIER,
    );
  }

  // Every input is validated at this point — nothing below can fail, so no
  // partially rendered script can leak into a response body.
  const script = renderClaudeCodeScript({
    os,
    endpointUrl: baseUrlResult.value,
    apiKey: keyResult.value,
    resolvedTiers: tiersResult.value,
    subagentModel,
  });

  const contentType = isWindows(os)
    ? "text/plain; charset=utf-8"
    : "text/x-shellscript; charset=utf-8";

  return new Response(script, {
    status: 200,
    headers: { "Content-Type": contentType },
  });
}
