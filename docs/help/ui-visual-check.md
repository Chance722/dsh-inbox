# 面板 UI 的视觉/几何验证（拿不到真机截图时）

面板跑在浏览器里，而浏览器里的东西**只有眼睛能验**：列宽、"能不能放一行"、箭头有没有对齐，
typecheck 与单测都看不见。本文记的是 2026-09-19 实测出来的可行路径与三个坑。

## 真机面板什么时候拿不到

- **token 不落盘**：`dsh --profile inbox --no-open --port 3102` 启动时把带 token 的 URL
  打在 stdout，之后**哪里都不存**（已查 profile 的 `cordis.yml` / `cordis.patch.yml`、
  `~/.dsh/settings.yaml`、`~/.dsh` 下没有 token 文件）。不带 token 访问根路径是 **401**。
- **别人的实例占着端口就起不了第二个**：`EADDRINUSE`。此时只能请启动者把 URL 给你。
- **沙箱里的端口检查会假报**：`Get-NetTCPConnection` 在 Codex 沙箱内因权限不足**静默返回空**，
  看起来"3102 没人监听"，于是你以为可以自己起一个——真起服务才发现端口被占。查端口要带提权。

## 内置浏览器（iab）走不通

| 试过的路子 | 结果（2026-09-19） |
|---|---|
| `http://127.0.0.1:4399/` 或 `http://localhost:4399/` | `net::ERR_BLOCKED_BY_CLIENT` |
| `data:text/html;base64,…` | 被 URL policy 拒绝 |
| `file:///…`（历次记录） | 同样被拒 |

结论：**本地页面别指望内置浏览器**。

## 能用的路子：终端里的 headless Chrome

本机有 `C:\Program Files\Google\Chrome\Application\chrome.exe`（Edge 同款参数，路径见
`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`）。它读 `file://` 没问题，
不需要起服务器：

```powershell
$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$args = @('--headless=new','--disable-gpu','--no-sandbox','--no-first-run',
          "--user-data-dir=$env:TEMP\ui-check",'--virtual-time-budget=5000',
          '--window-size=1400,880',
          "--screenshot=$env:TEMP\ui.png",
          'file:///<仓库路径>/.research/ui-check/index.html?report=0')
Start-Process -FilePath $chrome -ArgumentList $args -Wait -NoNewWindow
```

**坑**：PowerShell 用 `&` 起 GUI 程序**不会等**，`--dump-dom` 会拿到空字符串（exit code 也是空的）。
必须 `Start-Process -Wait -RedirectStandardOutput`。

两种用法：

- `--dump-dom`：让检查页把量到的数字写进一个 `<pre id="report">`，dump 出来的 DOM 里就有**几何报告**
  （列宽、按钮宽度、图标中心偏移、是否同一行）。比看图精确，还能被 diff。
- `--screenshot=…png --window-size=W,H`：肉眼看的 PNG，可以贴进回复给用户确认。

### 除了几何，颜色也能这么量（2026-09-20 新用）

浅色/深色的 bug（`Canvas` 底 + 继承来的文字色 = 看不见内容）不是几何问题，但同一套办法能给出**数字证据**：
`.research/ui-check/scheme-check.html` 按 dsh 的真实 DOM 形状（`<html>` 声明 `color-scheme`、`<body>` 给文字色）
跑五个场景，报告 `schemeOf` 的返回值、弹窗/`select` 的实际 `background-color`，以及两者的**对比度**——
"看不见"于是变成 `contrast≈1.10` 这个可 diff 的数。规则与结论见 `docs/help/panel-theme.md`。

跑它要多两个参数（比几何页多）：

```powershell
$args = @('--headless=new','--disable-gpu','--no-sandbox','--no-first-run',
          '--allow-file-access-from-files',          # file:// 下加载本地 ES 模块，少了这句脚本静默不跑
          "--user-data-dir=$env:TEMP\ui-check-scheme",'--virtual-time-budget=5000',
          '--window-size=820,900',"--screenshot=$png","--dump-dom",
          'file:///<仓库路径>/.research/ui-check/scheme-check.html')
```

那个页面 import 的是 `./scheme.js`——由 `npx --no-install esbuild src/client/scheme.ts --format=esm --outfile=.research/ui-check/scheme.js`
从**真源码**编出来的，不是手抄一份（手抄的镜像只会验自己）。

## 检查页要守的两条

1. **样式值逐条从 `src/client/index.tsx` 抄**，尤其是 `font: 14px/1.6 system-ui, sans-serif`
   ——中文标签的宽度全靠它，"能不能放一行"量错就白量。
2. **页面上写一句"样式镜像页（假数据），不是真机截图"**，截图自证来源，免得日后被当成真机证据。

## 探针必须挂进文档再量（2026-09-20 踩到）

镜像页第一次跑出 `app says light dark → dark`，不是插件错了，是**探针本身没挂上去**：
`getComputedStyle(el).color` 对**不在文档里**的元素返回**空串**（Chrome 实测），
空串解析不出亮度 → 走"读不懂就按深色"的兜底，于是场景 3/4 全落在 `dark` 上，看着像判定逻辑坏了。
真机上面板永远是挂载状态（effect 里读），所以镜像页也必须**先 `append` 再量**。
凡是"读数不对"的镜像结果，先怀疑探针的位置，再怀疑被测代码。

镜像页**只能证几何**（这套数值在真实引擎 + 真实字体下长什么样），不能证组件逻辑正确——
那部分仍旧靠 typecheck / 单测 / 读代码。检查页不是产品的一部分，放 `.research/ui-check/`
（已 gitignore，删掉不影响任何东西）；留着是为了下轮少写一遍骨架，但**它不会自己跟着代码走**，
复用前先把里面的样式值跟当轮的 `src/client/index.tsx` 逐条对齐，否则量到的是上一轮的界面。

## 2026-09-19 量到的基线（改这些数值时可对照）

| 项 | 实测 |
|---|---|
| 面板 1400px | 三列 `176px / 776px / 380px`（详情列取到上限 380） |
| 详情列内容宽 | **354px**（380 − 2×12 内边距 − 2×1 边框）。漏算边框会得到 356，13 步之前的记录就是这么错的 |
| 详情表单 | 类目 select / 描述 / 标签输入框都取满 354px |
| 详情动作行 | 三个按钮**等宽三等分**（各 114px）+ 两道 6px 间距 = 354px，正好填满 |
| 面板 960px | `176 / 336 / 380`，仍不溢出——所以窄屏阈值定在 960 |
| 分页按钮 / 模式按钮 | 分页 79×31.2；两类按钮的图标中心相对按钮中心偏移都是 **0** |
| 图片附件 | 外框 0px、内边距 0；图片与说明相对面板中心偏移 ≤0.02px |
| 列表卡片 | 网格高 94px（图标 34×34）；紧凑行高 **47px**，图标 / 标题 / 元信息 / 待看胶囊四个中心相等 |
| 详情时间戳 | 距卡片下沿 17px（`bottom: 16` + 1px 边框），始终在框内 |
| 详情列 | 有界 flex 列 + 内容列 `overflow-y: auto`：内容比卡片高时**列内滚动**（实测 h=603.6 / 内容 809，滚动到底时时间戳位移 0、按钮可见）；留白用 `margin-bottom: 40` 才挡得住内容滑到时间戳底下 |
| 密钥标题 | `密钥 / 账密（描述…）`，描述截断在 24 字符（逻辑在 `src/client/heading.ts`，另有单测），整行再由 CSS 省略号收口 |
| 两列卡片 | 一律 **94px**（不论有没有预览行）；图标 38px（含边框 40）；预览位 64×64 且是一个自己的按钮 |

## 2026-09-20（M7.16）新增基线

| 项 | 实测 |
|---|---|
| 工具栏控件高度 | 搜索框 / 列表模式组 / 刷新 / 筛选**都 34.39px**，顶边都 71.19（`CONTROL_HEIGHT = calc(1.6em + 12px)`，面板 `14px/1.6` ⇒ 22.4+10+2） |
| 列表模式按钮 | 每个 **38 × 32.39**（组内 `height: 100%`），两个图标中心与整行中心都是 88.38，**偏移 0** |
| 判定来源胶囊 | 三个各 **62 × 21.59**，与所在行同轴（中心 128.77 三者相等） |
| toast | `top:50%` + `translate(-50%,-50%)`，距视口中心 X/Y**都是 0**；`pointer-events: none` |
| 列表标题 | 一行装得下：`flex / center / space-between / gap 8` 的行里「图片 · 待看」量到 70.5px（这是文案改动，量它只为证明窄列里不会折行） |
| 一次性镜像页 | `.research/ui-check/index.html`（含 `?clean=1` 隐藏报告行，方便出图）；本轮样式值逐条抄自当轮 `src/client/index.tsx` |

## 2026-09-20（M7.17）新增基线

| 项 | 实测 |
|---|---|
| 详情表单 | 名称 / 类目 / 描述三个控件**都是 354px**（380 − 2×12 内边距 − 2×1 边框），名称输入框高 **34.39**，与工具栏控件同高（同一个 `calc(1.6em + 12px)`） |
| 镜像页 | 加了 `#pane-card`（380px 卡片 + 三个控件）与 `detailForm` 量测项，专门盯"新字段有没有和别的控件对齐" |
