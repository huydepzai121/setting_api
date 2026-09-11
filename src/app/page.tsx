"use client";

import { useSyncExternalStore } from "react";
import { AppHeader } from "@/components/app-header";
import { Generator } from "@/components/generator";

const noopSubscribe = () => () => {};

/**
 * `true` only once mounted on the client. The server snapshot and the
 * client's pre-hydration snapshot are both `false`, so the very first
 * client render matches the server-rendered HTML exactly; React swaps in
 * `true` right after hydration commits. `Generator` is only ever rendered
 * once this is `true`, so its lazy `useState` initializers can safely read
 * `localStorage` / `window.location.origin` — it never takes part in SSR
 * or the hydration-matching render, so there is nothing for those
 * client-only values to mismatch.
 */
function useMounted(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

export default function Home() {
  const mounted = useMounted();
  return (
    <main className="sk-app">
      <AppHeader />
      {mounted ? (
        <Generator />
      ) : (
        <div className="sk-main">
          <p className="sk-loading">Loading the configuration form…</p>
        </div>
      )}
    </main>
  );
}
