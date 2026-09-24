# 项目现状与目标

这是已上线的 Hugo + Blowfish 个人网站，公开地址为 `https://lyrumu.top/`，部署在 Cloudflare Pages。站点框架、导航、内容读取、主要页面、资源管线和基础 SEO 已完成；当前默认方向是持续改善可抓取性、页面身份、内容质量、内部发现、性能和上线后的可观测性，而不是继续按“首版搭建”思路扩张结构。

- `baseURL` 与规范域名保持为 `https://lyrumu.top/`；未经确认不要改域名、路径或 URL 大小写策略。
- 默认语言为英文 `en`，但文章可按原内容使用中文；不要为了语言配置机械翻译正文或 URL。
- `SEO_REPORT.md` 是 2026-09-21 抓取审计的处理记录，不是永远有效的当前结论；每次仍以现有代码、生成结果和可获得的线上证据为准。

# 执行边界

- 修改前先读实际文件，并检查 `git status`、相关 diff、调用链和生成链路；保护用户已有 WIP，不覆盖无关改动。
- 需求若会改变站点结构、导航、栏目、路由、taxonomy、内容组织、下载方式、技术选型或外部服务，必须先询问；局部且可逆的实现默认选择更简单、保守的方案。
- 非必要不启动或关闭 Hugo 服务；优先用临时目录生产构建验证，最终浏览器体验由用户手动检查。
- 未经明确授权，不 commit、push、部署，也不修改 Cloudflare、Google Search Console、Google Analytics、Firebase 或其他线上设置。
- SEO 修改不得减少现有页面功能，不得破坏 Firebase、Giscus、搜索、分享、音乐播放器、图片放大、复制功能或 Cloudflare Pages 行为。
- 不把 Hugo 或 Blowfish 升级夹带进 SEO 修改。先运行 `hugo version` 并报告兼容警告；主题既有项目级覆写，也有少量直接修改，升级必须单独审计。
- 用户手改过的坐标、视觉参数和内容措辞不要顺手调整。SEO 任务默认保持现有暖白衬线视觉、响应式规则和页面布局不变。

# SEO 决策原则

- 先区分四层证据：源文件、Hugo 生成物、已部署页面、搜索引擎或第三方爬虫数据。只能声称实际验证过的层级，不能用本地构建代替线上生效或收录证明。
- 优先修复真实的抓取、索引、页面身份、链接和性能问题；第三方工具的字符数、像素宽度、H2 数量、正文长度或图片阈值只是线索，不是必须清零的指标。
- 不做关键词堆砌，不虚构正文或标题层级，不为“内容新鲜”伪造日期，不承诺排名、收录时间或站点链接展示。
- 优先复用 Hugo、Blowfish 和现有共享模板；不要重复输出 canonical、meta、Open Graph、Twitter Card、RSS、sitemap 或 JSON-LD。
- SEO 修复尽量落在所有相关页面共用的根因位置，并留下最小可运行回归检查；不要逐页复制同一补丁。

# 页面与内容规则

- 每个可索引正式页面应有且仅有一个清晰 H1、一个非空且与页面一致的 description、一个自引用 canonical，以及能区分页面用途的 title。显示标题不应改动时，可使用现有 `seoTitle`。
- 首页保留单一 `WebSite` 结构化数据；普通内容页才输出 `Article`；非首页可保留 `BreadcrumbList`。任何模板修改都必须检查最终 JSON-LD 能解析，且 `mainEntityOfPage` 指向规范 URL。
- 不因栏目页或 taxonomy 页正文较短就自动 `noindex`、隐藏或填充空洞内容。是否停止渲染、停止列出或移出 sitemap 属于信息架构决策，必须先确认。
- 保留已有中文路径；若确需改 URL，先给出重定向、canonical、内部链接、sitemap 和历史收录迁移方案，得到确认后再实施。
- taxonomy 以少而准确为原则，优先复用现有 tags/categories；除非确实出现新的文章类型或分类需求，不新增同义、过细或仅为关键词覆盖的分面。
- 内链必须有可理解的锚文本；新窗口链接保留安全的 `rel`。不要为了扫描分数批量添加 `nofollow`，也不要把 Cloudflare 注入的隐藏链接直接归因于源码。
- 图片继续走现有 Hugo Resources/WebP/srcset/LQIP 管线。内容图使用有意义的 alt，纯装饰图使用 `alt=""`；不要为过任意体积阈值而明显牺牲可读性或删除原图。
- 个人身份、联系方式、作者资料、`sameAs` 或其他无法从项目确认的事实不得猜测，先询问用户。

# 关键实现位置

- 全局配置与站点身份：`hugo.toml`
- title、description、canonical 与社交元数据：`layouts/partials/head.html`
- JSON-LD：`layouts/partials/schema.html`
- taxonomy 页面身份：`layouts/_default/term.html`
- Markdown 图片输出：`layouts/_default/_markup/render-image.html`
- 分享链接：`layouts/partials/sharing-links.html`
- 抓取与 Pages 响应头：`static/robots.txt`、`static/_headers`
- 生产生成物回归：`tests/seo_check.py`
- 历史审计解释与保留项：`SEO_REPORT.md`

# 验证与交付

SEO 或全局模板改动至少执行以下检查，不启动服务：

```sh
# 构建与 Cloudflare Pages 接近的生产压缩结果到临时目录。
hugo --minify --themesDir themes --theme blowfish --config hugo.toml --destination /tmp/lyrumu-seo-check --cacheDir /tmp/lyrumu-seo-cache --cleanDestinationDir

# 检查真实生成页面的 metadata、canonical、JSON-LD、链接和图片候选。
python3 -B tests/seo_check.py /tmp/lyrumu-seo-check

# 检查补丁格式；若失败来自既有 WIP，必须明确指出文件与归属，不能顺手修改。
git diff --check
```

- 改路由、taxonomy、渲染或索引控制时，额外比较修改前后的正式 URL 集合、sitemap 和内部链接；不能只看模板语法。
- 改 `_headers`、Cloudflare 相关链接处理或线上元数据时，本地构建只证明源端输出；部署后的响应头、Cloudflare 转换和实际 HTML 必须另行验证。
- 改内容或 front matter 时，核对 title、description、日期、aliases、tags/categories 与正文真实一致，不以通过测试为由改写原意。
- 交付时分别说明：本地通过项、未验证的浏览器行为、待部署验证项和需要用户在 GSC/GA/Cloudflare 确认的外部状态。

# 文档维护

- `PROJECT_MAP.md` 记录当前结构与关键入口；结构或关键文件职责变化时同步更新。
- `DONE.md` 只记录网站架构、部署、前端功能/样式、后端或服务集成等技术变更，按日期倒序。常规条目用 2–4 条说明结果、关键位置、验证与限制；重大调整最多 6 条。
- 文章新增/迁移、正文排版与内容修改、单篇配图及数据映射不写入 `DONE.md`；规则或 Skill 文档维护也不单独记录。
