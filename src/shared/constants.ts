/** Stable ids shared by the host half and the browser half. */

/** npm package name; also the client bundle id the loader registers. */
export const PACKAGE_NAME = '@duoyu/dsh-inbox'

/** Sidebar panel id: addresses both the `sidebar.panellist` row and the `main` key. */
export const PANEL_ID = 'inbox'

/**
 * The version the plugin reports, substituted from `package.json` at build time.
 *
 * The status tool used to print an internal milestone marker instead (`M6c`),
 * which told the user nothing — and the assistant relays that string verbatim,
 * so it was also the first thing they saw when they asked what the vault held.
 * `typeof` keeps a build that forgot the substitution from throwing.
 */
export const VERSION: string =
  typeof __DSH_INBOX_VERSION__ === 'string' ? __DSH_INBOX_VERSION__ : '0.0.0-dev'

/**
 * What the plugin calls itself in `User-Agent` when the user configured nothing.
 *
 * Some object-storage gateways (中科院数据胶囊 among them) bind an access key to
 * an application and reject any caller that does not claim to be that
 * application, which is why this is a visible setting rather than a constant
 * buried in a client.
 */
export const DEFAULT_USER_AGENT = 'dsh-inbox'
