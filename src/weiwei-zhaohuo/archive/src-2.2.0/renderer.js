'use strict';
/* window.ww 由 preload 注入 */
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let P = [], data = { history: [], favorites: [] }, settings = {};
let mode = 'text', view = 'tabs', active = null, imageFile = null, loginMap = {};
const panes = {};
let selected = new Set();
const HOT = ['保温杯', '蓝牙耳机', '连衣裙', '手机壳', '儿童玩具', '收纳盒'];

const enabled = () => P.filter(p => p.enabled !== false);
const byId = id => P.find(p => p.id === id);
const capOf = (p, m) => p.capabilities?.[m];
const fill = (tpl, q) => tpl.replace(/\{q\}/g, encodeURIComponent(q));
let UA = {};
const isMobile = p => (p.accessMode === 'mobile' || p.accessMode === 'desktop' ? p.accessMode : (settings.accessMode || 'mobile')) === 'mobile';
const homeOf = p => isMobile(p) && p.mobileHome || p.home;
const loginOf = p => isMobile(p) && p.mobileLogin || p.login || homeOf(p);
const tplOf = p => isMobile(p) && p.mobileSearch || p.search;
const searchUrl = (p, q) => tplOf(p) ? fill(tplOf(p), q) : null;
const uaOf = p => isMobile(p) ? (settings.mobileUA === 'android' ? UA.android : UA.mobile) : UA.desktop;

/* ---------- 通用 UI ---------- */
function toast(msg, type = 'info', ms = 2600) {
  const icons = { success: 'ri-checkbox-circle-fill', error: 'ri-error-warning-fill', info: 'ri-information-fill', warn: 'ri-alert-fill' };
  const t = document.createElement('div'); t.className = 'toast ' + type;
  t.innerHTML = `<i class="${icons[type]}"></i><span>${esc(msg)}</span>`;
  $('#toasts').appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 220); }, ms);
}
const status = t => { $('#statusText').textContent = t; };
function avatar(p, cls = 'avatar') {
  if (p.logo) return `<span class="${cls} logo"><img src="${esc(p.logo)}" alt="" draggable="false" onerror="this.parentNode.classList.remove('logo');this.parentNode.style.background='${esc(p.color || '#888')}';this.replaceWith(document.createTextNode('${esc((p.name || '?').slice(0, 1))}'))"></span>`;
  return `<span class="${cls}" style="background:${esc(p.color || '#888')}">${p.icon ? `<i class="${esc(p.icon)}"></i>` : esc((p.name || '?').slice(0, 1))}</span>`;
}
document.addEventListener('mouseover', e => {
  const el = e.target.closest('[data-tip]'); const tt = $('#tooltip');
  if (!el) { tt.hidden = true; return; }
  tt.textContent = el.dataset.tip; tt.hidden = false;
  const r = el.getBoundingClientRect(); const w = tt.offsetWidth;
  tt.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + 'px';
  tt.style.top = (r.bottom + 6 + 28 > innerHeight ? r.top - 30 : r.bottom + 6) + 'px';
});
document.addEventListener('mousedown', () => { $('#tooltip').hidden = true; });

/* ---------- 主题 ---------- */
function applyTheme() {
  const t = settings.theme || 'light';
  const dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.body.classList.toggle('dark', dark); document.body.classList.toggle('light', !dark);
  $('#btnTheme i').className = dark ? 'ri-sun-line' : 'ri-moon-line';
  $$('#themeSeg button').forEach(b => b.classList.toggle('active', b.dataset.theme === t));
}
function setTheme(t) { settings.theme = t; applyTheme(); saveSettings(); }
const saveSettings = () => ww.setSettings(settings);
const saveData = () => ww.setData(data);

/* ---------- 侧边栏 ---------- */
function renderPlatforms() {
  const ul = $('#platformList'); ul.innerHTML = '';
  for (const p of enabled()) {
    const cap = capOf(p, mode);
    const li = document.createElement('li');
    li.className = 'plat' + (active === p.id ? ' active' : '') + (cap ? '' : ' disabled');
    li.dataset.id = p.id;
    li.title = (cap ? '' : '该平台不支持此搜索方式\n') + (p.note || '');
    const login = loginMap[p.id];
    li.innerHTML = `<span class="chk ${selected.has(p.id) && cap ? 'on' : ''}"><i class="ri-check-line"></i></span>${avatar(p)}
      <span class="pname">${esc(p.name)}</span>${p.accessMode === 'mobile' || p.accessMode === 'desktop' ? `<i class="mode-ico ${isMobile(p) ? 'ri-smartphone-line' : 'ri-computer-line'}" data-tip="单独设置为${isMobile(p) ? '移动端' : '电脑端'}"></i>` : ''}${cap === 'manual' ? '<span class="tag" data-tip="该平台不支持直接搜索链接，会打开首页并复制关键词">手动</span>' : ''}
      ${login === null ? '' : `<span class="lstat ${login ? 'on' : ''}" data-tip="${login ? '已登录 · 点击退出' : '未登录 · 点击登录'}"><i class="${login ? 'ri-user-follow-line' : 'ri-login-circle-line'}"></i></span>`}`;
    li.querySelector('.chk').onclick = e => { e.stopPropagation(); selected.has(p.id) ? selected.delete(p.id) : selected.add(p.id); settings.selected = [...selected]; saveSettings(); renderPlatforms(); };
    const ls = li.querySelector('.lstat');
    if (ls) ls.onclick = e => { e.stopPropagation(); loginAction(p); };
    li.onclick = () => panes[p.id]?.wv ? focus(p.id) : navigate(p.id, homeOf(p));
    ul.appendChild(li);
  }
}
async function loginAction(p) {
  if (loginMap[p.id]) {
    if (!confirm(`退出「${p.name}」登录并清除该平台本地数据？`)) return;
    await ww.logout(p.id); panes[p.id]?.wv?.reload(); refreshLogin(); toast(`已退出 ${p.name}`, 'success');
  } else { $('#modal').hidden = true; navigate(p.id, loginOf(p)); panes[p.id].userLogin = true; setView('tabs'); focus(p.id); toast(`请在页面中登录 ${p.name}，登录状态将自动保存`, 'info', 4000); }
}
function renderLists() {
  const h = $('#historyList'); h.innerHTML = '';
  if (!data.history.length) h.innerHTML = '<li class="none">暂无搜索记录</li>';
  data.history.forEach((x, i) => {
    const li = document.createElement('li');
    li.innerHTML = `<i class="${x.mode === 'ai' ? 'ri-sparkling-2-line' : x.mode === 'image' ? 'ri-image-line' : 'ri-history-line'}"></i><span>${esc(x.q)}</span><i class="ri-close-line del"></i>`;
    li.title = x.q;
    li.onclick = e => { if (e.target.classList.contains('del')) { data.history.splice(i, 1); saveData(); return renderLists(); } setMode(x.mode); if (x.file) setImage(x.file); else $('#q').value = x.q; search(); };
    h.appendChild(li);
  });
  const f = $('#favList'); f.innerHTML = '';
  if (!data.favorites.length) f.innerHTML = '<li class="none">点击页面右上角星标收藏</li>';
  data.favorites.forEach((x, i) => {
    const li = document.createElement('li');
    li.innerHTML = `<i class="ri-star-line"></i><span>${esc(x.title)}</span><i class="ri-close-line del"></i>`; li.title = x.url;
    li.onclick = e => { if (e.target.classList.contains('del')) { data.favorites.splice(i, 1); saveData(); return renderLists(); } if (byId(x.id)) { navigate(x.id, x.url); focus(x.id); } };
    f.appendChild(li);
  });
}

/* ---------- 浏览器面板 ---------- */
function ensurePane(id) {
  if (panes[id]) return panes[id];
  const p = byId(id);
  const el = document.createElement('div'); el.className = 'pane'; el.dataset.id = id;
  el.innerHTML = `<div class="ph">${avatar(p)}<b>${esc(p.name)}</b>
    <button class="icon-btn" data-a="back" data-tip="后退"><i class="ri-arrow-left-line"></i></button>
    <button class="icon-btn" data-a="fwd" data-tip="前进"><i class="ri-arrow-right-line"></i></button>
    <button class="icon-btn" data-a="reload" data-tip="刷新 F5"><i class="ri-refresh-line"></i></button>
    <button class="icon-btn" data-a="home" data-tip="首页"><i class="ri-home-5-line"></i></button>
    <div class="url"><i class="ri-lock-line"></i><span></span></div>
    <button class="icon-btn" data-a="mode" data-tip="切换 移动端/电脑端"><i class="ri-smartphone-line"></i></button>
    <button class="icon-btn" data-a="fav" data-tip="收藏当前页"><i class="ri-star-line"></i></button>
    <button class="icon-btn" data-a="copy" data-tip="复制网址"><i class="ri-file-copy-line"></i></button>
    <button class="icon-btn" data-a="max" data-tip="单独查看"><i class="ri-fullscreen-line"></i></button></div>
    <div class="tip"><i class="ri-lightbulb-line"></i><span></span><button class="icon-btn sm" data-a="tipx"><i class="ri-close-line"></i></button></div>
    <div class="skel"><div class="bar" style="width:40%"></div><div class="bar" style="width:70%"></div><div class="cards">${'<div class="card"></div>'.repeat(8)}</div></div>`;
  $('#stage').appendChild(el);
  const pane = panes[id] = { el, wv: null, tip: el.querySelector('.tip'), u: el.querySelector('.url span') };
  el.querySelector('.ph').onclick = e => {
    const a = e.target.closest('[data-a]')?.dataset.a, wv = pane.wv; if (!a) return;
    if (a === 'home') return navigate(id, homeOf(p));
    if (a === 'max') { setView('tabs'); return focus(id); }
    if (a === 'mode') { p.accessMode = isMobile(p) ? 'desktop' : 'mobile'; persistPlatforms(); toast(`${p.name} 已切换为${isMobile(p) ? '移动端' : '电脑端'}`, 'success'); return; }
    if (!wv) return;
    if (a === 'back' && wv.canGoBack()) wv.goBack();
    if (a === 'fwd' && wv.canGoForward()) wv.goForward();
    if (a === 'reload') wv.reload();
    if (a === 'copy') { ww.copy(wv.getURL()); toast('网址已复制', 'success'); }
    if (a === 'fav') { data.favorites.unshift({ title: `${p.name} · ${wv.getTitle() || wv.getURL()}`, url: wv.getURL(), id }); data.favorites = data.favorites.slice(0, 100); saveData(); renderLists(); toast('已加入收藏', 'success'); }
  };
  pane.tip.querySelector('[data-a=tipx]').onclick = () => tip(id, '');
  return pane;
}
const ERR_TEXT = c => ({ '-2': '网络连接失败', '-7': '连接超时', '-21': '网络已切换', '-100': '连接被对方关闭', '-101': '连接被重置', '-102': '对方拒绝连接', '-105': '找不到该网站', '-106': '网络已断开', '-118': '连接超时', '-137': '域名解析失败', '-310': '跳转次数过多', '-337': '协议错误' })[String(c)] || '页面打不开';
function failTip(id, text) {
  const pane = panes[id]; if (!pane) return;
  tip(id, text);
  const t = pane.tip; t.querySelectorAll('.tip-act').forEach(x => x.remove());
  const mk = (label, fn) => { const b = document.createElement('button'); b.className = 'btn sm tip-act'; b.textContent = label; b.onclick = fn; t.insertBefore(b, t.lastElementChild); };
  mk('重试', () => { tip(id, ''); pane.wv.reload(); armWatchdog(id); });
  mk('用系统浏览器打开', () => ww.openExternal(pane.u.textContent));
}
const LOGIN_RE = /(passport|login|signin|mlogin|plogin|mini_login)[./]/i;
function needLoginTip(id) {
  const pane = panes[id], p = byId(id); if (!pane) return;
  tip(id, `${p.name}要求登录后才能查看搜索结果，登录一次即可长期保存`);
  const t = pane.tip; t.querySelectorAll('.tip-act').forEach(x => x.remove());
  const b = document.createElement('button'); b.className = 'btn sm tip-act'; b.textContent = '在此登录';
  b.onclick = () => { tip(id, ''); setView('tabs'); focus(id); }; t.insertBefore(b, t.lastElementChild);
}
function armWatchdog(id) {
  const pane = panes[id]; clearTimeout(pane.wd);
  pane.wd = setTimeout(() => { if (pane.el.classList.contains('loading')) { setLoading(id, false); failTip(id, `${byId(id)?.name || ''}响应太慢，可能被网站限制访问，可以重试或用系统浏览器打开`); } }, 20000);
}
function setLoading(id, on) {
  panes[id]?.el.classList.toggle('loading', on);
  document.querySelector(`.tab[data-id="${id}"]`)?.classList.toggle('loading', on);
}
function navigate(id, url, onReady) {
  const p = byId(id); if (!p) return;
  const pane = ensurePane(id);
  const once = wv => { if (!onReady) return; const h = () => { wv.removeEventListener('did-stop-loading', h); onReady(wv); }; wv.addEventListener('did-stop-loading', h); };
  if (!pane.wv) {
    const wv = document.createElement('webview');
    wv.setAttribute('partition', 'persist:' + (p.partition || p.id));
    wv.setAttribute('allowpopups', '');
    wv.setAttribute('useragent', uaOf(p)); pane.mobile = isMobile(p);
    wv.setAttribute('src', url);
    wv.addEventListener('did-start-loading', () => setLoading(id, true));
    wv.addEventListener('did-stop-loading', () => { setLoading(id, false); clearTimeout(pane.wd); });
    wv.addEventListener('dom-ready', () => { setLoading(id, false); if (!pane.ready) { pane.ready = true; ww.emulate(wv.getWebContentsId(), pane.mobile); } applyView(); });
    wv.addEventListener('did-navigate', e => { pane.u.textContent = e.url; setTimeout(refreshLogin, 1500);
      if (LOGIN_RE.test(e.url) && !LOGIN_RE.test(pane.lastNav || '') && !pane.userLogin) needLoginTip(id); if (!LOGIN_RE.test(e.url)) pane.userLogin = false; pane.lastNav = e.url; });
    wv.addEventListener('did-navigate-in-page', e => { if (e.isMainFrame) pane.u.textContent = e.url; });
    wv.addEventListener('did-fail-load', e => { if (e.isMainFrame && e.errorCode !== -3) { setLoading(id, false); clearTimeout(pane.wd); failTip(id, `${ERR_TEXT(e.errorCode)}，${p.name}暂时无法访问`); status(`${p.name}：${ERR_TEXT(e.errorCode)}`); } });
    pane.el.appendChild(wv); pane.wv = wv; once(wv);
  } else { once(pane.wv); pane.wv.loadURL(url).catch(() => {}); }
  setLoading(id, true); armWatchdog(id);
  pane.u.textContent = url; markMode(id);
  if (view === 'tabs' || !active) active = id;
  renderTabs(); applyView(); renderPlatforms();
  return pane;
}
function markMode(id) {
  const pane = panes[id], p = byId(id); if (!pane || !p) return;
  const m = isMobile(p);
  pane.el.classList.toggle('mobile', m);
  const b = pane.el.querySelector('[data-a=mode]');
  b.querySelector('i').className = m ? 'ri-smartphone-line' : 'ri-computer-line';
  b.dataset.tip = (m ? '当前：移动端' : '当前：电脑端') + (p.accessMode === 'follow' || !p.accessMode ? '（跟随全局）' : '') + ' · 点击切换';
  b.classList.toggle('on-mode', p.accessMode === 'mobile' || p.accessMode === 'desktop');
}
// 访问方式变化的平台：切换 UA/触摸模拟并重新加载（若有搜索词则重新搜索）
function syncModes() {
  for (const [id, pane] of Object.entries(panes)) {
    const p = byId(id); if (!p || !pane.wv) continue;
    const m = isMobile(p); markMode(id);
    if (pane.mobile === m) continue;
    pane.mobile = m;
    try { pane.wv.setUserAgent(uaOf(p)); } catch {}
    ww.emulate(pane.wv.getWebContentsId(), m);
    const url = pane.lastQ && searchUrl(p, pane.lastQ) || homeOf(p);
    pane.wv.loadURL(url).catch(() => {}); pane.u.textContent = url; setLoading(id, true);
  }
  applyView();
}
function closePane(id) {
  const pane = panes[id]; if (!pane) return;
  pane.el.remove(); delete panes[id];
  if (active === id) active = Object.keys(panes)[0] || null;
  renderTabs(); applyView(); renderPlatforms();
}
function tip(id, text, ok) { const t = panes[id]?.tip; if (!t) return; t.querySelector('span').textContent = text || ''; t.classList.toggle('show', !!text); t.classList.toggle('ok', !!ok); }
function focus(id) { active = id; renderTabs(); applyView(); renderPlatforms(); }
function renderTabs() {
  const bar = $('#tabbar'); bar.innerHTML = '';
  for (const p of P) {
    if (!panes[p.id]) continue;
    const t = document.createElement('div');
    t.className = 'tab' + (active === p.id ? ' active' : '') + (panes[p.id].el.classList.contains('loading') ? ' loading' : '');
    t.dataset.id = p.id;
    t.innerHTML = `${avatar(p, 'avatar xs')}<i class="ri-loader-4-line spin"></i><span>${esc(p.name)}</span><i class="ri-close-line x"></i>`;
    t.onclick = e => e.target.classList.contains('x') ? closePane(p.id) : focus(p.id);
    t.onauxclick = e => { if (e.button === 1) closePane(p.id); };
    bar.appendChild(t);
  }
  const opts = enabled().map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
  for (const [s, d] of [['#cmpL', 0], ['#cmpR', 1]]) {
    const sel = $(s), v = sel.value; sel.innerHTML = opts;
    sel.value = byId(v) ? v : (Object.keys(panes)[d] || enabled()[d]?.id);
  }
}
function applyView() {
  const st = $('#stage'); st.className = view + ' mw-' + (settings.mobileWidth || '414');
  const opened = P.filter(p => panes[p.id]).map(p => p.id);
  $('#empty').hidden = opened.length > 0 && view !== 'compare';
  $('#tabbar').style.display = view === 'tabs' ? 'flex' : 'none';
  $('#compareBar').hidden = view !== 'compare';
  const lim = view === 'grid6' ? 6 : 4;
  const gridIds = [...new Set([active, ...opened].filter(x => x && opened.includes(x)))].slice(0, lim);
  const L = $('#cmpL').value, R = $('#cmpR').value;
  if (view === 'compare') { $('#empty').hidden = true; for (const id of [L, R]) if (id && !panes[id]?.wv) navigate(id, homeOf(byId(id))); }
  for (const [id, pane] of Object.entries(panes)) {
    const c = pane.el.classList;
    c.toggle('active', id === active); c.toggle('shown', gridIds.includes(id));
    c.toggle('cmp', id === L || id === R);
    if (pane.wv && pane.ready) try { pane.wv.setZoomFactor(pane.mobile ? 1 : view === 'grid6' ? 0.67 : view === 'grid4' ? 0.8 : view === 'compare' ? 0.85 : 1); } catch {} c.toggle('cmpL', id === L); c.toggle('cmpR', id === R);
  }
}
function setView(v) { view = v; $$('#views button').forEach(b => b.classList.toggle('active', b.dataset.view === v)); applyView(); }
function setMode(m) {
  mode = m; $$('#modes button').forEach(b => b.classList.toggle('active', b.dataset.mode === m));
  $('#q').placeholder = { text: '搜索商品，回车一键搜索全部已选平台', image: '粘贴 / 拖入 / 点击右侧相机选择图片，然后一键搜索', ai: '描述需求，例如：200元以内适合送妈妈的保暖围巾' }[m];
  renderPlatforms();
}
const targets = () => enabled().filter(p => selected.has(p.id) && capOf(p, mode));

/* ---------- 搜索 ---------- */
async function search() {
  const q = $('#q').value.trim(); const ts = targets();
  if (!ts.length) return toast('当前模式下没有已选且支持的平台', 'warn');
  if (mode !== 'image' && !q) { $('#q').focus(); return toast(mode === 'ai' ? '请先描述你的需求' : '请输入关键词', 'warn'); }
  if (mode === 'text') {
    let manual = 0;
    for (const p of ts) {
      const u = searchUrl(p, q);
      if (u) { navigate(p.id, u); tip(p.id, ''); panes[p.id].lastQ = q; }
      else { manual++; navigate(p.id, homeOf(p)); tip(p.id, `${p.note || '该平台无搜索链接'}（关键词已复制，Ctrl+V 粘贴到站内搜索框）`); }
    }
    if (manual) ww.copy(q);
    addHistory({ mode, q }); toast(`已在 ${ts.length} 个平台搜索「${q}」`, 'success');
  } else if (mode === 'ai') {
    await ww.copy(q);
    for (const p of ts) { const u = p.aiSearch?.url ? fill(p.aiSearch.url, q) : searchUrl(p, q) || homeOf(p); navigate(p.id, u); tip(p.id, (p.aiSearch?.note || 'AI 找货') + (/复制/.test(p.aiSearch?.note || '') ? '' : '（需求已复制，可 Ctrl+V 粘贴）')); }
    addHistory({ mode, q }); toast(`AI 找货已在 ${ts.length} 个平台发起`, 'success');
  } else {
    if (!imageFile) { toast('请先选择、粘贴或拖入一张图片', 'warn'); return $('#pickImg').click(); }
    await ww.copy(imageFile);
    for (const p of ts) {
      navigate(p.id, (isMobile(p) ? p.imageSearch?.mobileUrl : null) || p.imageSearch?.url || homeOf(p), async wv => {
        tip(p.id, '正在自动上传图片…');
        await new Promise(r => setTimeout(r, 1200));
        let r = await ww.uploadImage(wv.getWebContentsId(), imageFile, p.id);
        // 移动网页通常没有图片上传入口：自动改用电脑端图搜页面上传（仅本次，之后切回所选访问方式）
        if (!r.ok && panes[p.id].mobile && p.imageSearch?.url && capOf(p, 'image') === true) {
          tip(p.id, '移动网页无图片上传入口，正在改用电脑端图搜…');
          const pane = panes[p.id]; pane.mobile = false; wv.setUserAgent(UA.desktop); await ww.emulate(wv.getWebContentsId(), false);
          await new Promise(res => { const h = () => { wv.removeEventListener('did-stop-loading', h); res(); }; wv.addEventListener('did-stop-loading', h); wv.loadURL(p.imageSearch.url).catch(res); });
          markMode(p.id); pane.el.classList.remove('mobile'); applyView();
          await new Promise(r2 => setTimeout(r2, 1200));
          r = await ww.uploadImage(wv.getWebContentsId(), imageFile, p.id);
          if (r.ok) r.msg += '（移动网页无上传入口，本次使用电脑端图搜）';
        }
        tip(p.id, r.msg + (p.note && !r.ok ? '｜' + p.note : ''), r.ok);
      });
    }
    addHistory({ mode, q: '图片 · ' + imageFile.split(/[\\/]/).pop(), file: imageFile });
    toast(`以图搜货：${ts.length} 个平台处理中`, 'info');
  }
  status(`${{ text: '文字', image: '图片', ai: 'AI' }[mode]}搜索 · ${ts.map(p => p.name).join('、')}`);
  if (view === 'tabs' && settings.focusFirst !== false) focus(ts[0].id);
}
function addHistory(h) { data.history = [h, ...data.history.filter(x => x.q !== h.q)].slice(0, 30); saveData(); renderLists(); }
function setImage(f) {
  imageFile = f; $('#imgChip').hidden = !f;
  if (f) { $('#imgPreview').src = 'file://' + f.replace(/\\/g, '/'); $('#imgName').textContent = f.split(/[\\/]/).pop().slice(0, 16); setMode('image'); }
}
async function refreshLogin() {
  loginMap = await ww.loginStatus(); renderPlatforms();
  const vals = enabled().map(p => loginMap[p.id]).filter(v => v !== null && v !== undefined);
  $('#loginSummary').innerHTML = `<i class="ri-shield-user-line"></i>已登录 ${vals.filter(Boolean).length}/${vals.length} · 登录状态自动保存`;
  if (!$('#modal').hidden) renderAccounts();
}

/* ---------- 设置 / 平台管理 ---------- */
function openSettings(page = 'general') {
  $('#modal').hidden = false; showPage(page);
  $('#setView').value = settings.view || 'tabs';
  $('#setFocusFirst').checked = settings.focusFirst !== false;
  $('#setOpenHome').checked = !!settings.openHome;
  $$('#accessSeg button').forEach(b => b.classList.toggle('active', b.dataset.am === (settings.accessMode || 'mobile')));
  $('#setMobileWidth').value = settings.mobileWidth || '414'; $('#setMobileUA').value = settings.mobileUA || 'iphone';
  applyTheme();
}
function showPage(page) {
  $$('.dlg-side button').forEach(b => b.classList.toggle('active', b.dataset.sp === page));
  $$('.dlg-body section').forEach(s => s.hidden = s.dataset.page !== page);
  if (page === 'platforms') renderManager(); if (page === 'accounts') renderAccounts();
}
const capTag = (label, v) => `<span class="cap ${v === true ? 'y' : v ? 'm' : ''}">${label}${v === 'manual' ? '·手动' : ''}</span>`;
function renderManager() {
  const ul = $('#pmList'); ul.innerHTML = '';
  P.forEach((p, i) => {
    const li = document.createElement('li'); li.draggable = true; li.dataset.i = i;
    li.innerHTML = `<i class="ri-draggable grip"></i>${avatar(p)}<div class="pm-info"><b>${esc(p.name)}</b>${p.builtin ? '' : ' <span class="tag">自定义</span>'}<div><i class="${isMobile(p) ? 'ri-smartphone-line' : 'ri-computer-line'}"></i> ${esc(tplOf(p) || '（无搜索链接，打开首页）')}</div></div>
      <div class="caps">${capTag('文字', p.capabilities?.text)}${capTag('图片', p.capabilities?.image)}${capTag('AI', p.capabilities?.ai)}</div>
      <select class="am-sel" data-tip="访问方式"><option value="follow">跟随全局</option><option value="mobile">移动端</option><option value="desktop">电脑端</option></select>
      <input type="checkbox" class="switch" ${p.enabled !== false ? 'checked' : ''} data-tip="显示/隐藏">
      <button class="icon-btn" data-a="edit" data-tip="编辑"><i class="ri-edit-line"></i></button>
      <button class="icon-btn" data-a="del" data-tip="删除"><i class="ri-delete-bin-6-line"></i></button>`;
    li.querySelector('.switch').onchange = e => { p.enabled = e.target.checked; persistPlatforms(); };
    const am = li.querySelector('.am-sel'); am.value = p.accessMode || 'follow'; am.onchange = () => { p.accessMode = am.value; persistPlatforms(); };
    li.querySelector('[data-a=edit]').onclick = () => openEditor(p);
    li.querySelector('[data-a=del]').onclick = () => { if (confirm(`删除平台「${p.name}」？`)) { P.splice(i, 1); closePane(p.id); persistPlatforms(); toast(`已删除 ${p.name}`, 'success'); } };
    li.ondragstart = e => { li.classList.add('dragging'); e.dataTransfer.setData('text/x-ww', i); };
    li.ondragend = () => li.classList.remove('dragging');
    li.ondragover = e => { e.preventDefault(); li.classList.add('over'); };
    li.ondragleave = () => li.classList.remove('over');
    li.ondrop = e => { e.preventDefault(); e.stopPropagation(); const from = +e.dataTransfer.getData('text/x-ww'); const [m] = P.splice(from, 1); P.splice(i, 0, m); persistPlatforms(); };
    ul.appendChild(li);
  });
}
function renderAccounts() {
  const ul = $('#accList'); ul.innerHTML = '';
  for (const p of enabled()) {
    const s = loginMap[p.id];
    const li = document.createElement('li');
    li.innerHTML = `${avatar(p)}<div class="pm-info"><b>${esc(p.name)}</b><div>会话：persist:${esc(p.partition || p.id)}</div></div>
      ${s === null ? '<span class="cap">无法检测</span>' : `<span class="lstat ${s ? 'on' : ''}">${s ? '已登录' : '未登录'}</span>`}
      <button class="btn">${s ? '<i class="ri-logout-box-r-line"></i>退出' : '<i class="ri-login-box-line"></i>去登录'}</button>`;
    li.querySelector('.btn').onclick = () => loginAction(p);
    ul.appendChild(li);
  }
}
async function persistPlatforms() {
  await ww.setPlatforms(P);
  for (const id of [...selected]) if (!byId(id)) selected.delete(id);
  renderManager(); renderPlatforms(); renderTabs(); syncModes(); refreshLogin();
}
let editing = null;
function openEditor(p) {
  editing = p || null; const f = $('#pform');
  $('#pformTitle').textContent = p ? `编辑平台 · ${p.name}` : '添加平台'; $('#pformErr').textContent = '';
  const v = p || { color: '#ff5c28', ua: 'desktop', capabilities: { text: true, image: false, ai: false } };
  const set = (n, x) => { f.elements[n].value = x ?? ''; };
  set('name', v.name); pendingLogo = v.logo || null; showLogo(); set('id', v.id); set('color', v.color || '#ff5c28'); set('icon', v.icon); set('home', v.home); set('search', v.search); set('login', v.login);
  set('mobileHome', v.mobileHome); set('mobileSearch', v.mobileSearch); set('mobileLogin', v.mobileLogin); set('accessMode', v.accessMode || 'follow'); set('cookieDomain', v.loginCookie?.domain); set('cookieNames', (v.loginCookie?.names || []).join(',')); set('partition', p && p.partition !== p.id ? p.partition : '');
  set('image', String(v.capabilities?.image ?? false)); set('ai', String(v.capabilities?.ai ?? false));
  set('imageUrl', v.imageSearch?.url); set('aiUrl', v.aiSearch?.url); set('note', v.note);
  f.elements.id.readOnly = !!p;
  $('#editor').hidden = false; f.elements.name.focus();
}
let pendingLogo = null;
function showLogo() { const b = $('#logoPreview'); b.innerHTML = pendingLogo ? `<img src="${esc(pendingLogo)}">` : '<i class="ri-image-line"></i>'; }
$('#logoFetch').onclick = async () => {
  const home = $('#pform').elements.home.value.trim(); if (!home) return $('#pformErr').textContent = '请先填写首页 URL';
  $('#logoFetch').disabled = true; $('#logoFetch').innerHTML = '<i class="ri-loader-4-line spin-i"></i>获取中';
  const d = await ww.fetchFavicon(home).catch(() => null);
  $('#logoFetch').disabled = false; $('#logoFetch').innerHTML = '<i class="ri-download-cloud-2-line"></i>自动获取';
  if (d) { pendingLogo = d; showLogo(); toast('已获取官网图标', 'success'); } else toast('没有获取到图标，将使用文字图标，也可以上传图片', 'warn');
};
$('#logoUpload').onclick = async () => { const d = await ww.pickLogo(); if (d) { pendingLogo = d; showLogo(); } };
$('#logoClear').onclick = () => { pendingLogo = null; showLogo(); };
function readForm() {
  const e = $('#pform').elements, g = n => e[n].value.trim();
  const cv = s => s === 'true' ? true : s === 'manual' ? 'manual' : false;
  const id = g('id');
  const base = editing ? JSON.parse(JSON.stringify(editing)) : { builtin: false, enabled: true };
  return Object.assign(base, {
    id, name: g('name'), color: e.color.value, logo: pendingLogo, icon: g('icon'), home: g('home'), search: g('search') || null, login: g('login') || g('home'),
    loginCookie: { domain: g('cookieDomain'), names: g('cookieNames').split(/[,，\s]+/).filter(Boolean) },
    accessMode: e.accessMode.value, mobileHome: g('mobileHome') || null, mobileSearch: g('mobileSearch') || null, mobileLogin: g('mobileLogin') || null, partition: g('partition') || id, note: g('note'),
    capabilities: { text: g('search') || g('mobileSearch') ? true : 'manual', image: cv(e.image.value), ai: cv(e.ai.value) },
    imageSearch: g('imageUrl') || cv(e.image.value) ? Object.assign(base.imageSearch || {}, { url: g('imageUrl') || g('home') }) : null,
    aiSearch: g('aiUrl') ? Object.assign(base.aiSearch || {}, { url: g('aiUrl') }) : (base.aiSearch || null),
  });
}
function validate(p) {
  if (!p.name) return '请填写名称';
  if (!/^[a-z0-9_-]+$/.test(p.id)) return 'ID 只能包含小写字母、数字、- 和 _';
  if (!editing && byId(p.id)) return 'ID 已存在';
  try { new URL(p.home); } catch { return '首页 URL 无效'; }
  if (p.mobileSearch && !p.mobileSearch.includes('{q}')) return '移动端搜索 URL 模板需包含 {q}';
  if (p.mobileHome) { try { new URL(p.mobileHome); } catch { return '移动端首页 URL 无效'; } }
  if (p.search) { if (!p.search.includes('{q}')) return '搜索 URL 模板需包含 {q}'; try { new URL(fill(p.search, 'test')); } catch { return '搜索 URL 无效'; } }
  return '';
}
$('#pform').onsubmit = e => {
  e.preventDefault(); const p = readForm(); const err = validate(p);
  if (err) return $('#pformErr').textContent = err;
  if (!p.logo && !editing) ww.fetchFavicon(p.home).then(d => { if (d) { const x = byId(p.id); if (x && !x.logo) { x.logo = d; persistPlatforms(); } } }).catch(() => {});
  if (editing) P[P.indexOf(editing)] = p; else { P.push(p); selected.add(p.id); }
  if (panes[p.id]) closePane(p.id);
  persistPlatforms(); $('#editor').hidden = true; toast(editing ? '平台已更新' : `已添加 ${p.name}`, 'success');
};
$('#pformCancel').onclick = () => { $('#editor').hidden = true; };
$('#pformTest').onclick = () => {
  const p = readForm(); const err = validate(p); if (err) return $('#pformErr').textContent = err;
  if (!p.search) return $('#pformErr').textContent = '未填写搜索 URL 模板';
  ww.copy(fill(p.search, '保温杯')); $('#pformErr').textContent = ''; toast('测试链接已复制：' + fill(p.search, '保温杯'), 'info', 4000);
};
$('#pmAdd').onclick = () => openEditor(null);
$('#pmExport').onclick = async () => { const f = await ww.exportPlatforms(); if (f) toast('已导出到 ' + f, 'success'); };
$('#pmImport').onclick = async () => {
  try {
    const list = await ww.importPlatforms(); if (!list) return;
    if (!Array.isArray(list)) throw new Error('格式不正确');
    let n = 0;
    for (const x of list) { if (!x.id || !x.name || !x.home) continue; const i = P.findIndex(p => p.id === x.id); if (i >= 0) P[i] = x; else P.push(x); n++; }
    persistPlatforms(); toast(`已导入 ${n} 个平台`, 'success');
  } catch (e) { toast('导入失败：' + e.message, 'error'); }
};
$('#pmReset').onclick = async () => { if (!confirm('恢复默认平台列表？自定义平台将被删除。')) return; P = await ww.resetPlatforms(); persistPlatforms(); toast('已恢复默认', 'success'); };

/* ---------- 事件绑定 ---------- */
$$('[data-win]').forEach(b => b.onclick = () => ww.win(b.dataset.win));
ww.onWinState(m => { $('#maxIcon').className = m ? 'ri-checkbox-multiple-blank-line' : 'ri-checkbox-blank-line'; });
$('#titlebar').ondblclick = e => { if (e.target.closest('.tb-drag')) ww.win('max'); };
$('#btnTheme').onclick = () => setTheme(document.body.classList.contains('dark') ? 'light' : 'dark');
$('#btnSettings').onclick = () => openSettings();
$('#openManager').onclick = () => openSettings('platforms');
$('#closeModal').onclick = () => { $('#modal').hidden = true; };
$('#modal').onclick = e => { if (e.target.id === 'modal') $('#modal').hidden = true; };
$$('.dlg-side button').forEach(b => b.onclick = () => showPage(b.dataset.sp));
$$('#themeSeg button').forEach(b => b.onclick = () => setTheme(b.dataset.theme));
$('#setView').onchange = e => { settings.view = e.target.value; saveSettings(); setView(e.target.value); };
$('#setFocusFirst').onchange = e => { settings.focusFirst = e.target.checked; saveSettings(); };
$$('#accessSeg button').forEach(b => b.onclick = () => { settings.accessMode = b.dataset.am; saveSettings(); $$('#accessSeg button').forEach(x => x.classList.toggle('active', x === b)); renderPlatforms(); syncModes(); renderManager(); toast('默认访问方式：' + (b.dataset.am === 'mobile' ? '移动端' : '电脑端'), 'success'); });
$('#setMobileWidth').onchange = e => { settings.mobileWidth = e.target.value; saveSettings(); applyView(); };
$('#setMobileUA').onchange = e => { settings.mobileUA = e.target.value; saveSettings(); for (const [id, pane] of Object.entries(panes)) if (pane.mobile && pane.wv) { pane.wv.setUserAgent(uaOf(byId(id))); pane.wv.reload(); } };
$('#setOpenHome').onchange = e => { settings.openHome = e.target.checked; saveSettings(); };
$('#setClearHistory').onclick = $('#clearHistory').onclick = () => { data.history = []; saveData(); renderLists(); toast('历史已清空', 'success'); };
$('#selAll').onclick = () => { enabled().forEach(p => selected.add(p.id)); settings.selected = [...selected]; saveSettings(); renderPlatforms(); };
$('#selNone').onclick = () => { selected.clear(); settings.selected = []; saveSettings(); renderPlatforms(); };
$('#modes').onclick = e => { const b = e.target.closest('[data-mode]'); if (b) setMode(b.dataset.mode); };
$('#views').onclick = e => { const b = e.target.closest('[data-view]'); if (b) setView(b.dataset.view); };
$('#go').onclick = search;
$('#q').onkeydown = e => { if (e.key === 'Enter') search(); if (e.key === 'Escape') $('#q').blur(); };
$('#pickImg').onclick = async () => { const f = await ww.pickImage(); if (f) setImage(f); };
$('#imgClear').onclick = () => { setImage(null); setMode('text'); };
$('#cmpL').onchange = $('#cmpR').onchange = applyView;
$('#hotChips').innerHTML = HOT.map(k => `<button class="chip" data-k="${k}"><i class="ri-fire-line"></i>${k}</button>`).join('');
$('#hotChips').onclick = e => { const b = e.target.closest('[data-k]'); if (b) { setMode('text'); $('#q').value = b.dataset.k; search(); } };

document.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (e.key === 'Escape') { if (!$('#editor').hidden) $('#editor').hidden = true; else $('#modal').hidden = true; }
  if (e.ctrlKey && k === 'k') { e.preventDefault(); $('#q').focus(); $('#q').select(); }
  if (e.ctrlKey && k === ',') { e.preventDefault(); openSettings(); }
  if (e.ctrlKey && e.shiftKey && k === 'l') { e.preventDefault(); $('#btnTheme').click(); }
  if (e.ctrlKey && !e.shiftKey && ['1', '2', '3', '4'].includes(k)) { e.preventDefault(); setView(['tabs', 'grid4', 'grid6', 'compare'][+k - 1]); }
  if (e.altKey && ['1', '2', '3'].includes(k)) { e.preventDefault(); setMode(['text', 'image', 'ai'][+k - 1]); }
  if (e.key === 'F5' && active) { e.preventDefault(); panes[active]?.wv?.reload(); }
  if (e.ctrlKey && e.key === 'Tab') {
    e.preventDefault(); const ids = Object.keys(panes).sort((a, b) => P.findIndex(p => p.id === a) - P.findIndex(p => p.id === b));
    if (ids.length) focus(ids[(ids.indexOf(active) + (e.shiftKey ? -1 : 1) + ids.length) % ids.length]);
  }
});
document.addEventListener('paste', async e => {
  const item = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/'));
  if (!item) return; e.preventDefault();
  const f = await ww.clipboardImage(); if (f) { setImage(f); toast('已粘贴图片，点击一键搜索', 'success'); }
});
let dragDepth = 0;
const isFileDrag = e => [...(e.dataTransfer?.types || [])].includes('Files');
document.addEventListener('dragenter', e => { if (!isFileDrag(e)) return; e.preventDefault(); dragDepth++; $('#drop').hidden = false; });
document.addEventListener('dragleave', e => { if (!isFileDrag(e)) return; if (--dragDepth <= 0) { dragDepth = 0; $('#drop').hidden = true; } });
document.addEventListener('dragover', e => { if (isFileDrag(e)) e.preventDefault(); });
document.addEventListener('drop', async e => {
  if (!isFileDrag(e)) return; e.preventDefault(); dragDepth = 0; $('#drop').hidden = true;
  const file = e.dataTransfer.files[0]; if (!file || !file.type.startsWith('image/')) return toast('请拖入图片文件', 'warn');
  let p = ww.filePath(file); if (!p) p = await ww.saveImage(await file.arrayBuffer(), file.name.split('.').pop());
  setImage(p); toast('图片已就绪，点击一键搜索', 'success');
});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
setInterval(refreshLogin, 30000);

/* ---------- 启动 ---------- */
(async () => {
  [P, data, settings, UA] = await Promise.all([ww.getPlatforms(), ww.getData(), ww.getSettings(), ww.ua()]);
  data = Object.assign({ history: [], favorites: [] }, data);
  selected = new Set(settings.selected || P.filter(p => p.enabled !== false).map(p => p.id));
  applyTheme(); renderTabs(); setMode('text'); setView(settings.view || 'tabs'); renderLists(); refreshLogin();
  if (settings.openHome && enabled()[0]) navigate(enabled()[0].id, enabled()[0].home);
  $('#q').focus();
})();

/* ---------- 端到端测试钩子（仅 WW_E2E 使用） ---------- */
window.__e2e = {
  text: q => { setMode('text'); $('#q').value = q; return search(); },
  image: f => { setImage(f); return search(); },
  view: v => setView(v), focus: id => focus(id), theme: t => setTheme(t), isDark: () => document.body.classList.contains('dark'),
  compare: (l, r) => { $('#cmpL').value = l; $('#cmpR').value = r; applyView(); },
  select: ids => { selected = new Set(ids); renderPlatforms(); },
  closeAll: () => Object.keys(panes).forEach(closePane),
  ids: () => Object.fromEntries(Object.entries(panes).filter(([, p]) => p.wv).map(([id, p]) => [id, p.wv.getWebContentsId()])),
  tips: () => Object.fromEntries(Object.entries(panes).map(([id, p]) => [id, p.tip.textContent.trim()])),
  platforms: () => P.map(p => ({ id: p.id, name: p.name, search: p.search, enabled: p.enabled !== false })),
  settings: page => openSettings(page), closeSettings: () => { $('#modal').hidden = true; $('#editor').hidden = true; },
  addPlatform: v => { openSettings('platforms'); openEditor(null); const e = $('#pform').elements; for (const [k, x] of Object.entries(v)) e[k].value = x; $('#pform').requestSubmit(); return $('#pformErr').textContent; },
  editPlatform: (id, v) => { openEditor(byId(id)); const e = $('#pform').elements; for (const [k, x] of Object.entries(v)) e[k].value = x; $('#pform').requestSubmit(); return $('#pformErr').textContent; },
  deletePlatform: id => { const i = P.findIndex(p => p.id === id); P.splice(i, 1); closePane(id); return persistPlatforms(); },
  movePlatform: (from, to) => { const [m] = P.splice(from, 1); P.splice(to, 0, m); return persistPlatforms(); },
  toast: (m, t) => toast(m, t, 8000),
  setAccess: m => { settings.accessMode = m; saveSettings(); renderPlatforms(); syncModes(); },
  setPlatformMode: (id, m) => { byId(id).accessMode = m; return persistPlatforms(); },
  modes: () => Object.fromEntries(P.map(p => [p.id, { mode: isMobile(p) ? 'mobile' : 'desktop', override: p.accessMode, tpl: tplOf(p) }])),
  ai: q => { setMode('ai'); $('#q').value = q; return search(); },
  platformsFull: () => JSON.parse(JSON.stringify(P)),
  globalAccess: () => settings.accessMode || 'mobile',
  enableAll: () => { P.forEach(p => p.enabled = true); return persistPlatforms(); },
};
