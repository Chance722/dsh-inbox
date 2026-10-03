/**
 * The one control every dialog header shares.
 *
 * A round ✕ with no word next to it (asked 2026-10-03: "关闭按钮…都在右上角，
 * 然后都只有 icon 不要文本"). It carries `aria-label` at the call site, because a
 * glyph is not a name.
 *
 * Lives in its own module so the panel's dialogs and the manual's do not each
 * grow their own copy — and so neither has to import the other.
 */
import type { CSSProperties } from 'react';
export declare const closeButtonStyle: CSSProperties;
