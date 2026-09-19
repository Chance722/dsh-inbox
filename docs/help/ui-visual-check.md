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
          'file:///C:/Duoyu/dsh-inbox/.research/ui-check/index.html?report=0')
Start-Process -FilePath $chrome -ArgumentList $args -Wait -NoNewWindow
```

**坑**：PowerShell 用 `&` 起 GUI 程序**不会等**，`--dump-dom` 会拿到空字符串（exit code 也是空的）。
必须 `Start-Process -Wait -RedirectStandardOutput`。

两种用法：

- `--dump-dom`：让检查页把量到的数字写进一个 `<pre id="report">`，dump 出来的 DOM 里就有**几何报告**
  （列宽、按钮宽度、图标中心偏移、是否同一行）。比看图精确，还能被 diff。
- `--screenshot=…png --window-size=W,H`：肉眼看的 PNG，可以贴进回复给用户确认。

## 检查页要守的两条

1. **样式值逐条从 `src/client/index.tsx` 抄**，尤其是 `font: 14px/1.6 system-ui, sans-serif`
   ——中文标签的宽度全靠它，"能不能放一行"量错就白量。
2. **页面上写一句"样式镜像页（假数据），不是真机截图"**，截图自证来源，免得日后被当成真机证据。

镜像页**只能证几何**（这套数值在真实引擎 + 真实字体下长什么样），不能证组件逻辑正确——
那部分仍旧靠 typecheck / 单测 / 读代码。检查页是一次性的，验完删掉（放 `.research/`，已 gitignore）。

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
