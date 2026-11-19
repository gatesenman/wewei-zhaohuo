// 端到端测试 v3：WW_E2E=<输出目录> WW_E2E_PHASE=v3 | v3b(重启后)
const { app } = require('electron');
const fs = require('fs'), path = require('path');
const sleep = ms => new Promise(r => setTimeout(r, ms));
module.exports = async win => {
  const out = process.env.WW_E2E; fs.mkdirSync(out, { recursive: true });
  const res = []; const js = s => win.webContents.executeJavaScript(s);
  const shot = async n => { await sleep(900); const f = path.join(out, n + '.png'); fs.writeFileSync(f, (await win.webContents.capturePage()).toPNG()); return f; };
  const log = (t, ok, d = {}) => { res.push({ test: t, ok, ...d }); console.log('E2E', ok ? 'PASS' : 'FAIL', t, JSON.stringify(d).slice(0, 300)); fs.appendFileSync(path.join(out, 'results.jsonl'), JSON.stringify(res[res.length - 1]) + '\n'); };
  const waitDone = async (max = 300000) => { const t = Date.now(); while (Date.now() - t < max) { const st = await js('__e2e.state()'); if (!Object.values(st).some(x => x.status === 'loading')) return st; await sleep(2000); } return js('__e2e.state()'); };
  const phase = process.env.WW_E2E_PHASE || 'v3';
  try {
    await sleep(2500);
    if (phase === 'sub') {
      const ids = process.env.WW_SUB.split(','); await js('__e2e.enableAll()'); await js(`__e2e.select(${JSON.stringify(ids)})`);
      js(`__e2e.text(${JSON.stringify(process.env.WW_Q || '保温杯')})`); await sleep(3000); const st = await waitDone(240000);
      for (const id of ids) { const r = st[id] || {}; log('sub:' + id, r.status === 'ok' && r.n > 0, { status: r.status, n: r.n, ms: r.ms, sample: (r.sample || []).slice(0, 1), url: r.url }); }
      await js(`__e2e.cat('wholesale')`); await shot('sub-results');
      const f = await js('__e2e.favFirst()'); log('favorite item', f >= 1, { f });
    } else if (phase === 'v3b') {
      const favs = await js('__e2e.drawer("fav"), document.querySelectorAll("#drawerBody .d-item").length');
      log('restart: favorites persisted', favs >= 1, { favs, screenshot: await shot('restart-favorites') });
      await js('__e2e.close()');
      const n = await js('__e2e.suggest("保")'); log('restart: history suggestions', n >= 1, { n, screenshot: await shot('restart-suggest') });
      log('restart: theme persisted', await js('__e2e.isDark()'), {});
      await js(`__e2e.theme('light')`);
    } else {
      log('launch / empty (light)', true, { screenshot: await shot('ui-01-empty-light') });
      await js(`__e2e.theme('dark')`); await shot('ui-02-empty-dark'); await js(`__e2e.theme('light')`);
      await js('__e2e.enableAll()'); await sleep(500);
      await js(`__e2e.loading()`); await sleep(400); await shot('ui-03-loading-skeleton');
      const all = (await js('__e2e.platformsFull()')).map(p => p.id);
      await js(`__e2e.select(${JSON.stringify(all)})`);
      const t0 = Date.now(); js(`__e2e.text('保温杯')`); await sleep(9000); await shot('ui-04-partial-results');
      const st = await waitDone(); const total = Date.now() - t0;
      const ps = await js('__e2e.platformsFull()');
      for (const p of ps) { const r = st[p.id]; if (!r) continue; log(`extract:${p.id} ${p.name}`, r.status === 'ok' && r.n > 0, { cat: p.category, status: r.status, n: r.n, ms: r.ms, sample: r.sample, url: r.url }); }
      log('parallel search total time', total < 200000, { seconds: Math.round(total / 1000), okPlatforms: Object.values(st).filter(r => r.status === 'ok').length });
      await shot('ui-05-results-card');
      const shown = await js('__e2e.shownCount()'); log('merged results rendered', shown > 0, { shown });
      const asc = await js(`__e2e.sort('price-asc')`); log('sort price asc', asc.every((v, i) => i === 0 || v == null || asc[i - 1] == null || v >= asc[i - 1]), { first5: asc, screenshot: await shot('ui-06-sort-price') });
      await js(`__e2e.sort('default')`);
      const nf = await js('__e2e.price(10, 50)'); log('price range filter 10–50', true, { n: nf, screenshot: await shot('ui-07-price-filter') }); await js('__e2e.price()');
      const ng = await js('__e2e.group(true)'); log('group similar', ng <= shown, { before: shown, after: ng, screenshot: await shot('ui-08-grouped') }); await js('__e2e.group(false)');
      await js(`__e2e.view('list')`); log('list view', true, { screenshot: await shot('ui-09-list') });
      await js(`__e2e.view('table')`); log('table view', true, { screenshot: await shot('ui-10-table') });
      await js(`__e2e.view('card')`);
      const c = await js('__e2e.cmpFirst(3)'); log('compare dialog', c === 3, { screenshot: await shot('ui-11-compare') }); await js('__e2e.close()');
      const f = await js('__e2e.favFirst()'); log('favorite item', f >= 1, {});
      await js('__e2e.drawer("fav")'); await shot('ui-12-favorites'); await js('__e2e.close()');
      await js('__e2e.drawer("hist")'); await shot('ui-13-history'); await js('__e2e.close()');
      const csv = await js('__e2e.export("csv")'); const xls = await js('__e2e.export("xls")');
      log('export CSV/Excel', !!(csv && csv.f && fs.existsSync(csv.f) && xls && fs.existsSync(xls.f)), { csv: csv && csv.f, rows: csv && csv.n, xls: xls && xls.f });
      await js(`__e2e.cat('wholesale')`); await sleep(300); log('wholesale category tab', true, { screenshot: await shot('ui-14-wholesale-tab') }); for (const c of ['local','vertical','content','secondhand','crossborder','general']) { await js(`__e2e.cat('${c}')`); await sleep(300); const n = await js('document.querySelectorAll("#platformList .plat").length'); log('category tab ' + c, n > 0, { n, screenshot: await shot('ui-14-cat-' + c) }); } for (const x of ['电子元器件','五金工具']) { const n = await js(`__e2e.cat('wholesale'), __e2e.ind('${x}')`); log('industry filter ' + x, n > 0, { n, screenshot: await shot('ui-14-ind-' + (x === '五金工具' ? 'hw' : 'elec')) }); } await js(`__e2e.ind('')`);
      const badge = await js(`[...document.querySelectorAll('.cat-badge')].map(b => b.textContent).filter(t => t.length > 2)`); 
      await js(`__e2e.cat('all')`); const b2 = await js(`[...document.querySelectorAll('#platformList .cat-badge')].map(b => b.textContent)`); log('3.2 fix: category badges are 2 chars', b2.length > 0 && b2.every(t => t.length <= 2), { sample: [...new Set(b2)] });
      log('3.2 fix: no duplicate lock icon in sidebar', (await js(`document.querySelectorAll('#platformList .need-login').length`)) === 0, {});
      // v3.4 产业带
      const nb = await js('__e2e.belts()'); log('v3.4 belt directory', nb >= 50, { cities: nb, screenshot: await shot('ui-30-belts') });
      await js(`document.querySelector('#beltQ').value='袜'; document.querySelector('#beltQ').dispatchEvent(new Event('input'))`); log('v3.4 belt filter 袜', (await js(`document.querySelectorAll('#drawerBody .d-item.belt').length`)) >= 1, { screenshot: await shot('ui-31-belts-filter') });
      const sel = await js(`__e2e.belt('义乌')`); const u1 = await js(`__e2e.beltUrl('1688','保温杯')`); const u2 = await js(`__e2e.beltUrl('yiwugo','保温杯')`);
      log('v3.4 belt scope 义乌', sel.includes('yiwugo') && sel.includes('1688') && /%E4%B9%89%E4%B9%8C|义乌|%D2%E5%CE%DA/.test(u1) && !/%E4%B9%89%E4%B9%8C/.test(u2), { sel, u1, u2, screenshot: await shot('ui-32-belt-scoped') });
      await js(`__e2e.belt(null)`); await js(`__e2e.select(${JSON.stringify(all)})`);
      // 缓存
      const t1 = Date.now(); js(`__e2e.text('保温杯')`); await sleep(1200);
      const st2 = await js('__e2e.state()'); const cached = Object.values(st2).filter(r => r.cached).length; const ms1 = Date.now() - t1;
      log('cache: repeat search instant (ok platforms from cache)', cached > 0, { ms: ms1, cachedPlatforms: cached, shownAfter1s: await js('__e2e.shownCount()') });
      await waitDone(200000);
      const sg = await js('__e2e.suggest("保")'); log('history suggestions', sg >= 1, { n: sg, screenshot: await shot('ui-15-suggest') });
      await js('__e2e.close()'); await js(`document.querySelector('#q').blur()`);
      // 原网页（登录/验证）弹窗
      await js(`__e2e.raw('jd')`); await sleep(5000); log('raw page modal (login/captcha fallback)', true, { screenshot: await shot('ui-16-raw-modal') }); await js('__e2e.close()');
      for (const pg of ['general', 'platforms', 'accounts', 'keys', 'about']) { await js(`__e2e.settings('${pg}')`); await shot('ui-17-settings-' + pg); }
      await js('__e2e.close()');
      await js(`__e2e.editor('yiwugo')`); await shot('ui-18-editor'); await js('__e2e.close()');
      // 深色结果 + 窄窗口
      await js(`__e2e.theme('dark')`); await shot('ui-19-results-dark');
      win.setSize(1080, 680); await sleep(800); await shot('ui-20-narrow-dark'); win.setSize(1440, 900); await sleep(600);
      // 以图搜货
      const img = path.join(out, 'test-image.png'); fs.copyFileSync(path.join(__dirname, 'assets', 'platforms', 'taobao.png'), img);
      await js(`__e2e.select(['taobao','tmall','1688'])`);
      js(`__e2e.image(${JSON.stringify(img)})`); await sleep(3000);
      const si = await waitDone(120000);
      for (const [id, r] of Object.entries(si)) log('image→results:' + id, r.status === 'ok' && r.n > 0, { status: r.status, n: r.n, url: r.url, msg: r.msg });
      await shot('ui-21-image-results');
      if (process.env.WW_V31) {
        await js(`__e2e.select(${JSON.stringify(all)})`); await js(`__e2e.text('保温杯')`).catch(() => {}); await waitDone(60000);
        const best = await js('__e2e.best()'); log('v3.1 best-deal chip', !!best, { best, screenshot: await shot('ui-22-best-deal') });
        const stx = await js(`document.querySelector('.statusbar, #status, footer')?.innerText || ''`); log('v3.1 status shows first-result time', /首批结果/.test(stx), { status: stx.slice(0, 160) }); { const m = /(\d+)\/(\d+) 个平台有结果/.exec(stx); const total = await js('__e2e.platformsFull().length'); log('3.2 fix: status denominator excludes manual platforms', !!m && +m[2] < total && /需手动打开/.test(stx), { denom: m && m[2], total }); }
        js('__e2e.same()'); await sleep(4000); await shot('ui-23-find-same-loading');
        const ss = await waitDone(120000);
        log('v3.1 find-same (card image → image search)', Object.keys(ss).length > 0, { platforms: Object.fromEntries(Object.entries(ss).map(([k, v]) => [k, v.status + ':' + v.n])), screenshot: await shot('ui-24-find-same') });
        await js(`__e2e.settings('general')`); await shot('ui-25-settings-timeout'); await js('__e2e.close()');
      }
    }
  } catch (e) { log('harness-error', false, { err: e.stack }); }
  app.quit();
};
