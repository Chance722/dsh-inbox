/** Stable ids shared by the host half and the browser half. */

/** npm package name; also the client bundle id the loader registers. */
export const PACKAGE_NAME = '@duoyu/dsh-inbox'

/** Sidebar panel id: addresses both the `sidebar.panellist` row and the `main` key. */
export const PANEL_ID = 'inbox'

/** Milestone marker surfaced by the status tool; see docs/feature/dev-bus.md. */
export const MILESTONE = 'M6c'

/**
 * What the plugin calls itself in `User-Agent` when the user configured nothing.
 *
 * Some object-storage gateways (中科院数据胶囊 among them) bind an access key to
 * an application and reject any caller that does not claim to be that
 * application, which is why this is a visible setting rather than a constant
 * buried in a client.
 */
export const DEFAULT_USER_AGENT = 'dsh-inbox'
