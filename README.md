# dsh-inbox

English | [中文](README.zh.md)

> **Status: pre-alpha — M0 done.** The plugin skeleton works: a sidebar entry, a full-page panel, and one tool the model can call. There is no vault yet. Progress and acceptance records live in the [development bus](docs/feature/dev-bus.md).

A personal inbox plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`): paste links, images, text and credentials into one local vault, get them classified, browse them from the sidebar, and pull them back through conversation.

## What works today (M0)

| | |
|---|---|
| ✅ Sidebar entry | An **Inbox** row appears under *Global panels*; clicking it swaps the main area to the plugin's page |
| ✅ Tool reaches the model | `inbox_status` is registered and callable in conversation |
| ❌ Not yet | Capture, storage, classification, search — these arrive with M1–M6 |

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

## Install

> Not on npm yet — that lands in M7 (`npx @duoyu/dsh-inbox init`). Until then, install from a local checkout.

```powershell
# 1. build the plugin
git clone <this repo> dsh-inbox ; cd dsh-inbox
pnpm install
pnpm build

# 2. create an isolated profile (skip if it already exists)
dsh --profile inbox --from-default-profile web

# 3. mount the plugin — this also appends it to the profile's dsh.profile.bundles
dsh plugin --profile inbox add <absolute path to this repo>

# 4. run it
dsh --profile inbox --no-open --port 3102
```

Open the printed URL (it carries a token). Your daily `dsh web` profile is not touched.

`dsh` may not be on `PATH`; the full command with explicit Node and bin paths is in [docs/help/dev-setup.md](docs/help/dev-setup.md).

### Uninstall

```powershell
# 1. remove the package from the profile (also drops it from dsh.profile.bundles)
dsh plugin --profile inbox remove @duoyu/dsh-inbox

# 2. delete anything the plugin no longer needs
rm -r ~/.dsh/profiles/inbox        # the isolated profile
rm -r ~/.dsh/.agent-presets/inbox-m0   # only if you created the test preset
```

Nothing is installed into `dsh` itself and no global state is touched, so removing those two directories is a complete uninstall.

## Development

| Purpose | Command |
|---|---|
| Install deps | `pnpm install` |
| Build | `pnpm build` (esbuild → `lib/index.js` + `lib/client.js`) |
| Typecheck | `pnpm typecheck` |
| Test | `pnpm test` (vitest) |
| Run the dev profile | `dsh --profile inbox --no-open --port 3102` |

The browser bundle is what the app actually loads, so **rebuild before reloading the page**. Building needs to spawn a subprocess (esbuild), which some sandboxes block.

Project rules live in [AGENTS.md](AGENTS.md); knowledge docs are indexed in [docs/help/index.md](docs/help/index.md).

## License

MIT
