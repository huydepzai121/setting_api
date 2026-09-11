import { describe, expect, it } from "vitest";
import {
  DEFAULT_PERSISTED_STATE,
  loadPersistedState,
  savePersistedState,
  toPersistedPayload,
  type StorageLike,
} from "./storage";

function memoryStorage(): StorageLike & { dump(): Record<string, string> } {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    dump: () => Object.fromEntries(data),
  };
}

const THROWING_STORAGE: StorageLike = {
  getItem() {
    throw new Error("localStorage disabled");
  },
  setItem() {
    throw new Error("localStorage disabled");
  },
};

describe("toPersistedPayload / D9 audit — the API key is never persisted", () => {
  it("the persisted payload has no apiKey/api_key field at all", () => {
    const live = {
      baseUrl: "https://api.example.com",
      primaryModel: "claude-sonnet-4-6",
      overrides: {},
      providerId: undefined,
      providerName: undefined,
      targets: { claudeCode: true, codex: true },
      os: "posix",
      // Extra fields a real caller might carry alongside the persisted
      // ones — toPersistedPayload must not copy them through regardless
      // of what the input object contains.
      apiKey: "sk-ant-SUPER-SECRET-VALUE",
    } as const;

    const payload = toPersistedPayload(live);

    expect(Object.prototype.hasOwnProperty.call(payload, "apiKey")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(payload, "api_key")).toBe(false);
    expect(JSON.stringify(payload)).not.toContain("SUPER-SECRET-VALUE");
  });

  it("what actually reaches storage.setItem never contains the key value", () => {
    const storage = memoryStorage();
    const live = {
      baseUrl: "https://api.example.com",
      primaryModel: "claude-sonnet-4-6",
      overrides: { haiku: "haiku-model" },
      providerId: "custom-provider",
      providerName: "Custom Provider",
      targets: { claudeCode: true, codex: false },
      os: "windows",
      apiKey: "sk-ant-ANOTHER-SECRET",
    };

    savePersistedState(toPersistedPayload(live), storage);

    const raw = storage.dump()["setting-key:form:v1"];
    expect(raw).toBeDefined();
    expect(raw).not.toContain("ANOTHER-SECRET");
    expect(raw).not.toContain("apiKey");
  });
});

describe("loadPersistedState", () => {
  it("returns defaults when storage is absent", () => {
    expect(loadPersistedState(undefined)).toEqual(DEFAULT_PERSISTED_STATE);
  });

  it("returns defaults, without surfacing an error, when storage throws (spec: Storage unavailable)", () => {
    expect(() => loadPersistedState(THROWING_STORAGE)).not.toThrow();
    expect(loadPersistedState(THROWING_STORAGE)).toEqual(DEFAULT_PERSISTED_STATE);
  });

  it("returns defaults when the stored value is not valid JSON", () => {
    const storage = memoryStorage();
    storage.setItem("setting-key:form:v1", "{not json");
    expect(loadPersistedState(storage)).toEqual(DEFAULT_PERSISTED_STATE);
  });

  it("returns defaults when the stored value parses to a non-object", () => {
    const storage = memoryStorage();
    storage.setItem("setting-key:form:v1", "42");
    expect(loadPersistedState(storage)).toEqual(DEFAULT_PERSISTED_STATE);
  });

  it("round-trips exactly what was saved", () => {
    const storage = memoryStorage();
    const live = {
      baseUrl: "https://router.example.com",
      primaryModel: "gpt-5",
      overrides: { small: "gpt-5-mini", medium: "gpt-5" },
      providerId: "router-example-com",
      providerName: "Router Example",
      targets: { claudeCode: false, codex: true },
      os: "windows",
      apiKey: "irrelevant-and-discarded",
    };
    const payload = toPersistedPayload(live);
    savePersistedState(payload, storage);
    expect(loadPersistedState(storage)).toEqual(payload);
  });

  it("sanitizes a corrupted overrides/targets shape instead of throwing", () => {
    const storage = memoryStorage();
    storage.setItem(
      "setting-key:form:v1",
      JSON.stringify({
        baseUrl: 42, // wrong type
        primaryModel: "claude-sonnet-4-6",
        overrides: { haiku: "ok-model", sonnet: 123, notATier: "ignored" },
        targets: "not-an-object",
        os: "banana",
      }),
    );
    const loaded = loadPersistedState(storage);
    expect(loaded.baseUrl).toBe("");
    expect(loaded.overrides).toEqual({ haiku: "ok-model" });
    expect(loaded.targets).toEqual({ claudeCode: true, codex: true });
    expect(loaded.os).toBe("posix");
  });
});

describe("savePersistedState", () => {
  it("does not throw when storage is absent or throwing", () => {
    expect(() =>
      savePersistedState(DEFAULT_PERSISTED_STATE, undefined),
    ).not.toThrow();
    expect(() =>
      savePersistedState(DEFAULT_PERSISTED_STATE, THROWING_STORAGE),
    ).not.toThrow();
  });
});
