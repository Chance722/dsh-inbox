# dsh-inbox

English | [中文](README.zh.md)

> **Status: pre-alpha — M0–M6 done, M7 (UI) in progress.** File things two ways, browse and manage them in the panel, ask for them in conversation, **arrive already classified** (rules first, a capped `deepseek-flash` pass for the rest), and **let another device drop things in over WebDAV or S3**. M7 puts the vault in the right-hand dock as well and rebuilds the main management page (pagination included); packaging and one-command install move to M8. Progress and acceptance records live in the [development bus](docs/feature/dev-bus.md).

A personal inbox plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`): paste links, images, text and credentials into one local vault, get them classified, browse them from the sidebar, and pull them back through conversation.

## What works today (M6)

| | |
|---|---|
| ✅ Sidebar entry | An **Inbox** row appears under *Global panels*; clicking it swaps the main area to the plugin's page |
| ✅ Tool reaches the model | `inbox_status` reports whether the vault is open and how many records it holds |
| ✅ Two ways to capture | `/inbox <text or link>` in the composer (attach images to carry them along), or paste/drop/pick inside the panel |
| ✅ Browse and manage | Filter by watch-later / category / tag, search across title, text, url and note, switch the list between two densities (two columns / compact), open a record's detail with image thumbnails, edit its **name**, category, description and tags, flag it watch-later |
| ✅ Recycle bin | Delete is a soft delete; restore from the bin, or empty it to remove the records for good. Filing the same thing again also brings it back out |
| ✅ Everything has a name | A link is named by the **headline its page carries** (fetched automatically, **no model tokens spent**), a photo or a file by the **file name it arrived with**. Rename any record in the detail pane; emptying the field hands the name back to those fallbacks. The row shows the name itself — what kind of thing it is, the category glyph says (a key, for a credential). When a fetch is refused it says why (WeChat serves verification pages to anonymous requests), rather than staying silent |
| ✅ A note, not a subtitle | The note box no longer squeezes into the list row: hover the name to see it. It only becomes the name when a record has no name at all — an unnamed credential, say |
| ✅ Storage and merging | Records persist through dsh's own storage stack; a repeat paste merges into the record you already have |
| ✅ Ask in conversation | `inbox_search` finds records by words, category, tag, watch-later flag or kind; `inbox_get` opens one by id (text up to 1000 characters, links, notes, tags, attachment facts) |
| 🔒 What never happens | A credential record never returns its text, and image bytes never enter the **conversation** — images come back as markers the UI renders locally. (Classification may send a picture to the model; that is a deliberate, capped choice — see below.) |
| ✅ Own conversation card | Tool results render as dsh-inbox cards: links become clickable, and image markers become thumbnails drawn on this machine |
| ✅ Classification by rule | A video page becomes 视频/音频, a public-account article 文章, a credential-shaped paste 密钥/账密 (and is then never echoed), and a card-shaped image gets a 疑似证件 tag — all decided locally, no bytes or text leaving the machine |
| ✅ Your word wins | Set the category yourself and it is marked as yours; nothing overwrites it |
| ✅ Says who judged it | Open a record and its category carries a coloured badge: **规则判定** (grey — the local rules), **模型判定** (violet — the capped model fallback), **手动判定** (blue — your own pick, the one nothing overwrites). Hovering explains it in one line |
| ✅ Model fallback, capped | Text or a recognised-host link no rule could judge gets one `deepseek-flash` call, redacted first. Capped at 200 calls / 100k tokens per day, recorded in the vault, and a failure leaves the rule's verdict standing. Images are never sent. |
| ✅ Sync, one way | Point it at a remote — a **WebDAV folder** or an **S3 bucket** — and any device can drop files in; the vault pulls them at startup or on demand, classifies them, and merges repeats. Configuration lives in dsh's settings, the password and secret in dsh's credential store. |
| ✅ Client identity | Some gateways (中科院数据胶囊 among them) bind **each access key or account** to an "application" and **tell clients apart by `User-Agent`** — anything else is refused with the same status code a wrong password gets. The identity is kept **per protocol** (the two doors can be bound to different applications); empty means the plugin's own name, `dsh-inbox`. |

### Where your data lives

The vault is a domain (`dsh_inbox`) on dsh's JSON storage backend, one document per record:

```
~/.dsh/storages/dsh_inbox/
```

It is created on the first write. Nothing in it is ever sent anywhere by this plugin — see the privacy rules below.

## What it will do

- **Capture** — paste or drag into an inbox panel, or prefix a chat message to file it instead of sending it.
- **Classify** — rules first (platform and media type from the URL, secrets by pattern, images by local heuristics), with a model as fallback. Your own description always wins.
- **Browse** — a sidebar switch that swaps the session list for your vault: categories, tags, watch-later flags, soft delete.
- **Retrieve** — ask in conversation and get the original content back (text inline, images as thumbnails, links as title cards).
- **Sync (one-way, pull)** — drop files into a remote folder (WebDAV directory / S3 bucket) from any device; the vault pulls and classifies them at startup. Pulling is the only direction: **nothing is ever uploaded**, there is no push yet.

## Privacy rules this project holds itself to

- **Credentials are encrypted at rest** (since 2026-09-20): the body is stored as ciphertext in `items\*.json` (AES-256-GCM, key derived from your master password with scrypt). **Neither the password nor the key is ever written to disk** — the vault locks again on every restart and you unlock it under 入库设置 → 账密加密. A forgotten password means unrecoverable ciphertext; that is the design, not a bug. With no master password set, a credential is **refused rather than stored in the clear**.
- **What the encryption covers**: the **body** of credential records only. Notes (your own words), categories, tags, timestamps and attachment **bytes** stay as they are — a key inside a pasted file is still a key inside a file. Do not read "credentials are encrypted" as "the whole vault is encrypted".
- **Credentials**: masked in the list, **never** sent to a model, **never** printed in conversation.
- **Pictures**: classification does send an image to the model (the choice the user made on 2026-09-19); the conversation only ever gets an `[attachment:id]` marker, never the bytes.
- The vault is never injected into model context automatically — the model only sees it when it calls a tool.

## Where things live

All of it on this machine (`%DSH_HOME%`, i.e. `C:\Users\<you>\.dsh` on Windows):

| What | Where |
|---|---|
| Records: text, links, category, note, tags, watch-later… | `storages\dsh_inbox\items\*.json`, one file each |
| Attachment index (mime/size/original file name) | `storages\dsh_inbox\attachments\*.json` |
| The **bytes** of images / videos / files | `attachments\` — dsh's own content-addressed store, never auto-deleted |
| Remote password / S3 AccessKey Secret | dsh's credential store, `.credentials.yaml` |
| Remote settings (URL, bucket, client identity…) | dsh's own settings |

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
- **S3** — endpoint (e.g. `s3.cstcloud.cn`; the scheme defaults to `https`, and
  an explicit `http://` is kept for a LAN endpoint), bucket, region, signature
  version (v4), AccessKey ID and AccessKey Secret.
- **Client identity** (stored per protocol) — empty means `dsh-inbox`. On
  数据胶囊 this **must** be the application the credential is bound to;
  without it the S3 door answers 401 and the WebDAV door answers
  `403 Client type mismatch.`, both of which read like a wrong password. The
  match is "contains, case-insensitive", so `Obsidian` or `Zotero/7.0.11` both
  work. The two doors may be bound to different applications (say an S3 key
  bound to `Obsidian` and a WebDAV account bound to `Zotero`), which is why the
  identity travels with the protocol instead of being shared. The same key also
  works over WebDAV: username = AccessKey ID, password = AccessKey Secret —
  **if you would rather keep one binding, that is the combination to use**.

Save, then press **立即拉取**. Passwords and secrets go to dsh's credential
store, never into configuration.

Anything another device drops into that folder is pulled, classified and filed —
text-ish files become text or links, everything else becomes an attachment.
Pulling happens once per start as well, in the background, and a server that is
down never delays or fails the boot.

When a pull fails, press **自检**: it asks the gateway every signature shape at
once and prints the server's own words. The reasoning and the measured matrix
are in [docs/help/remote-gateway-compat.md](docs/help/remote-gateway-compat.md).

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
