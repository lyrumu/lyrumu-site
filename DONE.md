# 网站技术变更记录

> 记录网站架构、部署、前端、后端及服务集成的有效变更，按日期倒序。每项保留结果与动机、关键位置、验证或限制，方便定位和接手；文章内容、排版、单篇配图及映射不记录。
>
> 2026-09-14 改版前的完整过程日志原样保存在 [`DONE_ARCHIVE.md`](DONE_ARCHIVE.md)，仅供追溯，不再追加。当前实现以代码、`PROJECT_MAP.md` 和本文件为准。

## 2026-09-24 · DOCS 分页页独立页面身份

- 新增笔记后 `/notes/` 出现第 2 页；`layouts/partials/head.html` 按原有卡片顺序初始化分页，为后续页输出独立 title、description 和自引用 canonical；`layouts/_default/list.html` 同步显示页码 H1。
- 生产压缩构建与 44 页 SEO 回归通过；新 URL 仅增加文章与 `/notes/page/2/`，原有 URL 保留。线上页面与浏览器效果待部署后检查。

## 2026-09-23 · 邮件分享链接避开 Cloudflare 改写

- `layouts/partials/sharing-links.html` 不再把邮件分享的 `mailto:` 放进源 HTML，改用站内现有 `email.js` 从 `data-email` 还原链接；其他分享链接和页面内容保持原样。
- 移除仅为旧 `email_off` 方案保留注释的压缩配置，并更新 `tests/seo_check.py` 校验邮件正文与标题。42 页生产压缩构建、SEO 回归、邮件脚本行为和 `git diff --check` 通过；线上修复仍需部署后复查，本机代理不可用。

## 2026-09-23 · 修正文章结构化数据的页面地址

- `layouts/partials/schema.html` 将 `Article.mainEntityOfPage` 从字符串 `"true"` 修为文章的规范 URL，符合 Schema.org 的 URL 类型；页面和后端逻辑不受影响。
- `tests/seo_check.py` 增加对应回归断言；生产压缩构建、42 页 SEO 检查与 `git diff --check` 通过。未启动本地服务，也未验证发布后的 Google 重新抓取结果。

## 2026-09-22 · 区分文章页同名分类与标签

- 文章同时属于同名分类和标签时，共享元信息徽章显示 `Ai Category`、`Ai Tag`，避免两枚相同的 `Ai`；链接继续分别指向分类页和标签页，其余徽章名称不变。
- 修复位于 `themes/blowfish/layouts/partials/article-meta/basic.html`，由文章页和列表卡片共用；`tests/seo_check.py` 检查同一页面的分类、标签徽章不再重名。
- 生产压缩构建、42 页 SEO 回归和实际文章输出检查通过；未启动本地服务，最终视觉留待手动查看。

## 2026-09-21 · Google Analytics 接入

- 在 `hugo.toml` 根级配置 GA4 衡量 ID `G-5ZD6M1S9NG`，复用 Blowfish 原生 Analytics partial，不重复维护手写脚本。
- 统计代码仅在生产环境构建时注入；56 页生产构建通过且首页仅生成一份 gtag 脚本。未发布，实时数据需部署后在 Google Analytics 中确认。

## 2026-09-21 · SEO 抓取问题修复

- 分类与标签页按分面生成独立标题、H1 和描述；共享卡片补齐锚文本，分享链接补齐安全关系和查询参数编码。关键入口为 `layouts/partials/head.html`、`layouts/_default/term.html`、`layouts/partials/article-link/card.html` 和 `layouts/partials/sharing-links.html`。
- 邮箱分享添加 Cloudflare `email_off` 排除标记，并在 `hugo.toml` 保留压缩后的 HTML 注释，防止邮件分享被改写成可抓取的 404；`static/_headers` 增加 HSTS、框架限制、Referrer-Policy 和不限制现有脚本/连接的基础 CSP。
- Markdown 图片使用 Hugo 原生 WebP 变体并修正小图 srcset 宽度；35 张默认展示图从 7,055,121 降至 1,197,100 字节，原图保留。高分辨率候选仍有 7 张超过 100 kB，不以压低扫描阈值牺牲清晰度。
- 生产压缩构建、42 页 SEO 回归与 `git diff --check` 通过；测试入口 `tests/seo_check.py`，28 类报告及处理边界见 `SEO_REPORT.md`。未启动服务、未发布；Cloudflare 实际响应头和邮箱改写需部署后复查，基础 CSP 不等同于完整 XSS 防护。

## 2026-09-16 · Notes 卡片计数骨架宽度修复

- Firebase 计数加载时的脉冲占位固定为约两个数字宽，避免慢网下 `loading` 文案撑大卡片 meta 条；数据返回后仍按真实数字自然伸缩。
- 仅调整 `assets/css/_13_notes-card.css`，未改 Firebase 请求、计数和错误处理逻辑。
- `git diff --check` 与 Hugo 内存构建通过（55 pages）；按项目约定未启动本地服务，慢网视觉效果留待手动确认。

## 2026-09-15 · 文章图片放大不再等待原图

- 修复慢网下点击文章图片后，`medium-zoom` 先覆盖页面、再无限等待原图而阻塞其他操作的问题；放大层现在直接使用浏览器已加载的响应式图片立即打开。
- 修复位于共享入口 `layouts/partials/footer.html`：未加载完成的图片忽略点击，已加载图片在 zoom 创建副本时临时隐藏高清源属性，随后恢复页面图片属性。
- Hugo 构建、生成脚本结构和 Git 空白检查通过；未启动本地服务，实际点击手感留待手动确认。

## 2026-09-15 · DOCS 文章 Markdown 一键复制

- 每篇 `/notes/` 文章页新增 `Copy Markdown`，复制正文时将文章包内的 `image/` 相对路径改为本站完整 URL，粘贴到其他 Markdown 平台后仍可加载图片。
- `layouts/partials/article-copy-markdown.html` 在构建期准备原始正文，`assets/js/article-markdown-copy.js` 使用 Clipboard API 并提供旧浏览器回退；不包含 YAML front matter，也不修改文章内容。
- Hugo 构建、脚本语法、生成页面结构和复制文本解析检查通过；图片仍依赖 `lyrumu.top` 托管。

## 2026-09-14 · 首页展开三卡等比响应

- 桌面展开态以约 `1440×800` 内容区为视觉基准，卡片宽高、左右间距和侧卡下沉距离改为由视口宽高共同约束的同一比例，消除宽屏、矮窗口之间的构图变形。
- `assets/css/_16_cover-carousel.css` 移除 `721–980px` 独立卡片尺寸覆盖，避免跨过 `980px` 时突变；卡内文字保留可读字号，移动端横向滑动、减少动态效果和无 JavaScript 回退均不变。
- 轮播 Node 测试 6 项、Hugo 内存构建与 `git diff --check` 通过；未启动本地服务，最终显示比例留待真实窗口手动确认。

## 2026-09-14 · 正文表格宽度修复

- Blowfish 的全局 `table { display: block; }` 会让表格外框占满正文、内部列区却按内容收缩；`assets/css/_03_prose.css` 现将正文表格恢复为原生 table 布局并固定为容器宽度。
- 保留现有边框、圆角和单元格样式；修复作用于所有 Markdown 正文表格，不改文章内容或代码高亮表格。
- Hugo 内存构建与生成 CSS 检查通过；窄屏长内容仍由单元格正常换行。

## 2026-09-05 · 封面首次展开资源准备优化

- 首页三卡高清图改为在封面插画与字体就绪后低优先级预取，显示前等待图片解码；移动端和减少动态效果模式直接准备可见卡片，无 JavaScript 时保留静态图片。
- `layouts/partials/home/carousel-image.html` 与 `assets/js/cover-carousel.js` 使用 `data-cover-candidates` 保存响应式候选，避开 Hugo 将 srcset 编码成无效单一 URL 的问题；失败时继续显示 LQIP。
- `sizes` 按实际卡片槽位收紧，减少过大资源选择；未改变卡片位置、动画时长、路由或数据契约。
- Node 时序检查、Hugo 构建与实际浏览器加载通过；真实冷加载帧率仍依赖设备和网络。

## 2026-09-03 · GitHub Contribution 刷新稳定性

- About 页贡献图刷新时优先显示上一次成功缓存，再后台拉取公开数据；首次加载使用同尺寸骨架，接口失败时给出明确状态。
- 实现在 `assets/js/github-contrib.js`，入口为 `layouts/shortcodes/github-contrib.html`；避免旧版图片与年份视图切换时闪烁。
- 脚本语法、Hugo 构建和生成结构断言通过。

## 2026-08-29 · 修复 Hugo 根级主题配置

- `theme = 'blowfish'` 曾被 TOML 表作用域误归入作者配置，导致不带 `--theme` 的裸 `hugo` 构建无法加载主题；现已移至 `hugo.toml` 根级。
- 命令行显式主题参数仍可用，Cloudflare 构建行为不变；`hugo config`、裸构建和完整构建均验证通过。

## 2026-08-29 · About 技术栈图例与年度贡献图

- `content/about/_index.md` 与 `assets/css/_09_about.css` 增加技术栈颜色图例，并保持明暗主题一致。
- `layouts/shortcodes/github-contrib.html` 和 `assets/js/github-contrib.js` 实现年份切换、年度贡献数、53 周网格及窄屏滚动；接口失败时显示可理解的降级状态。
- 数据来自公开贡献接口，前端直连；接口可用性仍是外部依赖。

## 2026-08-13 · 首页音符盘环形卡片交互

- 桌面首页改为滚轮/触控板触发展开与返回：DOCS 为默认主卡，侧卡首次点击切换，主卡再次点击进入页面；移动端继续使用原生横向滚动。
- 核心状态和交互位于 `assets/js/cover-carousel.js`，舞台、音符盘、轨道和卡片布局位于 `assets/css/_16_cover-carousel.css`，结构由 `layouts/partials/home/` 负责。
- `prefers-reduced-motion`、无 JavaScript、键盘焦点和离开视口暂停均有降级；未新增动画依赖。
- Node 语法、Hugo 构建与真实链接检查通过；最终滚动手感需在实际触控板和设备上复核。

## 2026-08-09 · 首页数据驱动首帧与三入口契约

- 首页文案迁入 `data/cover.yaml`，DOCS / WORKS / DAILY 三入口迁入 `data/home_highlights.yaml`；模板在构建期校验数量、唯一 ID、目标路由、视觉类型和图片数量。
- `layouts/partials/home/cover-carousel.html` 负责语义结构和路由，`carousel-image.html` 负责响应式 WebP、尺寸与 LQIP，JavaScript 只处理状态与显现进度。
- 清理旧首页 JSON、Start Here 数据和无消费者钩子，修复嵌套 `<main>`；首页保持单一 H1、单一 main 和无 JavaScript 可访问入口。
- Hugo 生产构建和生成结构断言通过。

## 2026-08-05 · Notes 卡片图片管线

- Notes 卡片图片统一从 `assets/image/notes/` 进入 Hugo Resources，自动生成 600/1200px WebP、24px LQIP、srcset 和加载优先级；网络失败时降级为图标。
- 图片解析和生成位于 `layouts/partials/article-link/card.html`，展示状态由 `assets/js/blur-image.js` 与 `assets/css/_13_notes-card.css` 处理，文章映射位于 `data/notes.yaml`。
- 修复 data 图片已命中却跳过 resize 的守卫位置问题；卡片原图不再直接从 `static/` 大文件加载。
- 构建产物已核对 WebP、LQIP、srcset 和失败降级结构。

## 2026-08-05 · Notes 影像封面卡重构

- `/notes/` 列表改为双列全背景封面卡，底部实色面板承载标题，顶部显示日期和 taxonomy；无图按 tag 映射 Lucide 图标。
- `data/notes.yaml` 管理文章图片、图标及 tag 降级，`layouts/partials/article-link/card.html` 管理渲染优先级，`assets/css/_13_notes-card.css` 管理布局和响应式。
- 整卡链接与 tag 链接分层，避免点击背景图打开资源文件；移动端回到单列。

## 2026-08-04 · SEO 与结构化数据基础修复

- 补齐站点及关键页面 description，修复 About 标题和作者链接，并在 `layouts/partials/schema.html` 的首页 WebSite JSON-LD 中加入站点别名。
- 主要配置位于 `hugo.toml` 和页面 front matter；沿用 Hugo/Blowfish 原生 Open Graph、Twitter Card、sitemap 和 JSON-LD 链路。
- Hugo 构建、页面标题/摘要、sitemap 与单一 WebSite 节点检查通过；搜索引擎收录结果仍由外部平台决定。

## 2026-08-04 · 桌面自定义光标

- `assets/js/custom-cursor.js` 和 `assets/css/_12_custom-cursor.css` 实现中心点直接跟随、外环缓动及交互状态。
- 粗指针、720px 以下视口和 `prefers-reduced-motion` 自动使用系统光标；结构由 `layouts/partials/custom-cursor.html` 注入。
- 未改变移动端输入行为，也未引入第三方依赖。

## 2026-07-25 · 移除 AOS 并外置 Giscus 控制器

- 资源卡入场改用原生 `IntersectionObserver`，移除 AOS CSS/JS；继续兼容原有 `data-aos-delay`，减少渲染阻塞资源。
- Giscus 的路径白名单、主题同步和异步加载从内联脚本迁入 `assets/js/giscus-loader.js`，由 `layouts/partials/extend-footer.html` 指纹化加载。
- 资源卡动画和减少动态效果降级保留；Giscus 页面范围不因外置而扩大。

## 2026-07-23 · 前端资源加载与脚本维护优化

- 项目脚本迁入 `assets/js/` 并通过 Hugo Pipes 压缩、指纹化；音乐播放器模块合并为一个 bundle，减少请求和固定 URL 缓存问题。
- `layouts/partials/vendor.html` 将 Firebase SDK 限定到首页、Notes 和相关 term 页，避免无关页面加载及写入浏览量。
- 图片缩放脚本延迟加载，首页装饰动画改用 transform；`prefers-reduced-motion` 下停止非必要动画。
- Hugo 构建、脚本语法和页面资源范围检查通过。

## 2026-07-20 · Music 外链与版权边界

- 音乐页外链收敛为 Apple Music 与 Spotify，Apple 使用精确曲目地址；点击外链不会同时触发播放器切歌。
- 链接数据位于 `data/music.yaml`，白名单与渲染位于 `layouts/shortcodes/music-list.html`，主题样式位于 `_05_cards.css` 和 `_10_music-darkside.css`。
- 页面保留试听和来源说明；第三方曲目、封面和平台可用性仍受版权及外部服务影响。

## 2026-07-12 · 主题切换斜向擦除

- 使用 View Transition API 和 CSS mask 实现 900ms 斜向硬边擦除，替代早期 clip-path 动画。
- `assets/js/theme-transition.js` 负责切换锁、方向和降级，`assets/css/_11_theme-transition.css` 负责动画；不支持 API 时直接切换主题。
- 桌面与移动端切换入口共用同一控制逻辑，避免动画期间重复点击。

## 2026-07-11 · Music 列表性能与分页

- 曲目列表初始显示 7 首并按批加载，事件委托替代逐项监听；屏外项目使用 `content-visibility`，封面声明尺寸以降低布局偏移。
- 分页与播放器编排位于 `assets/js/music-player/controller.js`，结构位于 `layouts/shortcodes/music-list.html`，批量大小由数据属性控制。
- 播放控制保持 sticky；移动端与深色主题使用同一分页行为。

## 2026-07-10 · 内页导航、Notes 入口与分隔符

- 列表页、文章页和普通页面统一语义化 breadcrumb；Notes 入口采用 hero 与说明并排，窄屏纵向堆叠。
- 分隔符由 `_03_prose.css` 的伪元素统一绘制，list 页面由模板自动补底部分隔，避免内容文件重复插入。
- 关键位置为 `layouts/_default/list.html`、`layouts/_default/single.html`、`layouts/page.html`、`assets/css/_02_chrome.css` 与 `_03_prose.css`。

## 2026-07-06 · Giscus 条件加载与主题同步

- 评论仅在允许的页面和 Notes 文章加载，列表、taxonomy、404 等页面不注入；主题切换时同步 Giscus iframe。
- 当前实现已外置到 `assets/js/giscus-loader.js`，由 `layouts/partials/extend-footer.html` 负责加载。
- 评论可用性依赖 GitHub Discussions、仓库配置及外部网络。

## 2026-07-05 · 音乐播放器模块化

- 原单文件播放器拆为 `dom / storage / store / view / controller` 五个职责模块，`assets/js/music-player.js` 只装配依赖。
- 模板使用 `data-role` 与 `data-track` 契约，移除硬编码 ID；播放模式、音量和状态持久化集中在 storage/store。
- Hugo Pipes 将模块合并为一个指纹化 bundle；旧 ID 选择器和外部全局引用已清理。

## 2026-07-04 · 搜索、RSS 与 sitemap 入口

- 全站搜索增加快捷键与可见提示，RSS/sitemap 入口补入页面导航，提升内容发现和订阅能力。
- 继续使用 Blowfish/Hugo 原生生成能力，未增加搜索后端。

## 2026-06-30 · 图片格式与加载策略

- 站内主要 PNG/JPG 批量转换为 WebP 并同步引用，首屏品牌资源设为高优先级，非首屏图片延迟解码或低优先级加载。
- Hugo Resources 后续继续承担卡片缩放和响应式变体；源图转换脚本仅用于一次性维护，不进入运行时。
- 构建和引用扫描通过；新增图片应优先进入现有资源管线，避免直接发布大尺寸原图。

## 2026-06-27 · Notes 原生功能、Firebase 与统计

- `content/notes/_index.md` 通过 cascade 为 Notes 文章统一开启 taxonomy、编辑入口、上一篇/下一篇、阅读量和点赞，避免每篇重复配置。
- Firebase 前端配置位于 `hugo.toml`，真实安全边界是 Firestore Rules 与 Anonymous Auth，维护说明见 `FIREBASE_SECURITY.md`。
- Umami 曾通过 Blowfish 原生配置接入，现因国内连接开销在 `hugo.toml` 中关闭；重新启用前需评估网络影响。
- 页面功能和生成结构已验证；线上计数仍依赖 Firebase 配置与规则。

## 2026-06-26 · 数据驱动组件与统一视觉规则

- About 时间线、Start Here 和站点统计逐步改为 YAML 数据驱动，展示逻辑集中在 shortcodes/partials，减少 Markdown 内重复结构。
- 全站颜色、边线和强调色收口到 `assets/css/_01_tokens.css`；内页 hero、prose、卡片和分隔符复用同一套变量与排版逻辑。
- 站点在线天数由 `data/site.yaml` 提供起点、前端脚本校正当前值，避免手工更新。

## 2026-06-25 · 首页收口为快速入口

- 首页定位为 ABOUT / DOCS / WORKS / DAILY 的快速入口，并补齐音乐下载路径；内页继续由 section landing 承担具体内容。
- 首页结构位于 `layouts/partials/home/`，数据位于 `data/cover.yaml` 和相关模块 YAML；页面不再承担文档目录职责。

## 2026-06-24 · 默认语言、导航与页面结构调整

- 站点默认语言由 zh-CN 改为 en，保留 `hasCJKLanguage` 以支持中文文章；顶栏入口统一读取 `hugo.toml` 菜单。
- 删除独立 `/start/` 大厅，将个人入口并入 About；桌面和移动菜单跳过重复的 home 项。
- 关键位置为 `hugo.toml`、`layouts/partials/header/` 和 `layouts/partials/home/custom.html`。

## 2026-06-23 · CSS 模块化与模板维护边界

- 将约 3514 行 `assets/css/custom.css` 拆为编号模块 `_01_*.css` 起，按基础、组件、页面职责组织；`custom.css` 仅保留索引作用。
- `layouts/partials/head.html` 使用 Hugo Resources 匹配并合并 `css/_*.css`，因此新增样式应放入下一个编号模块，不能依赖 CSS `@import`。
- 项目级模板覆写集中在 `layouts/`；`themes/blowfish/` 默认不直接修改，升级主题时需对照覆写契约。
- Hugo 构建确认模块加载顺序和生成 CSS 正常。

## 2026-06-23 · 前端安全与 About 组件整理

- 当时保留的第三方 CDN 资源加入 SRI 与匿名跨域校验；后续已移除的依赖不再需要维护对应哈希。
- About 联系方式和内联样式迁入可复用 shortcode/partial 与 `assets/css/_09_about.css`，邮箱复制使用本地 Toast。
- 当前第三方脚本入口应通过 `layouts/partials/head.html`、`extend-head*` 或 `extend-footer.html` 统一维护。

## 2026-06-21 · Works 模块与暗色主题统一

- 建立 `/works/`、Projects 与 Resources 数据驱动结构；数据分别位于 `data/works.yaml`、`data/projects.yaml`、`data/resources.yaml`，页面由对应 shortcode 渲染。
- Projects 使用网格和倾斜交互，Resources 使用响应式资源卡；页面结构与交互分离，后续内容维护优先改 YAML。
- 暗色主题从多套独立色板收口到全局 tokens，使封面、卡片和 Blowfish utility 同步变化。

## 2026-06-20 · Life 子模块与音乐架构

- `/life/` 使用 `data/life.yaml` 驱动可扩展子模块，音乐页使用 `data/music.yaml`、HTML5 Audio 和统一播放器。
- 页面结构由 `layouts/shortcodes/music-list.html` 与 `layouts/partials/music-player.html` 提供，样式和状态逻辑分别位于 `_07_music-player.css` 与 `assets/js/music-player/`。
- 新增 Life 子模块只需增加数据项和对应页面；需要新交互时再增加独立 shortcode。

## 2026-06-19 · Hugo 架构与首次部署

- 项目确定为 Hugo + vendored Blowfish 的静态站，内容使用 Markdown/front matter，页面能力通过项目级 layouts、shortcodes、YAML 数据和静态资源扩展。
- 初始内容目录与路由按 Vault 层级建立，后续内容源保持只读；当前 Notes 迁移以项目 Skill 为入口，不再依赖一次性全量迁移脚本。
- Cloudflare Pages 连接 GitHub 仓库，构建命令为 `hugo --minify --themesDir themes --theme blowfish --config hugo.toml`，输出 `public/`，并固定兼容的 Hugo Extended 版本。
- 生产域名为 `https://lyrumu.top`；部署、域名和外部服务变更应继续记录在本文件。
