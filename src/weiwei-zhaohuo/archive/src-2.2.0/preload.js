const { contextBridge, ipcRenderer, webUtils } = require('electron');
const inv = (c, ...a) => ipcRenderer.invoke(c, ...a);
contextBridge.exposeInMainWorld('ww', {
  win: a => ipcRenderer.send('win', a), onWinState: cb => ipcRenderer.on('win:state', (_e, m) => cb(m)),
  getData: () => inv('data:get'), setData: d => inv('data:set', d),
  getSettings: () => inv('settings:get'), setSettings: s => inv('settings:set', s),
  getPlatforms: () => inv('platforms:get'), setPlatforms: l => inv('platforms:set', l), resetPlatforms: () => inv('platforms:reset'),
  exportPlatforms: () => inv('platforms:export'), importPlatforms: () => inv('platforms:import'),
  loginStatus: () => inv('login:status'), logout: id => inv('login:clear', id),
  pickImage: () => inv('image:pick'), saveImage: (b, e) => inv('image:saveBuffer', b, e), clipboardImage: () => inv('image:clipboard'),
  uploadImage: (w, f, id) => inv('image:upload', w, f, id), copy: t => inv('clipboard:write', t), openExternal: u => inv('open:external', u), fetchFavicon: h => inv('favicon:fetch', h), pickLogo: () => inv('logo:pick'), ua: () => inv('ua'), emulate: (w, m) => inv('emulate', w, m),
  filePath: f => webUtils.getPathForFile(f), platform: process.platform,
});
