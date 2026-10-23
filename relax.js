/* FitFlow — Relaxamento guiado (3, 5, 10 e 15 min): imaginação guiada, sons da natureza e música leve.
   Áudio 100% local (funciona sem internet), volumes de voz / música / natureza separados,
   continua com a tela apagada (no app Android, com serviço em primeiro plano) e para sozinho no final.
   A narração vem de arquivos gerados pelo app Narrador (audio/narracao/*.mp3). Sem o arquivo de um trecho,
   o app lê o texto com a voz do aparelho. Sons de fundo: só CC0 / domínio público (audio/CREDITOS.md). */
(function () {
  'use strict';
  const D = window.RELAX_DADOS;
  const $ = id => document.getElementById(id);
  const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const NATIVE = () => !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform());
  const P = n => window.Capacitor && Capacitor.Plugins && Capacitor.Plugins[n];
  const mmss = s => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const ESC_T = () => (typeof window.RELAX_ESCALA === 'number' ? window.RELAX_ESCALA : 1);   // só para teste

  // ── preferências ──
  const PREF0 = { cenario: 'cachoeira', min: 5, vVoz: 90, vMus: 35, vNat: 55, musica: true, natureza: true, depois: 0 };
  const prefs = () => Object.assign({}, PREF0, DB.load('relax_pref', {}));
  const salvarPrefs = p => DB.save('relax_pref', p);

  // ── narração: manifesto + buffers ──
  let manifesto = null;
  async function carregarManifesto() {
    if (manifesto) return manifesto;
    try { const r = await fetch('audio/narracao/manifest.json', { cache: 'no-cache' }); manifesto = r.ok ? await r.json() : { clips: {} }; } catch (e) { manifesto = { clips: {} }; }
    manifesto.clips = manifesto.clips || {}; return manifesto;
  }
  const cacheBuf = new Map();
  async function buffer(ac, url) {
    if (cacheBuf.has(url)) return cacheBuf.get(url);
    const r = await fetch(url); if (!r.ok) throw new Error('áudio não encontrado: ' + url);
    const b = await ac.decodeAudioData(await r.arrayBuffer()); cacheBuf.set(url, b); return b;
  }

  // ── sessão em andamento ──
  let S = null;
  function parar(motivo) {
    if (!S) return; const s = S; S = null;
    clearInterval(s.iv); s.timers.forEach(clearTimeout);
    try { speechSynthesis.cancel(); } catch (e) { }
    try { const t = s.ac.currentTime; [s.eVoz, s.eMus, s.eNat].forEach(g => { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0, t + 0.4); }); setTimeout(() => { try { s.ac.close(); } catch (e) { } }, 600); } catch (e) { }
    if (NATIVE() && P('SessaoAudio')) { try { P('SessaoAudio').parar(); } catch (e) { } }
    s.onFim && s.onFim(motivo);
  }

  async function iniciar(opts, aoMudar, aoFim) {
    if (S) parar('substituída');
    const p = Object.assign(prefs(), opts); const cen = D.CENARIOS.find(c => c.id === p.cenario); if (!cen) throw new Error('cenário inválido');
    const man = await carregarManifesto();
    const dur = {}; Object.keys(man.clips).forEach(k => { dur[k] = man.clips[k].dur; });
    const tl = D.linhaDoTempo(cen, p.min, dur);
    const AC = window.AudioContext || window.webkitAudioContext; const ac = new AC();
    if (ac.state === 'suspended') { try { await ac.resume(); } catch (e) { } }
    const mk = (v, dest) => { const g = ac.createGain(); g.gain.value = v; g.connect(dest); return g; };
    const master = mk(1, ac.destination);
    const uVoz = mk(p.vVoz / 100, master), uMus = mk(p.vMus / 100, master), uNat = mk(p.vNat / 100, master);   // volumes escolhidos pela pessoa
    const eVoz = mk(1, uVoz), eMus = mk(0, uMus), eNat = mk(0, uNat);                                       // envelopes (entrada e saída suaves)
    const kk = ESC_T(), T = tl.total * kk, depoisS = p.depois * 60 * kk, fim = T + depoisS;
    const t0 = ac.currentTime + 0.4;
    S = { ac, uVoz, uMus, uNat, eVoz, eMus, eNat, tl, cen, p, t0, T, fim, timers: [], pausado: false, onFim: aoFim, tts: 0, clips: 0, fonteVoz: 'texto' };
    // sons de fundo em loop
    const sons = []; if (p.natureza) sons.push(...cen.fundo.natureza.map(id => [id, eNat])); if (p.musica) sons.push([cen.fundo.musica, eMus]);
    for (const [id, env] of sons) {
      try { const b = await buffer(ac, `audio/sons/${id}.mp3`); const src = ac.createBufferSource(); src.buffer = b; src.loop = true; src.connect(env); src.start(t0); S.src = (S.src || []).concat(src); }
      catch (e) { S.semSom = (S.semSom || []).concat(id); }
    }
    // entrada suave e saída suave dos fundos (agendadas no relógio do áudio: não dependem de timers da página)
    const ent = tl.fadeEntrada * kk, sai = tl.fadeSaida * kk;
    [eMus, eNat].forEach(g => { g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(1, t0 + ent); g.gain.setValueAtTime(1, t0 + fim - sai); g.gain.linearRampToValueAtTime(0, t0 + fim); });
    // narração: arquivo (preferido) ou voz do aparelho
    let nClips = 0, nTts = 0;
    for (const it of tl.itens) {
      const info = man.clips[it.trecho.id];
      if (info) {
        try { const b = await buffer(ac, 'audio/narracao/' + info.arquivo); const src = ac.createBufferSource(); src.buffer = b; src.connect(eVoz); src.start(t0 + it.t * kk); nClips++; continue; } catch (e) { /* cai no TTS */ }
      }
      nTts++; S.timers.push(setTimeout(() => falarTTS(it.trecho.texto), (it.t * kk) * 1000));
    }
    S.fonteVoz = nClips && !nTts ? 'narrador' : nClips ? 'misto' : 'aparelho'; S.nClips = nClips; S.nTts = nTts;
    // fim
    S.timers.push(setTimeout(() => parar('fim'), (fim + 0.8) * 1000));
    S.iv = setInterval(() => { if (S && aoMudar) aoMudar(estado()); }, 500);
    if (NATIVE() && P('SessaoAudio')) { try { await P('SessaoAudio').iniciar({ titulo: 'Relaxamento: ' + cen.nome, minutos: Math.ceil(fim / 60 / Math.max(kk, 0.001) * kk) }); P('SessaoAudio').addListener('parar', () => parar('notificação')); } catch (e) { } }
    return S;
  }
  function falarTTS(texto) {
    try {
      if (!window.speechSynthesis || !S || S.pausado) return;
      const u = new SpeechSynthesisUtterance(texto.replace(/\/\/\//g, '... ').replace(/\/\//g, ', ')); u.lang = 'pt-BR'; u.rate = 0.82; u.pitch = 0.95; u.volume = Math.max(0, Math.min(1, S.p.vVoz / 100));
      speechSynthesis.speak(u);
    } catch (e) { }
  }
  function estado() {
    if (!S) return null; const dec = S.pausado ? S.pausadoEm - S.t0 : S.ac.currentTime - S.t0;
    return { decorrido: Math.max(0, dec), total: S.fim, narracaoTotal: S.T, fase: dec < 0 ? 'preparando' : dec < S.T ? 'narrando' : 'sons', pausado: S.pausado };
  }
  async function alternarPausa() {
    if (!S) return; if (S.pausado) { await S.ac.resume(); S.pausado = false; } else { S.pausadoEm = S.ac.currentTime; await S.ac.suspend(); S.pausado = true; try { speechSynthesis.cancel(); } catch (e) { } }
  }
  function volume(qual, v) { if (!S) return; const g = { voz: S.uVoz, mus: S.uMus, nat: S.uNat }[qual]; if (g) g.gain.setTargetAtTime(v / 100, S.ac.currentTime, 0.05); }

  // ════════════════════════════════════════════════════════════
  //  INTERFACE
  // ════════════════════════════════════════════════════════════
  function janela(html) { const old = $('rx-ov'); if (old) old.remove(); const ov = document.createElement('div'); ov.className = 'sa-ov modal pa-ov'; ov.id = 'rx-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.innerHTML = '<div class="sa-box">' + html + '</div>'; document.body.appendChild(ov); document.body.classList.add('pa-aberta'); ov.scrollTop = 0; return ov; }
  function fechar() { parar('fechada'); const o = $('rx-ov'); if (o) o.remove(); document.body.classList.remove('pa-aberta'); }
  const slider = (id, rot, v) => `<label class="sa-lbl" for="${id}">${rot}: <b id="${id}-v">${v}%</b></label><input id="${id}" type="range" min="0" max="100" value="${v}" style="width:100%">`;

  async function menu(voltar) {
    const p = prefs(); const man = await carregarManifesto(); const temArquivos = Object.keys(man.clips).length;
    janela(`<div class="sa-h">🧘 Relaxamento guiado</div>
      <p class="sa-p">Imaginação guiada com voz calma, sons da natureza e música leve. Funciona sem internet e com a tela apagada.</p>
      <div class="sa-p"><b>Escolha o lugar</b></div>
      <div class="rx-cenarios" role="radiogroup" aria-label="Cenário">${D.CENARIOS.map(c => `<button class="rx-cen ${c.id === p.cenario ? 'sel' : ''}" data-id="${c.id}" role="radio" aria-checked="${c.id === p.cenario}"><span style="font-size:1.8rem">${c.emoji}</span><br>${esc(c.nome)}</button>`).join('')}</div>
      <div class="sa-p"><b>Duração</b></div>
      <div class="sa-seg" role="radiogroup" aria-label="Duração">${D.DURACOES.map(m => `<button data-m="${m}" class="${m === p.min ? 'on' : ''}" role="radio">${m} min</button>`).join('')}</div>
      <div class="sa-p" style="margin-top:.8rem"><b>Volumes</b> <span class="sa-small">(separados)</span></div>
      ${slider('rx-vv', '🗣️ Voz', p.vVoz)}${slider('rx-vm', '🎵 Música', p.vMus)}${slider('rx-vn', '🌿 Sons da natureza', p.vNat)}
      <label class="sa-row"><input type="checkbox" id="rx-mus" ${p.musica ? 'checked' : ''}> <span>Música leve de fundo</span></label>
      <label class="sa-row"><input type="checkbox" id="rx-nat" ${p.natureza ? 'checked' : ''}> <span>Sons da natureza</span></label>
      <label class="sa-lbl" for="rx-dep">Depois da narração</label>
      <select class="sa-in" id="rx-dep">${[[0, 'Parar sozinho no final'], [15, 'Manter só os sons por mais 15 min e parar'], [30, 'Manter só os sons por mais 30 min e parar'], [60, 'Manter só os sons por mais 60 min e parar']].map(([v, t]) => `<option value="${v}" ${v === p.depois ? 'selected' : ''}>${t}</option>`).join('')}</select>
      <div class="sa-small" style="margin:.4rem 0">${temArquivos ? '🎙️ Narração gravada pelo Narrador (' + temArquivos + ' trechos).' : '🗣️ Sem os arquivos de narração neste aparelho: o app lê o texto com a voz do próprio aparelho.'} Sons: CC0 / domínio público.</div>
      <div class="sa-alert warn">Use deitado ou sentado com conforto, e <b>não durante dirigir ou atividades que exijam atenção</b>. Se sentir tontura ou mal-estar, pare e respire normalmente.</div>
      <button class="sa-btn green" id="rx-go">▶ Começar</button><button class="sa-btn sec" id="rx-v">Voltar</button>`);
    const q = s => document.querySelectorAll('#rx-ov ' + s);
    q('.rx-cen').forEach(b => b.onclick = () => { p.cenario = b.dataset.id; q('.rx-cen').forEach(x => { x.classList.toggle('sel', x === b); x.setAttribute('aria-checked', x === b); }); });
    q('.sa-seg button').forEach(b => b.onclick = () => { p.min = +b.dataset.m; q('.sa-seg button').forEach(x => x.classList.toggle('on', x === b)); });
    [['rx-vv', 'vVoz'], ['rx-vm', 'vMus'], ['rx-vn', 'vNat']].forEach(([id, k]) => { $(id).oninput = e => { p[k] = +e.target.value; $(id + '-v').textContent = p[k] + '%'; }; });
    $('rx-v').onclick = () => { fechar(); if (voltar) voltar(); };
    $('rx-go').onclick = () => { p.musica = $('rx-mus').checked; p.natureza = $('rx-nat').checked; p.depois = +$('rx-dep').value; salvarPrefs(p); tocar(p, voltar); };
  }

  async function tocar(p, voltar) {
    const cen = D.CENARIOS.find(c => c.id === p.cenario);
    janela(`<div class="pa-run"><div class="pa-top"><button class="sa-btn sec pa-peq" id="rx-sair">✕ Encerrar</button><div style="flex:1"><div class="pbar-wrap thick"><div class="pbar" id="rx-prog" style="width:0%;background:var(--teal)"></div></div><div class="tiny muted" id="rx-info">Preparando…</div></div></div>
      <div class="pa-cena"><div class="pa-emoji" aria-hidden="true">${cen.emoji}</div><div class="pa-titulo">${esc(cen.nome)} · ${p.min} min</div><div class="pa-cont" id="rx-tempo" aria-live="off"></div>
        <div class="sa-small" id="rx-fonte"></div></div>
      <div class="rx-vols">${slider('rx-lv', '🗣️ Voz', p.vVoz)}${slider('rx-lm', '🎵 Música', p.vMus)}${slider('rx-ln', '🌿 Natureza', p.vNat)}</div>
      <div class="pa-ctl"><button class="sa-btn sec pa-peq" id="rx-pausa">⏸ Pausar</button></div>
      <div class="sa-small" style="text-align:center">${NATIVE() ? 'Pode apagar a tela: o áudio continua e para sozinho no final.' : 'Mantenha esta página aberta. No app Android o áudio continua com a tela apagada.'}</div></div>`);
    $('rx-sair').onclick = () => { fechar(); if (voltar) voltar(); };
    $('rx-pausa').onclick = async () => { await alternarPausa(); $('rx-pausa').textContent = S && S.pausado ? '▶ Continuar' : '⏸ Pausar'; };
    [['rx-lv', 'voz'], ['rx-lm', 'mus'], ['rx-ln', 'nat']].forEach(([id, k]) => { $(id).oninput = e => { $(id + '-v').textContent = e.target.value + '%'; volume(k, +e.target.value); const pp = prefs(); pp[{ voz: 'vVoz', mus: 'vMus', nat: 'vNat' }[k]] = +e.target.value; salvarPrefs(pp); }; });
    try {
      await iniciar(p, st => {
        if (!st || !$('rx-tempo')) return;
        $('rx-prog').style.width = Math.min(100, st.decorrido / st.total * 100) + '%';
        $('rx-tempo').textContent = mmss(st.total - st.decorrido) + ' restantes';
        $('rx-info').textContent = st.fase === 'narrando' ? 'Narração em andamento' : st.fase === 'sons' ? 'Só os sons, até o fim do timer' : 'Preparando…';
      }, motivo => {
        if (!$('rx-ov')) return;
        if (motivo === 'fim') { janela(`<div class="sa-h">😌 Sessão concluída</div><p class="sa-p">Respire fundo e volte com calma. Obrigado por reservar este tempo.</p><button class="sa-btn green" id="rx-ok">Concluir</button>`); try { if (typeof Shared !== 'undefined') { Shared.addXp(Math.round(p.min * 1.5)); Shared.touchDay(); if (typeof populateUI === 'function') populateUI(); } } catch (e) { } const l = DB.load('relax_log', []); l.unshift({ ts: Date.now(), cenario: p.cenario, min: p.min }); DB.save('relax_log', l.slice(0, 100)); $('rx-ok').onclick = () => { fechar(); if (voltar) voltar(); }; }
      });
      $('rx-fonte').textContent = S.fonteVoz === 'narrador' ? '🎙️ Voz: Narrador' : S.fonteVoz === 'misto' ? '🎙️ Voz: Narrador + voz do aparelho' : '🗣️ Voz: leitura pelo aparelho';
    } catch (e) { janela(`<div class="sa-h">Não consegui iniciar</div><p class="sa-p">${esc(e.message || e)}</p><button class="sa-btn" id="rx-v">Voltar</button>`); $('rx-v').onclick = () => { fechar(); if (voltar) voltar(); }; }
  }

  window.Relax = { menu, iniciar, parar, estado, volume, alternarPausa, _tl: (id, min, dur) => D.linhaDoTempo(D.CENARIOS.find(c => c.id === id), min, dur), _estado: () => S };
})();
