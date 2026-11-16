(function () {
  const bootEl = document.getElementById('cl-boot-data');
  if (!bootEl) return;
  let boot;
  try {
    boot = JSON.parse(bootEl.textContent || '{}');
  } catch (e) {
    return;
  }

  function fmtUsd(n, dec) {
    const d = typeof dec === 'number' ? dec : 0;
    return '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  }

  function nextPow2(v) {
    let p = 1;
    while (p < v) p *= 2;
    return p;
  }

  function nCr(n, r) {
    if (r < 0 || r > n) return 0;
    if (r === 0 || r === n) return 1;
    r = Math.min(r, n - r);
    let res = 1;
    for (let i = 1; i <= r; i++) res = (res * (n - r + i)) / i;
    return res;
  }

  if (boot.kind === 'storefront') {
    const state = Object.assign({
      unitPriceUsd: 14.99,
      unitsSold: 5000,
      refundRatePct: 8,
      avgVatPct: 12,
      publisherCutPct: 0,
      itchRevSharePct: 0,
      engineId: 'godot'
    }, boot.defaults || {});

    const els = {
      price: document.getElementById('inp-price'),
      units: document.getElementById('inp-units'),
      refund: document.getElementById('inp-refund'),
      vat: document.getElementById('inp-vat'),
      pub: document.getElementById('inp-pub'),
      itchShare: document.getElementById('inp-itch-share'),
      engine: document.getElementById('inp-engine'),
      list: document.getElementById('store-results-list'),
      kpiBestNet: document.getElementById('kpi-best-net'),
      kpiBestSub: document.getElementById('kpi-best-sub'),
      kpiGross: document.getElementById('kpi-gross'),
      kpiGrossSub: document.getElementById('kpi-gross-sub'),
      kpiSpread: document.getElementById('kpi-spread'),
      kpiSpreadSub: document.getElementById('kpi-spread-sub'),
      winnerHeadline: document.getElementById('winner-headline'),
      winnerDesc: document.getElementById('winner-desc')
    };

    function calcStore(store) {
      const unitPriceUsd = Math.max(0.99, Number(state.unitPriceUsd) || 14.99);
      const unitsSold = Math.max(1, Number(state.unitsSold) || 1000);
      const refundRatePct = Math.max(0, Math.min(40, Number(state.refundRatePct) || 0));
      const avgVatPct = Math.max(0, Math.min(27, Number(state.avgVatPct) || 0));
      const publisherCutPct = Math.max(0, Math.min(80, Number(state.publisherCutPct) || 0));
      const itchRevSharePct = Math.max(0, Math.min(30, Number(state.itchRevSharePct) || 0));
      const grossRetailUsd = unitPriceUsd * unitsSold;
      const refundsUsd = grossRetailUsd * (refundRatePct / 100);
      const netUnits = unitsSold * (1 - refundRatePct / 100);
      const postRefund = Math.max(0, grossRetailUsd - refundsUsd);
      const vatUsd = avgVatPct > 0 ? postRefund * (avgVatPct / (100 + avgVatPct)) : 0;
      const netAfterVat = Math.max(0, postRefund - vatUsd);

      let storeFeeUsd = 0;
      if (store.id === 'itch-io') {
        storeFeeUsd = netAfterVat * (itchRevSharePct / 100) + netAfterVat * 0.029 + netUnits * 0.30;
      } else if (store.id === 'steam') {
        if (netAfterVat <= 10000000) storeFeeUsd = netAfterVat * 0.30;
        else if (netAfterVat <= 50000000) storeFeeUsd = 3000000 + (netAfterVat - 10000000) * 0.25;
        else storeFeeUsd = 13000000 + (netAfterVat - 50000000) * 0.20;
      } else if (store.id === 'apple-app-store' || store.id === 'google-play') {
        storeFeeUsd = netAfterVat <= 1000000 ? netAfterVat * 0.15 : 150000 + (netAfterVat - 1000000) * 0.30;
      } else {
        storeFeeUsd = netAfterVat * ((store.baseCutPct || 30) / 100);
      }

      let engineFeeUsd = 0;
      if (state.engineId === 'unreal' && !store.unrealWaived && grossRetailUsd > 1000000) {
        engineFeeUsd = (grossRetailUsd - 1000000) * 0.05;
      } else if (state.engineId === 'unity' && netAfterVat > 200000) {
        engineFeeUsd = 2200;
      } else if (state.engineId === 'gamemaker') {
        engineFeeUsd = 100;
      }

      const prePub = Math.max(0, netAfterVat - storeFeeUsd - engineFeeUsd);
      const publisherShareUsd = prePub * (publisherCutPct / 100);
      const devNet = Math.max(0, prePub - publisherShareUsd);
      const keepPct = grossRetailUsd > 0 ? (devNet / grossRetailUsd) * 100 : 0;

      return {
        store,
        grossRetailUsd,
        refundsUsd,
        vatUsd,
        storeFeeUsd,
        engineFeeUsd,
        publisherShareUsd,
        devNet,
        keepPct,
        perUnitUsd: devNet / unitsSold
      };
    }

    function renderStores() {
      const results = (boot.storefronts || []).map(calcStore).sort((a, b) => b.devNet - a.devNet);
      if (!results.length) return;
      const top = results[0];
      const worst = results[results.length - 1];
      const spread = Math.max(0, top.devNet - worst.devNet);

      if (els.kpiBestNet) els.kpiBestNet.textContent = fmtUsd(top.devNet);
      if (els.kpiBestSub) els.kpiBestSub.textContent = `Highest on ${top.store.shortName} (${top.keepPct.toFixed(1)}% of retail gross)`;
      if (els.kpiGross) els.kpiGross.textContent = fmtUsd(top.grossRetailUsd);
      if (els.kpiGrossSub) els.kpiGrossSub.textContent = `${Number(state.unitsSold).toLocaleString('en-US')} copies @ ${fmtUsd(state.unitPriceUsd, 2)}`;
      if (els.kpiSpread) els.kpiSpread.textContent = '+' + fmtUsd(spread);
      if (els.kpiSpreadSub) els.kpiSpreadSub.textContent = `Extra dev net vs ${worst.store.shortName}`;
      if (els.winnerHeadline) els.winnerHeadline.textContent = `#1 Net Payout: ${top.store.name}`;
      if (els.winnerDesc) els.winnerDesc.textContent = `You keep ${fmtUsd(top.devNet)} (${fmtUsd(top.perUnitUsd, 2)}/copy) after ${state.refundRatePct}% refunds & ${state.avgVatPct}% VAT.`;

      if (els.list) {
        els.list.innerHTML = results.map((r, i) => {
          const gross = Math.max(1, r.grossRetailUsd);
          const keepW = Math.max(0, Math.min(100, (r.devNet / gross) * 100));
          const storeW = Math.max(0, Math.min(100 - keepW, ((r.storeFeeUsd + r.engineFeeUsd + r.publisherShareUsd) / gross) * 100));
          const taxW = Math.max(0, 100 - keepW - storeW);
          return `<div class="result-card ${i === 0 ? 'rank-1' : ''}">
            <div class="result-top">
              <div>
                <span class="rank-pill">#${i + 1}</span>
                <a class="result-title" href="/storefronts/${r.store.slug}-revenue-calculator/">${r.store.name}</a>
                <span class="tag-badge">${r.store.category}</span>
              </div>
              <div class="tabular">
                <div class="net-amount">${fmtUsd(r.devNet)} <span style="font-size:0.78rem;color:#64748b;">(${r.keepPct.toFixed(1)}%)</span></div>
                <div class="fee-meta">${fmtUsd(r.perUnitUsd, 2)}/copy net · Store fee ${fmtUsd(r.storeFeeUsd)}</div>
              </div>
            </div>
            <div class="bar-track">
              <div class="bar-keep" style="width:${keepW.toFixed(2)}%"></div>
              <div class="bar-fee" style="width:${storeW.toFixed(2)}%"></div>
              <div class="bar-tax" style="width:${taxW.toFixed(2)}%"></div>
            </div>
            <div class="chip-list tabular">
              <span>Refunds: <strong>-${fmtUsd(r.refundsUsd)}</strong></span>
              <span>VAT Deducted: <strong>-${fmtUsd(r.vatUsd)}</strong></span>
              <span>Engine/Pub Cut: <strong>-${fmtUsd(r.engineFeeUsd + r.publisherShareUsd)}</strong></span>
            </div>
          </div>`;
        }).join('');
      }
    }

    function bindInput(el, key, labelId, suffix) {
      if (!el) return;
      el.addEventListener('input', function () {
        state[key] = el.tagName === 'SELECT' ? el.value : Number(el.value);
        if (labelId) {
          const lb = document.getElementById(labelId);
          if (lb) lb.textContent = (key === 'unitPriceUsd' ? fmtUsd(state[key], 2) : state[key]) + (suffix || '');
        }
        renderStores();
      });
    }

    bindInput(els.price, 'unitPriceUsd', 'lbl-price', '');
    bindInput(els.units, 'unitsSold', 'lbl-units', ' copies');
    bindInput(els.refund, 'refundRatePct', 'lbl-refund', '%');
    bindInput(els.vat, 'avgVatPct', 'lbl-vat', '%');
    bindInput(els.pub, 'publisherCutPct', 'lbl-pub', '%');
    bindInput(els.itchShare, 'itchRevSharePct', 'lbl-itch-share', '%');
    bindInput(els.engine, 'engineId', null, '');

    document.querySelectorAll('.preset-btn[data-preset]').forEach((btn) => {
      btn.addEventListener('click', function () {
        try {
          const p = JSON.parse(btn.getAttribute('data-preset') || '{}');
          Object.assign(state, p);
          if (els.price) els.price.value = state.unitPriceUsd;
          if (els.units) els.units.value = state.unitsSold;
          if (els.refund) els.refund.value = state.refundRatePct;
          if (els.vat) els.vat.value = state.avgVatPct;
          if (els.pub) els.pub.value = state.publisherCutPct;
          if (els.itchShare) els.itchShare.value = state.itchRevSharePct;
          if (els.engine) els.engine.value = state.engineId;
          renderStores();
        } catch (err) {}
      });
    });

    const csvBtn = document.getElementById('btn-export-csv');
    if (csvBtn) {
      csvBtn.addEventListener('click', function () {
        const res = (boot.storefronts || []).map(calcStore).sort((a, b) => b.devNet - a.devNet);
        const lines = ['Storefront,Gross_USD,Refunds_USD,VAT_USD,Store_Fee_USD,Engine_Fee_USD,Publisher_USD,Dev_Net_USD,Effective_Pct'];
        res.forEach((r) => lines.push([`"${r.store.name}"`, r.grossRetailUsd.toFixed(2), r.refundsUsd.toFixed(2), r.vatUsd.toFixed(2), r.storeFeeUsd.toFixed(2), r.engineFeeUsd.toFixed(2), r.publisherShareUsd.toFixed(2), r.devNet.toFixed(2), r.keepPct.toFixed(2)].join(',')));
        const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'camberlabs-storefront-payout.csv';
        a.click();
      });
    }
    renderStores();
    return;
  }

  if (boot.kind === 'tool') {
    const mode = boot.mode;
    const state = Object.assign({}, boot.defaults || {});

    function updateToolDom(metrics) {
      metrics.kpis.forEach((k, idx) => {
        const vEl = document.getElementById(`tool-kpi-val-${idx}`);
        const sEl = document.getElementById(`tool-kpi-sub-${idx}`);
        if (vEl) vEl.textContent = k.value;
        if (sEl) sEl.textContent = k.sub;
      });
      const tbody = document.getElementById('tool-breakdown-body');
      if (tbody) {
        tbody.innerHTML = metrics.rows.map((r) => `<tr><td>${r[0]}</td><td class="tabular"><strong>${r[1]}</strong></td></tr>`).join('');
      }
    }

    function computeClientTool() {
      const n = (k, d) => {
        const v = Number(state[k]);
        return Number.isFinite(v) ? v : d;
      };
      if (mode === 'autotile-atlas') {
        const ts = Math.max(4, n('tileSizePx', 16)), c = Math.max(1, Math.round(n('cols', 12))), r = Math.max(1, Math.round(n('rows', 4))),
          m = Math.max(0, Math.round(n('marginPx', 0))), p = Math.max(0, Math.round(n('paddingPx', 1))), ex = Math.max(0, Math.round(n('extrudePx', 1))),
          ch = Math.max(4, Math.round(n('chunkTiles', 32)));
        const cell = ts + 2 * ex;
        const w = m * 2 + c * cell + Math.max(0, c - 1) * p;
        const h = m * 2 + r * cell + Math.max(0, r - 1) * p;
        const pw = nextPow2(w), ph = nextPow2(h);
        return {
          kpis: [
            { value: `${w} × ${h} px`, sub: `${c}×${r} grid (${c * r} tile slots)` },
            { value: `${pw} × ${ph} px`, sub: `RGBA8 GPU Footprint: ${((pw * ph * 4) / 1024).toFixed(1)} KB` },
            { value: `${cell} × ${cell} px`, sub: `Chunk ${ch}² = ${ch * ts}px (${((ch * ch * 4) / 1024).toFixed(1)} KB uint32)` }
          ],
          rows: [
            ['Base Tile Size', `${ts} × ${ts} px`],
            ['Border Extrusion (All Sides)', `${ex} px (Cell -> ${cell}×${cell} px)`],
            ['Inter-Tile Separation', `${p} px (Godot Separation = ${p + 2 * ex} px)`],
            ['Outer Atlas Margin', `${m} px`],
            ['Exact Exported PNG Size', `${w} × ${h} px`],
            ['Recommended POT Container', `${pw} × ${ph} px`],
            ['Map Chunk World Span', `${ch * ts} × ${ch * ts} world px (${ch}×${ch} tiles)`]
          ]
        };
      }
      if (mode === 'isometric-grid') {
        const tw = Math.max(8, n('tileWidthPx', 64)), th = Math.max(4, n('tileHeightPx', 32)),
          gx = Math.round(n('gridX', 12)), gy = Math.round(n('gridY', 8)), ppu = Math.max(1, n('ppu', 32)),
          g = Math.max(10, n('gravity', 980)), jh = Math.max(4, n('jumpHeightPx', 48));
        const sx = (gx - gy) * (tw * 0.5), sy = (gx + gy) * (th * 0.5), jv = -Math.sqrt(2 * g * jh), t = Math.abs(jv) / g;
        return {
          kpis: [
            { value: `(${sx.toFixed(0)}, ${sy.toFixed(0)}) px`, sub: `For tile (${gx}, ${gy}) @ ${tw}×${th}` },
            { value: `${(tw / ppu).toFixed(3)} units`, sub: `PPU = ${ppu} (${tw}px tile)` },
            { value: `${jv.toFixed(1)} px/s`, sub: `Apex ${jh}px (${(jh / th).toFixed(2)} tiles) in ${(t * 1000).toFixed(0)}ms` }
          ],
          rows: [
            ['Tile Dimensions & Aspect', `${tw} × ${th} px (Ratio ${(tw / th).toFixed(2)}:1)`],
            ['Orthogonal World Span', `${gx * tw} × ${gy * th} px`],
            ['Isometric Diamond Center (gx, gy)', `(${sx.toFixed(1)}, ${sy.toFixed(1)}) px`],
            ['Hex Row Vertical Spacing (0.75×H)', `${(th * 0.75).toFixed(1)} px/row`],
            ['Safe Top-Down Corridor Hitbox (72%)', `${(tw * 0.72).toFixed(1)} px max width`],
            ['Jump Initial Velocity (v₀)', `${jv.toFixed(2)} px/s @ g=${g} px/s²`],
            ['Time to Jump Apex / Total Air', `${(t * 1000).toFixed(0)} ms up / ${(t * 2000).toFixed(0)} ms symmetric`]
          ]
        };
      }
      if (mode === 'vram-spritesheet') {
        const fw = Math.max(4, Math.round(n('frameW', 64))), fh = Math.max(4, Math.round(n('frameH', 64))),
          fc = Math.max(1, Math.round(n('frameCount', 16))), cols = Math.max(1, Math.round(n('cols', 8))),
          pad = Math.max(0, Math.round(n('paddingPx', 0))), bpp = Math.max(2, n('astcBpp', 32)),
          mips = Boolean(state.mipmaps);
        const rows = Math.ceil(fc / cols);
        const sw = cols * fw + Math.max(0, cols - 1) * pad, sh = rows * fh + Math.max(0, rows - 1) * pad;
        const pw = nextPow2(sw), ph = nextPow2(sh), mm = mips ? 4 / 3 : 1;
        const rawB = sw * sh * 4 * mm, potB = pw * ph * (bpp / 8) * mm;
        return {
          kpis: [
            { value: `${sw} × ${sh} px`, sub: `${cols} cols × ${rows} rows (${cols * rows - fc} empty slots)` },
            { value: `${pw} × ${ph} px`, sub: `${bpp}-bit/px${mips ? ' + 33% Mipmaps' : ' (No Mipmaps)'}` },
            { value: potB >= 1048576 ? `${(potB / 1048576).toFixed(2)} MB` : `${(potB / 1024).toFixed(1)} KB`, sub: `Uncompressed RGBA8: ${(rawB / 1024).toFixed(1)} KB` }
          ],
          rows: [
            ['Frame Size & Total Frames', `${fw} × ${fh} px × ${fc} frames`],
            ['Grid Layout (hframes × vframes)', `${cols} × ${rows} (${cols * rows - fc} unused cells)`],
            ['Exact Sheet Size (with padding)', `${sw} × ${sh} px`],
            ['Next Power-of-Two (POT)', `${pw} × ${ph} px`],
            ['Uncompressed RGBA8888 VRAM', `${(rawB / 1024).toFixed(1)} KB`],
            [`Target Format VRAM (${bpp} bpp)`, potB >= 1048576 ? `${(potB / 1048576).toFixed(2)} MB` : `${(potB / 1024).toFixed(1)} KB`],
            ['Mipmap Overhead Applied', mips ? 'Yes (+33.33% RAM)' : 'No (Recommended for Pixel Art)']
          ]
        };
      }
      if (mode === 'pixel-camera') {
        const bw = Math.max(64, Math.round(n('baseW', 320))), bh = Math.max(64, Math.round(n('baseH', 180))),
          tw = Math.max(320, Math.round(n('targetW', 1920))), th = Math.max(240, Math.round(n('targetH', 1080))),
          ppu = Math.max(1, n('ppu', 16)), tr = Math.max(0, Math.min(1, n('trauma', 0.65))), dec = Math.max(0.1, n('decayPerSec', 1.5));
        const sc = Math.max(1, Math.min(Math.floor(tw / bw), Math.floor(th / bh)));
        const ortho = (bh / ppu) * 0.5, shk = tr * tr, rec = tr / dec;
        return {
          kpis: [
            { value: `${sc}× Exact`, sub: `Renders ${bw * sc}×${bh * sc} inside ${tw}×${th}` },
            { value: `${ortho.toFixed(3)}`, sub: `At PPU = ${ppu} (${(bh / ppu).toFixed(1)} vertical world units)` },
            { value: `${(shk * 100).toFixed(1)}%`, sub: `Trauma ${tr.toFixed(2)} decays in ${(rec * 1000).toFixed(0)}ms` }
          ],
          rows: [
            ['Virtual Base Resolution', `${bw} × ${bh} px`],
            ['Target Display Resolution', `${tw} × ${th} px`],
            ['Clean Integer Viewport Size', `${bw * sc} × ${bh * sc} px (${sc}x multiplier)`],
            ['Black Borders / Expand Margin', `Horizontal: ${(tw - bw * sc) / 2}px/side · Vertical: ${(th - bh * sc) / 2}px/side`],
            ['Unity URP Camera.orthographicSize', `${ortho.toFixed(4)} (half-height in world units)`],
            ['Camera Shake Intensity (trauma²)', `${(shk * 100).toFixed(1)}% -> recovers in ${rec.toFixed(2)}s`]
          ]
        };
      }
      if (mode === 'frame-timing') {
        const fps = Math.max(1, n('animFps', 15)), fc = Math.max(1, Math.round(n('frameCount', 8))),
          st = Math.max(0, Math.round(n('startupFrames', 4))), ac = Math.max(1, Math.round(n('activeFrames', 3))),
          rc = Math.max(0, Math.round(n('recoveryFrames', 7))), hs = Math.max(0, n('hitstopMs', 55)), bpm = Math.max(30, n('bpm', 128));
        const mpf = 1000 / fps, clip = fc * mpf, tot = st + ac + rc, cm = tot * (1000 / 60), bm = 60000 / bpm;
        return {
          kpis: [
            { value: `${clip.toFixed(0)} ms`, sub: `${fc} frames @ ${fps} FPS (${mpf.toFixed(1)} ms/frame)` },
            { value: `${tot} frames (${cm.toFixed(0)} ms)`, sub: `${st}f start · ${ac}f active · ${rc}f recov` },
            { value: `${bm.toFixed(1)} ms/beat`, sub: `${bpm} BPM (${(bpm / 60).toFixed(2)} Hz) · Hitstop ${(hs / 16.6667).toFixed(1)}f` }
          ],
          rows: [
            ['Sprite Frame Step Duration', `${mpf.toFixed(2)} ms (${(1 / fps).toFixed(4)} s)`],
            ['Total Loop Duration', `${(clip / 1000).toFixed(3)} seconds (${fc} frames)`],
            ['Total Attack Lockout (60Hz)', `${tot} frames = ${cm.toFixed(1)} ms`],
            ['Hitstop Freeze Frames (60Hz / 50Hz)', `${(hs / 16.6667).toFixed(2)} frames @ 60Hz · ${(hs / 20).toFixed(2)} ticks @ Unity 50Hz`],
            ['1/4 Beat · 1/8 Beat · 1/16 Beat', `${bm.toFixed(1)}ms · ${(bm / 2).toFixed(1)}ms · ${(bm / 4).toFixed(1)}ms`],
            ['Shader Pulse Frequency', `${(bpm / 60).toFixed(3)} Hz`]
          ]
        };
      }
      if (mode === 'ui-nineslice-dpi') {
        const sL = Math.round(n('sliceL', 8)), sR = Math.round(n('sliceR', 8)), sT = Math.round(n('sliceT', 8)), sB = Math.round(n('sliceB', 8)),
          cW = Math.round(n('contentW', 240)), cH = Math.round(n('contentH', 72)), rH = Math.max(120, n('refH', 360)), tH = Math.max(120, n('targetH', 1080)),
          fPx = n('fontPx', 14), sc = Math.round(n('slotCount', 6)), sp = Math.round(n('slotPx', 32)), gp = Math.round(n('slotGapPx', 4));
        const rat = tH / rH, mW = sL + sR, mH = sT + sB, iW = Math.max(0, cW - mW), iH = Math.max(0, cH - mH), rf = fPx * rat, hw = mW + sc * sp + Math.max(0, sc - 1) * gp;
        return {
          kpis: [
            { value: `${rat.toFixed(2)}×`, sub: `Ref ${rH}p -> Target ${tH}p` },
            { value: `${iW} × ${iH} px`, sub: `Min safe shell: ${mW}×${mH}px (9-slice insets)` },
            { value: `${rf.toFixed(1)} screen px`, sub: `${rf >= 16 ? 'Deck Readability OK ✓' : 'Increase base font size!'} · Hotbar ${hw}px` }
          ],
          rows: [
            ['9-Slice Corner Insets (L / R / T / B)', `${sL} / ${sR} / ${sT} / ${sB} px`],
            ['Minimum Uncorrupted Panel Size', `${mW} × ${mH} px`],
            ['Inner Content Safe Area', `${iW} × ${iH} px`],
            ['Recommended L10n Width (+35% DE)', `${Math.ceil(iW * 1.35 + mW)} px total panel width`],
            ['Inventory / Hotbar Total Width', `${hw} px (${sc} slots × ${sp}px + ${gp}px gap)`],
            ['Final Screen-Space Font Size', `${rf.toFixed(1)} px (${fPx}px base @ ${rat.toFixed(2)}x)`]
          ]
        };
      }
      if (mode === 'audio-dialogue') {
        const ch = Math.max(1, n('charCount', 120)), cps = Math.max(1, n('charsPerSec', 36)), bec = Math.max(1, Math.round(n('blipEveryChars', 2))),
          sr = Math.max(8000, Math.round(n('sampleRateHz', 44100))), chan = n('channels', 1) >= 2 ? 2 : 1, dur = Math.max(0.02, n('durationSec', 2.5)),
          bpm = Math.max(30, n('bpm', 128)), bts = Math.max(1, Math.round(n('beats', 32))), db = n('dbGain', -6), st = n('semitones', 2);
        const rSec = ch / cps, blips = Math.ceil(ch / bec), wb = Math.round(sr * chan * 2 * dur) + 44, ls = (60 / bpm) * bts, lsam = Math.round(ls * sr), lin = Math.pow(10, db / 20), pt = Math.pow(2, st / 12);
        return {
          kpis: [
            { value: `${rSec.toFixed(2)} s`, sub: `${ch} chars @ ${cps} CPS (${blips} voice blips)` },
            { value: wb >= 1048576 ? `${(wb / 1048576).toFixed(2)} MB` : `${(wb / 1024).toFixed(1)} KB`, sub: `${sr}Hz · ${chan === 1 ? 'Mono' : 'Stereo'} · ${dur}s` },
            { value: `${ls.toFixed(3)} s`, sub: `${lsam.toLocaleString('en-US')} samples @ ${bpm} BPM · ${pt.toFixed(3)}× pitch` }
          ],
          rows: [
            ['Dialogue Reveal Duration', `${rSec.toFixed(2)} s (${blips} blips)`],
            ['Exact PCM WAV File Size', `${wb.toLocaleString('en-US')} bytes (${(wb / 1024).toFixed(2)} KB)`],
            ['Tracker Seamless Loop Duration', `${ls.toFixed(4)} s (${bts} beats @ ${bpm} BPM)`],
            ['Exact Trim Sample Count', `${lsam.toLocaleString('en-US')} samples @ ${sr}Hz`],
            [`Decibel Gain (${db} dB)`, `${(lin * 100).toFixed(1)}% linear (${lin.toFixed(4)})`],
            [`Semitone Shift (${st >= 0 ? '+' : ''}${st} st)`, `${pt.toFixed(4)}× speed/pitch ratio`]
          ]
        };
      }
      // rpg-probability-curve
      const ds = Math.max(1, Math.round(n('deckSize', 30))), cp = Math.max(0, Math.min(ds, Math.round(n('copiesInDeck', 4)))), hs = Math.max(1, Math.min(ds, Math.round(n('handSize', 5)))),
        hp = Math.max(1, n('hp', 500)), ar = Math.max(0, n('armor', 100)), ak = Math.max(1, n('armorK', 100)),
        dp = Math.max(0.01, Math.min(100, n('dropPct', 5))), tr = Math.max(1, Math.round(n('trials', 30))),
        xb = Math.max(1, n('xpBase', 100)), xe = Math.max(1, n('xpExp', 1.65)), tl = Math.max(2, Math.round(n('targetLevel', 20))),
        cc = Math.max(0, Math.min(100, n('critChancePct', 25))), cm = Math.max(1, n('critMult', 2.0)), bd = Math.max(1, n('baseDmg', 40)), aps = Math.max(0.1, n('aps', 2.0)),
        ub = Math.max(1, n('upgradeBase', 50)), ur = Math.max(1.01, n('upgradeRate', 1.15)), un = Math.max(1, Math.round(n('upgradeN', 10)));
      const zeroOdds = nCr(ds - cp, hs) / nCr(ds, hs), drawOdds = Math.max(0, Math.min(100, (1 - zeroOdds) * 100));
      const dr = (ar / (ar + ak)) * 100, ehp = hp * (1 + ar / ak);
      const pD = dp / 100, dropN = (1 - Math.pow(1 - pD, tr)) * 100, r90 = pD >= 1 ? 1 : Math.ceil(Math.log(0.1) / Math.log(1 - pD));
      let cumXp = 0, lastXp = 0;
      for (let i = 1; i < tl; i++) { const r = Math.round(xb * Math.pow(i, xe)); cumXp += r; if (i === tl - 1) lastXp = r; }
      const hit = bd * (1 + (cc / 100) * (cm - 1)), dps = hit * aps, pArm = hit * (ak / (ak + ar)), stk = Math.max(1, Math.ceil(hp / Math.max(0.01, pArm))), ttk = (stk - 1) / aps;
      const bulk = ub * ((Math.pow(ur, un) - 1) / (ur - 1));
      return {
        kpis: [
          { value: `${drawOdds.toFixed(2)}%`, sub: `${cp} copies in ${ds}-card deck (Hand ${hs})` },
          { value: `${Math.round(ehp).toLocaleString('en-US')} EHP`, sub: `${dr.toFixed(1)}% mitigation · STK ${stk} hits (${ttk.toFixed(2)}s TTK)` },
          { value: `${dropN.toFixed(1)}%`, sub: `${dp}% rate · 90% target = ${r90} runs · DPS ${dps.toFixed(1)}` }
        ],
        rows: [
          ['Hypergeometric Opening Draw P(X ≥ 1)', `${drawOdds.toFixed(2)}% (Zero-draw risk: ${(zeroOdds * 100).toFixed(2)}%)`],
          ['Armor Damage Mitigation & EHP', `${dr.toFixed(2)}% DR -> ${Math.round(ehp).toLocaleString('en-US')} EHP from ${hp} HP`],
          ['Expected Crit Hit & Raw DPS', `${hit.toFixed(1)} avg dmg/hit · ${dps.toFixed(1)} DPS (${aps}/sec)`],
          ['Shots-to-Kill & Time-to-Kill vs Armor', `${stk} shots · ${ttk.toFixed(2)}s TTK`],
          [`Loot Probability Over ${tr} Trials`, `${dropN.toFixed(2)}% (Need ${r90} runs for 90% certainty)`],
          [`Level ${tl} XP Requirement & Total`, `${lastXp.toLocaleString('en-US')} XP final step · ${cumXp.toLocaleString('en-US')} total XP`],
          [`Idle Buy-${un} Upgrade Sum (r=${ur})`, `${Math.round(bulk).toLocaleString('en-US')} currency total`]
        ]
      };
    }

    document.querySelectorAll('[data-tool-field]').forEach((inp) => {
      const key = inp.getAttribute('data-tool-field');
      inp.addEventListener(inp.type === 'checkbox' ? 'change' : 'input', function () {
        state[key] = inp.type === 'checkbox' ? inp.checked : Number(inp.value);
        updateToolDom(computeClientTool());
      });
    });
  }
})();
