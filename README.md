# dsh-inbox

English | [中文](README.zh.md)

> **Status: pre-alpha — not installable yet.** The plugin skeleton (M0) has not been built. See the [development bus](docs/feature/dev-bus.md) for what exists.

A personal inbox plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`): paste links, images, text and credentials into one local vault, get them classified, browse them from the sidebar, and pull them back through conversation.

## What it will do

- **Capture** — paste or drag into an inbox panel, or prefix a chat message to file it instead of sending it.
- **Classify** — rules first (platform and media type from the URL, secrets by pattern, images by local heuristics), with a model as fallback. Your own description always wins.
- **Browse** — a sidebar switch that swaps the session list for your vault: categories, tags, unread state, soft delete.
- **Retrieve** — ask in conversation and get the original content back (text inline, images as thumbnails, links as title cards).
- **Sync (one-way)** — drop files into a WebDAV `inbox/` folder from any device; the vault pulls and classifies them at startup. Everything leaving the machine is encrypted.

## Privacy rules this project holds itself to

- Credentials are encrypted at rest, masked in the list, and **never** sent to a model or printed in conversation.
- ID documents are classified locally by default; nothing is uploaded just to guess.
- The vault is never injected into model context automatically — the model only sees it when it calls a tool.

## Install (planned)

```sh
dsh plugin --profile web add @duoyu/dsh-inbox
npx @duoyu/dsh-inbox init
```

## Development

| Purpose | Command |
|---|---|
| Install deps | `pnpm install` |
| Isolated dev profile | `dsh --profile inbox` |
| Build | `pnpm build` |
| Test | `pnpm test` |

Project rules live in [AGENTS.md](AGENTS.md); knowledge docs are indexed in [docs/help/index.md](docs/help/index.md).

## License

MIT
