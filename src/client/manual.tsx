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

import { CATEGORY_LABELS, CATEGORY_SOURCE_LABELS } from '../shared/vocabulary.js'

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
      {label.length === 0 ? '' : '：'}
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
  return (
    <div
      role="dialog"
      aria-label="使用手册"
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
          <strong style={{ fontSize: 16 }}>dsh-inbox 怎么用</strong>
          <span style={{ opacity: 0.6, fontSize: 12 }}>三分钟看完</span>
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
            关闭
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
        <Section title="1. 往里存">
          <Line label="面板">
            粘贴文字/链接、拖进图片文件，或点「选择文件…」，然后「存入仓库」（Ctrl+Enter 也行）。
          </Line>
          <Line label="对话里">
            输入 <code>/inbox 文字或链接</code>，图片直接附在输入框上；不发给模型。
          </Line>
          <Line label="重复">
            同一样东西再存一次不会新增，会并进原记录；如果它之前在回收站，会顺手取回来。
          </Line>
        </Section>

        <Section title="2. 怎么翻、怎么改">
          <Line label="筛选">
            左侧「全部 / 待看 / 回收站」与类目、标签互斥；「待看」是你自己打的标记，新记录不带任何标记。
          </Line>
          <Line label="列表">
            两种密度（两列 / 紧凑）随手切，会记住；上面搜索框搜标题、正文、链接、备注。
          </Line>
          <Line label="详情">
            右边一栏可以改名称、类目、备注、标签，也能标待看、删除、恢复。
          </Line>
        </Section>

        <Section title="3. 列表里显示的名字是哪儿来的">
          <Line label="顺序">
            你起的名称 → 抓来的页面标题 → 链接/正文/文件名 → 备注（最后兜底）。
          </Line>
          <Line label="类目图标">
            {Object.values(CATEGORY_LABELS).join(' / ')} 各有图标；密钥/账密是钥匙，一眼能认出来。
          </Line>
          <Line label="谁判的">
            类目旁的标签分三种：{Object.values(CATEGORY_SOURCE_LABELS).join(' / ')}
            （你选过的类目，规则和模型都不会覆盖）。
          </Line>
        </Section>

        <Section title="4. 密钥与账密">
          <Line label="先设主密码">
            设置 → 账密加密。设了之后，账密正文以密文写盘；没设的时候，账密不会被存进去（宁可不存，也不写明文）。
          </Line>
          <Line label="每次重启要解锁">
            主密码和密钥都不落盘，所以服务一重启就要在同一个地方解锁一次；密码忘了就解不开，没有找回。
          </Line>
          <Line label="永不外显">
            列表里只显示你起的名字；对话里只回一句「明文不会通过对话输出」；发给模型的分类请求先脱敏。
          </Line>
        </Section>

        <Section title="5. 同步（本机 ↔ 云盘）">
          <Line label="自动">
            入库/改动后几秒自动推送一次（防抖，连着存五条只会推一次）。
          </Line>
          <Line label="手动">
            右上角「刷新」= 一次完整同步：先推本机改动，再拉别人的，然后重读列表。
          </Line>
          <Line label="删除">
            面板里的「删除」只是把它放进回收站（别的设备也会知道它被删了，不会又被拉回来）；
            「清空回收站」才是真删，云端那份也会一起删。
          </Line>
          <Line label="冲突">
            多设备改同一条按时间后写赢，不留冲突副本。上云的密文只有账密正文，其余是明文——桶务必要有访问控制。
          </Line>
        </Section>

        <Section title="6. 在对话里取回来">
          <Line label="查">
            在对话里直接问：「我的收件箱里有哪些还没看的链接？」助手会去仓库里找，
            最多列 10 条，并告诉你还剩几条。叫它「收件箱」「仓库」「个人仓库」还是「inbox」都认。
          </Line>
          <Line label="取">
            接着说「打开第 3 条」，助手就把那条拿回来：正文（最多 1000 字）、链接、备注、标签、附件信息。
          </Line>
          <Line label="两条硬拒绝">
            账密永不回明文；图片默认只回一个标记，由界面在本机画出来。想让助手亲眼看图（比如「这张是什么码」），
            直接说「帮我看这张图」——那一次才会把这张图发给它。
          </Line>
          <Line label="助手说不认识这个仓库">
            说明这个会话没带上收件箱插件。新开一个会话再问一次即可——面板能用、助手看不到，
            这两件事是分开的。
          </Line>
        </Section>

        <Section title="7. 出问题先看这里">
          <Line label="链接没名字">
            正常：有些站点（如微信）对非浏览器请求只回空壳页，抓不到标题；点进详情自己起个名字即可。
          </Line>
          <Line label="云盘里有 0 字节目录">
            云盘自己建的占位对象，不是插件写的，可以忽略。
          </Line>
          <Line label="同步不对">
            设置里点「自检」：会告诉你通道通不通、哪种签名可用；认证被拒通常是「客户端标识」与 AccessKey 绑定的应用不一致。
          </Line>
        </Section>
        </div>
      </div>
    </div>
  )
}
