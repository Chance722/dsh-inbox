# 链接的分类与平台标签

> 只有一处实现：`src/host/classify/rules.ts`。平台标签随记录存进 `record.platform`（自由字符串，没有 schema 约束）。

## 一次粘贴里谁在判

- **入库时**：`capture.ts` 的 `sniff()` 先用 `platformOf(url)` 打平台标签——这时还不知道类目。
- **类目**：`classifyLink(url)` 按这个顺序判，先命中的先算：
  1. **路径**（跨站点仍然有意义的那些）：`/video/`、`/watch`、`/audio/`、`/podcast`、`/shorts/`、`/v_show/`、`/playlist` → 视频/音频；`/article/`、`/articles/`、`/post/`、`/posts/`、`/blog/`、`/read/`、`/story/`、`/item` → 文章。
  2. **宿主习惯**（平台表第三列）：`{platform} 上的文章页 / 视频音频页`。路径优先的意义就在这——`bilibili.com/read/cv123` 是文章，尽管 B 站是视频站。
  3. **认得出平台但说不准**（表里没有第三列，比如 GitHub 仓库）→ `other` + `unsure`，可能花**一次模型调用**（`classify/model.ts` 只对"平台已知且 unsure"的链接这么做）。
  4. **不认识的站点** → `other` + `unsure`，不问模型：不认识的域名是猜，不是提问。
- 用户自己选的类目永远优先，规则与模型都不覆盖它。

## 平台表（2026-09-21 扩过一次）

| 分组 | 平台标签（`record.platform`） | 主机后缀 |
|---|---|---|
| 视频 / 音频 | `bilibili` `youtube` `vimeo` `youku` `tencentvideo` `iqiyi` `mgtv` `douyin` `kuaishou` `xigua` `tiktok` `twitch` `dailymotion` `netease-music` `qq-music` `spotify` `soundcloud` `ximalaya` | bilibili.com / b23.tv / youtube.com / youtu.be / vimeo.com / youku.com / v.qq.com / iqiyi.com / mgtv.com / douyin.com / iesdouyin.com / kuaishou.com / ixigua.com / tiktok.com / twitch.tv / dailymotion.com / music.163.com / y.qq.com / spotify.com / soundcloud.com / ximalaya.com |
| 文章 / 帖子 | `wechat` `zhihu` `juejin` `csdn` `cnblogs` `jianshu` `segmentfault` `v2ex` `sspai` `36kr` `infoq` `toutiao` `weibo` `douban` `xiaohongshu` `maimai` `yuque` `medium` `substack` `devto` `hackernews` `reddit` `stackoverflow` `arxiv` `mdn` `twitter` `instagram` `threads` `bluesky` `telegram` `linkedin` | mp.weixin.qq.com / weixin.qq.com / zhihu.com / juejin.cn / csdn.net / cnblogs.com / jianshu.com / segmentfault.com / v2ex.com / sspai.com / 36kr.com / infoq.cn / toutiao.com / weibo.com / weibo.cn / douban.com / xiaohongshu.com / xhslink.com / maimai.cn / yuque.com / medium.com / substack.com / dev.to / news.ycombinator.com / reddit.com / stackoverflow.com / arxiv.org / developer.mozilla.org / x.com / twitter.com / instagram.com / threads.net / bsky.app / t.me / linkedin.com |
| 代码 / 包（**没有**第三列，留给模型） | `github` `gitlab` `gitee` `npm` `pypi` `huggingface` | github.com / gitlab.com / gitee.com / npmjs.com / pypi.org / huggingface.co |

匹配是**后缀**匹配：`host === suffix` 或 `host.endsWith('.' + suffix)`，所以子域自动包含（`space.bilibili.com`、`blog.csdn.net`、`zhuanlan.zhihu.com`），短链（`b23.tv`、`xhslink.com`）各占一行。首个命中的行胜出，所以更具体的后缀要写在一般后缀前面。

## 标签长什么样、显示在哪

- 标签是**短的英文品牌 slug**，不是译文：面板直接原样显示，所以不进 `src/client/messages.ts` 的词典、也不跟语言变（`wechat`、`youtube`、`tencentvideo` 都是原样）。
- 出现的位置：详情页头部那行平台文本、给模型看的工具输出（`src/host/tools.ts`）、搜索负载（`src/host/rpc.ts`）。
- 没有标签的记录**什么都不显示**（不是「未知」），这正是"掘金那篇什么都没有"的原因：表里没有它。

## 加一个平台要做的事

1. `PLATFORMS` 里加一行 `['juejin.cn', 'juejin', 'article']`。第三列只在"这个站点主要就是文章或视频"时写；拿不准（仓库、包、文档站）留空，让它走 `unsure` + 模型那一路。
2. `test/classify.test.ts` 加断言：至少 `platformOf`，最好连类目一起。
3. **没有 schema 变更**：`platform` 一直是自由字符串，同步与双半边都不受影响。**老记录能补上**：把同一条链接
   再贴一次即可——合并重复项时（`capture.ts` 的 `absorb`）对"原本没有平台"的记录补标签，已有平台**不覆盖**
   （那可能是你自己改过的值）。
4. 路径规则只在**新形状**上才动。踩过的坑：为了 SegmentFault 与知乎专栏加的 `/a/`、`/p/` 两个单字母段，把 `github.com/a/b` 判成了文章；这类宿主现在由"宿主习惯"负责，路径模式收窄到整词。
