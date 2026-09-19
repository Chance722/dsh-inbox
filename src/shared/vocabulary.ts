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

/** How the vault classifies it. Seven top-level buckets, tags carry the rest. */
export const CATEGORIES = [
  'idea',
  'article',
  'media',
  'image',
  'document',
  'secret',
  'other',
] as const
export type Category = (typeof CATEGORIES)[number]

/** Two states only; "later" is a tag, not a state. */
export const STATUSES = ['unread', 'read'] as const
export type Status = (typeof STATUSES)[number]

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

export const STATUS_LABELS: Record<Status, string> = {
  unread: '未读',
  read: '已读',
}

export const CATEGORY_SOURCE_LABELS: Record<CategorySource, string> = {
  rule: '规则',
  model: '模型',
  user: '你',
}
