# 维维找货 v2.2 · UI 走查报告

走查方式：打包版 AppImage + xvfb 1440×900 / 1024×640，浅色、深色、空状态、加载、宫格移动端、错误提示、AI 搜索、设置各页、平台管理、平台编辑。截图目录：`e2e-v22/`。

| # | 问题 | 级别 | 截图（修复前） | 修复 | 截图（修复后） |
|---|---|---|---|---|---|
| 1 | 平台图标为文字色块，不是真实品牌 Logo | 高 | v2.1 `e2e-v21/01-launch-mobile-default.png` | 内置 30 个官方 App 图标（`src/assets/platforms/*.png`，128px），侧栏/标签/平台管理/账号页统一使用；自定义平台自动抓取官网图标，可上传 | `e2e-v22/ui-empty-light.png`、`ui-platform-manager-logos.png` |
| 2 | 侧栏“登录”文字按钮 + 模式图标 + “手动”标签挤压平台名（出现“京…”“饿…”截断） | 中 | `e2e-v21/view-grid4-mobile.png` | 登录状态改为 24px 图标按钮（已登录绿色），模式图标仅在单独覆盖时显示 | `e2e-v22/ui-empty-light.png` |
| 3 | 未登录却显示“已登录”（淘宝/天猫/闲鱼的 cookie2、网易严选 yx_s_tid 为游客 Cookie） | 高 | `e2e-v22/grid6-mobile-1.png`（已登录 3/21） | 登录判定只用真实账号 Cookie（unb/_nk_、__cn_logon__ 且值非 false、NTES_YD_SESS），旧配置自动迁移 | `e2e-v22/after-login-summary.png`（修正后再次校验） |
| 4 | 宫格视图中移动端页面固定 414px，比格子宽，出现横向滚动条 | 中 | `e2e-v22/grid6-mobile-1.png` | 宫格/对比视图中移动端页面铺满格子 | `e2e-v22/after-grid6-mobile.png` |
| 5 | 被重定向到登录页时无任何提示 | 高 | `e2e-v21/m-text-jd.png` | 识别登录跳转，显示“××要求登录后才能查看搜索结果”+“在此登录”按钮 | `e2e-v22/after-login-tip.png`、`ui-narrow-1080.png` |
| 6 | 当当一直转圈、国美超时，没有反馈 | 高 | v2.1 `m-text-dangdang.png` | 20 秒看门狗 + 失败提示（“重试”“用系统浏览器打开”）；错误码翻译成自然中文（如 ERR_HTTP2_PROTOCOL_ERROR → 协议错误）；全局关闭 HTTP/2 修复京东协议错误 | `e2e-v22/ui-error-tip.png` |
| 7 | 中文提示中多余空格（“京东 要求登录”“当当 暂时无法访问”） | 低 | `ui-narrow-1080.png` | 文案去掉中文与中文之间的空格 | `after-login-tip.png` |
| 8 | AI 提示文案重复“需求已复制”两次；京东京言网页入口已失效（跳到店铺页） | 中 | `ai-search-jd-tab.png` | 文案去重；京东 AI 改为按需求关键词搜索并说明京言在 App 内 | `ai-search-grid.png` |
| 9 | 小红书移动端搜索页“页面不见了” | 中 | `after-login-summary.png` | 小红书默认电脑端访问 | — |
| 10 | 提示条按钮样式与正文不协调 | 低 | — | 提示条内按钮改为描边小按钮（24px，继承提示色） | `ui-error-tip.png` |

检查项结论：8px 栅格（间距 4/8/12/16/24）一致；标题 18px / 正文 13px / 辅助 11–12px 层级清楚；主色 #ff5c28 用于主按钮、选中态；深色模式对比度满足阅读；所有图标来自 Remix Icon，无 emoji。

遗留到 v3.0：内嵌网页的视觉不统一（各站页面风格各异、弹窗广告）——v3.0 改为“原生统一结果视图”。
