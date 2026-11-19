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

源码在 `src/weiwei-zhaohuo/`。本仓库不包含安装包。

```bash
cd src/weiwei-zhaohuo
npm install
npm start
```

## 文档

- [源码 README](src/weiwei-zhaohuo/README.md)
- [产业带研究](产业带研究.md)
- [3.4 界面评审](ui-review-3.4.md)

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

Source is under `src/weiwei-zhaohuo/`. This repository does not include installers.

```bash
cd src/weiwei-zhaohuo
npm install
npm start
```

## Documentation

- [源码 README](src/weiwei-zhaohuo/README.md)
- [产业带研究](产业带研究.md)
- [3.4 界面评审](ui-review-3.4.md)

