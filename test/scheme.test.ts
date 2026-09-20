/**
 * Which colour scheme the panel decides the surrounding app is drawn in.
 *
 * This is the whole of the light-mode fix, and it is a guess made from one
 * number — the brightness of the text colour the app hands down to us. The
 * guess is what the native `<select>` popup and every `Canvas`-filled dialog
 * then obey, so the two directions are worth pinning: light text means a dark
 * app, dark text means a light app, and the boundary is exactly where the code
 * says it is.
 *
 * `schemeOf` cannot be exercised here — it needs a real engine's
 * `getComputedStyle`, and these tests run in Node with no DOM. What is tested is
 * the decision it delegates to, plus the no-DOM fallback it must survive.
 */

import { describe, expect, it } from 'vitest'

import { schemeFrom, schemeOf, schemeOfColor } from '../src/client/scheme.js'

describe('schemeOfColor', () => {
  it('reads light text as a dark app and dark text as a light app', () => {
    expect(schemeOfColor('rgb(230, 232, 234)')).toBe('dark')
    expect(schemeOfColor('rgb(28, 28, 30)')).toBe('light')
  })

  it('takes alpha and loose whitespace the way the engine prints them', () => {
    // `getComputedStyle().color` comes back as `rgba(...)` when a theme sets
    // opacity, and some browsers put no space after the commas.
    expect(schemeOfColor('rgba(255, 255, 255, 0.87)')).toBe('dark')
    expect(schemeOfColor('rgb(20,20,20)')).toBe('light')
  })

  it('treats mid grey as the light side, one step either way of 140', () => {
    // Not a claim about taste: a boundary that moves silently is how "it was
    // readable yesterday" happens.
    expect(schemeOfColor('rgb(140, 140, 140)')).toBe('light')
    expect(schemeOfColor('rgb(141, 141, 141)')).toBe('dark')
  })

  it('falls back to dark when the colour is not one it can read', () => {
    // A modern colour space this regex does not parse, and an empty string:
    // dsh's own UI is dark, and guessing dark keeps the native controls
    // legible in the composition this plugin actually ships in.
    expect(schemeOfColor('oklch(0.8 0.02 250)')).toBe('dark')
    expect(schemeOfColor('')).toBe('dark')
  })
})

describe('schemeOf', () => {
  it('answers dark where there is no document to ask', () => {
    expect(schemeOf(null)).toBe('dark')
  })
})

describe('schemeFrom', () => {
  it('takes the app’s own declaration over anything it can infer', () => {
    // The case that matters: dsh writes `color-scheme` onto `<html>`, so the
    // answer is the app's, not our reading of its text colour.
    expect(schemeFrom('light', 'rgb(230, 232, 234)')).toBe('light')
    expect(schemeFrom('dark', 'rgb(28, 28, 30)')).toBe('dark')
    expect(schemeFrom('LIGHT', 'rgb(0, 0, 0)')).toBe('light')
  })

  it('falls back to the text colour for a scheme that answers nothing', () => {
    // `light dark` is "whatever the OS says" and `normal` is "undeclared";
    // in both the inherited text colour is the only thing that knows.
    expect(schemeFrom('light dark', 'rgb(28, 28, 30)')).toBe('light')
    expect(schemeFrom('normal', 'rgb(230, 232, 234)')).toBe('dark')
    expect(schemeFrom('', 'rgb(230, 232, 234)')).toBe('dark')
  })
})
