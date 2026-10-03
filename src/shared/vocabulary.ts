/**
 * The vault's fixed vocabulary, shared by both halves.
 *
 * No zod here on purpose: the browser half must not pull a schema library into
 * the client bundle (the platform's static module table has no zod). Validation
 * lives in `src/host/vault/spec.ts`.
 */

/** What the pasted thing physically is. */
export const KINDS = ['text', 'link', 'image', 'file'] as const
export type Kind = (typeof KINDS)[number]

/**
 * How the vault classifies it. Eight top-level buckets, tags carry the rest.
 *
 * `file` was added on 2026-10-03 after the user asked "有没有可以补充的": a PDF, a
 * contract or a spreadsheet had nowhere to land (a dropped attachment was filed
 * as `image` whatever it was — see `classifyImage`). Everything longer-tailed
 * than that still belongs in a tag, which is why the list stayed at one new
 * bucket rather than an editable taxonomy.
 */
export const CATEGORIES = [
  'idea',
  'article',
  'media',
  'image',
  'file',
  'document',
  'secret',
  'other',
] as const
export type Category = (typeof CATEGORIES)[number]

/** Where the record entered the vault. */
export const SOURCES = ['panel', 'chat', 'webdav', 'import'] as const
export type Source = (typeof SOURCES)[number]

/**
 * Who decided the category. Precedence runs user > model > rule: a category the
 * user typed is never overwritten, and a rule never overrides a model pass.
 */
export const CATEGORY_SOURCES = ['rule', 'model', 'user'] as const
export type CategorySource = (typeof CATEGORY_SOURCES)[number]

/** Display labels. Chinese is the primary UI language. */
export const CATEGORY_LABELS: Record<Category, string> = {
  idea: '灵感/待办',
  article: '文章',
  media: '视频/音频',
  image: '图片',
  file: '文件',
  document: '证件',
  secret: '密钥/账密',
  other: '其它',
}

export const KIND_LABELS: Record<Kind, string> = {
  text: '文本',
  link: '链接',
  image: '图片',
  file: '文件',
}


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
export const CATEGORY_SOURCE_LABELS: Record<CategorySource, string> = {
  rule: '规则判定',
  model: '模型判定',
  user: '手动判定',
}

/** One sentence per source: what it means, and what it implies about the record. */
export const CATEGORY_SOURCE_HINTS: Record<CategorySource, string> = {
  rule: '本地规则按链接、文本、图片的形状判的，没有联网',
  model: '规则判不出来才交给模型判的；你说的话永远优先，随时可以改',
  user: '你自己选的类目，规则和模型都不会覆盖它',
}
