/* FitFlow — Pausa Anti-Estresse + Do-In.
   Sessões guiadas por voz e animação, registro antes/depois, lembretes e sugestão gentil quando o batimento está alto e a pessoa está parada.
   Nunca afirma que a pessoa "está estressada". Prática tradicional de autocuidado: não substitui tratamento. */
(function () {
  'use strict';
  const D = window.PAUSA_DADOS;
  const $ = id => document.getElementById(id);
  const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const NATIVE = () => !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform());
  const P = n => window.Capacitor && Capacitor.Plugins && Capacitor.Plugins[n];
  const pad = n => String(n).padStart(2, '0');
  const hoje = () => { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  const minDoDia = hhmm => { const [h, m] = String(hhmm).split(':').map(Number); return h * 60 + (m || 0); };
  const ESCALA = () => (typeof window.PAUSA_ESCALA === 'number' ? window.PAUSA_ESCALA : 1);
  const reduzMov = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const median = a => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

  // ════════════════════════════════════════════════════════════
  //  CONFIGURAÇÃO E REGISTRO
  // ════════════════════════════════════════════════════════════
  const CFG_PADRAO = { lembrete: { ativo: true, hora: '15:30' }, trabalho: { ini: '08:00', fim: '18:00', uteis: true }, fc: { ativo: true, pct: 20 }, silencioAte: '', sug: { data: '', n: 0, ultima: 0, lembreteDia: '' } };
  const cfg = () => { const c = DB.load('pausa_cfg', {}); return { lembrete: Object.assign({}, CFG_PADRAO.lembrete, c.lembrete), trabalho: Object.assign({}, CFG_PADRAO.trabalho, c.trabalho), fc: Object.assign({}, CFG_PADRAO.fc, c.fc), silencioAte: c.silencioAte || '', sug: Object.assign({}, CFG_PADRAO.sug, c.sug) }; };
  const salvarCfg = c => DB.save('pausa_cfg', c);
  const getLog = () => DB.load('pausa_log', []);
  const SAs = () => (window.SA && SA.state && SA.state()) || {};

  function ctx() {
    const S = SAs();
    const sexoM = typeof U !== 'undefined' && U && U.sexo === 'M';
    return { gravida: sexoM ? false : (S.gravida === undefined ? null : S.gravida), anticoag: S.anticoag === undefined ? null : S.anticoag, conds: S.conds || [] };
  }

  // ════════════════════════════════════════════════════════════
  //  JANELAS
  // ════════════════════════════════════════════════════════════
  function janela(html, cls) {
    fechar(); const ov = document.createElement('div'); ov.className = 'sa-ov modal pa-ov ' + (cls || ''); ov.id = 'pa-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    ov.innerHTML = '<div class="sa-box">' + html + '</div>'; document.body.appendChild(ov); document.body.classList.add('pa-aberta'); ov.scrollTop = 0; return ov;
  }
  function fechar() { pararRun(); const o = $('pa-ov'); if (o) o.remove(); document.body.classList.remove('pa-aberta'); }
  const notaGeral = `<p class="sa-small" style="margin-top:.8rem">${esc(D.AVISO_GERAL)}</p>`;

  // ── avisos por tipo de sessão ──
  function avisosDe(s) {
    let h = '';
    if (s.tipo === 'doin') h += `<div class="sa-alert warn pa-rotulo"><b>${esc(D.ROTULO_DOIN)}</b><br><span class="sa-small">${esc(D.EVIDENCIA_DOIN)}</span><br><span class="sa-small">${esc(D.CUIDADOS_DOIN)}</span></div>`;
    if (s.aviso === 'olhos' || s.tipo === 'olhos') h += `<div class="sa-alert bad pa-aviso-fixo">⚠️ ${esc(D.AVISO_OLHOS)}</div>`;
    if (s.aviso === 'sinusite') h += `<div class="sa-alert bad pa-aviso-fixo">⚠️ ${esc(D.AVISO_SINUSITE)}</div>`;
    if (s.aviso === 'cabeca') h += `<div class="sa-alert bad pa-aviso-fixo">⚠️ Dor de cabeça súbita e muito forte, com fraqueza, fala enrolada, febre com rigidez no pescoço ou depois de uma pancada: ligue 192 ou procure atendimento agora. Isto é só para a dor de tensão de sempre.</div>`;
    return h;
  }

  // ── perguntas de segurança do perfil (gravidez e anticoagulante) ──
  function perguntarPerfil(depois, forcar) {
    const S = SAs(), c = ctx(), sexoM = typeof U !== 'undefined' && U && U.sexo === 'M';
    const falta = [];
    if (!sexoM && (S.gravida === undefined || forcar)) falta.push('gravida');
    if (S.anticoag === undefined || forcar) falta.push('anticoag');
    if (!falta.length) { depois(); return; }
    const q = { gravida: ['Você está grávida (ou pode estar)?', 'Alguns pontos tradicionais, como o IG4, não são indicados na gravidez e ficam escondidos.'], anticoag: ['Você usa anticoagulante ou tem problema de coagulação?', 'Com anticoagulante (por exemplo varfarina ou rivaroxabana) a pressão fica sempre leve.'] };
    janela(`<div class="sa-h">Antes do Do-In</div><p class="sa-p">Duas perguntas rápidas de segurança. Ficam só no seu aparelho.</p>` + falta.map(k => `<div class="sa-q"><div class="t">${q[k][0]}<div class="sa-small">${q[k][1]}</div></div><div class="sa-yn" data-k="${k}"><button data-v="0">NÃO</button><button data-v="1">SIM</button><button data-v="n">Prefiro não dizer</button></div></div>`).join('') + `<button class="sa-btn" id="pq-ok" disabled>Continuar</button>`);
    const resp = {};
    document.querySelectorAll('#pa-ov .sa-yn').forEach(g => g.querySelectorAll('button').forEach(b => b.onclick = () => {
      resp[g.dataset.k] = b.dataset.v === '1' ? true : b.dataset.v === '0' ? false : null;
      g.querySelectorAll('button').forEach(x => x.className = x === b ? (b.dataset.v === '0' ? 'on-no' : 'on-yes') : '');
      $('pq-ok').disabled = !falta.every(k => k in resp);
    }));
    $('pq-ok').onclick = () => { const S2 = SA.state(); falta.forEach(k => { S2[k] = resp[k]; }); DB.save('saude', S2); depois(); };
  }

  // ════════════════════════════════════════════════════════════
  //  MENU
  // ════════════════════════════════════════════════════════════
  const GRUPOS = [['resp', '🌬️ Respiração'], ['licao', '📚 Lições de respiração (uma por dia)'], ['corpo', '🪑 Corpo na cadeira'], ['olhos', '👁️ Cansaço visual'], ['doin', '🤲 Do-In (autoaplicação)'], ['nariz', '👃 Nariz entupido / sinusite']];
  function linhaSessao(s) {
    const passos = D.montarPassos(s, ctx()); const seg = D.duracaoTotal(passos); if (!passos.length) return '';
    return `<div class="sa-row pa-sessao" data-id="${s.id}" role="button" tabindex="0"><div style="font-size:1.5rem">${s.icone}</div><div style="flex:1"><b>${esc(s.titulo)}</b><div class="sa-small">${Math.max(1, Math.round(seg / 60))} min${s.tipo === 'doin' ? ' · tradicional' : ''} · ${esc(s.desc.slice(0, 80))}${s.desc.length > 80 ? '…' : ''}</div></div></div>`;
  }
  function menu() {
    const S = SAs(); const conds = S.conds || [];
    const rapida = [1, 3, 5].map(m => `<button class="sa-btn pa-rap" data-id="resp-coerente-${m}">${m} min</button>`).join('');
    const sessoes = SESSOES_VISIVEIS();
    let h = `<div class="sa-h">🌿 Preciso de uma pausa</div>
      <p class="sa-p">Escolha o tempo. Eu guio a respiração com voz e animação.</p>
      <div class="pa-rapidas">${rapida}</div>`;
    GRUPOS.forEach(([g, nome]) => { const l = g === 'licao' ? linhasLicoes(sessoes) : sessoes.filter(s => s.grupo === g).map(linhaSessao).join(''); if (l) h += `<details class="pa-grupo" ${g === 'doin' || g === 'resp' ? '' : ''}><summary><b>${nome}</b></summary>${l}</details>`; });
    const cs = sessoes.filter(s => s.grupo === 'cond').map(linhaSessao).join('');
    if (cs) h += `<details class="pa-grupo"><summary><b>🌿 Bem-estar para a sua condição</b></summary>${cs}</details>`;
    if (window.Relax) h += `<button class="sa-btn pa-relax" id="pa-relax">🧘 Relaxamento guiado (3, 5, 10 e 15 min)</button>`;
    h += `<div class="pa-rodape"><button class="sa-btn sec" id="pa-hist">📊 O que funciona pra mim</button><button class="sa-btn sec" id="pa-lemb">⏰ Lembretes e sugestões</button><button class="sa-btn sec" id="pa-perfil">🛡️ Segurança do Do-In (gravidez, anticoagulante)</button></div>
      <div class="sa-alert warn pa-rotulo"><b>${esc(D.ROTULO_DOIN)}</b></div>${notaGeral}<button class="sa-btn sec" id="pa-x">Fechar</button>`;
    janela(h);
    document.querySelectorAll('#pa-ov .pa-sessao, #pa-ov .pa-rap').forEach(el => { const go = () => iniciar(el.dataset.id, el.classList.contains('pa-rap')); el.onclick = go; el.onkeydown = e => { if (e.key === 'Enter') go(); }; });
    if ($('pa-relax')) $('pa-relax').onclick = () => Relax.menu(menu);
    $('pa-hist').onclick = historico; $('pa-lemb').onclick = lembretes; $('pa-perfil').onclick = () => perguntarPerfil(menu, true); $('pa-x').onclick = fechar;
  }
  const licoes = () => DB.load('licoes', { feitas: [], ultima: '' });
  function linhasLicoes(sessoes) {
    const L = sessoes.filter(x => x.grupo === 'licao').sort((a, b) => a.licao - b.licao), st = licoes(), feitasHoje = st.ultima === hoje();
    const proxima = L.find(x => !st.feitas.includes(x.id));
    return L.map(x => {
      const feita = st.feitas.includes(x.id), liberada = feita || (x === proxima && !feitasHoje);
      if (liberada) return linhaSessao(x).replace('class="sa-row pa-sessao"', 'class="sa-row pa-sessao' + (feita ? ' pa-feita' : '') + '"').replace('<b>', (feita ? '✅ ' : '▶ ') + '<b>');
      return `<div class="sa-row pa-trancada" aria-disabled="true"><div style="font-size:1.5rem">🔒</div><div style="flex:1"><b>${esc(x.titulo)}</b><div class="sa-small">${x === proxima ? 'Liberada amanhã: uma lição por dia.' : 'Libera quando você concluir a anterior.'}</div></div></div>`;
    }).join('');
  }
  function SESSOES_VISIVEIS() {
    const conds = SAs().conds || [];
    return D.SESSOES.filter(s => !s.oculta && (s.grupo !== 'cond' || conds.includes(s.cond)));
  }

  // ════════════════════════════════════════════════════════════
  //  EXECUÇÃO DA SESSÃO
  // ════════════════════════════════════════════════════════════
  let run = null;
  function pararRun() { if (run) { clearInterval(run.iv); run = null; } try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) { } }
  const falar = t => { try { if (typeof say === 'function') say(t); } catch (e) { } };
  const bip = (f, d) => { try { if (typeof beep === 'function') beep(f || 660, d || 0.08, 0.2); } catch (e) { } };
  function notas0a10(id, rotulo) {
    return `<div class="sa-small" style="margin:.4rem 0">${rotulo}</div><div class="sa-rpe-row pa-nota" id="${id}" role="group" aria-label="${rotulo}">${Array.from({ length: 11 }, (_, i) => `<button data-n="${i}" style="background:${['#9ae6b4', '#9ae6b4', '#c6f6a0', '#e9f58a', '#fbe66b', '#fbbf4a', '#fb923c', '#f87171', '#ef4444', '#dc2626', '#b91c1c'][i]}">${i}</button>`).join('')}</div>`;
  }
  function ligarNota(id, aoEscolher) {
    const g = $(id); if (!g) return;
    g.querySelectorAll('button').forEach(b => b.onclick = () => { g.querySelectorAll('button').forEach(x => x.classList.toggle('sel', x === b)); aoEscolher(+b.dataset.n); });
  }

  function iniciar(id, direto) {
    const s = D.SESSOES.find(x => x.id === id); if (!s) return;
    if (direto && s.tipo === 'resp') { rodar(s, D.montarPassos(s, ctx()), null); return; }   // 2 toques: botão da pausa + tempo
    const comPonto = s.passos.some(p => p.t === 'ponto');
    const seguir = () => {
      const passos = D.montarPassos(s, ctx());
      if (!passos.length) { janela(`<div class="sa-h">Sem passos para você</div><p class="sa-p">Pelos seus dados de segurança, os pontos desta sessão estão escondidos. Escolha outra sessão.</p><button class="sa-btn" id="pa-v">Voltar</button>`); $('pa-v').onclick = menu; return; }
      const seg = D.duracaoTotal(passos);
      janela(`<div class="sa-h">${s.icone} ${esc(s.titulo)}</div><p class="sa-p">${esc(s.desc)}</p><p class="sa-small">Duração: cerca de ${Math.max(1, Math.round(seg / 60))} min. Sente-se com conforto.</p>
        ${avisosDe(s)}
        ${notas0a10('pa-antes', s.tipo === 'doin' || s.grupo === 'cond' ? 'Como está a tensão ou dor agora? (0 = nada, 10 = muito) — opcional' : 'Como está a sua tensão agora? (0 = nada, 10 = muito) — opcional')}
        <button class="sa-btn green" id="pa-go">▶ Começar</button><button class="sa-btn sec" id="pa-v">Voltar</button>`);
      let antes = null; ligarNota('pa-antes', n => { antes = n; });
      $('pa-v').onclick = menu; $('pa-go').onclick = () => rodar(s, passos, antes);
    };
    if (comPonto) perguntarPerfil(seguir); else seguir();
  }

  function rodar(s, passos, antes) {
    const total = passos.reduce((a, p) => a + p.dur, 0) * ESCALA();
    janela(`<div class="pa-run">
      <div class="pa-top"><button class="sa-btn sec pa-peq" id="pa-sair">✕ Sair</button><div style="flex:1"><div class="pbar-wrap thick"><div class="pbar" id="pa-prog" style="width:0%;background:var(--teal)"></div></div><div class="tiny muted" id="pa-etapa"></div></div></div>
      <div id="pa-cena" class="pa-cena" aria-live="polite"></div>
      <div class="pa-ctl"><button class="sa-btn sec pa-peq" id="pa-pausa">⏸ Pausar</button><button class="sa-btn sec pa-peq" id="pa-pular">Pular ⏭</button></div>
      <div class="pa-avisos">${s.tipo === 'doin' ? `<div class="sa-small pa-rotulo-peq">${esc(D.ROTULO_DOIN)}</div>` : ''}${s.aviso === 'olhos' || s.tipo === 'olhos' ? `<div class="sa-small" style="color:#ffb3b3">⚠️ ${esc(D.AVISO_OLHOS)}</div>` : ''}${s.aviso === 'sinusite' ? `<div class="sa-small" style="color:#ffb3b3">⚠️ ${esc(D.AVISO_SINUSITE)}</div>` : ''}</div></div>`, 'pa-tela');
    run = { s, passos, i: -1, antes, fim: 0, restante: 0, pausado: false, iniMs: Date.now(), pausaMs: 0, faseAtual: -1, ciclos: 0, lado: 0, concluidos: 0 };
    $('pa-sair').onclick = () => { if (confirm('Encerrar a sessão agora?')) { const r = run; pararRun(); finalizar(r, false); } };
    $('pa-pausa').onclick = () => {
      if (!run) return; run.pausado = !run.pausado;
      if (run.pausado) { run.restante = run.fim - Date.now(); run.pausadoEm = Date.now(); $('pa-pausa').textContent = '▶ Continuar'; try { speechSynthesis.cancel(); } catch (e) { } }
      else { run.fim = Date.now() + run.restante; run.pausaMs += Date.now() - run.pausadoEm; $('pa-pausa').textContent = '⏸ Pausar'; }
    };
    $('pa-pular').onclick = () => { if (run) proximo(); };
    proximo(); run.iv = setInterval(tick, 150);
  }

  function cenaDe(p) {
    if (p.t === 'resp') return `<div class="pa-circ"><div class="pa-bola" id="pa-bola"></div></div><div class="pa-fase" id="pa-fase">Prepare-se</div><div class="pa-cont" id="pa-cont"></div><div class="sa-small" style="text-align:center">${esc(D.PADROES[p.padrao].nome)}</div>`;
    if (p.t === 'txt') return `<div class="pa-emoji" aria-hidden="true">${p.emoji}</div><div class="pa-titulo">${esc(p.titulo)}</div><div class="pa-texto">${esc(p.texto)}</div><div class="pa-cont" id="pa-cont"></div>`;
    const pt = D.PONTOS[p.ponto], pr = D.pressaoDoPonto(p.ponto, ctx());
    return `<div class="pa-figwrap">${D.figuraPonto(p.ponto)}</div><div class="pa-titulo">${esc(pt.nome)}${pt.rotuloFig ? ' <span class="sa-small">(' + esc(pt.rotuloFig) + ')</span>' : ''}</div>
      <div class="pa-texto"><b>Onde:</b> ${esc(pt.local)}<br><b>Como:</b> ${esc(pt.como)}</div>
      <div class="pa-pressao pa-p-${pr.nivel}">🤏 ${esc(pr.txt)} · ${pt.seg}s${pt.lados === 2 ? ' de cada lado' : ''}</div>
      ${pt.grav ? '<div class="sa-small" style="color:var(--yellow)">Não indicado na gravidez.</div>' : ''}
      <div class="pa-lado" id="pa-lado">${pt.lados === 2 ? 'Lado 1 de 2' : ''}</div><div class="pa-cont" id="pa-cont"></div>`;
  }

  function proximo() {
    if (!run) return;
    if (run.i >= 0) run.concluidos++;
    run.i++;
    if (run.i >= run.passos.length) { const r = run; pararRun(); finalizar(r, true); return; }
    const p = run.passos[run.i];
    $('pa-cena').innerHTML = cenaDe(p);
    $('pa-etapa').textContent = `Etapa ${run.i + 1} de ${run.passos.length}`;
    run.dur = p.dur * ESCALA() * 1000; run.fim = Date.now() + run.dur; run.restante = run.dur; run.faseAtual = -1; run.ciclos = 0; run.lado = 0;
    if (p.t === 'txt') falar(p.fala); else if (p.t === 'ponto') { const pt = D.PONTOS[p.ponto], pr = D.pressaoDoPonto(p.ponto, ctx()); falar(`${pt.nome.split('·').pop().trim()}. ${pt.local} ${pt.como} ${pr.txt}.`); }
    else if (p.t === 'resp') falar('Vamos respirar juntos. ' + D.PADROES[p.padrao].nota);
    bip(520, 0.12);
  }

  function tick() {
    if (!run || run.pausado) return;
    const agora = Date.now(), p = run.passos[run.i], restMs = run.fim - agora;
    const feitoDosPassos = run.passos.slice(0, run.i).reduce((a, x) => a + x.dur * ESCALA() * 1000, 0) + (run.dur - Math.max(0, restMs));
    const totalMs = run.passos.reduce((a, x) => a + x.dur * ESCALA() * 1000, 0);
    const prog = $('pa-prog'); if (prog) prog.style.width = Math.min(100, feitoDosPassos / totalMs * 100) + '%';
    const cont = $('pa-cont'); if (cont && p.t !== 'resp') cont.textContent = Math.max(0, Math.ceil(restMs / 1000 / Math.max(ESCALA(), 0.001) * ESCALA())) + ' s';
    if (p.t === 'resp') {
      const pad_ = D.PADROES[p.padrao], cicloMs = pad_.ciclo.reduce((a, f) => a + f[1], 0) * 1000 * ESCALA(), dec = (run.dur - restMs);
      const noCiclo = dec % cicloMs; let acc = 0, idx = 0;
      for (let k = 0; k < pad_.ciclo.length; k++) { acc += pad_.ciclo[k][1] * 1000 * ESCALA(); if (noCiclo < acc) { idx = k; break; } }
      const cicloNum = Math.floor(dec / cicloMs); const chave = cicloNum * 10 + idx;
      if (chave !== run.faseAtual) {
        run.faseAtual = chave; const [nome, seg, escala] = pad_.ciclo[idx];
        const bola = $('pa-bola'); if (bola) { bola.style.transition = reduzMov() ? 'none' : `transform ${seg * ESCALA()}s ease-in-out, background .5s`; bola.style.transform = `scale(${0.45 + escala * 0.55})`; bola.dataset.fase = nome; }
        const f = $('pa-fase'); if (f) f.textContent = nome;
        if (cicloNum < 3 || idx === 0) falar(nome); else bip(idx === 0 ? 700 : 520, 0.05);
      }
      const c = $('pa-cont'); if (c) c.textContent = Math.max(0, Math.ceil(restMs / 1000 / Math.max(ESCALA(), 0.001) * ESCALA())) + ' s';
    }
    if (p.t === 'ponto' && D.PONTOS[p.ponto].lados === 2 && run.lado === 0 && restMs < run.dur / 2) {
      run.lado = 1; const l = $('pa-lado'); if (l) l.textContent = 'Lado 2 de 2: troque de lado'; falar('Agora o outro lado.'); bip(660, 0.15);
    }
    if (restMs <= 0) proximo();
  }

  // ── fim da sessão ──
  function finalizar(r, completa) {
    const seg = Math.round((Date.now() - r.iniMs - r.pausaMs) / 1000);
    if (!completa && r.concluidos < 1) { menu(); return; }
    let xp = 0;
    if (completa && r.s.grupo === 'licao') { const st = licoes(); if (!st.feitas.includes(r.s.id)) st.feitas.push(r.s.id); st.ultima = hoje(); DB.save('licoes', st); }
    if (completa) { xp = r.s.xp || 10; try { if (typeof Shared !== 'undefined') { Shared.addXp(xp); Shared.touchDay(); } if (typeof populateUI === 'function') populateUI(); } catch (e) { } falar('Sessão concluída. Muito bem.'); bip(880, 0.2); }
    let depois = null;
    janela(`<div class="sa-h">${completa ? '✅ Pronto!' : 'Sessão encerrada'}</div>
      <p class="sa-p">${completa ? 'Você concluiu ' + esc(r.s.titulo) + '.' : 'Você fez parte da sessão.'} ${xp ? '<b>+' + xp + ' XP</b> (compartilhado com o Escoteiro).' : ''}</p>
      ${notas0a10('pa-depois', 'E agora, como está a tensão ou dor? (0 = nada, 10 = muito) — opcional')}
      <div class="sa-small" id="pa-cmp"></div>
      <button class="sa-btn green" id="pa-fim">Concluir</button>`);
    ligarNota('pa-depois', n => { depois = n; $('pa-cmp').textContent = r.antes != null ? (n < r.antes ? `Antes ${r.antes}, agora ${n}: melhorou ${r.antes - n} ponto(s).` : n === r.antes ? `Antes ${r.antes}, agora ${n}: igual.` : `Antes ${r.antes}, agora ${n}: subiu. Tudo bem, às vezes leva um tempo; se estiver desconfortável, descanse.`) : ''; });
    $('pa-fim').onclick = () => {
      const l = getLog(); l.unshift({ ts: Date.now(), sessao: r.s.id, titulo: r.s.titulo, tipo: r.s.tipo, antes: r.antes, depois, seg, completa: !!completa }); DB.save('pausa_log', l.slice(0, 200)); fechar();
    };
  }

  // ════════════════════════════════════════════════════════════
  //  HISTÓRICO: o que funciona pra mim
  // ════════════════════════════════════════════════════════════
  function resumoFunciona(log) {
    const por = {};
    log.filter(x => x.antes != null && x.depois != null).forEach(x => { const o = (por[x.sessao] = por[x.sessao] || { titulo: x.titulo, n: 0, soma: 0 }); o.n++; o.soma += x.antes - x.depois; });
    return Object.values(por).map(o => ({ titulo: o.titulo, n: o.n, media: o.soma / o.n })).sort((a, b) => b.media - a.media);
  }
  function historico() {
    const log = getLog(), res = resumoFunciona(log);
    janela(`<div class="sa-h">📊 O que funciona pra mim</div>
      ${res.length ? '<p class="sa-p">Média de quanto a tensão ou dor <b>diminuiu</b> (antes − depois, de 0 a 10), por sessão. É só para você observar; não é diagnóstico.</p>' + res.map(r => `<div class="md-linha"><span>${esc(r.titulo)}</span><b style="color:${r.media > 0 ? 'var(--green)' : 'var(--muted2)'}">${r.media > 0 ? '−' : r.media < 0 ? '+' : ''}${Math.abs(r.media).toFixed(1)}</b><span class="tiny muted">${r.n}×${r.n < 3 ? ' (poucas vezes)' : ''}</span></div>`).join('') : '<p class="sa-p">Sem dados ainda. Anote "antes" e "depois" nas sessões para ver o que ajuda você.</p>'}
      <div class="h2" style="margin-top:1rem">Últimas sessões</div>
      ${log.slice(0, 10).map(x => `<div class="md-linha"><span>${new Date(x.ts).toLocaleDateString('pt-BR')} ${esc(x.titulo)}</span><span class="tiny muted">${x.antes != null ? x.antes : '–'} → ${x.depois != null ? x.depois : '–'}</span></div>`).join('') || '<div class="small muted">Sem dados ainda.</div>'}
      <button class="sa-btn sec" id="pa-v">Voltar</button>`);
    $('pa-v').onclick = menu;
  }

  // ════════════════════════════════════════════════════════════
  //  LEMBRETES E SUGESTÕES (no máximo 3 por dia)
  // ════════════════════════════════════════════════════════════
  const MAX_DIA = 3, INTERVALO_MIN = 90;
  function podeSugerir(agora, c, estado) {
    const d = new Date(agora), dia = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    if (c.silencioAte && c.silencioAte >= dia) return { ok: false, motivo: 'silenciado' };
    const dow = d.getDay(); if (c.trabalho.uteis && (dow === 0 || dow === 6)) return { ok: false, motivo: 'fim de semana' };
    const m = d.getHours() * 60 + d.getMinutes();
    if (m < minDoDia(c.trabalho.ini) || m > minDoDia(c.trabalho.fim)) return { ok: false, motivo: 'fora do horário' };
    const n = c.sug.data === dia ? c.sug.n : 0;
    if (n >= MAX_DIA) return { ok: false, motivo: 'limite do dia' };
    if (c.sug.ultima && agora - c.sug.ultima < INTERVALO_MIN * 60000) return { ok: false, motivo: 'muito perto da última' };
    if (estado && (estado.treinando || estado.dormindo)) return { ok: false, motivo: 'ocupado' };
    return { ok: true };
  }
  const estadoAtual = () => ({ treinando: typeof timerRunning !== 'undefined' && timerRunning, dormindo: !!(DB.load('sonomon', {}).rodando) });
  function registrarSugestao() { const c = cfg(), dia = hoje(); c.sug.n = (c.sug.data === dia ? c.sug.n : 0) + 1; c.sug.data = dia; c.sug.ultima = Date.now(); salvarCfg(c); }

  function sugerir(motivo) {
    const c = cfg(); const v = podeSugerir(Date.now(), c, estadoAtual()); if (!v.ok) return false;
    registrarSugestao();
    const msg = motivo === 'fc' ? 'Seu batimento está alto e você está parado. Quer uma pausa de 2 minutos?' : 'Hora de uma pausa rápida? Dois minutos de respiração podem ajudar.';
    janela(`<div class="sa-h">🌿 Pausa?</div><p class="sa-p">${msg}</p>${motivo === 'fc' ? '<div class="sa-small">Pode ser café, calor, susto, remédio ou doença: isto não é um diagnóstico. Se sentir dor no peito, falta de ar ou mal-estar, use o botão de socorro.</div>' : ''}
      <button class="sa-btn green" id="sg-sim">Sim, 2 minutos</button><button class="sa-btn sec" id="sg-nao">Agora não</button><button class="sa-btn sec" id="sg-hoje">Não sugerir mais hoje</button>`);
    $('sg-sim').onclick = () => iniciarDoisMin();
    $('sg-nao').onclick = fechar;
    $('sg-hoje').onclick = () => { const c2 = cfg(); c2.silencioAte = hoje(); salvarCfg(c2); fechar(); };
    try { if (NATIVE() && typeof beep === 'function') beep(520, 0.1, 0.2); } catch (e) { }
    return true;
  }
  function iniciarDoisMin() {
    if (!D.SESSOES.find(s => s.id === 'resp-coerente-2')) D.SESSOES.push({ id: 'resp-coerente-2', grupo: 'resp', icone: '🌬️', titulo: 'Respiração coerente (2 min)', min: 2, desc: D.PADROES.coerente.nota, tipo: 'resp', passos: [{ t: 'resp', padrao: 'coerente', dur: 120 }], xp: 8, oculta: true });
    iniciar('resp-coerente-2');
  }

  // ── gatilho pelo batimento: FC acima da média pessoal, parado, por alguns minutos ──
  const BASE_MIN_AMOSTRAS = 40, BASE_MIN_DIAS = 3, CONFIRMACOES = 2, ESPERA_APOS_SUG_MIN = 120;
  function baseline(amostras) {
    const lim = Date.now() - 14 * 86400000, v = amostras.filter(a => a.t >= lim);
    const dias = new Set(v.map(a => a.d)); if (v.length < BASE_MIN_AMOSTRAS || dias.size < BASE_MIN_DIAS) return null;
    return median(v.map(a => a.bpm));
  }
  function avaliarGatilho(o) {
    // o: { mediana (bpm nos últimos ~5 min), base, pct, passosDelta (passos no mesmo intervalo), confirmacoes, ocupado }
    if (!o.base) return { disparar: false, motivo: 'aprendendo', confirmacoes: 0 };
    if (o.ocupado) return { disparar: false, motivo: 'ocupado', confirmacoes: 0 };
    if (o.passosDelta == null || o.passosDelta >= 15) return { disparar: false, motivo: 'em movimento', confirmacoes: 0 };
    const alto = o.mediana >= o.base * (1 + o.pct / 100) && (o.mediana - o.base) >= 10;
    if (!alto) return { disparar: false, motivo: 'normal', confirmacoes: 0 };
    const conf = (o.confirmacoes || 0) + 1;
    return { disparar: conf >= CONFIRMACOES, motivo: 'alto e parado', confirmacoes: conf };
  }
  const fcEstado = { buf: [], passos: [], conf: 0, ultimaAval: 0, ultimaFC: 0 };
  async function lerFC() {
    if (typeof HR !== 'undefined' && HR.connected && HR.bpm) return HR.bpm;                       // Bluetooth ao vivo
    if (DB.load('hcon', false) && P('Health')) {                                                 // Health Connect (últimos 10 min)
      try { const r = await P('Health').readSamples({ dataType: 'heartRate', startDate: new Date(Date.now() - 10 * 60000).toISOString(), endDate: new Date().toISOString(), limit: 50 }); const v = (r.samples || []).map(s => s.value).filter(Boolean); if (v.length) return Math.round(median(v)); } catch (e) { }
    }
    return null;
  }
  async function lerPassos() { const p = P('Passos'); if (!p) return null; try { const r = await p.hoje(); return r.permissao === false ? null : r.passos; } catch (e) { return null; } }

  async function tickFC(forcado) {
    const c = cfg(); if (!c.fc.ativo || !NATIVE()) return;
    const agora = Date.now(); if (!forcado && agora - fcEstado.ultimaAval < 5 * 60000) return; fcEstado.ultimaAval = agora;
    const bpm = await lerFC(); const passos = await lerPassos();
    if (bpm == null || passos == null) return;
    fcEstado.buf.push({ t: agora, bpm }); fcEstado.passos.push({ t: agora, n: passos });
    fcEstado.buf = fcEstado.buf.filter(x => agora - x.t < 15 * 60000); fcEstado.passos = fcEstado.passos.filter(x => agora - x.t < 15 * 60000);
    const janela5 = fcEstado.buf.filter(x => agora - x.t <= 6 * 60000);
    const ref = fcEstado.passos.find(x => agora - x.t <= 6 * 60000 && agora - x.t >= 4 * 60000) || fcEstado.passos[0];
    const delta = ref && ref.t < agora ? passos - ref.n : null;
    const est = estadoAtual(); const treinoRecente = typeof U !== 'undefined' && U && U.lastWorkout && (agora - new Date(U.lastWorkout).getTime()) < 40 * 60000;
    const ocupado = est.treinando || est.dormindo || treinoRecente || (agora - (c.sug.ultima || 0)) < ESPERA_APOS_SUG_MIN * 60000;
    const parado = delta != null && delta < 15;
    const amostras = DB.load('fcbase', []);
    if (parado && !ocupado && !est.treinando) { amostras.push({ t: agora, d: hoje(), bpm: Math.round(median(janela5.map(x => x.bpm).concat([bpm]))) }); DB.save('fcbase', amostras.slice(-600)); }
    const r = avaliarGatilho({ mediana: median(janela5.map(x => x.bpm)), base: baseline(amostras.slice(0, -1)), pct: c.fc.pct, passosDelta: delta, confirmacoes: fcEstado.conf, ocupado });
    fcEstado.conf = r.confirmacoes;
    if (r.disparar) { fcEstado.conf = 0; sugerir('fc'); }
    return r;
  }

  // ── lembrete diário (dentro do app e, no Android, notificação agendada) ──
  function tickLembrete() {
    const c = cfg(); if (!c.lembrete.ativo) return;
    const d = new Date(), m = d.getHours() * 60 + d.getMinutes(), dia = hoje();
    if (c.sug.lembreteDia === dia) return;
    if (m >= minDoDia(c.lembrete.hora) && m <= minDoDia(c.lembrete.hora) + 60) {
      if (podeSugerir(Date.now(), c, estadoAtual()).ok) { const c2 = cfg(); c2.sug.lembreteDia = dia; salvarCfg(c2); sugerir('lembrete'); }
    }
  }
  async function agendarNativo() {
    const ln = P('LocalNotifications'); if (!ln || !NATIVE()) return { ok: false };
    const c = cfg();
    try {
      for (let id = 7101; id <= 7107; id++) await ln.cancel({ notifications: [{ id }] });
      if (!c.lembrete.ativo) return { ok: true, agendado: 0 };
      let perm = await ln.checkPermissions(); if (perm.display !== 'granted') perm = await ln.requestPermissions();
      if (perm.display !== 'granted') return { ok: false, motivo: 'sem permissão de notificação' };
      try { await ln.createChannel({ id: 'pausa', name: 'Pausa anti-estresse', description: 'Lembrete gentil de pausa', importance: 3, visibility: 1 }); } catch (e) { }
      const [h, mi] = c.lembrete.hora.split(':').map(Number);
      const m = h * 60 + mi; if (m < minDoDia(c.trabalho.ini) || m > minDoDia(c.trabalho.fim)) return { ok: false, motivo: 'horário fora da janela de trabalho' };
      const dias = c.trabalho.uteis ? [2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6, 7];   // 1 = domingo
      await ln.schedule({ notifications: dias.map((wd, i) => ({ id: 7101 + wd - 1, title: 'Hora de uma pausa?', body: 'Dois minutos de respiração podem ajudar. Toque para começar.', channelId: 'pausa', schedule: { on: { weekday: wd, hour: h, minute: mi }, allowWhileIdle: true } })) });
      return { ok: true, agendado: dias.length };
    } catch (e) { return { ok: false, motivo: e.message || String(e) }; }
  }

  function lembretes() {
    const c = cfg(), nBase = DB.load('fcbase', []), dias = new Set(nBase.map(a => a.d)).size;
    janela(`<div class="sa-h">⏰ Lembretes e sugestões</div>
      <p class="sa-p">No máximo <b>${MAX_DIA} sugestões por dia</b>, só dentro do horário de trabalho e nunca durante treino ou sono.</p>
      <label class="sa-row"><input type="checkbox" id="lm-on" ${c.lembrete.ativo ? 'checked' : ''}> <span>Lembrete diário de pausa</span></label>
      <label class="sa-lbl" for="lm-h">Horário do lembrete</label><input class="sa-in" id="lm-h" type="time" value="${c.lembrete.hora}">
      <div class="sa-p"><b>Horário de trabalho</b> <span class="sa-small">(só sugiro dentro dele)</span></div>
      <div class="form-grid"><div class="field"><label>Início</label><input id="lm-ti" type="time" value="${c.trabalho.ini}"></div><div class="field"><label>Fim</label><input id="lm-tf" type="time" value="${c.trabalho.fim}"></div></div>
      <label class="sa-row"><input type="checkbox" id="lm-ut" ${c.trabalho.uteis ? 'checked' : ''}> <span>Só em dias úteis (seg a sex)</span></label>
      <hr style="border-color:var(--border);margin:1rem 0">
      <label class="sa-row"><input type="checkbox" id="lm-fc" ${c.fc.ativo ? 'checked' : ''}> <span>Sugerir uma pausa quando meu batimento estiver bem acima do meu normal, <b>e eu estiver parado</b> (precisa de relógio ou cinta e do app Android)</span></label>
      <label class="sa-lbl" for="lm-pct">Quanto acima da minha média: <b id="lm-pv">${c.fc.pct}%</b></label><input id="lm-pct" type="range" min="10" max="40" step="5" value="${c.fc.pct}" style="width:100%">
      <div class="sa-small">${!NATIVE() ? 'Disponível no app Android. ' : ''}Aprendendo o seu normal: ${nBase.length} leituras em ${dias} dia(s) (preciso de pelo menos ${BASE_MIN_AMOSTRAS} em ${BASE_MIN_DIAS} dias). Só funciona com o app aberto, olhando o batimento e o sensor de passos. Eu nunca digo que você está estressado: só ofereço a pausa.</div>
      <div class="sa-small" id="lm-msg" style="color:var(--yellow)"></div>
      <button class="sa-btn green" id="lm-ok">Salvar</button><button class="sa-btn sec" id="lm-v">Voltar</button>`);
    $('lm-pct').oninput = e => { $('lm-pv').textContent = e.target.value + '%'; };
    $('lm-v').onclick = menu;
    $('lm-ok').onclick = async () => {
      const n = cfg(); n.lembrete.ativo = $('lm-on').checked; n.lembrete.hora = $('lm-h').value || '15:30'; n.trabalho.ini = $('lm-ti').value || '08:00'; n.trabalho.fim = $('lm-tf').value || '18:00'; n.trabalho.uteis = $('lm-ut').checked; n.fc.ativo = $('lm-fc').checked; n.fc.pct = +$('lm-pct').value;
      if (minDoDia(n.lembrete.hora) < minDoDia(n.trabalho.ini) || minDoDia(n.lembrete.hora) > minDoDia(n.trabalho.fim)) { $('lm-msg').textContent = 'O horário do lembrete precisa estar dentro do horário de trabalho.'; return; }
      salvarCfg(n); const r = await agendarNativo();
      $('lm-msg').textContent = r.ok ? (NATIVE() ? 'Salvo. Notificação agendada no Android.' : 'Salvo.') : (r.motivo ? 'Salvo, mas: ' + r.motivo : 'Salvo.');
    };
  }

  // ════════════════════════════════════════════════════════════
  //  MONTAGEM NA TELA
  // ════════════════════════════════════════════════════════════
  function montar() {
    const bar = $('sa-bar');
    if (bar && !$('pa-btn')) {
      const b = document.createElement('button'); b.id = 'pa-btn'; b.type = 'button'; b.className = 'sa-pausa-bar'; b.innerHTML = '🌿 Preciso de uma pausa'; b.onclick = menu; bar.insertBefore(b, bar.children[1] || null);
    }
    const home = $('p-home');
    if (home && !$('pa-card')) {
      const d = document.createElement('div'); d.id = 'pa-card'; d.className = 'card';
      d.innerHTML = `<div class="card-header"><span class="card-title">🌿 Pausa e Do-In</span></div><div class="small muted" style="margin-bottom:.6rem">Respiração guiada, alongamentos na cadeira, cansaço visual e autocuidado tradicional.</div>
        <button class="btn btn-teal" style="width:100%" id="pa-card-go">🌿 Preciso de uma pausa</button>`;
      home.insertBefore(d, home.children[2] || null); $('pa-card-go').onclick = menu;
    }
    const tp = $('p-timer');
    if (tp && !$('pa-timer')) {
      const d = document.createElement('div'); d.id = 'pa-timer'; d.className = 'card';
      d.innerHTML = `<div class="card-title" style="margin-bottom:.5rem">🤲 Do-In para o treino</div><div class="pa-duas"><button class="btn btn-secondary btn-sm" id="pa-t1">🔥 Aquecer</button><button class="btn btn-secondary btn-sm" id="pa-t2">🧊 Recuperar</button></div><div class="tiny muted" style="margin-top:.4rem">Prática tradicional de autocuidado. Não substitui orientação médica.</div>`;
      tp.appendChild(d); $('pa-t1').onclick = () => iniciar('din-treino-antes'); $('pa-t2').onclick = () => iniciar('din-treino-depois');
    }
    const ps = $('p-saude');
    if (ps && !$('pa-sono')) {
      const d = document.createElement('div'); d.id = 'pa-sono'; d.innerHTML = `<button class="btn btn-secondary" style="width:100%;margin:.5rem 0" id="pa-sono-go">🌙 Relaxar antes de dormir (Do-In)</button>`;
      const sc = $('sleep-card'); if (sc && sc.parentNode) sc.parentNode.insertBefore(d, sc.nextSibling); $('pa-sono-go').onclick = () => iniciar('din-sono');
    }
    if (!montar._iv) { montar._iv = true; setInterval(tickLembrete, 60000); setInterval(() => tickFC(false), 60000); setTimeout(tickLembrete, 3000); setTimeout(agendarNativo, 4000);
      if (NATIVE() && P('LocalNotifications')) { try { P('LocalNotifications').addListener('localNotificationActionPerformed', () => menu()); } catch (e) { } } }
  }

  window.Pausa = { montar, menu, iniciar, fechar, sugerir, tickFC, tickLembrete, agendarNativo, perguntarPerfil, _podeSugerir: podeSugerir, _avaliar: avaliarGatilho, _baseline: baseline, _resumo: resumoFunciona, _cfg: cfg, _salvarCfg: salvarCfg, _est: fcEstado };
})();
