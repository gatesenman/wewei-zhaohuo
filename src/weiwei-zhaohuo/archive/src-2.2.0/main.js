const { app, BrowserWindow, ipcMain, session, webContents, dialog, Menu, clipboard, shell, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');

const UA = {
  desktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  mobile: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
};
app.userAgentFallback = UA.desktop;
// 部分电商站点在 Chromium HTTP/2 下会返回 ERR_HTTP2_PROTOCOL_ERROR，统一使用 HTTP/1.1
app.commandLine.appendSwitch('disable-http2');
if (process.env.WW_USERDATA) app.setPath('userData', process.env.WW_USERDATA);

const DEFAULTS = require('./defaults.json');
const f = n => path.join(app.getPath('userData'), n);
const readJSON = (n, d) => { try { return JSON.parse(fs.readFileSync(f(n), 'utf8')); } catch { return d; } };
const writeJSON = (n, v) => fs.writeFileSync(f(n), JSON.stringify(v, null, 2));

let platforms = [];
function loadPlatforms() {
  const saved = readJSON('platforms.json', null);
  if (!saved) return JSON.parse(JSON.stringify(DEFAULTS));
  // 迁移：旧版本保存的内置平台补齐新字段（移动端 URL、访问方式）
  for (const p of saved) {
    const d = DEFAULTS.find(x => x.id === p.id);
    if (p.accessMode === undefined) p.accessMode = d ? d.accessMode : (p.ua === 'mobile' ? 'mobile' : 'follow');
    if (d) for (const k of ['mobileHome', 'mobileSearch', 'mobileLogin']) if (p[k] === undefined) p[k] = d[k];
    if (d && !p.logo && d.logo) p.logo = d.logo;
    if (d && p.builtin && JSON.stringify(p.loginCookie?.names || []).includes('cookie2')) p.loginCookie = d.loginCookie;
    if (d && p.imageSearch && d.imageSearch && p.imageSearch.mobileUrl === undefined) p.imageSearch.mobileUrl = d.imageSearch.mobileUrl;
    delete p.ua;
  }
  // 合并：新版本新增的内置平台追加到末尾
  const ids = new Set(saved.map(p => p.id));
  return saved.concat(DEFAULTS.filter(d => !ids.has(d.id) && !(readJSON('deleted.json', []).includes(d.id))));
}
const partOf = p => 'persist:' + (p.partition || p.id);
function applyUA() { /* UA 改为按面板（webview）设置，见 renderer */ }

let win;
function createWindow() {
  platforms = loadPlatforms(); applyUA();
  const settings = readJSON('settings.json', {});
  win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1080, minHeight: 680, title: '维维找货', frame: false,
    icon: path.join(__dirname, '..', 'build', 'icon.png'), backgroundColor: settings.theme === 'dark' ? '#16181d' : '#f5f6f8',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), webviewTag: true, contextIsolation: true, sandbox: false },
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, 'index.html'));
  win.on('maximize', () => win.webContents.send('win:state', true));
  win.on('unmaximize', () => win.webContents.send('win:state', false));
  if (process.env.WW_E2E) win.webContents.on('console-message', (_e, l, m, line) => console.log('CONSOLE', m, line));
  if (process.env.WW_E2E) win.webContents.once('did-finish-load', () => require('./e2e')(win));
}

app.on('web-contents-created', (_e, wc) => {
  if (wc.getType() !== 'webview') return;
  wc.setWindowOpenHandler(({ url }) => { wc.loadURL(url); return { action: 'deny' }; });
  wc.on('context-menu', (_ev, params) => {
    Menu.buildFromTemplate([
      { label: '后退', enabled: wc.navigationHistory.canGoBack(), click: () => wc.navigationHistory.goBack() },
      { label: '前进', enabled: wc.navigationHistory.canGoForward(), click: () => wc.navigationHistory.goForward() },
      { label: '刷新', click: () => wc.reload() },
      { type: 'separator' }, { label: '复制', role: 'copy' }, { label: '粘贴', role: 'paste' },
      ...(params.linkURL ? [{ type: 'separator' }, { label: '复制链接', click: () => clipboard.writeText(params.linkURL) }, { label: '在系统浏览器打开', click: () => shell.openExternal(params.linkURL) }] : []),
      ...(params.srcURL && params.mediaType === 'image' ? [{ label: '复制图片地址', click: () => clipboard.writeText(params.srcURL) }] : []),
      { type: 'separator' }, { label: '复制当前网址', click: () => clipboard.writeText(wc.getURL()) },
      { label: '开发者工具', click: () => wc.openDevTools() },
    ]).popup();
  });
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());

ipcMain.on('win', (_e, a) => { if (a === 'min') win.minimize(); if (a === 'max') win.isMaximized() ? win.unmaximize() : win.maximize(); if (a === 'close') win.close(); });
ipcMain.handle('data:get', () => readJSON('weiwei-data.json', { history: [], favorites: [] }));
ipcMain.handle('data:set', (_e, d) => { writeJSON('weiwei-data.json', d); return true; });
ipcMain.handle('settings:get', () => readJSON('settings.json', {}));
ipcMain.handle('settings:set', (_e, s) => { writeJSON('settings.json', s); nativeTheme.themeSource = s.theme === 'dark' ? 'dark' : 'light'; return true; });
ipcMain.handle('platforms:get', () => platforms);
ipcMain.handle('platforms:defaults', () => DEFAULTS);
ipcMain.handle('platforms:set', (_e, list) => {
  const del = readJSON('deleted.json', []);
  for (const d of DEFAULTS) if (!list.find(p => p.id === d.id) && !del.includes(d.id)) del.push(d.id);
  writeJSON('deleted.json', del.filter(id => !list.find(p => p.id === id)));
  platforms = list; writeJSON('platforms.json', list); applyUA(); return true;
});
ipcMain.handle('platforms:reset', () => { try { fs.unlinkSync(f('platforms.json')); fs.unlinkSync(f('deleted.json')); } catch {} platforms = loadPlatforms(); applyUA(); return platforms; });
ipcMain.handle('platforms:export', async () => {
  const r = await dialog.showSaveDialog(win, { defaultPath: '维维找货-平台配置.json', filters: [{ name: 'JSON', extensions: ['json'] }] });
  if (r.canceled) return null; fs.writeFileSync(r.filePath, JSON.stringify(platforms, null, 2)); return r.filePath;
});
ipcMain.handle('platforms:import', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [{ name: 'JSON', extensions: ['json'] }] });
  if (r.canceled) return null; return JSON.parse(fs.readFileSync(r.filePaths[0], 'utf8'));
});

ipcMain.handle('login:status', async () => {
  const out = {};
  for (const p of platforms) {
    const lc = p.loginCookie || {};
    if (!lc.domain || !lc.names?.length) { out[p.id] = null; continue; }
    try {
      const cookies = await session.fromPartition(partOf(p)).cookies.get({ domain: lc.domain });
      out[p.id] = cookies.some(c => lc.names.includes(c.name) && c.value && !/^(0|false|null|undefined)$/i.test(c.value));
    } catch { out[p.id] = false; }
  }
  return out;
});
ipcMain.handle('login:clear', async (_e, id) => { const p = platforms.find(x => x.id === id); await session.fromPartition(partOf(p)).clearStorageData(); return true; });

ipcMain.handle('image:pick', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [{ name: '图片', extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif'] }] });
  return r.canceled ? null : r.filePaths[0];
});
ipcMain.handle('image:saveBuffer', (_e, buf, ext) => { const p = path.join(app.getPath('temp'), `weiwei-img-${Date.now()}.${ext || 'png'}`); fs.writeFileSync(p, Buffer.from(buf)); return p; });
ipcMain.handle('image:clipboard', () => {
  const img = clipboard.readImage(); if (img.isEmpty()) return null;
  const p = path.join(app.getPath('temp'), `weiwei-clip-${Date.now()}.png`); fs.writeFileSync(p, img.toPNG()); return p;
});

const sleep = ms => new Promise(r => setTimeout(r, ms));
// 通过 DevTools 协议把图片设置到页面的 <input type=file>（等同用户选择文件）
ipcMain.handle('image:upload', async (_e, wcId, filePath, id) => {
  const p = platforms.find(x => x.id === id); const cfg = p.imageSearch || {};
  const wc = webContents.fromId(wcId); if (!wc) return { ok: false, msg: '页面未就绪' };
  try {
    if (cfg.trigger || cfg.triggerText) {
      await wc.executeJavaScript(`(()=>{const texts=${JSON.stringify(cfg.triggerText || [])};
        let el=null; const all=[...document.querySelectorAll('a,button,span,div,i,label')];
        for(const t of texts){ el=all.find(e=>e.children.length<4 && (e.innerText||'').trim()===t) || all.find(e=>(e.title||e.getAttribute('aria-label')||'').includes(t)); if(el) break; }
        const sel=${JSON.stringify(cfg.trigger || '')}; if(!el && sel) el=document.querySelector(sel);
        if(el){el.click(); return true} return false})()`).catch(() => {});
      await sleep(1500);
    }
    const dbg = wc.debugger; let attached = false;
    if (!dbg.isAttached()) { dbg.attach('1.3'); attached = true; }
    try {
      for (let i = 0; i < 6; i++) {
        const { root } = await dbg.sendCommand('DOM.getDocument', { depth: -1, pierce: true });
        const { nodeIds } = await dbg.sendCommand('DOM.querySelectorAll', { nodeId: root.nodeId, selector: cfg.fileInput || 'input[type=file]' });
        if (nodeIds.length) {
          let target = nodeIds[0];
          for (const n of nodeIds) {
            const { attributes } = await dbg.sendCommand('DOM.getAttributes', { nodeId: n });
            const ai = attributes.indexOf('accept'); if (ai >= 0 && /image/.test(attributes[ai + 1])) { target = n; break; }
          }
          await dbg.sendCommand('DOM.setFileInputFiles', { nodeId: target, files: [filePath] });
          return { ok: true, msg: '已自动上传图片' };
        }
        await sleep(1000);
      }
      return { ok: false, msg: '未找到上传控件，请点击页面中的相机图标手动上传（图片路径已复制）' };
    } finally { if (attached) try { dbg.detach(); } catch {} }
  } catch (err) { return { ok: false, msg: '自动上传失败：' + err.message }; }
});
// 自定义平台：自动抓取官网图标（优先 apple-touch-icon / 高分辨率 icon，回退 favicon.ico）
const { net, nativeImage } = require('electron');
async function fetchBuf(u) { const r = await net.fetch(u, { headers: { 'User-Agent': UA.desktop } }); if (!r.ok) throw new Error(r.status); return { buf: Buffer.from(await r.arrayBuffer()), type: r.headers.get('content-type') || '' }; }
ipcMain.handle('favicon:fetch', async (_e, home) => {
  const cands = [];
  try {
    const { buf } = await fetchBuf(home); const html = buf.toString('utf8');
    for (const m of html.matchAll(/<link[^>]+>/gi)) {
      const t = m[0], rel = /rel=["']([^"']+)/i.exec(t)?.[1] || '', href = /href=["']([^"']+)/i.exec(t)?.[1];
      if (href && /icon/i.test(rel)) cands.push({ u: new URL(href, home).href, s: (/apple/i.test(rel) ? 1000 : 0) + (+(/sizes=["'](\d+)/i.exec(t)?.[1] || 0)) });
    }
  } catch {}
  const o = new URL(home).origin;
  cands.push({ u: o + '/apple-touch-icon.png', s: 500 }, { u: o + '/favicon.ico', s: 1 });
  cands.sort((a, b) => b.s - a.s);
  for (const c of cands) {
    try {
      const { buf, type } = await fetchBuf(c.u);
      if (/svg/.test(type) || c.u.endsWith('.svg')) return 'data:image/svg+xml;base64,' + buf.toString('base64');
      let img = nativeImage.createFromBuffer(buf);
      if (img.isEmpty() && /ico/.test(type + c.u)) return 'data:image/x-icon;base64,' + buf.toString('base64');
      if (img.isEmpty() || img.getSize().width < 16) continue;
      if (img.getSize().width > 128) img = img.resize({ width: 128, height: 128, quality: 'best' });
      return img.toDataURL();
    } catch {}
  }
  return null;
});
ipcMain.handle('logo:pick', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'ico', 'svg', 'webp'] }] });
  if (r.canceled) return null; let img = nativeImage.createFromPath(r.filePaths[0]);
  if (img.isEmpty()) return 'data:image/svg+xml;base64,' + fs.readFileSync(r.filePaths[0]).toString('base64');
  if (img.getSize().width > 128) img = img.resize({ width: 128, height: 128, quality: 'best' }); return img.toDataURL();
});
ipcMain.handle('open:external', (_e, u) => shell.openExternal(u));
ipcMain.handle('clipboard:write', (_e, t) => clipboard.writeText(t));

ipcMain.handle('ua', () => UA);
// 移动端：触摸模拟（CDP Emulation），电脑端：关闭
ipcMain.handle('emulate', async (_e, wcId, mobile) => {
  const wc = webContents.fromId(wcId); if (!wc) return false;
  const dbg = wc.debugger;
  try {
    if (mobile) {
      if (!dbg.isAttached()) dbg.attach('1.3');
      await dbg.sendCommand('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
      await dbg.sendCommand('Emulation.setEmitTouchEventsForMouse', { enabled: true, configuration: 'mobile' });
    } else if (dbg.isAttached()) {
      await dbg.sendCommand('Emulation.setTouchEmulationEnabled', { enabled: false }).catch(() => {});
      await dbg.sendCommand('Emulation.setEmitTouchEventsForMouse', { enabled: false }).catch(() => {});
      dbg.detach();
    }
    return true;
  } catch (err) { return false; }
});
