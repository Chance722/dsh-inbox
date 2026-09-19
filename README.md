# dsh-inbox

English | [中文](README.zh.md)

> **Status: pre-alpha — M0–M5 done.** File things two ways, browse and manage them in the panel, ask for them in conversation, and things arrive **already classified**: rules decide what they can prove, and a capped `deepseek-flash` pass judges the rest. Sync (M6) is next. Progress and acceptance records live in the [development bus](docs/feature/dev-bus.md).

A personal inbox plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`): paste links, images, text and credentials into one local vault, get them classified, browse them from the sidebar, and pull them back through conversation.

## What works today (M4)

| | |
|---|---|
| ✅ Sidebar entry | An **Inbox** row appears under *Global panels*; clicking it swaps the main area to the plugin's page |
| ✅ Tool reaches the model | `inbox_status` reports whether the vault is open and how many records it holds |
| ✅ Two ways to capture | `/inbox <text or link>` in the composer (attach images to carry them along), or paste/drop/pick inside the panel |
| ✅ Browse and manage | Filter by unread / category / tag, search across title, text, url and note, open a record's detail with image thumbnails, edit its category, description and tags, mark it read |
| ✅ Recycle bin | Delete is a soft delete; restore from the bin, or empty it to remove the records for good |
| ✅ Storage and merging | Records persist through dsh's own storage stack; a repeat paste merges into the record you already have |
| ✅ Ask in conversation | `inbox_search` finds records by words, category, tag, status or kind; `inbox_get` opens one by id (text up to 1000 characters, links, notes, tags, attachment facts) |
| 🔒 What never happens | A credential record never returns its text, and image bytes never enter the **conversation** — images come back as markers the UI renders locally. (Classification may send a picture to the model; that is a deliberate, capped choice — see below.) |
| ✅ Own conversation card | Tool results render as dsh-inbox cards: links become clickable, and image markers become thumbnails drawn on this machine |
| ✅ Classification by rule | A video page becomes 视频/音频, a public-account article 文章, a credential-shaped paste 密钥/账密 (and is then never echoed), and a card-shaped image gets a 疑似证件 tag — all decided locally, no bytes or text leaving the machine |
| ✅ Your word wins | Set the category yourself and it is marked as yours; nothing overwrites it |
| ✅ Model fallback, capped | Text or a recognised-host link no rule could judge gets one `deepseek-flash` call, redacted first. Capped at 200 calls / 100k tokens per day, recorded in the vault, and a failure leaves the rule's verdict standing. Images are never sent. |
| ✅ Sync, one way | Point it at a WebDAV folder and any device can drop files into `inbox/`; the vault pulls them at startup or on demand, classifies them, and merges repeats. Configuration lives in dsh's settings, the password in dsh's credential store. |

### Where your data lives

The vault is a domain (`dsh_inbox`) on dsh's JSON storage backend, one document per record:

```
~/.dsh/storages/dsh_inbox/
```

It is created on the first write. Nothing in it is ever sent anywhere by this plugin — see the privacy rules below.

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

**Uninstalling does not delete your vault.** If you also want the records gone:

```powershell
rm -r ~/.dsh/storages/dsh_inbox
```

Nothing is installed into `dsh` itself and no global state is touched, so removing the profile directory is a complete uninstall of the plugin.

## Development

### Remote inbox (the phone's way in)

Open the panel, press **⚙ 入库设置**, and pick a protocol:

- **WebDAV** — base URL (e.g. `https://data.cstcloud.cn/dav`), folder (default
  `/inbox`), username and password.
- **S3** — endpoint (e.g. `https://s3.cstcloud.cn`), bucket, region, signature
  version (v4), AccessKey ID and AccessKey Secret.

Save, then press **立即拉取**. Passwords and secrets go to dsh's credential
store, never into configuration.

Anything another device drops into that folder is pulled, classified and filed —
text-ish files become text or links, everything else becomes an attachment.
Pulling happens once per start as well, in the background, and a server that is
down never delays or fails the boot.

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
