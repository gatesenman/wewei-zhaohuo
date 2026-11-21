# 维维找货

**3.4.0** · 跨电商平台一键找货桌面工具：在多个采购与零售平台上搜索货源，登录态按平台持久化。

## 功能特性

- 一键在多个电商平台找货、比对。
- 新增平台：编辑 `src/platforms.js`，补充搜索 URL、登录 Cookie 与能力矩阵。
- 每个平台独立 `persist:<id>` 会话（淘宝 / 天猫 / 闲鱼共享 `persist:taobao`），数据在 `%APPDATA%/维维找货`。

## 技术栈

- Electron
- JavaScript

## 从源码运行

源码在仓库根目录。本仓库不包含安装包。

```bash
npm install
npm start
```
## 文档

- [产业带研究](产业带研究.md)
- [3.4 界面评审](ui-review-3.4.md)

## 贡献

欢迎通过 Issue 和 Pull Request 参与，详见 [CONTRIBUTING.md](CONTRIBUTING.md)。安全问题请按 [SECURITY.md](SECURITY.md) 私下报告。参与时请遵守 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)。

## 许可证

本仓库尚未附带 LICENSE 文件，许可证未指定。

---

## English

# Weiwei Zhaohuo

**3.4.0** · A desktop tool for one-click cross-platform product sourcing. Search goods across procurement and retail sites, with login state persisted per platform.

## Features

- One-click search and comparison across multiple e-commerce platforms.
- Add a platform by editing `src/platforms.js` with its search URL, login cookie, and capability matrix.
- Each platform gets a `persist:<id>` session (Taobao / Tmall / Xianyu share `persist:taobao`). Data lives in `%APPDATA%/维维找货` on Windows.

## Tech stack

- Electron
- JavaScript

## Getting started

Source is at the repository root. This repository does not include installers.

```bash
npm install
npm start
```
## Documentation

- [产业带研究](产业带研究.md)
- [3.4 界面评审](ui-review-3.4.md)

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md). Please report vulnerabilities privately via [SECURITY.md](SECURITY.md). This project follows [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## License

No LICENSE file is included in this repository; the license is unspecified.
