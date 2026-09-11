/**
 * Guards against silent drift between the human-editable `.tpl` files under
 * `src/templates/` and the module-level string constants that `script.ts`
 * and `codex.ts` inline from them for browser-bundle use (see the header
 * comments on `ALL_SCRIPT_TEMPLATES` in `src/lib/script.ts` and on
 * `CODEX_MODELS_TEMPLATE` in `src/lib/codex.ts`).
 *
 * Without this test, editing a `.tpl` file changes nothing at runtime and
 * nothing else would notice: the inlined constant is what actually ships.
 * This test reads every `.tpl` file from disk with `fs` (safe here — this
 * is a Vitest file, never bundled into the browser build) and asserts each
 * equals its inlined constant byte-for-byte.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { ALL_SCRIPT_TEMPLATES } from "./script";
import { CODEX_MODELS_TEMPLATE, buildCodexModelsJson } from "./codex";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const templatesDir = path.resolve(__dirname, "../templates");

function readTemplate(filename: string): string {
  return readFileSync(path.join(templatesDir, filename), "utf8");
}

describe("template drift guard", () => {
  it.each(Object.keys(ALL_SCRIPT_TEMPLATES))(
    "%s on disk matches its inlined constant in script.ts",
    (filename) => {
      const onDisk = readTemplate(filename);
      const inlined = ALL_SCRIPT_TEMPLATES[filename];
      expect(inlined).toBe(onDisk);
    },
  );

  it("codex-models.json.tpl on disk matches CODEX_MODELS_TEMPLATE in codex.ts", () => {
    const onDisk = readTemplate("codex-models.json.tpl");
    expect(CODEX_MODELS_TEMPLATE).toBe(onDisk);
  });

  it("buildCodexModelsJson output reflects the on-disk template body (post attribution-header strip)", () => {
    // buildCodexModelsJson strips CODEX_MODELS_TEMPLATE's leading `//`
    // attribution-comment block before substituting placeholders and
    // parsing as JSON. Strip the same leading comment block from the
    // on-disk file the same way, then confirm the placeholders it defines
    // (slug/display_name) land in the built output — proving the runtime
    // path is actually reading the on-disk template's body, not some other
    // hidden copy.
    const onDisk = readTemplate("codex-models.json.tpl");
    const lines = onDisk.split("\n");
    let i = 0;
    while (i < lines.length && lines[i].trim().startsWith("//")) {
      i++;
    }
    const onDiskBody = lines.slice(i).join("\n");
    const parsedOnDiskBody = JSON.parse(
      onDiskBody
        .replaceAll("{{SMALL}}", "small-model")
        .replaceAll("{{MEDIUM}}", "medium-model")
        .replaceAll("{{LARGE}}", "large-model"),
    ) as { models: Array<{ slug: string }> };

    const built = JSON.parse(
      buildCodexModelsJson({
        resolvedTiers: {
          small: "small-model",
          medium: "medium-model",
          large: "large-model",
        },
      }),
    ) as { models: Array<{ slug: string }> };

    expect(built).toEqual(parsedOnDiskBody);
  });
});
