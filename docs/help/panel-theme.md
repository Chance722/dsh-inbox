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

## 还没验/待办

- 真实浅色 dsh 下的人工复验（用户侧）：设置弹窗、使用手册、详情 select、列表选中条。
- dsh 的**客户端主题服务**能不能被第三方插件直接订阅（`ctx.theme`？）没查过；现在这套是"读 DOM"，不依赖私有 API，
  但如果官方暴露了订阅口，那会是更正的写法（不用观察 DOM）。
