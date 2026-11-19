// 维维找货 · 商品提取引擎：隐藏窗口加载平台搜索页 → 提取商品 → 返回结构化结果
const { BrowserWindow, session } = require('electron');

// 通用启发式提取脚本（在页面内执行）。cfg 为平台可选的 CSS 选择器配置。
const EXTRACT_FN = function (cfg, limit) {
  const abs = u => { try { return u ? new URL(u, location.href).href : ''; } catch { return ''; } };
  const txt = el => (el ? (el.innerText || el.textContent || '') : '').replace(/\s+/g, ' ').trim();
  const imgSrc = img => {
    if (!img) return '';
    const c = [img.currentSrc, img.getAttribute('data-src'), img.getAttribute('data-ks-lazyload'), img.getAttribute('data-original'), img.getAttribute('data-lazy-img'), img.getAttribute('data-lazyload'), img.getAttribute('src'),
      (img.getAttribute('srcset') || img.getAttribute('data-srcset') || '').split(/\s|,/)[0]].find(s => s && !/^data:image\/(gif|svg)/.test(s) && !/blank|placeholder|loading|grey\.gif|1x1/.test(s));
    return abs(c);
  };
  const bgImg = el => { const m = /url\(["']?([^"')]+)/.exec(getComputedStyle(el).backgroundImage || ''); return m ? abs(m[1]) : ''; };
  const PRICE = /[¥￥]\s*(\d{1,7}(?:\.\d{1,2})?)/;
  const PRICE2 = /(\d{1,7}(?:\.\d{1,2})?)\s*元/;
  const SALES = /((?:\d+(?:\.\d+)?\s*[万wW]\+?|(?<![\d.])\d+\+?))\s*(?:人付款|人收货|人已买|人买过|件已售|已售|销量|人评价|条评价|成交|笔成交|人想要|评价)|(?:已售|销量|月销|成交|已拼|总销量)\s*[:：]?\s*((?:\d+(?:\.\d+)?\s*[万wW]\+?|\d+\+?))(?![\d.])/;
  const parsePrice = s => { s = (s || '').replace(/\s+/g, ''); let m = PRICE.exec(s) || PRICE2.exec(s); return m ? parseFloat(m[1]) : null; };
  const parseSales = s => { const m = SALES.exec(s || ''); if (!m) return null; const v = (m[1] || m[2]).replace(/\s|\+/g, ''); const n = parseFloat(v) * (/[万wW]/.test(v) ? 10000 : 1); return isNaN(n) ? null : { n, text: m[0].trim() }; };
  const visibleImg = img => { const r = img.getBoundingClientRect(); return r.width >= 50 && r.height >= 50; };
  const out = [];
  const seen = new Set();
  const push = it => {
    if (!it.title || it.title.length < 4 || (it.price == null && !it.priceText) || !it.link) return;
    const k = it.link.split('#')[0] + '|' + it.title.slice(0, 20); if (seen.has(k)) return; seen.add(k); out.push(it);
  };
  const fromCard = (card, sel = {}) => {
    const q = s => (s ? card.querySelector(s) : null);
    const imgs = [...card.querySelectorAll('img')].filter(visibleImg);
    const img = q(sel.image) || imgs.sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0];
    const as = card.tagName === 'A' ? [card, ...card.querySelectorAll('a[href]')] : [...card.querySelectorAll('a[href]')];
    const dl = [card, ...card.querySelectorAll('[data-href],[data-url],[data-link]')].map(e => e.getAttribute && (e.getAttribute('data-href') || e.getAttribute('data-url') || e.getAttribute('data-link'))).find(Boolean);
    const link = q(sel.link) || as.find(a => /item|detail|offer|product|goods|\/p\/|sku|id=|\d{6,}/i.test(a.getAttribute('href') || '')) || as[0];
    const full = txt(card);
    let title = sel.title ? txt(q(sel.title)) : '';
    if (!title) {
      const cands = [img && img.alt, ...as.map(a => a.title), ...[...card.querySelectorAll('[title]')].map(e => e.title)].filter(Boolean);
      const lines = (card.innerText || '').split('\n').map(s => s.trim()).filter(s => s.length >= 6 && s.length <= 140 && !PRICE.test(s) && !/^[\d.¥￥\s+万]+$/.test(s) && !SALES.test(s));
      const bad = s => /^[\u4e00-\u9fa5]{2,6}[:：]/.test(s) || /(有限公司|有限责任公司|商行|经营部)$/.test(s) || /^(进店|找相似|加入购物车|立即购买)/.test(s);
      const good = arr => arr.filter(s => s && s.length >= 6 && s.length <= 140 && !bad(s));
      const named = good([...card.querySelectorAll('[class*=title] , [class*=name], [class*=Title], h3, h4')].filter(e => !/shop|store|company|co-name/i.test(e.className)).map(e => e.getAttribute('title') || txt(e)));
      title = named.sort((a, b) => b.length - a.length)[0] || good(cands).sort((a, b) => b.length - a.length)[0] || good(lines).sort((a, b) => b.length - a.length)[0] || '';
    }
    const price = parsePrice(sel.price ? txt(q(sel.price)) : full) ?? parsePrice(full);
    const priceText = price == null && /面议|询价|电议/.test(full) ? '面议' : '';
    const sales = parseSales(sel.sales ? txt(q(sel.sales)) : full);
    let shop = sel.shop ? txt(q(sel.shop)) : '';
    if (!shop) { const se = card.querySelector('[class*=shop],[class*=Shop],[class*=store],[class*=Store],[class*=seller],[class*=company],[class*=Company]'); shop = se ? txt(se).split(/\s{2,}|\n/)[0] : ''; }
    if (!shop) { const m = /([\u4e00-\u9fa5A-Za-z0-9·]{2,20}(?:旗舰店|专卖店|专营店|官方店|商行|公司|厂|店|批发部|档口))/.exec(full); shop = m ? m[1] : ''; }
    return { title: title.slice(0, 140), price, sales: sales ? sales.text : '', salesNum: sales ? sales.n : 0, shop: shop.slice(0, 40), image: img ? imgSrc(img) : bgImg(card), priceText, link: abs(link ? link.getAttribute('href') : (dl || (card.closest('a[href]') || {}).href || location.href)), noLink: !link && !dl };
  };
  // 1) 平台专用选择器
  if (cfg && cfg.item) { for (const card of document.querySelectorAll(cfg.item)) { push(fromCard(card, cfg)); if (out.length >= limit) break; } }
  // 2) 通用启发式：价格叶子节点 → 向上找到同时包含图片和链接的最小“卡片”
  if (out.length < 3) {
    const cards = new Set();
    const leaves = [...document.querySelectorAll('body *')].filter(el => {
      if (el.children.length > 3) return false;
      const t = (el.textContent || '').trim(); if (!t || t.length > 30) return false;
      return /[¥￥]/.test(t) || /price|Price|jiage/.test(el.className || '') && /\d|面议/.test(t);
    }).slice(0, 1500);
    for (const leaf of leaves) {
      let el = leaf;
      for (let i = 0; i < 9 && el && el !== document.body; i++, el = el.parentElement) {
        const r = el.getBoundingClientRect();
        if (r.width > innerWidth * 0.98 && r.height > 900) break;
        if ([...el.querySelectorAll('img')].some(visibleImg) && (el.tagName === 'A' || el.querySelector('a[href]') || el.closest('a[href]') || /^(LI)$/.test(el.tagName) || /item|card|goods|product/i.test(el.className || ''))) {
          if ((el.innerText || '').length < 800) cards.add(el);
          break;
        }
      }
    }
    // 去掉包含其他卡片的外层容器（保留最小卡片）
    const arr = [...cards].filter(c => ![...cards].some(o => o !== c && c.contains(o)));
    for (const c of arr) { push(fromCard(c)); if (out.length >= limit) break; }
  }
  const text = (document.body ? document.body.innerText : '').slice(0, 3000);
  return { items: out.slice(0, limit), url: location.href, title: document.title, text, h: document.documentElement.scrollHeight };
};

const LOGIN_RE = /(passport|login|signin|mlogin|plogin|mini_login|sso)[./?]/i;
const BLOCK_RE = /验证码|安全验证|滑块|拖动滑块|人机验证|身份核实|访问受限|访问被拒绝|请求过于频繁|captcha|verify|punish|risk_handler|Forbidden|Access Denied|Attention Required/i;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const within = (p, ms, v) => Promise.race([p, sleep(ms).then(() => v)]);

class Extractor {
  constructor() { this.wins = new Map(); this.running = 0; this.queue = []; this.max = 6; }
  async slot() { if (this.running < this.max) { this.running++; return; } await new Promise(r => this.queue.push(r)); this.running++; }
  release() { this.running--; const n = this.queue.shift(); if (n) n(); }
  win(key, partition, ua, mobile) {
    let w = this.wins.get(key);
    if (w && !w.isDestroyed()) return w;
    w = new BrowserWindow({ show: false, width: mobile ? 414 : 1366, height: mobile ? 896 : 2200, webPreferences: { partition, offscreen: false, backgroundThrottling: false, images: true, sandbox: true } });
    w.webContents.setAudioMuted(true);
    w.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    this.wins.set(key, w); return w;
  }
  // job: { id, url, partition, ua, mobile, extractor, limit, timeout, upload: {file, trigger, triggerText} }
  async run(job, onStage) {
    await this.slot();
    const hard = (job.hardTimeout || 60000) + (job.upload ? 60000 : 0);
    const key = job.id + (job.mobile ? ':m' : ':d');
    const r = await within(this._run(job, onStage, key), hard, null);
    if (r) { this.release(); return r; }
    const w = this.wins.get(key); if (w && !w.isDestroyed()) w.destroy(); this.wins.delete(key);
    this.release();
    return { status: 'timeout', msg: '平台响应太慢，已跳过', items: [], ms: hard, url: job.url };
  }
  async _run(job, onStage, key) {
    const w = this.win(key, job.partition, job.ua, job.mobile);
    const wc = w.webContents;
    const t0 = Date.now();
    try {
      wc.setUserAgent(job.ua);
      onStage && onStage('loading');
      let failed = null;
      const onFail = (_e, code, desc, _u, main) => { if (main && code !== -3) failed = { code, desc }; };
      wc.on('did-fail-load', onFail);
      await Promise.race([wc.loadURL(job.url).catch(() => {}), sleep(job.timeout || 25000)]);
      wc.removeListener('did-fail-load', onFail);
      if (failed) return { status: 'error', code: failed.code, msg: failed.desc, url: wc.getURL(), ms: Date.now() - t0, items: [] };
      if (job.upload) {
        onStage && onStage('uploading');
        const up = await within(job.upload(wc), 30000, { ok: false, msg: '上传图片超时' });
        if (!up.ok) return { status: 'error', msg: up.msg, url: wc.getURL(), ms: Date.now() - t0, items: [] };
        await sleep(6000);
      }
      onStage && onStage('extracting');
      let res = null;
      // 滚动触发懒加载，多次尝试提取，直到稳定
      for (let i = 0; i < (job.upload ? 2 : 4); i++) {
        await sleep(i === 0 ? 1800 : 1200);
        await within(wc.executeJavaScript(`window.scrollTo(0, ${(i + 1) * (job.mobile ? 1600 : 1400)});`).catch(() => {}), 3000);
        await sleep(500);
        await within(wc.executeJavaScript('window.scrollTo(0, 0)').catch(() => {}), 3000);
        res = await Promise.race([wc.executeJavaScript(`(${EXTRACT_FN.toString()})(${JSON.stringify(job.extractor || null)}, ${job.limit || 60})`).catch(e => ({ items: [], err: e.message })), sleep(8000).then(() => ({ items: [], err: 'timeout' }))]);
        if (res.items && res.items.length >= 10) break;
      }
      const url = wc.getURL();
      let status = 'ok';
      if (!res.items || !res.items.length) {
        if (LOGIN_RE.test(url)) status = 'login';
        else if (BLOCK_RE.test(url + ' ' + (res.title || '') + ' ' + (res.text || '').slice(0, 400))) status = 'blocked';
        else status = 'empty';
      }
      return { status, items: (res.items || []).map(x => ({ ...x, platform: job.id })), url, title: res.title, ms: Date.now() - t0 };
    } catch (e) {
      return { status: 'error', msg: e.message, items: [], ms: Date.now() - t0 };
    }
  }
  // 预热：空闲时提前打开平台首页，建立连接、加载 Cookie，首次搜索更快
  async warm(jobs) {
    for (const j of jobs) {
      const key = j.id + (j.mobile ? ':m' : ':d'); if (this.wins.has(key) || this.running >= 2) continue;
      const w = this.win(key, j.partition, j.ua, j.mobile); w.webContents.setUserAgent(j.ua);
      await within(w.webContents.loadURL(j.url).catch(() => {}), 15000);
    }
  }
  closeAll() { for (const w of this.wins.values()) if (!w.isDestroyed()) w.destroy(); this.wins.clear(); }
}
module.exports = { Extractor, EXTRACT_FN, LOGIN_RE };
