# dsh-inbox

[English](README.md) | 中文

> **状态：pre-alpha，还不能装。** 插件骨架（M0）都还没跑。已经做到哪一步看[开发总线](docs/feature/dev-bus.md)。

给 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（`dsh`）做的个人收件箱插件：把链接、图片、文本、账密粘进一个本地仓库，自动分类，侧栏里能翻，对话里能取回来。

## 它要做什么

- **收**——在 inbox 面板里粘贴或拖拽；或者在聊天框里加前缀转存（不发给模型）。
- **分**——规则优先（链接判平台和类型、账密走正则、图片走本地启发式），模型兜底；**你自己写的描述永远优先**。
- **看**——左侧栏一个切换按钮，把会话列表换成一个仓库视图：类目、标签、未读、软删。
- **取**——在对话里问，原内容回到你眼前（文本内联、图片缩略图、链接标题卡）。
- **同步（单向）**——任何设备往 WebDAV 的 `inbox/` 目录扔文件，仓库启动时拉取并分类。离开本机的内容一律加密。

## 这个项目给自己定的隐私红线

- 账密加密落盘、列表脱敏，**永不**发给模型、**永不**在对话里输出明文。
- 证件照默认全本地判断，不为"猜一下"上传任何图片。
- 仓库不会被自动塞进模型上下文——只有模型主动调工具时才看得见。

## 安装（计划中）

```sh
dsh plugin --profile web add @duoyu/dsh-inbox
npx @duoyu/dsh-inbox init
```

## 开发

| 用途 | 命令 |
|---|---|
| 装依赖 | `pnpm install` |
| 隔离开发 profile | `dsh --profile inbox` |
| 构建 | `pnpm build` |
| 测试 | `pnpm test` |

项目规范在 [AGENTS.md](AGENTS.md)，知识文档索引在 [docs/help/index.md](docs/help/index.md)。

## 许可

MIT
