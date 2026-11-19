# 维维找货
跨电商平台一键找货桌面工具（Electron）。
- 开发运行：`npm install && npm start`
- 打包：`npm run dist:win`（安装包/便携版/zip），`npm run dist:linux`（AppImage）
- 新增平台：编辑 `src/platforms.js`，追加一项（搜索 URL、登录 Cookie、能力矩阵 text/image/ai）。
- 登录持久化：每个平台独立 `persist:<id>` 会话（淘宝/天猫/闲鱼共享 persist:taobao），数据在用户目录 `%APPDATA%/维维找货`。
