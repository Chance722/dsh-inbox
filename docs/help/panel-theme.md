# 面板的主题：怎么知道宿主是深色还是浅色

面板住在别人的 UI 里，**不能假定主题**。这条文档记的是"怎么问出来"，以及三种反色写法各自会怎么坏。
实现只有一处：`src/client/scheme.ts`（`schemeOf` / `schemeFrom` / `schemeOfColor`）。

## 实测事实：dsh 把主题声明在哪（2026-09-20）

对着本机正在跑的 `dsh --profile inbox --port 3102` 实例，把它自己的客户端产物读出来看（`@deepseek-ai/dsh-client-ui-theme`），
主题服务的 `apply(snapshot)` 是这么写的：

```js
const scheme = snapshot.active.colorScheme
document.documentElement.style.colorScheme = scheme   // ← 权威声明在 <html> 上
const body = document.body
if (scheme === "dark") body.setAttribute(DARK_ATTRIBUTE, "")
else body.removeAttribute(DARK_ATTRIBUTE)             // ← 深色标记在 <body> 上
body.style.setProperty(CONTENT_FONT_SIZE_VARIABLE, `${snapshot.fontSize}px`)
for (const [name, value] of Object.entries(snapshot.active.tokens)) body.style.setProperty(name, value)
                                                      // ← 主题 token（含文字色）挂在 <body> 的行内 style 上
```

结论：**`<html>` 上的 `color-scheme` 就是宿主的原话**，`<body>` 上是文字色与 token。
我们的面板继承 `<body>` 的文字色，所以"读 `<html>` 的声明、读不到再读继承来的文字色"这两步在 dsh 里都能落地。

主题偏好可以选「跟随系统」：那种情况下 dsh 自己在 OS 翻转时会重新 `apply`，于是 `html.style` 被改写，
属性观察者能看到；一个**只用 CSS media query** 的应用没有这一步，所以 `matchMedia('(prefers-color-scheme: dark)')`
的 `change` 监听是另一半保险。

## 判定顺序

| 顺序 | 信号 | 用法 |
|---|---|---|
| 1 | `<html>` 的 computed `color-scheme` | 是单一关键字 `light` / `dark` → 直接采信（宿主原话，压倒一切猜测） |
| 2 | 面板根容器继承到的文字色 | `light dark`（"随环境"）或 `normal`（没声明）时才有用：亮文字=深色 app，暗文字=浅色 app |

阈值写在 `schemeOfColor`：Rec. 601 亮度 > 140 判为"亮文字"。边界值（140/141）有单测钉着，**别静默改**——
改这个数就是改"什么算浅色"，会影响原生控件与所有 `Canvas` 底色的弹窗。

## 三个坑

1. **别读自己的 `color-scheme`**。面板根自己要声明这个属性，读它只会把上一次的猜测回声回来（自我确认的循环）。
   要读就读 `<html>`。
2. **别硬编码 `color-scheme: dark`**。它是 M7 第九步为修"深色 app 里原生下拉白底白字"下的补丁，然后在浅色模式下变成
   更糟的三个 bug：`Canvas` 解析成近黑（`rgb(18,18,18)`），而**文字色是从宿主继承的暗色**，于是「设置」弹窗整片看不清、
   详情的 select 图成黑色。镜像页量出来的对比度是 **1.10**（正常要 4.5 以上）。
3. **`Canvas` 与 `currentColor` 不是一回事**。`Canvas`/`CanvasText` 跟 `color-scheme` 走，`currentColor` 跟继承的文字色走；
   把"背景 `Canvas` + 文字继承"混在一起，就是上面那条 bug 的配方。

## 观察者怎么写（`src/client/index.tsx` 里的 effect）

- 观察 `document.documentElement` 与 `document.body` 的**属性**（`attributes: true`），**不观察子树**：
  面板自己会在根容器上写 `color-scheme`，观察子树会让自己的写入触发自己重读。
- 加 `matchMedia('(prefers-color-scheme: dark)')` 的 `change` 监听，覆盖"应用跟随系统但不重写标记"的情况。
- 重读只是一次 `getComputedStyle`，随便多，不怕。

## 怎么验

真机 token 拿不到时用镜像页（headless Chrome，见 `docs/help/ui-visual-check.md`）：
`.research/ui-check/scheme-check.html` 按 dsh 的**真实 DOM 形状**（`<html>` 声明、`<body>` 给文字色）跑五个场景，
把 `schemeOf` 的返回值、弹窗/select 的实际 `background-color` 与对比度写进 `<pre id="report">`：

| 场景 | 期望 |
|---|---|
| dsh 浅色（`light` + 暗文字） | `schemeOf=light`、弹窗 `rgb(255,255,255)`、对比度 ≈21 |
| dsh 深色（`dark` + 亮文字） | `schemeOf=dark`、弹窗 `rgb(18,18,18)`、对比度 ≈18.7 |
| 应用只说 `light dark` | 退回文字色判：暗文字 → `light` |
| 应用什么都没声明 + 亮文字 | `dark` |
| 对照：浅色 app 里硬编码 `dark`（旧写法） | 对比度 ≈**1.10**（这就是"设置页面看不到内容"） |

**镜子里量不到的**：面板在一个**真的浅色 dsh** 里的观感（间距、蓝底选中条在白底上的强弱）。那一条只能人眼过一遍。

## 设计 token 层（2026-10-02）

用户第一轮反馈："像表单的线、边框、按钮啥的整体都很粗糙，整体没有什么设计感。"根因不是缺框架，是**没有一套统一的取值**：圆角 8/10/12 混用、边框是 18%/22%/25% 三个灰、**而且没有任何 hover / active / focus 状态**——控件全都像"按钮的图片"。

做法（不引任何依赖，规则 11 也不许引）：

1. **token 挂在面板自己的根上**（`.ib-root`），由 `themeVars(scheme)` 用行内样式写进去。除强调色/危险色外，**每个值都是从 `currentColor` 与 `Canvas` 现算的**——这两个正是本文上面认定可以信任的宿主信号，所以一套 token 同时服务深浅两色，不存在第二份调色板：

   | token | 取值 | 用途 |
   |---|---|---|
   | `--ib-surface` / `-2` / `-3` | `currentColor` 4% / 8% / 13% over `Canvas` | 卡片面 / 悬停面 / 按下与选中面 |
   | `--ib-line` / `--ib-line-strong` | `currentColor` 14% / 26% | 边框、分隔线 / 悬停边框 |
   | `--ib-dim` | `currentColor` 62% | 次要文字（取代满屏 `opacity: .6`） |
   | `--ib-accent` | 浅色 `#2f6feb`、深色 `#6e9ef7` | 选中、聚焦环、主操作 |
   | `--ib-danger` | 浅色 `#c62828`、深色 `#ff7b72` | 删除类动作 |
   | `--ib-r-sm` / `--ib-r` / `--ib-r-lg` | 6 / 9 / 12px | 控件 / 卡片 / 弹层 |
   | `--ib-shadow-1` / `-2` | 极轻 / 大 | 卡片 / 悬浮层与对话框 |

   **强调色与危险色是唯一的例外**：grey 说不出"这条是你标的"和"这个会删东西"。它们按 `scheme.ts` 已经判定的 scheme 取两个值（不是按 OS，也不是硬编码 `color-scheme`），浅色用深一档、深色用亮一档。

2. **交互态写在一张作用域样式表里**（`.ib-root button/input/select/textarea`），因为行内样式表达得了"长什么样"，表达不了"鼠标上去会怎样"。规则很少：hover 换 `--ib-surface-2` + 强边框、active 再深一档、`:focus-visible` 2px 强调色描边、`:disabled` 降到 45%、所有过渡 120ms。**变体按钮的 hover 靠同一个变量**——`primaryStyle` 的底色是 `var(--ib-primary-bg)`，hover 规则把 `--ib-primary-bg` 换成 `--ib-primary-bg-hover`，所以主操作/删除按钮不用各自写一条规则。
3. 组件里**不再现算 `color-mix`**：`cardStyle`/`buttonStyle`/`inputStyle`/`actionStyle`/`primaryStyle`/`dangerStyle`/`chipStyle`/`RailRow`/`EntryCard` 全部改读 token。以后要调只能改 token 一处处。

**两套主题的对比度**（按 token 配方做 sRGB 合成算的，不是取像素；阈值 4.5）：

| scheme | 正文 | 次要文字 | 主操作文字 | 危险文字 |
|---|---|---|---|---|
| 浅色 | 21.00 | 6.20 | 17.27 | 4.57 |
| 深色 | 18.73 | 7.60 | 14.99 | 6.16 |

**验证页**：`C:\Users\hands\.codex\visualizations\…\panel-design-check.html`（一次性，放可视化目录不进仓库）——把 token 与交互层原样抄一份，浅色/深色并排渲染同一批控件（按钮四种 + 禁用 + 悬停示意、输入框静止/聚焦、标签、导航行、选中卡片、弹层）。做法沿用 `ui-visual-check.md` 的 headless Chrome。

**这次踩的**：注入的 `<style>` 是 JS 模板字符串，里面写中文注释会被 `test/i18n.test.ts` 当作"组件自带文案"拦下（它剥不掉字符串里的注释）——CSS 里的注释一律用英文。

### 第二轮：真的换视觉语言（2026-10-03）

用户看完第一轮说"**区别不大**，按钮还是一样的，下拉框、输入框、高亮态变化不大；要实体胶囊按钮、圆角下拉面板、整体圆滑、有交互动画，参考 ant-design"。诊断：第一轮只把**旧形状映射到 token**（圆角 8→9、边框仍是 1px、底色仍是透明），视觉语言一点没动。第二轮才是真的换：

| 控件 | 之前 | 现在 |
|---|---|---|
| 普通按钮 | 1px 细边 + 透明底 | **实体胶囊**：无边框、`--ib-control-fill` 填充（10% 墨，悬停 15%、按下 20%）、`border-radius: 999px` |
| 主操作 / 删除 | 淡淡的墨色/红色**底纹** | **实心**：`#2f6feb` / `#d92d20` + 白字（`--ib-accent-ink`）。实心色不能再用 `currentColor` 反相——那正是"白底白字"老 bug 的配方 |
| 输入框 | 透明底 + 1px 边 | **填充式**（`--ib-control-fill`）+ `--ib-r-lg`，聚焦时强调色描边 + 3px 柔光圈 |
| 下拉框 | 原生 `<select>`（弹层是操作系统的，样式不了） | **自绘下拉**：触发器是实体胶囊，弹层是 `--ib-r-panel`(16px) 圆角面板 + 大阴影 + 悬停行 + 当前项勾选；键盘 ↑/↓/Enter/Esc，点外部关闭 |
| 列表模式 | 两个边框按钮 | **分段控件**：一个填充轨道 + 活动段是浮起的 `Canvas` 板 + 阴影 |
| 导航行 / 标签 | 灰底 / 描边 | **强调色胶囊**：选中 = `--ib-accent-soft` 底 + 强调色文字 |
| 交互 | 什么都没有 | 悬停/按下/聚焦/禁用 + **入场动画**（`.ib-pop`：弹层与对话框 140–160ms 从上方 4px 淡入并轻微放大） |

**两个实现要点**：

- **填充色要走变量才能有 hover**：行内 `background` 会压过样式表，所以控件写的是 `background: var(--ib-control-fill)`，hover 规则改的是那个变量（`--ib-control-fill: var(--ib-control-fill-hover)`）。主操作/删除同理，一个规则同时点亮三种变体。
- **模板字符串里不能出现反引号**：CSS 注释里写 `` `:active` `` 会直接结束 JS 字符串（`tsc` 报的是一堆 `'}' expected`）。同理中文注释会被 i18n 测试拦下。这张样式表：注释英文、无反引号。

**"改了却看不到"的排查顺序**（用户实际遇到）：① 客户端改动必须 `pnpm build`（`dsh web` / dev:local 加载的是仓库里的 `lib/client.js`，源码改了不重建等于没改）；② 浏览器要**硬刷新**（Ctrl+Shift+R），面板 bundle 有缓存；③ 确认 `lib/client.js` 的 mtime 比源码新（`test/lib-artifacts.test.ts` 能守住"忘了重建"）。

### 第三轮：详情与列表的细节（2026-10-03 同日）

用户逐条点的问题与改法：

| 反馈 | 根因 | 改法 |
|---|---|---|
| 详情弹窗的标题应该和关闭按钮都在顶部 | 弹窗头部只有关闭按钮，标题在滚动区里的第一行 | 头部（`headingOf(detail)` + 关闭按钮 + 一条 hairline）挪到**滚动区之外**（和底部时间戳同一条规矩），宽度不够时标题省略号截断 |
| 表单太密集 | 滚动列 `gap: 10` | → `gap: 14` |
| 按钮要和表单有间距 / 干脆定位到底部 | 三个操作按钮跟在表单后面一起滚 | 操作行改 **sticky 页脚**：`position: sticky; bottom: 0` + `borderTop` + `paddingTop: 10`，并 `marginInline: -4 / paddingInline: 4` 让它铺满面板（滚动容器有 4px 内边距） |
| 详情输入框聚焦的高亮左右被裁剪；列表悬停高亮同样 | **`overflow-y: auto` 会让另一轴也裁**（CSS 把 `visible` 计算成 `auto`），3px 的聚焦光圈/阴影正好画到容器外 | 两个滚动容器各给 `padding: 4`（正好是一个 ring + offset 的空间）；列表卡片再也没被削边 |
| 高亮态不要影响元素抖动 | 悬停用了 `transform: translateY(-1px)`，加上裁剪就是"动一下、缺一角" | 去掉位移：悬停只换边框色与阴影（不动布局、不动几何） |
| 精简模式列表项上下要间距，高亮底色也要圆角 | 精简行是 `gap: 0` + 通栏色带、`borderRadius: 0` | 容器 `gap: 4`，行改 `border-radius: var(--ib-r)` + 透明边框（选中才亮强调色） |

**这一轮又踩的**：验证镜像页的 token 块没跟着源码更新，于是它渲染出的"删除"是透明底白字（真面板是实心红）——镜像与真面板不一致会**误导判断**。以后改 token 必须同时同步 `panel-design-check.html` 的 token 块（它是那一页里唯一手工复制的一段）。

### 第四轮：弹窗与下拉的最后几处（2026-10-03 同日）

| 反馈 | 根因 | 改法 |
|---|---|---|
| 关闭按钮只要 ✕，圆形底 | 上一版是「✕ 关闭」文字按钮 | 28×28 圆形按钮 + `--ib-control-fill` 底，`aria-label`/`title` 保留可访问名（字形本身不是名字） |
| 三个按钮还是没沉底 | **`position: sticky` 只在内容比滚动口高时才粘住**——记录短的时候按钮就停在中间 | 操作条**移出滚动区**，做成页脚的兄弟节点（`flex: none`）：头部（不滚）/ 内容（`flex: 1` 滚）/ 页脚（不滚）。时间戳一并移进页脚（两样东西都抢 `bottom` 必然重叠），滚动区那句 `marginBottom: 40` 的预留也随之删掉 |
| 弹窗矮，点下拉就出滚动条 | ① 弹窗只有 `max-height`，高度跟着内容变；② **下拉弹层是 `position: absolute`**，它会把所在滚动容器的 `scrollHeight` 撑大 | ① 弹窗给**确定高度** `min(92vh, 900px)`（视口高就多给点，矮屏也不会顶满）；② 下拉弹层改 **`position: fixed`**，坐标由触发器 `getBoundingClientRect()` 现算、下面放不下就**上翻**（配一个 `ib-pop-up` 关键帧，否则入场动画会覆盖掉内联的 `translateY(-100%)`），并在滚动/缩放时关闭——固定定位既不参与滚动区高度，也不会被滚动口裁掉（真 portal 要 import `react-dom`，客户端不允许/不必要） |

### 第五轮：三处一致性与两个坑（2026-10-03 同日）

| 反馈 | 根因 | 改法 |
|---|---|---|
| 粘贴框的描边比别的面板深 | 那个调用点写的是 `borderColor: dragging ? 'currentColor' : cardStyle.borderColor`，而 **`cardStyle` 早就改成 `border` 简写了，`cardStyle.borderColor` 这个键根本不存在** ⇒ 非拖动时回退成满强度 `currentColor`（100% 墨） | 明确写 `1px solid var(--ib-line)`；拖动是唯一允许"喊"的状态，且用强调色虚线 |
| 聚焦的边框要有圆角、文本要和边框有间距 | 粘贴框是"卡片做的输入框"：textarea 自己 `padding: 0`，也没有自己的边框 | textarea 给 `padding: 8px 10px` + `border: 1px solid transparent`（透明边框让聚焦换色不跳布局）+ `border-radius: var(--ib-r)`，聚焦就用全局那条 `textarea:focus`（强调色描边 + 3px 柔光）。**注意用 `box-shadow` 而不是 `outline`**——box-shadow 一定跟随 `border-radius`，outline 在老 Chromium 上不一定。**第一版把聚焦画在外层卡片上（`.ib-field:focus-within`），用户看到的是"外面的面板也高亮了"**——焦点属于正在输入的那个控件，不属于围着它的框；拖动反馈（虚线强调色）是另一回事，保留在外层卡片上 |
| 精简模式浅色有悬停阴影、深色没有 | 阴影是黑的：浅色底上看得见，近黑的深色面板上等于没有 | 精简行只留底色 tint、去掉阴影；网格卡片的 hover **同时**给 tint 与阴影，深色下也有反馈。实现上把底色走成 `--ib-card-bg` 变量（行内 `background` 会压过样式表，只有变量能让 hover 规则生效） |
| 手册/设置弹窗的关闭按钮要和详情弹窗一致 | 两处各写各的（文字按钮） | 新增 `src/client/controls.ts` 的 `closeButtonStyle`（28×28 圆形 ✕）三处共用；设置弹窗补「设置」标题 + 分隔线，ingest 卡片那枚文字关闭按钮撤掉。放在独立模块是为了让两个组件不必互相 import |

| 详情那三个按钮太长 | 三个都是 `flex: 1`，在宽窗口里被拉成三根长条 | 去掉 `flex`，**按内容宽度 + 整行右对齐**（`justifyContent: 'flex-end'`）；文案缩成 **保存 / 待看 / 删除**（`detail.save` 改值，新增 `detail.watchLabel`，原来的 `detail.watch`/`detail.unwatch` 留下来当 tooltip）；**已待看要一眼看得出来**：选中 = 强调色底 + 强调色文字 + `BookmarkCheck`（实心勾形），未选中 = 中性底 + `Bookmark`（空心）。hover 走 `--ib-watch-fill` 变量，否则通用 hover 规则会把强调色底换成灰色（那会让状态在悬停时消失） |

| 时间戳该在分割线上面、右对齐 | 原先排在按钮**下面**，且左对齐 | 页脚顺序改成 **时间戳（右对齐）→ 分割线 → 按钮（右对齐）**（asked 2026-10-03）。读起来是"这是什么 → 什么时候进来的 → 能对它做什么"，也正是使用这个页脚的顺序 |

**可复用的教训**：`cardStyle` 用的是 `border` 简写，所以 **`cardStyle.borderColor` 是 `undefined`** —— 任何"我没拖动时就用卡片的边框色"这种写法都会静默回退成浏览器默认（这里是 `currentColor`）。要读就写 token，别读简写拆出来的键。

## 还没验/待办

- 真实浅色 dsh 下的人工复验（用户侧）：设置弹窗、使用手册、详情 select、列表选中条。
- dsh 的**客户端主题服务**能不能被第三方插件直接订阅（`ctx.theme`？）没查过；现在这套是"读 DOM"，不依赖私有 API，
  但如果官方暴露了订阅口，那会是更正的写法（不用观察 DOM）。
