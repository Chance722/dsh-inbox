# 面板的中英双语（怎么接、接到哪一步）

## 结论：不要自己造语言开关，接官方的 locale 服务

dsh 自带 `@deepseek-ai/dsh-client-locale`（0.1.5-rc.2 实测存在，证据：本机 dsh 安装目录下该包的
`README.zh.md` / `lib/types/client/index.d.ts`）：用户在**设置 → 常规**切换 English / 中文，选择持久化到
`$DSH_HOME/settings.yaml`（loopback 页面），没有偏好时按 `navigator.languages` 匹配、**兜底 English**，
宿主会把 `<html lang>` 指向生效语言。插件作者要做的只是注册自己的词典。

## 我们的接法（`src/client/i18n.ts`）

1. **优先用官方服务**：`ctx.get('locale')` 拿到服务后，`register(ns, 'zh' | 'en', dict)` 注册两边词典
   （用**非类型化重载**，不需要把自己的 namespace 并进官方的 `LocaleNamespaceMap`），再 `bind(ns)` 取回
   按当前语言查表的函数——这样连"语言包 fallback"（例如 `ja` 落到 `en`）都跟着官方规则走。
2. **没有服务就退到文档**：读 `<html lang>`（宿主自己的声明）+ `navigator`，并用 `MutationObserver` 跟change。
   这条是给"组合里没有 locale 插件"用的，也让面板在 headless / 测试里不依赖任何 dsh 包。
3. **重渲染**：`useLocaleRevision()`（`useSyncExternalStore`）——面板、dock、对话卡片是**三棵独立的 React 树**，
   每棵树的根都要订阅一次，否则切语言后那棵树停在旧语言。`t()` 在调用时读当前语言，所以不需要把 `t` 往下传。

## 分工边界（重要）

| 文本 | 归谁 | 现状 |
|---|---|---|
| 面板/卡片/dock 的文案 | 客户端词典（`src/client/messages.ts`） | 已双语 |
| 工具描述、工具返回值（模型看的） | `src/host/tools.ts`、`src/shared/vocabulary.ts`（中文，且云端可读文件也用） | **故意不本地化**：读者是模型与别的设备，不是这个浏览器 |
| 宿主发到面板的句子（自检结论、同步/错误句子） | `src/shared/panel-wire.ts`、`src/host/rpc.ts` | **还没做**：要么宿主返回**代码**由面板翻译（`linkTitleError` 已经是这个形状，`titleMissReason()` 就是它的翻译器），要么继续中文 |

## 测试怎么钉住

- `test/i18n.test.ts`：两个词典的键集必须一致、占位符必须一致、语言判定规则、以及**客户端文件里不许再出现中文字符串字面量**
  （官方仓库有 `verify-client-ui-i18n` 做同一件事）。例外只有 `src/client/manual.tsx`（见下）。
- 断言具体句子的测试要**显式钉语言**：`test/helpers/locale.ts` 提供 `installLanguage('zh')`，否则测试会跟着
  跑测试那台机器的 locale 走（本机是 zh-CN，CI 上多半不是）。

## 还没做完的两块（2026-09-20）

1. **句内片段**：`src/client/index.tsx` 里还有约 45 处、`dock.tsx` 4 处是**句子中间的 JSX 文本片段**
   （例如设置页那句「目录那一栏同时是 … 的前缀（默认 …）」）。它们要整段重构成**一个 key + 参数**才能译，
   逐片建 key 会把英文拼成病句。
2. **`src/client/manual.tsx` 整页**：约 30 段散文。干净的译法是"整页两套 JSX / 一段 `en` 手册"，
   不是逐片建 key；这也是 `test/i18n.test.ts` 里那个例外存在的原因。

另外，安装器（`src/cli.ts`）的输出仍是中文：它跑在终端里，不归浏览器 locale 管，要双语得走
`--lang` / 环境变量那条路。
