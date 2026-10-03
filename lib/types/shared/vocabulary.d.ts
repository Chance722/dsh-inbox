/**
 * The vault's fixed vocabulary, shared by both halves.
 *
 * No zod here on purpose: the browser half must not pull a schema library into
 * the client bundle (the platform's static module table has no zod). Validation
 * lives in `src/host/vault/spec.ts`.
 */
/** What the pasted thing physically is. */
export declare const KINDS: readonly ["text", "link", "image", "file"];
export type Kind = (typeof KINDS)[number];
/**
 * How the vault classifies it. Eight top-level buckets, tags carry the rest.
 *
 * `file` was added on 2026-10-03 after the user asked "有没有可以补充的": a PDF, a
 * contract or a spreadsheet had nowhere to land (a dropped attachment was filed
 * as `image` whatever it was — see `classifyImage`). Everything longer-tailed
 * than that still belongs in a tag, which is why the list stayed at one new
 * bucket rather than an editable taxonomy.
 */
export declare const CATEGORIES: readonly ["idea", "article", "media", "image", "file", "document", "secret", "other"];
export type Category = (typeof CATEGORIES)[number];
/** Where the record entered the vault. */
export declare const SOURCES: readonly ["panel", "chat", "webdav", "import"];
export type Source = (typeof SOURCES)[number];
/**
 * Who decided the category. Precedence runs user > model > rule: a category the
 * user typed is never overwritten, and a rule never overrides a model pass.
 */
export declare const CATEGORY_SOURCES: readonly ["rule", "model", "user"];
export type CategorySource = (typeof CATEGORY_SOURCES)[number];
/** Display labels. Chinese is the primary UI language. */
export declare const CATEGORY_LABELS: Record<Category, string>;
export declare const KIND_LABELS: Record<Kind, string>;
/**
 * Display labels for the three answers to "who judged this category".
 *
 * The first cut was 「规则 / 模型 / 你」, three bare nouns sitting after a `·` next
 * to the category — they named the *thing* and never the *question*, which is
 * why they read as decoration rather than as a fact about the record. Each
 * label now carries the verb.
 *
 * `user` is 「手动判定」 and not the obvious 「自判定」: 自 at a glance reads as 自动,
 * which says the exact opposite of what happened (the machine judged it).
 */
export declare const CATEGORY_SOURCE_LABELS: Record<CategorySource, string>;
/** One sentence per source: what it means, and what it implies about the record. */
export declare const CATEGORY_SOURCE_HINTS: Record<CategorySource, string>;
