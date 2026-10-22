/* FitFlow — medições feitas só com o celular (e manuais). Só o que é confiável:
   batimento pela câmera (estimativa), pressão digitada (aparelho de braço), % de gordura (Marinha dos EUA) e fotos de progresso.
   NÃO há pressão nem SpO₂ pela câmera: não são confiáveis. Tudo fica no aparelho. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = n => String(n).padStart(2, '0');
  const fdata = ts => { const d = new Date(ts); return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear(); };
  const fhora = ts => { const d = new Date(ts); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  const num = v => parseFloat(String(v).replace(',', '.'));
  const mean = a => a.reduce((s, x) => s + x, 0) / (a.length || 1);
  const std = a => { const m = mean(a); return Math.sqrt(mean(a.map(x => (x - m) * (x - m)))); };
  const median = a => { const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : 0; };

  // ════════════════════════════════════════════════════════════
  //  1) BATIMENTO PELA CÂMERA (fotopletismografia)
  //  frames: [{ t (ms), r, g, b }] médias da imagem com o dedo sobre a lente e o flash aceso
  // ════════════════════════════════════════════════════════════
  const dedoNoFrame = f => f.r > 90 && f.r > f.g * 1.5 && f.r > f.b * 1.5;

  function mediaMovel(x, n) {
    const out = new Array(x.length); let s = 0;
    for (let i = 0; i < x.length; i++) { s += x[i]; if (i >= n) s -= x[i - n]; out[i] = s / Math.min(i + 1, n); }
    // desloca para centralizar a janela
    const k = n >> 1, c = new Array(x.length);
    for (let i = 0; i < x.length; i++) c[i] = out[Math.min(x.length - 1, i + k)];
    return c;
  }

  function processarPPG(frames) {
    const FS = 30;
    if (!frames || frames.length < 60) return { ok: false, motivo: 'Poucos quadros da câmera. Tente de novo.' };
    const comDedo = frames.filter(dedoNoFrame).length / frames.length;
    const rMed = mean(frames.map(f => f.r));
    if (rMed < 60) return { ok: false, motivo: 'Pouca luz: o flash não acendeu ou o dedo não cobriu a lente. Cubra a lente e o flash.' };
    if (comDedo < 0.85) return { ok: false, motivo: 'O dedo saiu da lente ou não a cobriu por inteiro. Cubra a lente e o flash sem apertar forte.' };
    // descarta os 2 primeiros segundos (a câmera ainda ajusta a exposição)
    const t0 = frames[0].t + 2000, util = frames.filter(f => f.t >= t0);
    if (util.length < 50) return { ok: false, motivo: 'Poucos quadros da câmera. Tente de novo.' };
    // reamostra em 30 Hz
    const ini = util[0].t, fim = util[util.length - 1].t, n = Math.floor((fim - ini) / 1000 * FS);
    if (n < FS * 12) return { ok: false, motivo: 'Medição muito curta. Mantenha o dedo parado por 30 segundos.' };
    const raw = new Array(n); let j = 0;
    for (let i = 0; i < n; i++) {
      const t = ini + i * 1000 / FS;
      while (j < util.length - 2 && util[j + 1].t < t) j++;
      const a = util[j], b = util[j + 1], w = b.t === a.t ? 0 : Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t)));
      raw[i] = a.r + (b.r - a.r) * w;
    }
    const dc = mean(raw);
    // movimento: janelas de 1 s em que o nível médio muda de repente
    let mov = 0, jan = 0;
    for (let i = FS; i + FS <= n; i += FS) { jan++; if (Math.abs(mean(raw.slice(i, i + FS)) - mean(raw.slice(i - FS, i))) > Math.max(6, dc * 0.04)) mov++; }
    const movFrac = jan ? mov / jan : 0;
    // filtro passa-faixa simples (≈0,7 a 3,5 Hz): tira a tendência e suaviza
    const tend = mediaMovel(raw, 45), x1 = raw.map((v, i) => v - tend[i]), x = mediaMovel(x1, 5);
    const amp = std(x) / dc;
    const sd = std(x) || 1e-9, z = x.map(v => v / sd);
    // picos
    const picos = []; const minDist = Math.round(FS * 0.3);
    for (let i = 2; i < n - 2; i++) {
      if (z[i] > 0.2 && z[i] > z[i - 1] && z[i] >= z[i + 1]) {
        if (picos.length && i - picos[picos.length - 1] < minDist) { if (z[i] > z[picos[picos.length - 1]]) picos[picos.length - 1] = i; }
        else picos.push(i);
      }
    }
    if (picos.length < 12) return { ok: false, motivo: 'Sinal fraco: não consegui contar batimentos. Mantenha o dedo parado e com a lente bem coberta.', qualidade: 20 };
    const ibi = []; for (let i = 1; i < picos.length; i++) ibi.push((picos[i] - picos[i - 1]) / FS);
    const m = median(ibi), bons = ibi.filter(v => v >= m * 0.78 && v <= m * 1.22);
    const keptFrac = bons.length / ibi.length;
    const bpm = 60 / median(bons), cv = std(bons) / mean(bons);
    // confere com o espectro (DFT de 0,7 a 3,2 Hz)
    let melhor = 0, fMel = 0;
    for (let f = 0.7; f <= 3.2; f += 0.02) {
      let re = 0, im = 0;
      for (let i = 0; i < n; i++) { const w = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1)), a = 2 * Math.PI * f * i / FS; re += z[i] * w * Math.cos(a); im -= z[i] * w * Math.sin(a); }
      const p = re * re + im * im; if (p > melhor) { melhor = p; fMel = f; }
    }
    const bpmFFT = fMel * 60, concorda = Math.abs(bpmFFT - bpm) / bpm < 0.12;
    let q = 100;
    q -= Math.max(0, cv - 0.04) * 450;
    q -= (1 - keptFrac) * 130;
    if (!concorda) q -= 45;
    if (picos.length < 20) q -= 25;
    if (amp < 0.0012) q -= 35;
    q -= movFrac * 120;
    q = Math.max(0, Math.min(100, Math.round(q)));
    const r = { ok: false, bpm: Math.round(bpm), bpmEspectro: Math.round(bpmFFT), qualidade: q, picos: picos.length, cv: +cv.toFixed(3), movimento: +movFrac.toFixed(2), amp: +amp.toFixed(4) };
    if (movFrac > 0.2) r.motivo = 'O dedo se mexeu durante a medição. Apoie a mão numa mesa e fique parado.';
    else if (amp < 0.0012) r.motivo = 'Sinal muito fraco. Aperte um pouco menos o dedo e cubra bem a lente e o flash.';
    else if (!concorda || cv > 0.18 || keptFrac < 0.7) r.motivo = 'O sinal ficou irregular e não dá para confiar no número. Tente de novo, bem parado, em um lugar tranquilo.';
    else if (bpm < 40 || bpm > 180) r.motivo = 'O valor ficou fora do esperado (' + Math.round(bpm) + ' bpm). Tente de novo.';
    else if (q < 60) r.motivo = 'Qualidade do sinal baixa (' + q + '/100). Tente de novo.';
    else r.ok = true;
    return r;
  }

  let cam = null;
  function pararCam() { if (cam) { try { cam.stream.getTracks().forEach(t => { try { if (t.getCapabilities && t.getCapabilities().torch) t.applyConstraints({ advanced: [{ torch: false }] }); } catch (e) { } t.stop(); }); } catch (e) { } clearInterval(cam.iv); cam = null; } }

  async function iniciarFC() {
    const st = $('fc-status'), bar = $('fc-barra'), btn = $('fc-go'), res = $('fc-res');
    res.innerHTML = '';
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { st.textContent = 'Este navegador não permite usar a câmera. Use o app Android ou o Chrome.'; return; }
    btn.disabled = true; st.textContent = 'Abrindo a câmera…';
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 160 }, height: { ideal: 120 }, frameRate: { ideal: 30 } }, audio: false }); }
    catch (e) { st.textContent = 'Não consegui abrir a câmera (' + (e.name === 'NotAllowedError' ? 'permissão negada' : e.name) + '). Libere o acesso à câmera nas configurações.'; btn.disabled = false; return; }
    const track = stream.getVideoTracks()[0]; let flash = false;
    try { const caps = track.getCapabilities && track.getCapabilities(); if (caps && caps.torch) { await track.applyConstraints({ advanced: [{ torch: true }] }); flash = true; } } catch (e) { }
    const vid = $('fc-video'); vid.srcObject = stream; vid.muted = true; vid.setAttribute('playsinline', ''); try { await vid.play(); } catch (e) { }
    const cv = document.createElement('canvas'); cv.width = 24; cv.height = 24; const cx = cv.getContext('2d', { willReadFrequently: true });
    const frames = []; const TOTAL = 32000; const t0 = performance.now(); let ultimoR = null, dedoOk = 0;
    cam = { stream, iv: null };
    st.textContent = flash ? 'Cubra a lente e o flash com a ponta do dedo e fique parado…' : 'Seu celular não deixou acender o flash. Use um lugar bem iluminado e cubra a lente com o dedo.';
    cam.iv = setInterval(() => {
      const w = vid.videoWidth, h = vid.videoHeight; if (!w) return;
      cx.drawImage(vid, w * 0.25, h * 0.25, w * 0.5, h * 0.5, 0, 0, 24, 24);
      const d = cx.getImageData(0, 0, 24, 24).data; let r = 0, g = 0, b = 0; const np = d.length / 4;
      for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
      const f = { t: performance.now() - t0, r: r / np, g: g / np, b: b / np }; frames.push(f);
      const ok = dedoNoFrame(f); if (ok) dedoOk++;
      const mexeu = ultimoR !== null && Math.abs(f.r - ultimoR) > 14; ultimoR = f.r;
      const dec = f.t / 1000;
      if (dec > 1) st.textContent = !ok ? '☝️ Coloque o dedo sobre a lente e o flash' : mexeu ? '⚠️ Fique parado' : '✅ Sinal bom. Fique parado… ' + Math.max(0, Math.ceil((TOTAL - f.t) / 1000)) + ' s';
      bar.style.width = Math.min(100, f.t / TOTAL * 100) + '%';
      const wf = $('fc-onda'); if (wf) desenharOnda(wf, frames);
      if (f.t >= TOTAL) {
        pararCam(); bar.style.width = '100%'; btn.disabled = false;
        const r2 = processarPPG(frames); mostrarFC(r2); st.textContent = r2.ok ? 'Pronto.' : 'Medição descartada.';
      }
    }, 33);
  }
  function desenharOnda(c, frames) {
    const ctx = c.getContext('2d'), W = c.width, H = c.height; ctx.clearRect(0, 0, W, H);
    const ult = frames.slice(-150).map(f => f.r); if (ult.length < 10) return;
    const m = mean(ult), s = std(ult) || 1; ctx.strokeStyle = '#FF6B35'; ctx.lineWidth = 2; ctx.beginPath();
    ult.forEach((v, i) => { const x = i / 150 * W, y = H / 2 - ((v - m) / (s * 3)) * H; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
  }
  const getFC = () => DB.load('fc_cam', []);
  function mostrarFC(r) {
    const el = $('fc-res');
    if (r.ok) {
      const lista = getFC(); lista.unshift({ ts: Date.now(), bpm: r.bpm, q: r.qualidade }); DB.save('fc_cam', lista.slice(0, 60));
      el.innerHTML = `<div class="sa-alert ok"><div style="font-size:2.2rem;font-weight:700">❤️ ${r.bpm} bpm</div>Qualidade do sinal: <b>${r.qualidade}/100</b> · ${r.picos} batimentos contados<br><b>Estimativa pela câmera</b>: não é um exame. Em repouso, adultos costumam ter entre 60 e 100 bpm.</div>`;
    } else {
      el.innerHTML = `<div class="sa-alert warn"><b>Leitura rejeitada${r.qualidade != null ? ' (qualidade ' + r.qualidade + '/100)' : ''}.</b><br>${esc(r.motivo)}<br><span class="sa-small">Não mostramos o número quando o sinal não é confiável.</span></div>`;
    }
    renderFC();
  }
  function renderFC() {
    const h = $('fc-hist'); if (!h) return; const l = getFC();
    h.innerHTML = l.length ? '<div class="small muted" style="margin:.5rem 0 .2rem">Últimas medições (estimativa pela câmera)</div>' + l.slice(0, 6).map(x => `<div class="md-linha"><span>${fdata(x.ts)} ${fhora(x.ts)}</span><b>${x.bpm} bpm</b><span class="tiny muted">qualidade ${x.q}</span></div>`).join('') : '<div class="small muted" style="margin-top:.5rem">Sem dados ainda.</div>';
  }

  // ════════════════════════════════════════════════════════════
  //  2) PRESSÃO ARTERIAL (digitada, aparelho de braço)
  // ════════════════════════════════════════════════════════════
  const getPA = () => DB.load('pa', []);
  function classePA(s, d) {
    if (s >= 180 || d >= 120) return { nivel: 'bad', txt: 'Valores muito altos. Se você sentir dor no peito, falta de ar, dor de cabeça forte, fraqueza ou fala enrolada, <b>ligue 192</b>. Sem sintomas, descanse sentado por 5 minutos, meça de novo e <b>procure atendimento médico hoje</b>.' };
    if (s >= 140 || d >= 90) return { nivel: 'warn', txt: 'Acima de <b>140/90</b>. Descanse sentado por 5 minutos e meça de novo. Se continuar assim, <b>procure o seu médico</b> para avaliar.' };
    if (s < 90 || d < 60) return { nivel: 'warn', txt: 'Abaixo de 90/60. Se houver tontura, fraqueza ou desmaio, procure atendimento. Converse com seu médico se acontecer com frequência.' };
    return { nivel: 'ok', txt: 'Abaixo de 140/90. Continue medindo nos horários combinados com seu médico.' };
  }
  function graficoPA(l) {
    const v = l.slice(0, 20).reverse(); if (v.length < 2) return '';
    const W = 320, H = 130, min = 40, max = 200, y = n => H - 14 - (n - min) / (max - min) * (H - 24), x = i => 22 + i * (W - 30) / (v.length - 1);
    const linha = (k, c) => `<polyline fill="none" stroke="${c}" stroke-width="2" points="${v.map((p, i) => x(i).toFixed(1) + ',' + y(p[k]).toFixed(1)).join(' ')}"/>` + v.map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p[k]).toFixed(1)}" r="2.5" fill="${c}"/>`).join('');
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Gráfico da pressão arterial">
      <line x1="22" x2="${W}" y1="${y(140)}" y2="${y(140)}" stroke="#F87171" stroke-dasharray="4 3"/><text x="0" y="${y(140) + 3}" fill="#F87171" font-size="8">140</text>
      <line x1="22" x2="${W}" y1="${y(90)}" y2="${y(90)}" stroke="#60A5FA" stroke-dasharray="4 3"/><text x="2" y="${y(90) + 3}" fill="#60A5FA" font-size="8">90</text>
      ${linha('sys', '#F87171')}${linha('dia', '#60A5FA')}
      <text x="${W - 4}" y="10" fill="#F87171" font-size="9" text-anchor="end">● sistólica</text><text x="${W - 4}" y="22" fill="#60A5FA" font-size="9" text-anchor="end">● diastólica</text></svg>`;
  }
  function salvarPA() {
    const s = num($('pa-s').value), d = num($('pa-d').value), p = num($('pa-p').value), arm = $('pa-b').value, quando = $('pa-t').value;
    const er = $('pa-erro'); er.textContent = '';
    if (!(s >= 70 && s <= 260)) { er.textContent = 'Sistólica (a maior) deve estar entre 70 e 260.'; return; }
    if (!(d >= 40 && d <= 160)) { er.textContent = 'Diastólica (a menor) deve estar entre 40 e 160.'; return; }
    if (!(s > d)) { er.textContent = 'A sistólica precisa ser maior que a diastólica.'; return; }
    if ($('pa-p').value !== '' && !(p >= 30 && p <= 220)) { er.textContent = 'Pulso deve estar entre 30 e 220.'; return; }
    const ts = quando ? new Date(quando).getTime() : Date.now();
    const l = getPA(); l.unshift({ ts, sys: Math.round(s), dia: Math.round(d), pul: isFinite(p) ? Math.round(p) : null, arm }); l.sort((a, b) => b.ts - a.ts);
    DB.save('pa', l.slice(0, 200));
    ['pa-s', 'pa-d', 'pa-p'].forEach(i => $(i).value = '');
    const c = classePA(Math.round(s), Math.round(d));
    $('pa-res').innerHTML = `<div class="sa-alert ${c.nivel}"><b>${Math.round(s)}/${Math.round(d)} mmHg</b><br>${c.txt}</div>`;
    renderPA();
  }
  function apagarPA(ts) { DB.save('pa', getPA().filter(x => x.ts !== ts)); renderPA(); }
  function renderPA() {
    const l = getPA(), el = $('pa-lista'); if (!el) return;
    el.innerHTML = (l.length ? graficoPA(l) + l.slice(0, 8).map(x => { const c = classePA(x.sys, x.dia); return `<div class="md-linha"><span>${fdata(x.ts)} ${fhora(x.ts)}</span><b style="color:${c.nivel === 'ok' ? 'var(--green)' : c.nivel === 'warn' ? 'var(--yellow)' : 'var(--red)'}">${x.sys}/${x.dia}</b><span class="tiny muted">${x.pul ? x.pul + ' bpm · ' : ''}braço ${x.arm}</span><button class="md-x" aria-label="Apagar" data-ts="${x.ts}">✕</button></div>`; }).join('') : '<div class="small muted">Sem dados ainda.</div>');
    el.querySelectorAll('.md-x').forEach(b => b.onclick = () => apagarPA(+b.dataset.ts));
  }

  // ════════════════════════════════════════════════════════════
  //  3) % DE GORDURA — método da Marinha dos EUA (centímetros)
  // ════════════════════════════════════════════════════════════
  function marinha(sexo, altura, pescoco, cintura, quadril) {
    const L = Math.log10;
    if (sexo === 'M') { const dif = cintura - pescoco; if (dif <= 0) return null; return 495 / (1.0324 - 0.19077 * L(dif) + 0.15456 * L(altura)) - 450; }
    const soma = cintura + quadril - pescoco; if (soma <= 0) return null;
    return 495 / (1.29579 - 0.35004 * L(soma) + 0.22100 * L(altura)) - 450;
  }
  function faixaGord(sexo, p) {
    const f = sexo === 'M' ? [[6, 'gordura essencial'], [14, 'atlético'], [18, 'em forma'], [25, 'médio'], [999, 'acima do ideal']] : [[14, 'gordura essencial'], [21, 'atlético'], [25, 'em forma'], [32, 'médio'], [999, 'acima do ideal']];
    return f.find(x => p < x[0])[1];
  }
  const getGord = () => DB.load('gordura', []);
  function calcularGord() {
    const sexo = $('gd-sexo').value, alt = num($('gd-alt').value), pes = num($('gd-pes').value), cin = num($('gd-cin').value), qua = num($('gd-qua').value);
    const er = $('gd-erro'); er.textContent = '';
    if (!(alt >= 120 && alt <= 230)) { er.textContent = 'Altura entre 120 e 230 cm.'; return; }
    if (!(pes >= 20 && pes <= 70)) { er.textContent = 'Pescoço entre 20 e 70 cm.'; return; }
    if (!(cin >= 40 && cin <= 220)) { er.textContent = 'Cintura entre 40 e 220 cm.'; return; }
    if (sexo === 'F' && !(qua >= 50 && qua <= 220)) { er.textContent = 'Quadril entre 50 e 220 cm.'; return; }
    const p = marinha(sexo, alt, pes, cin, qua);
    if (p == null || !isFinite(p) || p < 2 || p > 60) { er.textContent = 'Medidas incompatíveis: a cintura precisa ser maior que o pescoço. Meça de novo.'; return; }
    const v = Math.round(p * 10) / 10;
    const l = getGord(); l.unshift({ ts: Date.now(), pct: v, sexo, alt, pes, cin, qua: sexo === 'F' ? qua : null }); DB.save('gordura', l.slice(0, 60));
    $('gd-res').innerHTML = `<div class="sa-alert ok"><div style="font-size:2rem;font-weight:700">≈ ${v}%</div>
      Margem de erro: cerca de <b>±3 a 4 pontos percentuais</b> (de ${(v - 4).toFixed(1)}% a ${(v + 4).toFixed(1)}%). Faixa estimada: <b>${faixaGord(sexo, v)}</b>.<br>
      É uma estimativa por fita métrica; não substitui bioimpedância ou DEXA. Para acompanhar a evolução, meça sempre do mesmo jeito.
      <button class="sa-btn sec" id="gd-usar" style="margin-top:.7rem">Usar no meu perfil</button></div>`;
    $('gd-usar').onclick = () => { if (typeof U !== 'undefined') { U.gordura = Math.round(v); U.massaMagra = +(U.peso * (1 - v / 100)).toFixed(1); DB.save('profile', U); if (typeof populateUI === 'function') populateUI(); $('gd-usar').textContent = '✅ Perfil atualizado'; } };
    renderGord();
  }
  function renderGord() {
    const el = $('gd-hist'); if (!el) return; const l = getGord();
    el.innerHTML = l.length ? '<div class="small muted" style="margin:.6rem 0 .2rem">Histórico (estimativa, ±3 a 4 pontos)</div>' + l.slice(0, 6).map(x => `<div class="md-linha"><span>${fdata(x.ts)}</span><b>${x.pct}%</b><span class="tiny muted">cintura ${x.cin} cm</span></div>`).join('') : '<div class="small muted" style="margin-top:.6rem">Sem dados ainda.</div>';
  }

  // ════════════════════════════════════════════════════════════
  //  4) FOTOS DE PROGRESSO (ficam só no aparelho: IndexedDB)
  // ════════════════════════════════════════════════════════════
  function bd() {
    return new Promise((ok, no) => {
      const r = indexedDB.open('fitflow_fotos', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('fotos', { keyPath: 'id' });
      r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error);
    });
  }
  const tx = async (modo, fn) => { const db = await bd(); return new Promise((ok, no) => { const t = db.transaction('fotos', modo), s = t.objectStore('fotos'); const r = fn(s); t.oncomplete = () => ok(r && r.result); t.onerror = () => no(t.error); }); };
  const todasFotos = async () => (await tx('readonly', s => s.getAll())) || [];
  async function reduzir(file, max) {
    let bmp; try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) { bmp = await createImageBitmap(file); }
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return new Promise(ok => c.toBlob(b => ok(b), 'image/jpeg', 0.82));
  }
  async function addFoto(file) {
    const er = $('ft-erro'); er.textContent = '';
    try {
      const blob = await reduzir(file, 1280);
      await tx('readwrite', s => s.put({ id: 'f' + Date.now(), ts: Date.now(), pose: $('ft-pose').value, blob }));
      await renderFotos();
    } catch (e) { er.textContent = 'Não consegui salvar a foto: ' + (e.message || e); }
  }
  let urls = [];
  async function renderFotos() {
    const el = $('ft-galeria'); if (!el) return;
    urls.forEach(u => URL.revokeObjectURL(u)); urls = [];
    const fotos = (await todasFotos()).sort((a, b) => b.ts - a.ts);
    const url = f => { const u = URL.createObjectURL(f.blob); urls.push(u); return u; };
    const nomePose = { frente: 'Frente', lado: 'Lado', costas: 'Costas' };
    el.innerHTML = fotos.length ? '<div class="ft-grade">' + fotos.map(f => `<div class="ft-item"><img src="${url(f)}" alt="Foto de ${fdata(f.ts)}, ${nomePose[f.pose] || f.pose}"><div class="tiny">${fdata(f.ts)} · ${nomePose[f.pose] || f.pose}</div><button class="md-x" data-id="${f.id}" aria-label="Apagar foto">✕</button></div>`).join('') + '</div>' : '<div class="small muted">Sem dados ainda.</div>';
    el.querySelectorAll('.md-x').forEach(b => b.onclick = async () => { if (confirm('Apagar esta foto do aparelho?')) { await tx('readwrite', s => s.delete(b.dataset.id)); renderFotos(); } });
    // comparação lado a lado
    const cmp = $('ft-comp'); if (!cmp) return;
    if (fotos.length < 2) { cmp.innerHTML = '<div class="small muted">Tire pelo menos 2 fotos para comparar lado a lado.</div>'; return; }
    const op = fotos.map(f => `<option value="${f.id}">${fdata(f.ts)} · ${nomePose[f.pose] || f.pose}</option>`).join('');
    cmp.innerHTML = `<div class="form-grid"><div class="field"><label>Antes</label><select id="ft-a">${op}</select></div><div class="field"><label>Depois</label><select id="ft-b">${op}</select></div></div><div id="ft-par" class="ft-par"></div>`;
    $('ft-a').value = fotos[fotos.length - 1].id; $('ft-b').value = fotos[0].id;
    const desenhar = () => { const a = fotos.find(f => f.id === $('ft-a').value), b = fotos.find(f => f.id === $('ft-b').value); $('ft-par').innerHTML = [a, b].map(f => `<figure><img src="${url(f)}" alt="Foto de ${fdata(f.ts)}"><figcaption>${fdata(f.ts)} · ${nomePose[f.pose] || f.pose}</figcaption></figure>`).join(''); };
    $('ft-a').onchange = desenhar; $('ft-b').onchange = desenhar; desenhar();
  }

  // ════════════════════════════════════════════════════════════
  //  PAINEL
  // ════════════════════════════════════════════════════════════
  function montar() {
    if ($('p-medidas')) return;
    const content = document.querySelector('.content'); if (!content) return;
    const p = document.createElement('div'); p.className = 'panel'; p.id = 'p-medidas';
    const agora = new Date(); const local = new Date(agora.getTime() - agora.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    const u = (typeof U !== 'undefined' && U) || {};
    p.innerHTML = `<div class="h1">📏 Medições</div>
      <div class="sa-disc">Aqui só entram medições confiáveis feitas com o celular ou digitadas. <b>Pressão arterial e oxigênio (SpO₂) não são medidos pela câmera</b>, porque o resultado não seria confiável. As fotos e os valores ficam só neste aparelho e nunca são enviados.</div>

      <div class="card"><div class="card-header"><span class="card-title">❤️ Batimento pela câmera</span><span class="badge badge-b">Estimativa pela câmera</span></div>
        <div class="small muted" style="line-height:1.6">Sente-se e apoie a mão numa mesa. Cubra a <b>lente traseira e o flash</b> com a ponta do dedo, sem apertar forte, e fique parado por 30 segundos. Se o sinal for ruim, o resultado é descartado.</div>
        <video id="fc-video" playsinline muted style="width:1px;height:1px;opacity:0;position:absolute"></video>
        <canvas id="fc-onda" width="300" height="70" class="md-onda"></canvas>
        <div class="pbar-wrap thick" style="margin:.4rem 0"><div class="pbar" id="fc-barra" style="width:0%;background:var(--red)"></div></div>
        <div class="small" id="fc-status" aria-live="polite" style="min-height:1.4rem"></div>
        <button class="btn btn-primary" id="fc-go" style="margin-top:.5rem">▶ Medir agora (30 s)</button>
        <div id="fc-res" style="margin-top:.6rem"></div><div id="fc-hist"></div></div>

      <div class="card"><div class="card-header"><span class="card-title">🩺 Pressão arterial</span><span class="badge badge-g">Digitada</span></div>
        <div class="small muted" style="line-height:1.6;margin-bottom:.6rem">Meça com <b>aparelho de braço</b>, sentado, braço na altura do coração, depois de 5 minutos de descanso e sem café ou cigarro nos últimos 30 minutos. Digite o resultado:</div>
        <div class="form-grid">
          <div class="field"><label>Sistólica (a maior)</label><input id="pa-s" type="number" inputmode="numeric" placeholder="Ex: 120"></div>
          <div class="field"><label>Diastólica (a menor)</label><input id="pa-d" type="number" inputmode="numeric" placeholder="Ex: 80"></div>
          <div class="field"><label>Pulso (opcional)</label><input id="pa-p" type="number" inputmode="numeric" placeholder="Ex: 70"></div>
          <div class="field"><label>Braço</label><select id="pa-b"><option>esquerdo</option><option>direito</option></select></div>
        </div>
        <div class="field" style="margin-bottom:.6rem"><label>Data e hora</label><input id="pa-t" type="datetime-local" value="${local}"></div>
        <div class="small" id="pa-erro" style="color:var(--red)" role="alert"></div>
        <button class="btn btn-primary" id="pa-go">💾 Salvar medição</button>
        <div id="pa-res" style="margin-top:.6rem"></div><div id="pa-lista" style="margin-top:.6rem"></div></div>

      <div class="card"><div class="card-header"><span class="card-title">📐 % de gordura (método da Marinha)</span><span class="badge badge-b">Estimativa ±3-4%</span></div>
        <div class="small muted" style="line-height:1.6;margin-bottom:.6rem"><b>Como medir com a fita</b> (em pé, relaxado, sem apertar a fita, em centímetros):<br>• <b>Pescoço:</b> logo abaixo do pomo de adão, fita reta.<br>• <b>Cintura:</b> na altura do umbigo, depois de soltar o ar normalmente (sem encolher a barriga).<br>• <b>Quadril</b> (só mulheres): na parte mais larga do bumbum.<br>Meça 2 vezes e use a média.</div>
        <div class="form-grid">
          <div class="field"><label>Sexo</label><select id="gd-sexo"><option value="F" ${u.sexo === 'F' ? 'selected' : ''}>Feminino</option><option value="M" ${u.sexo === 'M' ? 'selected' : ''}>Masculino</option></select></div>
          <div class="field"><label>Altura (cm)</label><input id="gd-alt" type="number" inputmode="decimal" value="${u.altura || ''}" placeholder="Ex: 165"></div>
          <div class="field"><label>Pescoço (cm)</label><input id="gd-pes" type="number" inputmode="decimal" placeholder="Ex: 34"></div>
          <div class="field"><label>Cintura (cm)</label><input id="gd-cin" type="number" inputmode="decimal" placeholder="Ex: 80"></div>
          <div class="field" id="gd-qua-box"><label>Quadril (cm)</label><input id="gd-qua" type="number" inputmode="decimal" placeholder="Ex: 98"></div>
        </div>
        <div class="small" id="gd-erro" style="color:var(--red)" role="alert"></div>
        <button class="btn btn-primary" id="gd-go">Calcular</button>
        <div id="gd-res" style="margin-top:.6rem"></div><div id="gd-hist"></div></div>

      <div class="card"><div class="card-header"><span class="card-title">📸 Fotos de progresso</span><span class="badge badge-g">Só neste aparelho</span></div>
        <div class="small muted" style="line-height:1.6;margin-bottom:.6rem"><b>Para comparar bem:</b><br>• <b>Pose:</b> em pé, braços soltos ao lado, olhando para a frente (frente, lado e costas).<br>• <b>Distância:</b> celular a uns 2 metros, na altura do peito, apoiado e reto.<br>• <b>Luz:</b> de frente, sem sombra forte, fundo liso e claro.<br>• Mesma roupa justa e mesmo horário (de manhã, antes de comer).</div>
        <div class="form-grid"><div class="field"><label>Pose</label><select id="ft-pose"><option value="frente">Frente</option><option value="lado">Lado</option><option value="costas">Costas</option></select></div></div>
        <label class="btn btn-teal" style="display:block;text-align:center;cursor:pointer;margin:.4rem 0">📷 Tirar ou escolher foto<input id="ft-file" type="file" accept="image/*" style="display:none"></label>
        <div class="small" id="ft-erro" style="color:var(--red)" role="alert"></div>
        <div class="h2" style="margin-top:.8rem">Comparar</div><div id="ft-comp"></div>
        <div class="h2" style="margin-top:.8rem">Todas as fotos</div><div id="ft-galeria"></div></div>`;
    content.appendChild(p);
    const nb = $('nb-perfil'); const b = document.createElement('button');
    b.className = 'nav-btn'; b.id = 'nb-medidas'; b.setAttribute('onclick', "nav('medidas')"); b.innerHTML = '<span class="ni">📏</span>Medições';
    if (nb) nb.parentNode.insertBefore(b, nb); else document.querySelector('.bottom-nav').appendChild(b);
    $('fc-go').onclick = iniciarFC; $('pa-go').onclick = salvarPA; $('gd-go').onclick = calcularGord;
    $('ft-file').onchange = e => { const f = e.target.files[0]; if (f) addFoto(f); e.target.value = ''; };
    const qb = () => { $('gd-qua-box').style.display = $('gd-sexo').value === 'F' ? '' : 'none'; }; $('gd-sexo').onchange = qb; qb();
  }
  function render() { montar(); renderFC(); renderPA(); renderGord(); renderFotos(); }

  window.Medicoes = { montar, render, pararCam, _ppg: processarPPG, _marinha: marinha, _classePA: classePA };
})();
