import type { NextConfig } from "next";

// Do NOT set `output: 'export'` here. The `/api/setup/*` route handlers
// (Claude Code / Codex config + script generation) must execute per request
// on a server — static export would remove the server runtime those routes
// depend on. See openspec/changes/add-cli-config-generator/design.md, D8.
//
// `standalone` keeps that server runtime while emitting a self-contained
// server.js plus only the modules it needs, which is what the Docker image
// ships (see Dockerfile).
const nextConfig: NextConfig = {
  output: "standalone",
};

export default nextConfig;
