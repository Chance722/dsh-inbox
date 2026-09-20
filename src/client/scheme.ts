/**
 * Which colour scheme the app around this panel is drawn in.
 *
 * The panel lives inside someone else's UI and may not assume either theme. It
 * used to declare `color-scheme: dark` outright — which was a fix for one bug
 * (a native `<select>` drawn light while the app was dark, so its options were
 * white on white) and the cause of three worse ones: in a *light* app, `Canvas`
 * resolves to near-black, so a dialog whose text colour is inherited from the
 * app became dark-on-dark — the settings sheet that "showed nothing".
 *
 * Two ways to find out, in this order:
 *
 * 1. **Ask the app.** `color-scheme` is a real CSS property, it inherits, and
 *    dsh declares it on `document.documentElement` (`<html>`), keeping its token
 *    variables on `body` — measured 2026-09-20 against the running web app, see
 *    `docs/help/panel-theme.md`. That declaration is the app's own answer, so it
 *    beats any guess we could make.
 * 2. **Read the light.** An app may declare nothing, or declare
 *    `color-scheme: light dark` to mean "whatever the OS says"; neither says
 *    which one is on now. The colour the app hands down to our container does: a
 *    dark app gives light text.
 *
 * We deliberately do *not* read our own panel root's `color-scheme`: we set that
 * property ourselves, so it would only echo our own last guess back at us.
 */

/** Perceived brightness of an `rgb()`/`rgba()` colour, 0–255, or undefined. */
function brightnessOf(cssColor: string): number | undefined {
  const match = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(cssColor)
  if (match === null) return undefined
  const [r, g, b] = [Number(match[1]), Number(match[2]), Number(match[3])]
  if ([r, g, b].some((value) => Number.isNaN(value))) return undefined
  // Rec. 601 luma: close enough to "does this look light", and no colour
  // management needed for a two-way decision.
  return 0.299 * r + 0.587 * g + 0.114 * b
}

/**
 * The scheme a text colour implies.
 *
 * @param cssColor - a computed colour, e.g. `rgb(230, 232, 234)`.
 * @returns `dark` for light text (a dark app), `light` for dark text.
 */
export function schemeOfColor(cssColor: string): 'light' | 'dark' {
  const brightness = brightnessOf(cssColor)
  // Unparseable colour: dsh's own UI is dark, and guessing dark keeps the
  // native controls legible in the composition this plugin actually ships in.
  if (brightness === undefined) return 'dark'
  return brightness > 140 ? 'dark' : 'light'
}

/**
 * Decide from both signals, the app's own declaration winning.
 *
 * @param declared - the computed `color-scheme` of the document element.
 * @param inheritedTextColor - the computed text colour our container inherits.
 * @returns the scheme the panel should declare.
 */
export function schemeFrom(declared: string, inheritedTextColor: string): 'light' | 'dark' {
  // `light dark` (and `normal`) means "either one, ask the environment"; only a
  // single keyword is an answer.
  const single = declared.trim().toLowerCase()
  if (single === 'light' || single === 'dark') return single
  return schemeOfColor(inheritedTextColor)
}

/**
 * Read the scheme off the document element, falling back to inherited text.
 *
 * @param element - the panel's own root, whose inherited text colour is read.
 * @returns the scheme to declare, so native controls match the app.
 */
export function schemeOf(element: Element | null): 'light' | 'dark' {
  if (typeof document === 'undefined' || typeof getComputedStyle !== 'function') return 'dark'
  const root = document.documentElement
  const declared = root === null ? '' : getComputedStyle(root).colorScheme
  const target = element ?? document.body
  if (target === null || target === undefined) return schemeFrom(declared, '')
  return schemeFrom(declared, getComputedStyle(target).color)
}
