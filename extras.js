/* FitFlow — extras do app Rotina:
 *  • Stress: autoavaliação 0–10 com histórico; a partir de 7 sugere a Pausa Anti-Estresse
 *  • Atividade externa (caminhada) só em janela sem chuva; troca por interna com aviso e Desfazer; devolve se abrir sol; calor forte
 *  • Horário do treino editável + lembretes opcionais (água, refeições, sono: desligados por padrão) como avisos do Android
 *  • Cabeçalho que some ao rolar, "Começar" da notificação, tela de permissões
 * Nada aqui inventa número: sem dado mostra "–" e "Sem dados ainda".
 */
(function () {
  'use strict';
  const R = window.Rotina;
  const $ = id => document.getElementById(id);
  const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = n => String(n).padStart(2, '0');
  const hhmm = ts => { const d = new Date(ts); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const NATIVE = !!(R && R.nativoAtivo);

  // ════════════════════════════════════════════════════════════
  //  STRESS (autoavaliação)
  // ════════════════════════════════════════════════════════════
  const getStress = () => DB.load('stress', []);
  let stressSel = null;
  function stressHoje() { const d = isoDay(); return getStress().filter(x => isoDay(new Date(x.t)) === d)[0] || null; }
  function stressCelula() {
    const s = stressHoje();
    return celulaFixa('🧘', 'Stress agora', s ? s.v + '/10' : null, 'Digitado (autoavaliação) • ' + (s ? hhmm(s.t) : ''), s && s.v >= 7 ? 'var(--red)' : 'var(--teal)', 'Sem dados ainda: responda no cartão de stress');
  }
  function salvarStress() {
    if (stressSel == null) return;
    const l = getStress(); l.unshift({ t: Date.now(), v: stressSel }); DB.save('stress', l.slice(0, 120));
    stressSel = null; renderStress();
    if (typeof renderHealth === 'function') renderHealth();
  }
  function renderStress() {
    const el = $('stress-card'); if (!el) return;
    const ult = stressHoje(), hist = getStress().slice(0, 7);
    const btn = []; for (let i = 0; i <= 10; i++) btn.push(`<button type="button" class="${i >= 7 ? 'alto ' : ''}${stressSel === i ? 'on' : ''}" data-v="${i}" aria-label="Stress ${i} de 10">${i}</button>`);
    const alto = (stressSel != null ? stressSel : (ult && Date.now() - ult.t < 3600000 ? ult.v : -1)) >= 7;
    el.innerHTML = `<div class="card-header"><span class="card-title">🧘 Como está seu stress agora?</span></div>
      <div class="small muted" style="line-height:1.5">De 0 (calmo) a 10 (muito estressado). É o que você sente, não uma medição: fica como <b>Digitado</b>.</div>
      <div class="rt-seg">${btn.join('')}</div>
      <button class="btn btn-teal" style="width:100%" id="stress-ok" ${stressSel == null ? 'disabled style="width:100%;opacity:.5"' : ''}>Salvar ${stressSel != null ? stressSel + '/10' : ''}</button>
      ${alto ? `<div class="rt-aviso" style="margin-top:.7rem">🌿 Stress alto. Uma pausa de poucos minutos ajuda: respiração guiada, olhos e Do-In.
        <button class="btn btn-secondary btn-sm" style="width:100%;margin-top:.5rem" id="stress-pausa">🌿 Abrir a Pausa Anti-Estresse</button></div>` : ''}
      ${hist.length ? `<div class="tiny muted" style="margin-top:.7rem">Últimas respostas: ${hist.map(h => `${pad(new Date(h.t).getDate())}/${pad(new Date(h.t).getMonth() + 1)} ${hhmm(h.t)} → <b>${h.v}</b>`).join(' · ')}</div>` : '<div class="tiny muted" style="margin-top:.7rem">Sem respostas ainda.</div>'}
      <div class="tiny muted" style="margin-top:.5rem">Stress automático: ${PRECISA_RELOGIO} (só aparece quando vier de relógio).</div>`;
    el.querySelectorAll('.rt-seg button').forEach(b => b.onclick = () => { stressSel = +b.dataset.v; renderStress(); });
    const ok = $('stress-ok'); if (ok) ok.onclick = salvarStress;
    const p = $('stress-pausa'); if (p) p.onclick = () => { if (window.Pausa && Pausa.menu) Pausa.menu(); };
  }
  function montarStress() {
    if ($('stress-card')) return;
    const home = $('p-home'); const h = $('h-grid'); if (!home || !h) return;
    const d = document.createElement('div'); d.id = 'stress-card'; d.className = 'card';
    const alvo = h.closest('.card'); alvo.parentNode.insertBefore(d, alvo.nextSibling);
    renderStress();
  }

  // ════════════════════════════════════════════════════════════
  //  CÉLULAS DA SAÚDE: atividade agora, batimento pela câmera, barômetro
  // ════════════════════════════════════════════════════════════
  const ATIV = { andando: 'Andando', correndo: 'Correndo', parado: 'Parado', veiculo: 'Em veículo', bicicleta: 'De bicicleta' };
  function atividadeCelula() {
    const a = DB.load('atividade_agora', null);
    const vazio = NATIVE ? 'Sem dados ainda' : 'Só no app Android';
    if (!a || !ATIV[a.tipo] || Date.now() - a.ts > 6 * 3600000) return celulaFixa('🏃', 'Atividade agora', null, '', 'var(--teal)', vazio);
    return celulaFixa('🏃', 'Atividade agora', ATIV[a.tipo], (a.fonte === 'celular' ? 'Celular (reconhecimento de atividade)' : SRC_NOME.est_cadencia) + ' • ' + hhmm(a.ts), 'var(--teal)');
  }
  function fcCameraCelula() {
    const d = isoDay();
    const x = DB.load('fc_cam', []).filter(f => isoDay(new Date(f.ts)) === d)[0];
    return celulaFixa('📷', 'Batimento (câmera)', x ? x.bpm + ' bpm' : null, SRC_NOME.camera + ' • ' + (x ? hhmm(x.ts) : ''), 'var(--red)', 'Sem medição hoje: meça em Saúde › Medições');
  }
  const semBarometro = () => NATIVE && window.Dados && Dados.passosEstado && Dados.passosEstado().barometro === false;

  // ════════════════════════════════════════════════════════════
  //  ATIVIDADE EXTERNA (caminhada): só em janela sem chuva
  // ════════════════════════════════════════════════════════════
  function cadastrarExercicios() {
    if (typeof EX === 'undefined' || !EX.cardio) return;
    if (!EX.cardio.some(e => e.id === 'c11')) EX.cardio.push({ id: 'c11', name: 'Caminhada ao ar livre', icon: '🚶', sets: '30min', dur: 1800, kcal: 100, target: ['pernas'], level: 'todos', muscles: 'Cardio leve • só em janela sem chuva', ext: true, alt: 'c12' });
    if (!EX.cardio.some(e => e.id === 'c12')) EX.cardio.push({ id: 'c12', name: 'Caminhada dentro de casa', icon: '🏠', sets: '30min', dur: 1800, kcal: 90, target: ['pernas'], level: 'todos', muscles: 'Cardio leve • troca da caminhada quando chove' });
  }
  const achar = id => { for (const c of Object.keys(EX)) { const e = EX[c].find(x => x.id === id); if (e) return Object.assign({}, e, { cat: c }); } return null; };
  // true = sem chuva agora e durante o exercício; false = chuva; null = sem previsão
  function secoAgora(ex) {
    const hs = R.clima.horas(); if (!hs.length) return null;
    const h0 = R.clima.horaAtual(hs, Date.now()); if (!h0) return null;
    const n = Math.max(1, Math.ceil(ex.dur / 3600)), bloco = [h0];
    for (let k = 1; k < n; k++) { const x = hs.find(y => y.ts === h0.ts + k * 3600000); if (x) bloco.push(x); }
    return bloco.every(R.clima.seca);
  }
  const estadoExt = () => { const e = DB.load('ext_swap', null); return e && e.date === isoDay() ? e : { date: isoDay(), itens: [], sol: [], desfeito: false }; };
  let ajustando = false;
  function ajustarExternos() {
    if (ajustando || typeof playlist === 'undefined' || typeof EX === 'undefined') return;
    ajustando = true;
    try {
      const st = estadoExt(); let mudou = false;
      if (!st.desfeito) {
        playlist.forEach((p, i) => {
          const ex = achar(p.id); if (!ex || !ex.ext || secoAgora(ex) !== false) return;
          const alt = achar(ex.alt); if (!alt) return;
          playlist[i] = Object.assign({}, alt); st.itens.push({ orig: ex.id, alt: alt.id }); st.sol = []; mudou = true;
          if (typeof showNotif === 'function') showNotif('☔', 'Chuva: treino dentro de casa', `Troquei "${ex.name}" por "${alt.name}". Dá pra desfazer na aba Treino.`);
        });
      }
      // abriu sol: devolve a caminhada ao ar livre
      st.itens = st.itens.filter(it => {
        const idx = playlist.findIndex(p => p.id === it.alt), ex = achar(it.orig);
        if (idx < 0) return false;
        if (ex && secoAgora(ex) === true) {
          playlist[idx] = Object.assign({}, ex); st.sol.push(ex.id); mudou = true;
          if (typeof showNotif === 'function') showNotif('☀️', 'Abriu sol!', `A previsão mudou: devolvi "${ex.name}" pro seu treino.`);
          return false;
        }
        return true;
      });
      DB.save('ext_swap', st);
      if (mudou) { DB.save('playlist', playlist); if (typeof renderExercises === 'function') renderExercises(); if (typeof updatePlaylistBar === 'function') updatePlaylistBar(); if (typeof updateDashPlaylist === 'function') updateDashPlaylist(); }
    } finally { ajustando = false; }
    renderAvisoExterno();
  }
  function desfazerTroca() {
    const st = estadoExt();
    st.itens.forEach(it => { const idx = playlist.findIndex(p => p.id === it.alt), ex = achar(it.orig); if (idx >= 0 && ex) playlist[idx] = Object.assign({}, ex); });
    st.itens = []; st.desfeito = true; DB.save('ext_swap', st); DB.save('playlist', playlist);
    renderExercises(); updatePlaylistBar(); updateDashPlaylist(); renderAvisoExterno();
  }
  function avisoExternoHtml() {
    const hs = R.clima.horas(); if (!hs.length) return '';
    const st = estadoExt(), ex = achar('c11'), agora = Date.now();
    let h = '';
    if (st.itens.length) h += `<div class="rt-aviso chuva">☔ <b>Chuva:</b> troquei a caminhada ao ar livre pela caminhada dentro de casa.<button class="btn btn-secondary btn-sm" style="margin-left:.4rem" data-rt="desfazer">Desfazer</button></div>`;
    if (st.sol && st.sol.length) h += `<div class="rt-aviso">☀️ <b>Abriu sol:</b> a previsão mudou e a caminhada ao ar livre voltou pro seu treino.</div>`;
    const h0 = R.clima.horaAtual(hs, agora);
    if (ex) {
      const j = R.clima.janela(hs, isoDay(), ex.dur / 60, 7, 19, agora);
      if (h0 && R.clima.quente(h0)) { const f = R.clima.maisFresca(hs, agora); h += `<div class="rt-aviso calor">🌡️ <b>Calor forte (${Math.round(h0.temp)}°).</b> ${f ? 'Para caminhar ao ar livre, melhor às ' + f.h + 'h, mais fresco.' : 'Espere esfriar para caminhar ao ar livre.'}</div>`; }
      else if (j) h += `<div class="rt-aviso">🚶 Caminhada ao ar livre: janela sem chuva às <b>${pad(Math.floor(j.min / 60))}:${pad(j.min % 60)}</b>${j.calor ? ' (calor forte nessa hora: hidrate-se)' : ''}.</div>`;
      else h += `<div class="rt-aviso chuva">☔ Sem janela sem chuva para caminhar fora hoje. Use a caminhada dentro de casa.</div>`;
    }
    return h + `<div class="tiny muted" style="margin-bottom:.4rem">🌐 Open-Meteo • ${esc(R.clima.atualizadoTxt())}</div><div class="tiny muted" style="margin-bottom:.6rem">As kcal (~) dos exercícios são estimativas do catálogo, não medições.</div>`;
  }
  function renderAvisoExterno() {
    document.querySelectorAll('.ext-aviso-box').forEach(b => { b.innerHTML = avisoExternoHtml(); const d = b.querySelector('[data-rt="desfazer"]'); if (d) d.onclick = desfazerTroca; });
  }
  function montarAvisoExterno() {
    ['p-treino'].forEach(pid => { const p = $(pid); if (p && !p.querySelector('.ext-aviso-box')) { const d = document.createElement('div'); d.className = 'ext-aviso-box'; p.insertBefore(d, p.children[1] || null); } });
    renderAvisoExterno();
  }

  // ════════════════════════════════════════════════════════════
  //  HORÁRIO DO TREINO + LEMBRETES OPCIONAIS (viram avisos do Android)
  // ════════════════════════════════════════════════════════════
  const horas = () => DB.load('rem_horas', {});
  const dias = () => DB.load('treino_dias', [1, 2, 3, 4, 5]);
  const horaDe = r => horas()[r.id] || (r.h != null ? pad(r.h) + ':' + pad(r.m || 0) : '');
  function treinoFeitoHoje() { const d = isoDay(); return DB.load('sessions', []).some(s => s && s.d && isoDay(new Date(s.d)) === d); }
  function minutosPlaylist() { try { return Math.max(10, Math.round(playlist.reduce((a, p) => a + (p.dur || 0), 0) / 60)) || 30; } catch (e) { return 30; } }
  let ultSync = '';
  function sincronizar() {
    if (!NATIVE || typeof REMINDER_LIST === 'undefined') return;
    const itens = [], all = [0, 1, 2, 3, 4, 5, 6];
    const on = id => !!reminderState[id];
    const temExt = (typeof playlist !== 'undefined') && playlist.some(p => { const e = achar(p.id); return e && e.ext; });
    const tr = REMINDER_LIST.find(r => r.id === 'treino');
    if (tr && on('treino')) itens.push({ id: 'f_treino', kind: 'treino', nome: 'Hora do treino', emoji: '🏋️', ext: temExt, dur: minutosPlaylist(), dias: dias(), hora: horaDe(tr) || '18:00',
      frase: temExt ? 'fazer a caminhada ao ar livre' : 'treinar', dentro: 'faça o treino dentro de casa', texto: '', feito: treinoFeitoHoje() ? isoDay() : '', trocada: false });
    if (on('agua')) for (let h = 8; h <= 20; h += 2) itens.push({ id: 'f_agua_' + h, kind: 'agua', nome: 'Água', emoji: '💧', ext: false, dur: 1, dias: all, hora: pad(h) + ':00', texto: 'Hora de beber água. Um copo agora ajuda.', feito: '', trocada: false });
    REMINDER_LIST.filter(r => r.h != null && r.id !== 'treino').forEach(r => {
      if (!on(r.id)) return;
      const dorm = r.id === 'dormir';
      itens.push({ id: 'f_' + r.id, kind: dorm ? 'sono' : 'refeicao', nome: r.name, emoji: r.icon, ext: false, dur: 1, dias: all, hora: horaDe(r), texto: dorm ? 'Hora de dormir: desligue as telas e relaxe.' : r.name + ': não pule essa refeição!', feito: '', trocada: false });
    });
    const j = JSON.stringify(itens); if (j === ultSync) return; ultSync = j;
    R.nativo.sincronizarLembretes('fitflow', itens);
  }

  function renderRemindersRt() {
    const el = $('reminders-list'); if (!el) return;
    const dsel = dias();
    el.innerHTML = '<div class="rt-aviso" style="margin-bottom:.6rem">Água, refeições e sono já avisam pelo seu Google Agenda, então aqui ficam <b>desligados</b>. Ligue só o que quiser. O treino avisa no horário que você escolher.</div>' +
      REMINDER_LIST.map(r => `
      <div style="padding:0.7rem 0;border-bottom:1px solid var(--border)">
        <div style="display:flex;align-items:center;gap:0.8rem">
          <span style="font-size:1.3rem">${r.icon}</span>
          <div style="flex:1;min-width:0">
            <div style="font-size:0.85rem;font-weight:600">${r.name}</div>
            ${r.h != null ? `<div class="rt-linha"><span class="tiny muted">⏰ Avisar às</span><input type="time" class="rt-in" value="${horaDe(r)}" data-hora="${r.id}"></div>` : '<div class="tiny muted">🔄 A cada 2 horas, das 8h às 20h</div>'}
          </div>
          <label class="toggle"><input type="checkbox" ${reminderState[r.id] ? 'checked' : ''} onchange="toggleReminder('${r.id}',this.checked)"><div class="toggle-track"></div></label>
        </div>
        ${r.id === 'treino' ? `<div style="margin-top:.4rem"><span class="tiny muted">Dias do treino:</span><br>${DIAS.map((d, i) => `<span class="rt-chip ${dsel.includes(i) ? 'on' : ''}" data-dia="${i}">${d}</span>`).join('')}</div>` : ''}
      </div>`).join('');
    el.lastElementChild.style.borderBottom = 'none';
    el.querySelectorAll('[data-hora]').forEach(i => i.onchange = () => { if (!i.value) return; const h = horas(); h[i.dataset.hora] = i.value; DB.save('rem_horas', h); sincronizar(); });
    el.querySelectorAll('[data-dia]').forEach(c => c.onclick = () => { let d = dias(); const k = +c.dataset.dia; d = d.includes(k) ? d.filter(x => x !== k) : d.concat(k); DB.save('treino_dias', d.sort()); renderRemindersRt(); sincronizar(); });
  }

  // ════════════════════════════════════════════════════════════
  //  "Começar" da notificação, cabeçalho que some, permissões, Aa
  // ════════════════════════════════════════════════════════════
  async function tratarAcao(a) {
    if (!a || a.acao !== 'comecar' || !a.id) return;
    if (a.tipo !== 'treino') { location.href = '/escoteiro-moderno/index.html'; return; }   // tarefa da casa: o Escoteiro cuida (a ação continua pendente)
    await R.nativo.limparAcao();
    if (typeof playlist !== 'undefined' && playlist.length) { nav('timer'); if (typeof initTimer === 'function') initTimer(); } else nav('treino');
  }
  const checarAcao = () => R.nativo.acaoPendente().then(tratarAcao);

  function montarPerfil() {
    const pp = $('p-perfil'); if (!pp || $('rt-perm-btn')) return;
    const b = document.createElement('button'); b.id = 'rt-perm-btn'; b.className = 'btn btn-secondary'; b.style.cssText = 'width:100%;margin-bottom:0.5rem'; b.textContent = '🔧 Permissões e bateria';
    b.onclick = () => R.abrirPermissoes();
    const edit = pp.querySelector('button[onclick="editProfile()"]'); if (edit) edit.parentNode.insertBefore(b, edit); else pp.appendChild(b);
    if (!NATIVE) b.style.display = 'none';
  }

  function iniciar() {
    cadastrarExercicios();
    montarStress(); montarAvisoExterno(); montarPerfil();
    if (typeof renderReminders === 'function') try { renderReminders(); } catch (e) { }
    if (typeof renderExercises === 'function') try { renderExercises(); } catch (e) { }
    if (typeof renderHealth === 'function') try { renderHealth(); } catch (e) { }
  }

  // ── ganchos nas funções do app (só somam) ──
  const _upl = window.updatePlaylistBar;
  if (typeof _upl === 'function') window.updatePlaylistBar = function () { const r = _upl.apply(this, arguments); try { ajustarExternos(); sincronizar(); } catch (e) { } return r; };
  const _init = window.initTimer;
  if (typeof _init === 'function') window.initTimer = function () { try { ajustarExternos(); } catch (e) { } return _init.apply(this, arguments); };
  const _rr = window.renderReminders;
  if (typeof _rr === 'function') window.renderReminders = function () { try { renderRemindersRt(); } catch (e) { _rr.apply(this, arguments); } };
  const _tr = window.toggleReminder;
  if (typeof _tr === 'function') window.toggleReminder = function () { const r = _tr.apply(this, arguments); try { sincronizar(); } catch (e) { } return r; };
  const _ser = window.startReminderEngine;
  if (typeof _ser === 'function') window.startReminderEngine = function () { if (NATIVE) return; return _ser.apply(this, arguments); };   // no Android quem avisa é o sistema (funciona com o app fechado)
  let HDR = null;
  const _nav = window.nav;
  if (typeof _nav === 'function') window.nav = function (p) { const r = _nav.apply(this, arguments); if (HDR) HDR.mostrar(); try { if (p === 'treino') ajustarExternos(); } catch (e) { } return r; };

  window.Extras = { stressCelula, atividadeCelula, fcCameraCelula, semBarometro, ajustarExternos, sincronizar, desfazerTroca, renderStress, _secoAgora: secoAgora, _achar: achar, _estadoExt: estadoExt };

  window.addEventListener('load', () => {
    setTimeout(() => {
      try {
        iniciar();
        HDR = R.esconderAoRolar(document.querySelector('.topbar'));
        R.clima.aoMudar(() => { try { ajustarExternos(); renderAvisoExterno(); sincronizar(); } catch (e) { } });
        R.clima.iniciarAuto();
        ajustarExternos(); sincronizar();
        R.nativo.aoReceberAcao(tratarAcao); checarAcao();
        if (typeof U !== 'undefined' && U && U.nome) R.permissoesNaPrimeiraVez();
      } catch (e) { console.error(e); }
    }, 800);
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { try { sincronizar(); renderStress(); checarAcao(); } catch (e) { } } });
})();
