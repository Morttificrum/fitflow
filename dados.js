/* FitFlow — dados REAIS de saúde. Nenhum número inventado.
   Fontes: sensor de passos do celular (app Android), Health Connect (relógio), monitor de sono do celular
   (acelerômetro + nível de volume, processado no aparelho) e valores digitados.
   Prioridade quando há mais de uma fonte: Relógio (Health Connect) > Celular > Digitado. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const NATIVE = () => !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform());
  const P = n => window.Capacitor && Capacitor.Plugins && Capacitor.Plugins[n];
  const iso = (d) => { d = d || new Date(); const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 10); };
  const hhmm = ts => new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const dur = min => { min = Math.round(min); const h = Math.floor(min / 60), m = min % 60; return (h ? h + 'h ' : '') + String(m).padStart(2, '0') + 'min'; };
  const MIN = 60000;

  // ════════════════════════════════════════════════════════════
  //  ANÁLISE DO SONO (estimativa pelo celular a partir de épocas de 1 minuto)
  //  época = { t: fim da época (ms), mov: movimento médio, movMax, snd?: volume médio em dB, sndMax? }
  // ════════════════════════════════════════════════════════════
  const med = a => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const quant = (a, q) => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };

  function analisarSono(epocas, inicioTs, fimTs) {
    const ep = (epocas || []).filter(e => e && isFinite(e.t) && isFinite(e.mov)).sort((a, b) => a.t - b.t)
      .filter(e => (!inicioTs || e.t >= inicioTs) && (!fimTs || e.t - MIN <= fimTs));
    if (ep.length < 30) return { erro: 'Poucos dados: o monitor precisa de pelo menos 30 minutos.' };
    const movs = ep.map(e => e.mov);
    const piso = quant(movs, 0.25);                       // ruído do aparelho parado
    const lim = Math.max(piso * 2.5 + 0.01, 0.04);        // acima disso, houve movimento na cama
    const moveu = ep.map(e => e.mov > lim || (e.movMax || 0) > lim * 8);
    const temSom = ep.some(e => e.snd != null);
    const baseSom = temSom ? med(ep.filter(e => e.snd != null).map(e => e.snd)) : 0;
    const barulho = ep.map(e => temSom && e.sndMax != null && e.sndMax > baseSom + 18);
    // janela ponderada: um único giro na cama não é despertar; dois ou mais minutos seguidos, sim
    const pesos = [0.15, 0.25, 0.3, 0.25, 0.15];
    const acordado = ep.map((e, i) => {
      let s = 0;
      for (let k = -2; k <= 2; k++) { const j = i + k; if (j >= 0 && j < ep.length && moveu[j]) s += pesos[k + 2]; }
      return s >= 0.5 || (moveu[i] && barulho[i]);
    });
    // adormeceu: primeiro ponto com 10 minutos seguidos quase sem despertar
    let ini = -1;
    for (let i = 0; i + 10 <= ep.length; i++) { let n = 0; for (let k = 0; k < 10; k++) if (acordado[i + k]) n++; if (n <= 1) { ini = i; break; } }
    if (ini < 0) return { erro: 'Não foi possível identificar o início do sono: o celular se mexeu o tempo todo.' };
    // acordou: fim informado, ou o último minuto de sono antes de um despertar final
    let fim = ep.length - 1;
    if (!fimTs) { while (fim > ini && acordado[fim]) fim--; } else { while (fim > ini && ep[fim].t - MIN > fimTs) fim--; }
    if (fim - ini < 20) return { erro: 'Sono muito curto para analisar (menos de 20 minutos).' };
    // fases: leve por padrão; "profundo" só em trechos bem quietos (>= 15 min sem mexer), no máximo 40 min por trecho,
    // começando 5 min depois que o trecho começa, e no máximo 25% do sono (o sono profundo se concentra no começo da noite)
    const fases = [];
    const quieto = ep.map((e, i) => !moveu[i] && !barulho[i] && e.mov <= piso * 1.5 + 0.01);
    for (let i = ini; i <= fim; i++) fases.push(acordado[i] ? 'acordado' : 'leve');
    const candidatos = [];
    for (let i = ini; i <= fim;) {
      if (!quieto[i] || acordado[i]) { i++; continue; }
      let b = i; while (b + 1 <= fim && quieto[b + 1] && !acordado[b + 1]) b++;
      const len = b - i + 1;
      if (len >= 15) { const c0 = i + 5, c1 = Math.min(b, c0 + 39); candidatos.push({ c0, c1, peso: (c1 - c0 + 1) * (1.5 - (c0 - ini) / Math.max(1, fim - ini)) }); }
      i = b + 1;
    }
    candidatos.sort((x, y) => y.peso - x.peso);
    const sonoTotal = fases.filter(f => f !== 'acordado').length, teto = Math.floor(sonoTotal * 0.25); let usado = 0;
    for (const c of candidatos) {
      const n = c.c1 - c.c0 + 1; if (usado + n > teto) continue;
      for (let k = c.c0; k <= c.c1; k++) fases[k - ini] = 'profundo';
      usado += n;
    }
    // remove despertares muito curtos (< 3 min): contam como sono leve
    for (let i = 0; i < fases.length;) {
      let j = i; while (j < fases.length && fases[j] === fases[i]) j++;
      if (fases[i] === 'acordado' && (j - i) < 3) for (let k = i; k < j; k++) fases[k] = 'leve';
      i = j;
    }
    const estagios = [];
    for (let i = 0; i < fases.length;) {
      let j = i; while (j < fases.length && fases[j] === fases[i]) j++;
      estagios.push({ t0: ep[ini + i].t - MIN, t1: ep[ini + j - 1].t, tipo: fases[i] });
      i = j;
    }
    const tot = { acordado: 0, leve: 0, profundo: 0 };
    estagios.forEach(s => { tot[s.tipo] += (s.t1 - s.t0) / MIN; });
    const despertares = estagios.filter(s => s.tipo === 'acordado').length;
    const adormeceuTs = ep[ini].t - MIN, acordouTs = ep[fim].t;
    const sonoMin = tot.leve + tot.profundo;
    return {
      inicio: inicioTs || ep[0].t - MIN, adormeceu: adormeceuTs, acordou: acordouTs,
      horas: Math.round(sonoMin / 6) / 10, sonoMin: Math.round(sonoMin), leve: Math.round(tot.leve), profundo: Math.round(tot.profundo),
      acordadoMin: Math.round(tot.acordado), despertares, ruidos: barulho.filter(Boolean).length, comMic: temSom,
      estagios, latenciaMin: Math.round((adormeceuTs - (inicioTs || ep[0].t - MIN)) / MIN)
    };
  }

  // ════════════════════════════════════════════════════════════
  //  ARMAZENAMENTO
  // ════════════════════════════════════════════════════════════
  const PRI = { digitado: 1, celular: 2, relogio: 3 };
  function setCampo(log, dia, k, v, src, forcar) {
    const e = (log[dia] = log[dia] || {}); e.src = e.src || {};
    const atual = e.src[k] || (e[k] != null ? 'digitado' : null);
    if (!forcar && e[k] != null && atual && PRI[atual] > PRI[src]) return false;
    e[k] = v; e.src[k] = src; return true;
  }
  const getLog = () => DB.load('healthlog', {});
  function saveLog(log) { Object.keys(log).sort().slice(0, -60).forEach(k => delete log[k]); DB.save('healthlog', log); }
  const getNoites = () => DB.load('sonos', []);
  function salvarNoite(n) {
    const lista = getNoites().filter(x => !(x.data === n.data && x.fonte === n.fonte));
    lista.unshift(n); lista.sort((a, b) => b.acordou - a.acordou);
    DB.save('sonos', lista.slice(0, 40));
    const log = getLog();
    setCampo(log, n.data, 'sono_horas', n.horas, n.fonte === 'relogio' ? 'relogio' : 'celular');
    saveLog(log);
  }
  function melhorNoite() {
    const l = getNoites(); if (!l.length) return null;
    const dia = l[0].data;                                     // noite mais recente
    const mesmaNoite = l.filter(x => x.data === dia);
    return mesmaNoite.find(x => x.fonte === 'relogio') || mesmaNoite[0];
  }
  function refrescar() {
    try { loadHealth(); loadWeek(); renderHealth(); renderSono(); renderFontes(); if (typeof checkAchievements === 'function') checkAchievements(); } catch (e) { /* tela ainda não montada */ }
  }

  // ════════════════════════════════════════════════════════════
  //  PASSOS PELO CELULAR
  // ════════════════════════════════════════════════════════════
  let passosEstado = { disponivel: null, permissao: null };
  async function syncPassosCelular(pedir) {
    const pl = P('Passos'); if (!pl) return;
    try {
      const r = pedir ? await pl.pedirPermissao() : await pl.hoje();
      passosEstado = { disponivel: r.disponivel !== false, permissao: r.permissao !== false };
      if (r.dias) {
        const log = getLog();
        Object.keys(r.dias).forEach(d => { if (r.dias[d] > 0 || d === iso()) setCampo(log, d, 'passos', r.dias[d], 'celular'); });
        saveLog(log);
      }
    } catch (e) { passosEstado = { disponivel: true, permissao: false, erro: e.message || String(e) }; }
  }

  // ════════════════════════════════════════════════════════════
  //  HEALTH CONNECT (relógio)
  // ════════════════════════════════════════════════════════════
  const hcLigado = () => !!DB.load('hcon', false);
  const dayRange = (d) => { const a = new Date(d); a.setHours(0, 0, 0, 0); const b = new Date(a); b.setDate(b.getDate() + 1); return [a, b]; };
  async function syncHC() {
    const h = P('Health'), x = P('HealthExt'); if (!h) return { ok: false, msg: 'Health Connect indisponível.' };
    const sum = a => a.reduce((s, y) => s + (y.value || 0), 0);
    let log = getLog(); const out = { passos: 0, fc: null, noites: 0 };
    try {
      const q = (dataType, a, b, limit) => h.readSamples({ dataType, startDate: a.toISOString(), endDate: b.toISOString(), limit: limit || 2000 }).then(r => r.samples || []).catch(() => []);
      for (let i = 0; i < 7; i++) {
        const d = new Date(); d.setDate(d.getDate() - i); const [a, b] = dayRange(d); const fim = i === 0 ? new Date() : b;
        const steps = await q('steps', a, fim, 5000);
        if (steps.length) { const t = Math.round(sum(steps)); if (t > 0) { setCampo(log, iso(d), 'passos', t, 'relogio'); if (i === 0) out.passos = t; } }
        if (i === 0) {
          const hr = (await q('heartRate', a, fim, 5000)).map(s => s.value).filter(Boolean);
          if (hr.length) { setCampo(log, iso(d), 'bpm_repouso', Math.round(Math.min(...hr)), 'relogio'); setCampo(log, iso(d), 'bpm_pico', Math.round(Math.max(...hr)), 'relogio'); out.fc = [Math.min(...hr), Math.max(...hr)]; }
          const kc = await q('calories', a, fim, 2000);
          if (kc.length) setCampo(log, iso(d), 'calorias_dia', Math.round(sum(kc)), 'relogio');
        }
      }
    } catch (e) { out.erro = e.message; }
    saveLog(log);
    if (x) {
      try {
        const r = await x.sono({ inicio: Date.now() - 4 * 86400000, fim: Date.now() });
        const porDia = {};
        (r.sessoes || []).forEach(s => { const d = iso(new Date(s.fim)); if (!porDia[d] || (s.fim - s.inicio) > (porDia[d].fim - porDia[d].inicio)) porDia[d] = s; });
        Object.keys(porDia).forEach(d => {
          const s = porDia[d]; const est = (s.estagios || []).map(e => ({ t0: e.inicio, t1: e.fim, tipo: e.tipo }));
          const m = t => est.filter(e => e.tipo === t).reduce((a, e) => a + (e.t1 - e.t0) / MIN, 0);
          const dormMin = est.length ? (m('leve') + m('profundo') + m('rem') + m('dormindo')) : (s.fim - s.inicio) / MIN;
          if (dormMin < 20) return;
          salvarNoite({ id: 'hc' + s.inicio, data: d, fonte: 'relogio', inicio: s.inicio, adormeceu: s.inicio, acordou: s.fim, horas: Math.round(dormMin / 6) / 10,
            sonoMin: Math.round(dormMin), leve: Math.round(m('leve')), profundo: Math.round(m('profundo')), rem: Math.round(m('rem')), acordadoMin: Math.round(m('acordado')),
            despertares: est.filter(e => e.tipo === 'acordado').length, estagios: est.length ? est : [{ t0: s.inicio, t1: s.fim, tipo: 'dormindo' }] });
          out.noites++;
        });
      } catch (e) { out.erroSono = e.message; }
      log = getLog();
      try {
        const r = await x.spo2({ inicio: Date.now() - 86400000, fim: Date.now() });
        const v = (r.amostras || []).map(a => a.pct).filter(Boolean);
        if (v.length) setCampo(log, iso(), 'spo2', Math.round(v.reduce((a, b) => a + b, 0) / v.length), 'relogio');
      } catch (e) { /* sem permissão ou sem dados de SpO2 */ }
    }
    saveLog(log);
    return Object.assign({ ok: true }, out);
  }
  let ultimaMsg = '';
  async function conectarHC() {
    const dizer = t => { ultimaMsg = t; const m = $('dados-msg'); if (m) m.textContent = t; };
    try {
      const h = P('Health'); if (!h) throw new Error('Health Connect só existe no app Android.');
      const av = await h.isAvailable();
      if (!av.available) throw new Error(av.reason || 'Instale o app "Health Connect" na Play Store e tente de novo.');
      dizer('Pedindo permissão (passos, frequência cardíaca, calorias)…');
      const st = await h.requestAuthorization({ read: ['steps', 'heartRate', 'calories'], write: [] });
      if (!st.readAuthorized || !st.readAuthorized.length) throw new Error('Permissão negada no Health Connect.');
      const x = P('HealthExt');
      if (x) { dizer('Pedindo permissão (sono e SpO₂)…'); try { await x.pedir(); } catch (e) { /* segue sem sono do relógio */ } }
      DB.save('hcon', true);
      dizer('Sincronizando…');
      const r = await syncHC(); refrescar();
      dizer('Sincronizado: ' + [r.passos ? r.passos + ' passos hoje' : 'sem passos hoje', r.fc ? 'FC ' + Math.round(r.fc[0]) + '–' + Math.round(r.fc[1]) + ' bpm' : '', r.noites ? r.noites + ' noite(s) de sono' : 'sem sono do relógio'].filter(Boolean).join(' · '));
    } catch (e) { dizer(e.message || String(e)); }
  }

  // ════════════════════════════════════════════════════════════
  //  MONITOR DE SONO (celular)
  // ════════════════════════════════════════════════════════════
  const mon = () => DB.load('sonomon', { rodando: false });
  function janela(html, fechar) {
    const ov = document.createElement('div'); ov.className = 'sa-ov modal'; ov.id = 'dados-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    ov.innerHTML = '<div class="sa-box">' + html + '</div>'; document.body.appendChild(ov); return ov;
  }
  const fecharJanela = () => { const o = $('dados-ov'); if (o) o.remove(); };

  function explicarSono() {
    janela(`<div class="sa-h">🌙 Monitorar meu sono</div>
      <p class="sa-p"><b>Como funciona:</b> deixe o celular na cama ou no criado-mudo (de preferência carregando). Uma notificação fixa avisa que o monitor está ligado.</p>
      <ul class="sa-list"><li><b>Acelerômetro:</b> sente os movimentos da cama.</li>
        <li><b>Microfone (opcional):</b> mede <b>somente o nível de volume</b> (barulho, ronco). O som <b>nunca é gravado</b>, guardado nem enviado: a cada décimo de segundo vira um número e é descartado na hora.</li>
        <li>Tudo é processado <b>no aparelho</b>. Nada sai do celular.</li></ul>
      <label class="sa-row"><input type="checkbox" id="son-mic"> <span>Usar o microfone (só o nível de volume)</span></label>
      <div class="sa-small">Sem o microfone o monitor funciona só com o movimento, com menos detalhes.</div>
      <div class="sa-alert warn">O resultado é uma <b>estimativa pelo celular</b>, não um exame do sono. Para o monitor funcionar com a tela apagada, o Android pede a permissão de atividade física e de notificações.</div>
      <div id="son-erro" class="sa-small" style="color:var(--red)"></div>
      <button class="sa-btn green" id="son-go">Começar a monitorar</button><button class="sa-btn sec" id="son-x">Agora não</button>`);
    $('son-x').onclick = fecharJanela;
    $('son-go').onclick = async () => {
      const usaMic = $('son-mic').checked; $('son-go').disabled = true; $('son-erro').textContent = '';
      try {
        const r = await P('Sono').iniciar({ mic: usaMic });
        DB.save('sonomon', { rodando: true, inicio: r.inicio || Date.now(), mic: !!r.mic, avisou: false });
        fecharJanela(); renderSono();
      } catch (e) { $('son-erro').textContent = e.message || String(e); $('son-go').disabled = false; }
    };
  }

  async function terminarSono(fimTs) {
    const s = mon();
    let epocas = [];
    try { const r = await P('Sono').parar(); epocas = r.epocas || []; } catch (e) { }
    const an = analisarSono(epocas, s.inicio, fimTs || null);
    DB.save('sonomon', { rodando: false });
    if (an.erro) { janela(`<div class="sa-h">Monitor encerrado</div><div class="sa-alert warn">${esc(an.erro)}</div><button class="sa-btn" id="son-ok">Ok</button>`); $('son-ok').onclick = fecharJanela; renderSono(); return; }
    const wake = new Date(an.acordou);
    salvarNoite(Object.assign({ id: 'cel' + an.inicio, data: iso(wake), fonte: 'celular' }, an));
    try { await P('Sono').limpar(); } catch (e) { }
    refrescar();
  }

  async function checarAcordou() {
    const s = mon(); if (!s.rodando || s.avisou || !P('Sono')) return;
    try {
      const r = await P('Sono').estado();
      if (!r.rodando) { DB.save('sonomon', { rodando: false }); renderSono(); return; }
      const an = analisarSono(r.epocas || [], s.inicio, null);
      if (an.erro) return;
      const agora = Date.now();
      // detecção automática: dormiu há 3h+ e os últimos 20 min estão (quase) todos acordados
      const ult = (r.epocas || []).filter(e => e.t > agora - 20 * MIN);
      const ativos = ult.filter(e => e.mov > 0.04).length;
      if (agora - an.adormeceu >= 3 * 3600000 && ult.length >= 15 && ativos / ult.length >= 0.6) {
        DB.save('sonomon', Object.assign({}, s, { avisou: true }));
        janela(`<div class="sa-h">☀️ Parece que você acordou</div>
          <p class="sa-p">O celular sentiu movimento contínuo. Estimativa: você acordou às <b>${hhmm(an.acordou)}</b> (dormiu às ${hhmm(an.adormeceu)}).</p>
          <button class="sa-btn green" id="son-sim">Salvar a noite</button><button class="sa-btn sec" id="son-nao">Ainda estou dormindo</button>`);
        $('son-sim').onclick = async () => { fecharJanela(); await terminarSono(an.acordou); };
        $('son-nao').onclick = fecharJanela;
      }
    } catch (e) { }
  }

  // ── gráfico da noite ──
  const COR = { acordado: '#F87171', leve: '#60A5FA', profundo: '#A78BFA', rem: '#F472B6', dormindo: '#60A5FA' };
  function hipnograma(n) {
    const linhas = n.fonte === 'relogio' && n.estagios.some(s => s.tipo === 'rem') ? ['acordado', 'rem', 'leve', 'profundo'] : ['acordado', 'leve', 'profundo'];
    if (n.estagios.every(s => s.tipo === 'dormindo')) linhas.splice(0, linhas.length, 'dormindo');
    const W = 320, H = 22 + linhas.length * 26, t0 = n.estagios[0].t0, t1 = n.estagios[n.estagios.length - 1].t1, k = (W - 52) / Math.max(1, t1 - t0);
    let g = linhas.map((l, i) => `<text x="0" y="${24 + i * 26}" fill="#9898CC" font-size="9">${{ acordado: 'Acordado', leve: 'Leve', profundo: 'Profundo', rem: 'REM', dormindo: 'Dormindo' }[l]}</text><line x1="50" x2="${W}" y1="${14 + i * 26 + 10}" y2="${14 + i * 26 + 10}" stroke="#2A2A50"/>`).join('');
    n.estagios.forEach(s => { const i = linhas.indexOf(s.tipo); if (i < 0) return; g += `<rect x="${(50 + (s.t0 - t0) * k).toFixed(1)}" y="${14 + i * 26}" width="${Math.max(1.5, (s.t1 - s.t0) * k).toFixed(1)}" height="20" rx="3" fill="${COR[s.tipo]}"/>`; });
    // horas no eixo
    const passo = (t1 - t0) > 6 * 3600000 ? 2 * 3600000 : 3600000;
    for (let t = Math.ceil(t0 / passo) * passo; t <= t1; t += passo) { const x = 50 + (t - t0) * k; g += `<text x="${x.toFixed(1)}" y="${H - 2}" fill="#7878AA" font-size="9" text-anchor="middle">${hhmm(t).slice(0, 2)}h</text>`; }
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Gráfico da noite de sono">${g}</svg>`;
  }

  function renderSono() {
    const el = $('sleep-card'); if (!el) return;
    const s = mon(); const n = melhorNoite(); let h = '';
    if (n && !s.rodando) {
      const fonte = n.fonte === 'relogio' ? 'Relógio (Health Connect)' : 'Estimativa pelo celular';
      h += `<div class="card-header"><span class="card-title">Última noite (${esc(n.data.split('-').reverse().slice(0, 2).join('/'))})</span><span class="badge badge-b">${fonte}</span></div>
        <div style="display:flex;gap:1rem;flex-wrap:wrap;margin:.2rem 0 .6rem">
          <div><div class="hc-val" style="color:var(--purple)">${dur(n.sonoMin)}</div><div class="hc-lbl">de sono</div></div>
          <div><div class="hc-val" style="font-size:1.1rem">${hhmm(n.adormeceu)}</div><div class="hc-lbl">adormeceu</div></div>
          <div><div class="hc-val" style="font-size:1.1rem">${hhmm(n.acordou)}</div><div class="hc-lbl">acordou</div></div>
          <div><div class="hc-val" style="font-size:1.1rem">${n.despertares}</div><div class="hc-lbl">despertares</div></div></div>
        ${hipnograma(n)}
        <div class="small muted" style="margin-top:.4rem;line-height:1.7">${n.leve != null ? '🔵 Leve ' + dur(n.leve) : ''}${n.profundo != null ? ' · 🟣 Profundo ' + dur(n.profundo) : ''}${n.rem ? ' · 🩷 REM ' + dur(n.rem) : ''}${n.acordadoMin != null ? ' · 🔴 Acordado ' + dur(n.acordadoMin) : ''}${n.ruidos ? ' · 🔊 ' + n.ruidos + ' min com barulho' : ''}</div>
        ${n.fonte === 'celular' ? '<div class="tiny muted" style="margin-top:.3rem">As fases leve/profundo são estimadas pelo movimento da cama; não são um exame.</div>' : ''}`;
    } else if (!s.rodando) {
      h += `<div class="card-header"><span class="card-title">Sono</span></div><div class="small muted">Sem dados ainda.${NATIVE() ? ' Toque em "Vou dormir" antes de deitar, ou conecte o relógio no Health Connect.' : ' O monitor de sono funciona no app Android; você também pode digitar as horas dormidas abaixo.'}</div>`;
    }
    if (NATIVE() && P('Sono')) {
      if (s.rodando) {
        h += `<div class="sa-alert ok" style="margin-top:.6rem">🌙 Monitorando desde <b>${hhmm(s.inicio)}</b>${s.mic ? ' (movimento e volume)' : ' (só movimento)'}. Nada é gravado.</div>
          <button class="btn btn-primary" id="son-acordei">☀️ Acordei</button>`;
      } else {
        h += `<button class="btn btn-teal" style="width:100%;margin-top:.7rem" id="son-vou">🌙 Vou dormir (monitorar meu sono)</button>`;
      }
    }
    el.className = 'card'; el.innerHTML = h;
    const a = $('son-acordei'); if (a) a.onclick = () => terminarSono(null);
    const v = $('son-vou'); if (v) v.onclick = explicarSono;
  }

  function renderFontes() {
    const el = $('dados-card'); if (!el) return;
    const ps = passosEstado;
    let h = '<div class="card-header"><span class="card-title">📲 Fontes dos dados</span></div>';
    h += '<div class="small muted" style="line-height:1.7;margin-bottom:.6rem">Cada valor mostra de onde veio: <b>Celular</b>, <b>Relógio (Health Connect)</b> ou <b>Digitado</b>. Quando há relógio, os dados dele valem mais que os do celular.</div>';
    if (NATIVE()) {
      if (ps.disponivel === false) h += '<div class="small muted">Este celular não tem sensor de passos.</div>';
      else if (ps.permissao === false) h += '<button class="btn btn-teal" style="width:100%;margin-bottom:.5rem" id="dados-passos">🚶 Contar passos pelo celular</button><div class="tiny muted" style="margin-bottom:.5rem">O Android vai pedir a permissão de atividade física.</div>';
      else h += '<div class="small" style="margin-bottom:.5rem">🚶 Passos: contando pelo sensor do celular desde a meia-noite.</div>';
      h += `<button class="btn btn-secondary" style="width:100%" id="dados-hc">⌚ ${hcLigado() ? 'Sincronizar o Health Connect' : 'Conectar o relógio (Health Connect)'}</button>`;
      h += '<div class="tiny muted" id="dados-msg" style="margin-top:.5rem;line-height:1.5">' + esc(ultimaMsg) + '</div>';
    } else h += '<div class="small muted">Passos e sono automáticos funcionam no app Android. Aqui você pode digitar os valores.</div>';
    el.className = 'card'; el.innerHTML = h;
    const b = $('dados-passos'); if (b) b.onclick = async () => { await syncPassosCelular(true); refrescar(); };
    const c = $('dados-hc'); if (c) c.onclick = conectarHC;
  }

  async function sync() {
    if (NATIVE()) { await syncPassosCelular(false); if (hcLigado()) await syncHC(); }
    refrescar();
    checarAcordou();
  }

  function montar() {
    const ps = $('p-saude'); if (!ps || $('dados-card')) return;
    const d = document.createElement('div'); d.id = 'dados-card'; ps.insertBefore(d, ps.children[1] || null);
  }

  window.Dados = { analisarSono, sync, conectarHC, syncPassosCelular, setCampo, renderSono, renderFontes, montar, refrescar, hipnograma, getLog, saveLog, getNoites, salvarNoite };
  // início
  window.addEventListener('load', () => { setTimeout(() => { try { if (typeof U !== 'undefined' && U && U.nome) { montar(); sync(); } } catch (e) { } }, 600); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && typeof U !== 'undefined' && U && U.nome) sync(); });
})();
