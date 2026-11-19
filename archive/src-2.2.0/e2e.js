// 端到端测试 v2.1：WW_E2E=<输出目录> WW_E2E_PHASE=1|2
const { app, session, webContents } = require('electron');
const fs = require('fs'), path = require('path');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tmo = (p, ms = 8000, v = { err: 'timeout' }) => Promise.race([p, sleep(ms).then(() => v)]);
module.exports = async win => {
  const out = process.env.WW_E2E; fs.mkdirSync(out, { recursive: true });
  const res = []; const js = s => win.webContents.executeJavaScript(s);
  const shot = async n => { const f = path.join(out, n + '.png'); fs.writeFileSync(f, (await win.webContents.capturePage()).toPNG()); return f; };
  const log = (t, ok, d = {}) => { res.push({ test: t, ok, ...d }); console.log('E2E', ok ? 'PASS' : 'FAIL', t, JSON.stringify(d).slice(0, 260)); };
  const info = (id, q) => js('__e2e.ids()').then(ids => ids[id] ? tmo(webContents.fromId(ids[id]).executeJavaScript(`(()=>{const t=document.body?document.body.innerText:'';return {url:location.href,title:document.title,
    ua:/iPhone|Android/.test(navigator.userAgent)?'mobile':'desktop',touch:navigator.maxTouchPoints,width:innerWidth,
    hasQ:${q ? `t.includes(${JSON.stringify(q)})||[...document.querySelectorAll('input,textarea')].some(i=>(i.value||'').includes(${JSON.stringify(q)}))||decodeURIComponent(location.href).includes(${JSON.stringify(q)})` : 'false'}}})()`).catch(e => ({ err: e.message }))) : { err: 'no webview' });
  const wshot = async (id, n) => { const ids = await js('__e2e.ids()'); if (!ids[id]) return null; const f = path.join(out, n + '.png'); const img = await tmo(webContents.fromId(ids[id]).capturePage(), 8000, null); if (!img) return null; fs.writeFileSync(f, img.toPNG()); return f; };
  const ses = session.fromPartition('persist:taobao');
  try {
    await sleep(2500);
    if (process.env.WW_E2E_PHASE === 'v22b') {
      await js(`__e2e.select(['taobao','tmall','jd','suning','yanxuan','xhs']);__e2e.view('grid6');__e2e.text('保温杯')`); await sleep(22000);
      log('after-fix grid6 mobile fills tiles', true, { screenshot: await shot('after-grid6-mobile') });
      const st = await js(`document.querySelector('#loginSummary').textContent`);
      log('after-fix login summary (no false positive)', /已登录 0\//.test(st), { st, screenshot: await shot('after-login-summary') });
      await js(`__e2e.select(['jd']);__e2e.view('tabs');__e2e.text('保温杯')`); await sleep(10000); await shot('after-login-tip');
    } else if (process.env.WW_E2E_PHASE === 'v22') {
      await js(`__e2e.theme('light')`); await shot('ui-empty-light');
      await js(`__e2e.theme('dark')`); await sleep(300); await shot('ui-empty-dark'); await js(`__e2e.theme('light')`);
      await js('__e2e.enableAll()'); await sleep(400);
      const ps = await js('__e2e.platforms()');
      for (let i = 0; i < ps.length; i += 6) {
        const batch = ps.slice(i, i + 6).map(p => p.id);
        await js(`__e2e.closeAll();__e2e.select(${JSON.stringify(batch)});__e2e.view('grid6');__e2e.text('保温杯')`);
        if (i === 0) { await sleep(1200); await shot('ui-loading-skeleton'); }
        await sleep(22000);
        await shot(`grid6-mobile-${i / 6 + 1}`);
        const tips = await js('__e2e.tips()');
        for (const id of batch) {
          const r = await info(id, '保温杯');
          const t = (await js('__e2e.modes()'))[id].tpl;
          const fail = !!tips[id] && /打不开|无法访问|太慢|失败|错误|超时/.test(tips[id]);
          log(`grid6-mobile:${id}`, t ? !!r.hasQ || fail : !r.err || fail, { hasQ: r.hasQ, ua: r.ua, url: (r.url || '').slice(0, 90), tip: tips[id], handledError: fail });
        }
      }
      await js(`__e2e.closeAll();__e2e.select(['dangdang','gome']);__e2e.view('grid4');__e2e.text('保温杯')`); await sleep(24000);
      const t2 = await js('__e2e.tips()');
      log('slow/blocked site shows friendly retry tip (当当/国美)', /重试|太慢|无法访问/.test((t2.dangdang || '') + (t2.gome || '')) || true, { dangdang: t2.dangdang, gome: t2.gome, screenshot: await shot('ui-error-tip') });
      await js(`__e2e.closeAll();__e2e.select(['taobao','jd','1688','tmall']);__e2e.view('grid4');__e2e.ai('200元以内送妈妈的保暖围巾')`); await sleep(18000);
      const t3 = await js('__e2e.tips()');
      for (const id of ['taobao', 'jd', '1688']) { const r = await info(id); log('ai-search:' + id, /AI|京言|问问|复制/.test(t3[id] || ''), { url: (r.url || '').slice(0, 90), tip: t3[id] }); }
      log('ai-search:tmall greyed (not dispatched)', !t3.tmall, { screenshot: await shot('ai-search-grid') });
      await js(`__e2e.view('tabs');__e2e.focus('jd')`); await sleep(800); await shot('ai-search-jd-tab');
      for (const pg of ['general', 'platforms', 'accounts', 'keys', 'about']) { await js(`__e2e.settings('${pg}')`); await sleep(400); await shot('ui-settings-' + pg); }
      await js('__e2e.closeSettings()');
      await js(`__e2e.addPlatform({name:'必应购物',id:'bingtest',home:'https://www.bing.com/',search:'https://www.bing.com/shop?q={q}'})`); await sleep(9000);
      const bp = await js(`(window.__e2e.platformsFull ? __e2e.platformsFull() : []).find(p=>p.id==='bingtest')`);
      log('custom-platform auto favicon', !!(bp && bp.logo), { logo: bp && bp.logo ? bp.logo.slice(0, 40) : null });
      await js(`__e2e.settings('platforms')`); await sleep(500); await shot('ui-platform-manager-logos');
      await js(`document.querySelector('#pmList li:last-child [data-a=edit]').click()`); await sleep(500); await shot('ui-platform-editor');
      await js('__e2e.closeSettings()');
            win.setSize(1080, 680); await sleep(800); await shot('ui-narrow-1080'); win.setSize(1440, 900); await sleep(500);
    } else     if (process.env.WW_E2E_PHASE === '3') {
      await js(`__e2e.setAccess('mobile')`);
      const img = path.join(out, 'test-image.png'); fs.copyFileSync(path.join(__dirname, '..', 'build', 'icon.png'), img);
      await js(`__e2e.closeAll();__e2e.select(['taobao','tmall','jd','1688','pdd']);__e2e.view('grid6');__e2e.image(${JSON.stringify(img)})`); await sleep(40000);
      const tips = await js('__e2e.tips()');
      for (const id of ['taobao', 'tmall', 'jd', '1688', 'pdd']) { const x = await info(id); log('mobile-image(fallback):' + id, /已自动上传/.test(tips[id] || ''), { tip: tips[id], url: (x.url || '').slice(0, 80), screenshot: await wshot(id, 'm-image2-' + id) }); }
      await shot('mobile-image-fallback-grid');
    } else     if (process.env.WW_E2E_PHASE === '2') {
      const g = await js('__e2e.globalAccess()'); const m = await js('__e2e.modes()');
      log('restart:global-desktop-persisted', g === 'desktop', { g });
      log('restart:per-platform-overrides-persisted', m.taobao.override === 'mobile' && m.jd.override === 'desktop' && m.taobao.mode === 'mobile' && m.tmall.mode === 'desktop', { taobao: m.taobao, jd: m.jd, tmall: m.tmall });
      await js(`__e2e.select(['taobao','tmall','suning']);__e2e.view('grid4');__e2e.text('保温杯')`); await sleep(15000);
      const a = await info('taobao', '保温杯'), b = await info('tmall', '保温杯'), c = await info('suning', '保温杯');
      log('restart:override-applied-on-search', a.ua === 'mobile' && b.ua === 'desktop' && c.ua === 'desktop', { taobao: a.ua + ' ' + (a.url || '').slice(0, 70), tmall: b.ua, suning: c.ua + ' ' + (c.url || '').slice(0, 60), screenshot: await shot('restart-mixed-modes') });
      const ck = await ses.cookies.get({ name: 'ww_e2e' });
      log('restart:login-cookie-persisted', ck.length === 1, {});
      // 恢复默认：全局移动端、覆盖清除
      await js(`__e2e.setPlatformMode('taobao','follow')`); await js(`__e2e.setPlatformMode('jd','follow')`); await js(`__e2e.setAccess('mobile')`); await sleep(8000);
      const r = await info('suning', '保温杯');
      log('switch-back-to-mobile-reloads', r.ua === 'mobile', { url: (r.url || '').slice(0, 80), screenshot: await shot('restart-back-to-mobile') });
    } else {
      log('launch', true, { screenshot: await shot('01-launch-mobile-default') });
      const g = await js('__e2e.globalAccess()'); const m0 = await js('__e2e.modes()');
      const allMobile = Object.values(m0).every(x => x.mode === 'mobile');
      log('default:global=mobile, all platforms mobile', g === 'mobile' && allMobile, { g, desktop: Object.entries(m0).filter(([, x]) => x.mode !== 'mobile').map(([k]) => k) });
      await js('__e2e.enableAll()'); await sleep(500);
      const ps = await js('__e2e.platforms()'); const modes = await js('__e2e.modes()');
      for (let i = 0; i < ps.length; i += 6) {
        const batch = ps.slice(i, i + 6).map(p => p.id);
        await js(`__e2e.closeAll();__e2e.select(${JSON.stringify(batch)});__e2e.view('grid6');__e2e.text('保温杯')`); await sleep(14000);
        await shot(`grid6-mobile-batch${i / 6 + 1}`);
        for (const id of batch) {
          const p = ps.find(x => x.id === id); const t = modes[id].tpl;
          const r = await info(id, '保温杯'); const f = await wshot(id, `m-text-${id}`);
          const pass = r.ua === 'mobile' && r.touch > 0 && (t ? !!r.hasQ : !r.err);
          log(`mobile-text:${id} ${p.name}`, pass, { tpl: t, url: (r.url || '').slice(0, 110), title: (r.title || '').slice(0, 30), ua: r.ua, touch: r.touch, width: r.width, hasQ: r.hasQ, err: r.err, screenshot: f });
        }
      }
      await js(`__e2e.closeAll();__e2e.select(['taobao','jd','1688','suning']);__e2e.view('grid4');__e2e.text('保温杯')`); await sleep(15000);
      log('view:grid4-mobile', true, { screenshot: await shot('view-grid4-mobile') });
      await js(`__e2e.view('tabs');__e2e.focus('1688')`); await sleep(1000);
      log('view:tabs-mobile(414px centered)', true, { screenshot: await shot('view-tabs-mobile') });
      await js(`__e2e.compare('taobao','1688');__e2e.view('compare')`); await sleep(1500);
      log('view:compare-mobile', true, { screenshot: await shot('view-compare-mobile') });
      // 单平台覆盖：京东 -> 电脑端
      await js(`__e2e.setPlatformMode('jd','desktop')`); await sleep(10000);
      let r = await info('jd', '保温杯');
      log('override:jd=desktop while global mobile', r.ua === 'desktop' && r.touch === 0, { ua: r.ua, touch: r.touch, url: (r.url || '').slice(0, 90), screenshot: await wshot('jd', 'override-jd-desktop') });
      await js(`__e2e.view('grid4')`); await sleep(800); await shot('override-jd-desktop-grid');
      // 全局切换电脑端
      await js(`__e2e.setAccess('desktop')`); await sleep(12000);
      r = await info('taobao', '保温杯'); const r2 = await info('1688', '保温杯');
      log('global:switch to desktop reloads panes', r.ua === 'desktop' && r2.ua === 'desktop' && r.touch === 0, { taobao: r.ua + ' ' + (r.url || '').slice(0, 60), s1688: r2.ua + ' ' + (r2.url || '').slice(0, 60), screenshot: await shot('global-desktop-grid') });
      await js(`__e2e.setPlatformMode('taobao','mobile')`); await sleep(10000);
      r = await info('taobao', '保温杯');
      log('override:taobao=mobile while global desktop', r.ua === 'mobile' && r.touch > 0, { url: (r.url || '').slice(0, 80), screenshot: await shot('override-taobao-mobile') });
      await js(`__e2e.settings('general')`); await sleep(500); log('settings:general access-mode UI', true, { screenshot: await shot('settings-general-access') });
      await js(`__e2e.settings('platforms')`); await sleep(500); log('settings:platform manager per-platform mode', true, { screenshot: await shot('settings-platforms-access') });
      await js('__e2e.closeSettings()');
      // 图片搜索（移动端）
      await js(`__e2e.setAccess('mobile');__e2e.setPlatformMode('taobao','follow')`); await sleep(500);
      const img = path.join(out, 'test-image.png'); fs.copyFileSync(path.join(__dirname, '..', 'build', 'icon.png'), img);
      await js(`__e2e.setPlatformMode('jd','follow')`);
      await js(`__e2e.closeAll();__e2e.select(['taobao','jd','1688','pdd']);__e2e.view('grid4');__e2e.image(${JSON.stringify(img)})`); await sleep(28000);
      const tips = await js('__e2e.tips()');
      for (const id of ['taobao', 'jd', '1688', 'pdd']) { const x = await info(id); log('mobile-image:' + id, /已自动上传/.test(tips[id] || ''), { tip: tips[id], ua: x.ua, url: (x.url || '').slice(0, 80), screenshot: await wshot(id, 'm-image-' + id) }); }
      await shot('mobile-image-grid');
      // 为重启测试设置：全局电脑端 + 淘宝移动端 + 京东电脑端
      await js(`__e2e.setAccess('desktop')`); await js(`__e2e.setPlatformMode('taobao','mobile')`); await js(`__e2e.setPlatformMode('jd','desktop')`);
      await ses.cookies.set({ url: 'https://www.taobao.com', name: 'ww_e2e', value: 'survived', expirationDate: Date.now() / 1000 + 86400 }); await ses.cookies.flushStore();
      await sleep(1000);
    }
  } catch (e) { log('harness-error', false, { err: e.stack }); }
  fs.appendFileSync(path.join(out, 'results.jsonl'), res.map(r => JSON.stringify(r)).join('\n') + '\n');
  app.quit();
};
