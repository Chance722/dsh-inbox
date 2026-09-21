/**
 * The three-minute manual.
 *
 * The panel has grown features faster than it has grown explanations — sync,
 * encryption, naming, the conversation tools — and a user who has to ask "what
 * does this button do" in chat has already lost. This is the answer that lives
 * in the product: one screen, scenarios in the order a person meets them, three
 * lines each at most.
 *
 * Deliberately not a reference manual: the help docs are that. This is the part
 * you read once.
 */

import React from 'react'

import { CATEGORIES, CATEGORY_SOURCES } from '../shared/vocabulary.js'
import { categoryLabel, sourceLabel, t, useLocaleRevision } from './i18n.js'

/** A titled block: one sentence of what, a few bullets of how. */
function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}): React.ReactElement {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <strong>{title}</strong>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, opacity: 0.85 }}>
        {children}
      </div>
    </section>
  )
}

/** One line of explanation, with the label part emphasised. */
function Line({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement {
  return (
    <p style={{ margin: 0 }}>
      <strong style={{ fontWeight: 600 }}>{label}</strong>
      {label.length === 0 ? '' : t('manual.separator')}
      {children}
    </p>
  )
}

/**
 * The manual, as a dialog.
 *
 * @param props - how to close it.
 * @returns the dialog.
 */
export function ManualDialog({ onClose }: { onClose: () => void }): React.ReactElement {
  // The manual is prose, so a language switch has to bring new prose.
  useLocaleRevision()
  return (
    <div
      role="dialog"
      aria-label={t('manual.title')}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 45,
        background: 'color-mix(in srgb, #000 55%, transparent)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '4vh 16px',
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        style={{
          /*
            A fixed width and a bounded height, with the *sections* scrolling.
            The first version let the card grow as tall as its content and put
            the scroll on the backdrop instead — which on a laptop meant the
            manual ran off the bottom of the screen with no visible frame.
          */
          width: 'min(560px, 100%)',
          maxHeight: '92vh',
          // Border inside the width and the cap: without it the card is 2px
          // wider than the number and 2px taller than the overlay's room.
          boxSizing: 'border-box',
          background: 'Canvas',
          color: 'CanvasText',
          border: '1px solid color-mix(in srgb, currentColor 18%, transparent)',
          borderRadius: 12,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 18px 40px #0007',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 8,
            padding: '14px 18px 12px',
            borderBottom: '1px solid color-mix(in srgb, currentColor 12%, transparent)',
          }}
        >
          <strong style={{ fontSize: 16 }}>{t('manual.titleInline')}</strong>
          <span style={{ opacity: 0.6, fontSize: 12 }}>{t('manual.lead')}</span>
          <button
            type="button"
            onClick={onClose}
            style={{
              marginLeft: 'auto',
              font: 'inherit',
              padding: '4px 10px',
              borderRadius: 8,
              border: '1px solid color-mix(in srgb, currentColor 25%, transparent)',
              background: 'transparent',
              color: 'inherit',
              cursor: 'pointer',
            }}
          >
            {t('app.close')}
          </button>
        </div>

        {/* The scrolling part: everything below the title line. */}
        <div
          style={{
            padding: 18,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            overflowY: 'auto',
            minHeight: 0,
          }}
        >
        <Section title={t('manual.1.title')}>
          <Line label={t('manual.1.panel.label')}>{t('manual.1.panel.body')}</Line>
          <Line label={t('manual.1.chat.label')}>
            {t('manual.1.chat.lead')}
            <code>{t('manual.1.chat.code')}</code>
            {t('manual.1.chat.tail')}
          </Line>
          <Line label={t('manual.1.repeat.label')}>{t('manual.1.repeat.body')}</Line>
        </Section>

        <Section title={t('manual.2.title')}>
          <Line label={t('manual.2.filter.label')}>{t('manual.2.filter.body')}</Line>
          <Line label={t('manual.2.list.label')}>{t('manual.2.list.body')}</Line>
          <Line label={t('manual.2.detail.label')}>{t('manual.2.detail.body')}</Line>
        </Section>

        <Section title={t('manual.3.title')}>
          <Line label={t('manual.3.order.label')}>{t('manual.3.order.body')}</Line>
          <Line label={t('manual.3.icon.label')}>
            {CATEGORIES.map((category) => categoryLabel(category)).join(' / ')}
            {t('manual.3.icon.tail')}
          </Line>
          <Line label={t('manual.3.who.label')}>
            {t('manual.3.who.lead')}
            {CATEGORY_SOURCES.map((source) => sourceLabel(source)).join(' / ')}
            {t('manual.3.who.tail')}
          </Line>
        </Section>

        <Section title={t('manual.4.title')}>
          <Line label={t('manual.4.password.label')}>{t('manual.4.password.body')}</Line>
          <Line label={t('manual.4.unlock.label')}>{t('manual.4.unlock.body')}</Line>
          <Line label={t('manual.4.never.label')}>{t('manual.4.never.body')}</Line>
        </Section>

        <Section title={t('manual.5.title')}>
          <Line label={t('manual.5.auto.label')}>{t('manual.5.auto.body')}</Line>
          <Line label={t('manual.5.manual.label')}>{t('manual.5.manual.body')}</Line>
          <Line label={t('manual.5.twoMachines.label')}>{t('manual.5.twoMachines.body')}</Line>
          <Line label={t('manual.5.delete.label')}>{t('manual.5.delete.body')}</Line>
          <Line label={t('manual.5.conflict.label')}>{t('manual.5.conflict.body')}</Line>
        </Section>

        <Section title={t('manual.6.title')}>
          <Line label={t('manual.6.query.label')}>{t('manual.6.query.body')}</Line>
          <Line label={t('manual.6.get.label')}>{t('manual.6.get.body')}</Line>
          <Line label={t('manual.6.refuse.label')}>{t('manual.6.refuse.body')}</Line>
          <Line label={t('manual.6.tools.label')}>{t('manual.6.tools.body')}</Line>
        </Section>

        <Section title={t('manual.7.title')}>
          <Line label={t('manual.7.title.label')}>{t('manual.7.title.body')}</Line>
          <Line label={t('manual.7.zero.label')}>{t('manual.7.zero.body')}</Line>
          <Line label={t('manual.7.sync.label')}>{t('manual.7.sync.body')}</Line>
        </Section>
        </div>
      </div>
    </div>
  )
}
