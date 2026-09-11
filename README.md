# Setting Key

A small Next.js app that generates CLI configuration files and install
scripts for [Claude Code](https://docs.claude.com/en/docs/claude-code) and
[Codex](https://github.com/openai/codex) from a provider `base_url` and API
key: `settings.json`, `config.toml`, `models.json`, `auth.json`, a one-line
installer, and a full install script per OS (POSIX shell / PowerShell).

See `openspec/changes/add-cli-config-generator/` for the full proposal,
design decisions, and requirements this project implements.

## Requirements

- Node.js `v24.19.0` (or a version satisfying `next@16`, `typescript@7`,
  `vitest@5` and `eslint@10` — see `package.json` for exact pins)
- npm `11.x`

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Serve a production build |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Run the Vitest suite (`src/lib/**/*.test.ts`) |

## Why this needs a server

The `/api/setup/*` route handlers generate configuration and scripts per
request; the app is not statically exported (`output: 'export'` is
intentionally not set — see `next.config.ts` and
`openspec/changes/add-cli-config-generator/design.md`, decision D8).

## Docker

The image is published to Docker Hub as
[`huydepzai123454/setting_api`](https://hub.docker.com/r/huydepzai123454/setting_api).

Run the published image:

```bash
docker run --rm -p 3000:3000 huydepzai123454/setting_api:latest
```

Or with Compose (builds locally if the image is missing):

```bash
docker compose up --build
```

The container always listens on port 3000. To publish it on a different host
port — on a VPS already using 3000, for example — set `HOST_PORT`:

```bash
HOST_PORT=3100 docker compose up -d        # http://<vps>:3100
docker run -d -p 3100:3000 huydepzai123454/setting_api:latest
```

To serve it on a domain over HTTPS, keep the container bound to localhost
(`-p 127.0.0.1:3100:3000`) and let a reverse proxy such as Caddy or nginx
forward to it.

Build and publish a new version:

```bash
DOCKERHUB_TOKEN=<docker-hub-access-token> sh scripts/docker-publish.sh
```

Pushes on `main` and `v*` tags are also published automatically by
`.github/workflows/docker-publish.yml`, which needs the repository secrets
`DOCKERHUB_TOKEN` (the Docker Hub username is set directly in the workflow).
