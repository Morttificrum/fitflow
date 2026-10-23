/* FitFlow — "Pernas Fortes (iniciante / 60+)", inspirado no programa Otago de prevenção de quedas.
   10 exercícios com cadeira firme, 3 níveis de progressão e o teste "Sentar e levantar em 30 segundos"
   com gráfico de evolução. Integrado à Saúde Adaptada (avisos por condição) e ao XP.
   Não substitui orientação de médico ou fisioterapeuta. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = n => String(n).padStart(2, '0');
  const dia = ts => { const d = new Date(ts); return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear(); };
  const ESC = () => (typeof window.PERNAS_ESCALA === 'number' ? window.PERNAS_ESCALA : 1);   // só para teste
  const fala = t => { try { if (typeof say === 'function') say(t); } catch (e) { } };
  const bip = (f, d) => { try { if (typeof beep === 'function') beep(f || 660, d || 0.1, 0.25); } catch (e) { } };

  const REGRAS = ['Respire normalmente: solte o ar durante o esforço, nunca prenda a respiração.', 'Sem dor: se doer, pare esse exercício.', 'Faça 2 a 3 vezes por semana, com pelo menos um dia de descanso entre as sessões.', 'Pare e descanse se sentir tontura ou dor no peito. Se não passar, ligue 192.'];
  const CADEIRA = 'Use uma cadeira firme, encostada na parede, sem rodinhas. De pé, fique sempre com uma mão no encosto.';

  // ── exercícios ──
  const NIVEL = { 1: { series: 1, reps: 6, texto: '1 série de 5 a 8 repetições (faça 6)' }, 2: { series: 2, reps: 10, texto: '2 séries de 10' }, 3: { series: 3, reps: 10, texto: '3 séries de 10' } };
  const PESO = 'Nível 3 (opcional): se estiver tudo fácil, use caneleira leve (0,5 a 1 kg) ou uma garrafa de água bem amarrada no tornozelo. Nunca com dor.';
  const EX = [
    { id: 'p01', nome: 'Bombear os tornozelos', pos: 'sentado', como: 'Sentado com as costas apoiadas, estique as pernas e apoie os calcanhares no chão. Puxe a ponta dos pés para você e depois empurre para baixo, como se apertasse um acelerador. Movimento suave e contínuo.' },
    { id: 'p02', nome: 'Marcha sentado', pos: 'sentado', como: 'Sentado com a coluna alta, levante um joelho alguns centímetros, desça e troque de perna, como se marchasse. Sem balançar o corpo.' },
    { id: 'p03', nome: 'Extensão de joelho sentado', pos: 'sentado', hold: 3, lados: true, peso: true, como: 'Sentado, estique uma perna à frente até ficar reta (sem travar o joelho com força), segure 3 segundos contando e abaixe devagar. Faça todas as repetições e troque de perna.' },
    { id: 'p04', nome: 'Apertar os glúteos sentado', pos: 'sentado', hold: 3, como: 'Sentado, aperte as nádegas como se segurasse uma moeda entre elas, segure 3 segundos e solte. Respire normalmente.' },
    { id: 'p05', nome: 'Sentar e levantar', pos: 'de pé', como: n => ({ 1: 'Cruze os pés um pouco atrás dos joelhos. Levante-se e sente-se devagar. Você pode usar as mãos nos braços da cadeira ou nas coxas para ajudar.', 2: 'Levante-se e sente-se devagar, tentando NÃO usar as mãos. Se não conseguir, use só um pouco.', 3: 'Levante-se sem usar as mãos e desça devagar, contando 3 segundos para sentar.' })[n] },
    { id: 'p06', nome: 'Ficar na ponta dos pés', pos: 'de pé', hold: 2, como: 'De pé atrás da cadeira, com uma mão no encosto. Suba na ponta dos pés, segure 2 a 3 segundos e desça devagar.' },
    { id: 'p07', nome: 'Levantar a ponta dos pés', pos: 'de pé', hold: 2, como: 'De pé, com uma mão no encosto. Mantenha os calcanhares no chão e levante a ponta dos pés, segure 2 segundos e desça devagar.' },
    { id: 'p08', nome: 'Abrir a perna para o lado', pos: 'de pé', lados: true, peso: true, como: 'De pé, com uma mão no encosto e as costas retas. Leve uma perna para o LADO do corpo, com o pé apontando para a frente, sem inclinar o tronco. Volte devagar e troque de perna. (A figura mostra de lado: a perna vai para o lado do seu corpo.)' },
    { id: 'p09', nome: 'Levar a perna para trás', pos: 'de pé', lados: true, peso: true, como: 'De pé, com uma mão no encosto. Leve uma perna para trás, sem arquear as costas nem inclinar o corpo para a frente. Volte devagar e troque de perna.' },
    { id: 'p10', nome: 'Mini agachamento', pos: 'de pé', como: 'De pé, com a(s) mão(ões) no encosto e os pés na largura dos ombros. Dobre os joelhos só até onde for confortável (sem passar da ponta dos pés) e volte. Sem dor.' }
  ];
  const comoDe = (e, n) => typeof e.como === 'function' ? e.como(n) : e.como;

  // ── armazenamento ──
  const ST0 = { nivel: 1, sessoes: [], teste: [] };
  const get = () => { const st = Object.assign({}, ST0, DB.load('pernas', {})); st.teste = (st.teste || []).slice().sort((a, b) => b.ts - a.ts); st.sessoes = (st.sessoes || []).slice().sort((a, b) => b.ts - a.ts); return st; };
  const salvar = s => DB.save('pernas', s);

  // ── regras de progressão e frequência (puras, testáveis) ──
  function sugestaoNivel(st) {
    const ult = st.sessoes.filter(x => x.nivel === st.nivel && !x.ignorar).slice(0, 2);
    if (ult.length < 2 || st.nivel >= 3) return null;
    return ult.every(x => x.completa && !x.dor && x.postura) ? 'subir' : null;
  }
  function avisoFrequencia(st, agora) {
    const d0 = new Date(agora); d0.setHours(0, 0, 0, 0);
    const ontem = d0.getTime() - 86400000, ult7 = st.sessoes.filter(x => agora - x.ts < 7 * 86400000).length;
    const feitaHoje = st.sessoes.some(x => x.ts >= d0.getTime()), feitaOntem = st.sessoes.some(x => x.ts >= ontem && x.ts < d0.getTime());
    if (feitaHoje) return 'Você já treinou hoje. O ideal é descansar um dia entre as sessões.';
    if (feitaOntem) return 'Você treinou ontem. O ideal é um dia de descanso entre as sessões.';
    if (ult7 >= 3) return 'Você já fez 3 sessões nos últimos 7 dias. Duas a três por semana é o suficiente.';
    return '';
  }
  // CDC / STEADI: pontuação "abaixo da média" no teste de 30 s (repetições)
  const REF = { M: [[60, 64, 14], [65, 69, 12], [70, 74, 12], [75, 79, 11], [80, 84, 10], [85, 89, 8], [90, 94, 7]], F: [[60, 64, 12], [65, 69, 11], [70, 74, 10], [75, 79, 10], [80, 84, 9], [85, 89, 8], [90, 94, 4]] };
  function referencia(sexo, idade) { const f = (REF[sexo === 'M' ? 'M' : 'F'] || []).find(x => idade >= x[0] && idade <= x[1]); return f ? { de: f[0], ate: f[1], min: f[2] } : null; }

  // ── janelas ──
  function janela(html, cls) { fechar(); const ov = document.createElement('div'); ov.className = 'sa-ov modal pa-ov ' + (cls || ''); ov.id = 'pn-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.innerHTML = '<div class="sa-box">' + html + '</div>'; document.body.appendChild(ov); document.body.classList.add('pa-aberta'); ov.scrollTop = 0; return ov; }
  function fechar() { limparTimers(); const o = $('pn-ov'); if (o) o.remove(); document.body.classList.remove('pa-aberta'); }
  let timers = [];
  const limparTimers = () => { timers.forEach(clearInterval); timers.forEach(clearTimeout); timers = []; };
  const regrasHtml = () => `<div class="sa-alert warn pf-regras"><b>Regras de segurança</b><ul class="sa-list">${REGRAS.map(r => '<li>' + esc(r) + '</li>').join('')}</ul><div class="sa-small">${esc(CADEIRA)}</div></div>`;

  // ════════════════════════════════════════════════════════════
  //  MENU
  // ════════════════════════════════════════════════════════════
  function menu() {
    const st = get(), sug = sugestaoNivel(st), n = NIVEL[st.nivel], ultTeste = st.teste[0];
    janela(`<div class="sa-h">🦵 Pernas Fortes</div>
      <p class="sa-p">Exercícios simples com cadeira para fortalecer as pernas e ajudar no equilíbrio. Inspirado no programa Otago de prevenção de quedas. Para iniciantes e para 60+.</p>
      ${regrasHtml()}
      ${sug ? `<div class="sa-alert ok">✅ Você fez as duas últimas sessões do nível ${st.nivel} sem dor e com boa postura. Quer subir para o nível ${st.nivel + 1}?<div style="display:flex;gap:.5rem"><button class="sa-btn green" id="pn-sobe" style="margin:.5rem 0 0">Subir de nível</button><button class="sa-btn sec" id="pn-fica" style="margin:.5rem 0 0">Ficar mais um pouco</button></div></div>` : ''}
      <div class="sa-p"><b>Seu nível: ${st.nivel}</b> · ${esc(n.texto)}</div>
      <div class="sa-seg" role="radiogroup" aria-label="Nível">${[1, 2, 3].map(k => `<button data-n="${k}" class="${k === st.nivel ? 'on' : ''}" role="radio">Nível ${k}</button>`).join('')}</div>
      <div class="sa-small">Nível 1: 1 série de 5 a 8 · Nível 2: 2 séries de 10 · Nível 3: 3 séries de 10. Avance só quando fizer tudo sem dor e com boa postura. ${esc(PESO)}</div>
      <button class="sa-btn green" id="pn-go">▶ Começar a sessão (nível ${st.nivel})</button>
      <button class="sa-btn" id="pn-teste">⏱️ Teste: sentar e levantar em 30 s</button>
      <div class="sa-small">${ultTeste ? 'Último teste: ' + ultTeste.rep + ' repetições em ' + dia(ultTeste.ts) + '. Repita a cada 2 semanas.' : 'Ainda sem testes. Faça agora e repita a cada 2 semanas.'}</div>
      <button class="sa-btn sec" id="pn-evo">📈 Evolução do teste</button>
      <div class="h2" style="margin-top:1rem">Os 10 exercícios</div>
      ${EX.map((e, i) => `<div class="md-linha"><span>${i + 1}. ${esc(e.nome)}</span><span class="tiny muted">${e.pos}</span></div>`).join('')}
      <div class="sa-disc">Este programa não substitui orientação de médico ou fisioterapeuta. Em caso de dúvida, converse antes de começar.</div>
      <button class="sa-btn sec" id="pn-x">Fechar</button>`);
    document.querySelectorAll('#pn-ov .sa-seg button').forEach(b => b.onclick = () => { const s = get(); s.nivel = +b.dataset.n; salvar(s); menu(); });
    if ($('pn-sobe')) $('pn-sobe').onclick = () => { const s = get(); s.nivel = Math.min(3, s.nivel + 1); salvar(s); menu(); };
    if ($('pn-fica')) $('pn-fica').onclick = () => { const s = get(); s.sessoes.filter(x => x.nivel === s.nivel).slice(0, 2).forEach(x => { x.ignorar = true; }); salvar(s); menu(); };
    $('pn-go').onclick = () => comecar(); $('pn-teste').onclick = teste; $('pn-evo').onclick = evolucao; $('pn-x').onclick = fechar;
  }

  // ════════════════════════════════════════════════════════════
  //  SESSÃO
  // ════════════════════════════════════════════════════════════
  function comecar() {
    if (window.SA && SA.blocked()) { fechar(); SA.gate(); return; }
    const st = get(), av = avisoFrequencia(st, Date.now());
    const seguir = () => {
      if (window.SA && SA.isAdapt() && SA.preflight) SA.preflight(() => intro()); else intro();
    };
    if (av) {
      janela(`<div class="sa-h">Dia de descanso?</div><p class="sa-p">${esc(av)}</p><button class="sa-btn" id="pn-seg">Fazer mesmo assim</button><button class="sa-btn sec" id="pn-nao">Deixar para outro dia</button>`);
      $('pn-seg').onclick = seguir; $('pn-nao').onclick = menu;
    } else seguir();
  }
  function intro() {
    const st = get(), n = NIVEL[st.nivel];
    janela(`<div class="sa-h">Nível ${st.nivel}</div><p class="sa-p">${esc(n.texto)} em cada exercício, com 30 s de descanso entre as séries. Cerca de ${Math.round(EX.length * (n.series * 50 + (n.series - 1) * 30) / 60)} min.</p>${regrasHtml()}
      <label class="sa-row"><input type="checkbox" id="pn-ritmo"> <span>Marcar o ritmo com um som a cada 3 segundos</span></label>
      <button class="sa-btn green" id="pn-ini">▶ Começar</button><button class="sa-btn sec" id="pn-v">Voltar</button>`);
    $('pn-v').onclick = menu; $('pn-ini').onclick = () => { const ritmo = $('pn-ritmo').checked; rodar(st.nivel, ritmo); };
  }

  function rodar(nivel, ritmo) {
    const n = NIVEL[nivel]; const fil = EX.filter(e => !(window.SA && SA.hidden(e.id)));
    const sess = { nivel, feitos: 0, puladas: 0, total: fil.length, i: 0, serie: 1, ts: Date.now() };
    const mostrar = () => {
      limparTimers();
      const e = fil[sess.i]; if (!e) { fim(sess); return; }
      const notas = window.SA ? SA.notesHtml(e.id) : '';
      const reps = n.reps, serieTxt = `Série ${sess.serie} de ${n.series}`;
      janela(`<div class="pa-run"><div class="pa-top"><button class="sa-btn sec pa-peq" id="pn-sair">✕ Parar</button><div style="flex:1"><div class="pbar-wrap thick"><div class="pbar" style="width:${Math.round(sess.i / fil.length * 100)}%;background:var(--teal)"></div></div><div class="tiny muted">Exercício ${sess.i + 1} de ${fil.length} · ${e.pos}</div></div></div>
        <div class="pa-cena"><div class="pf-fig">${window.FIGURAS ? FIGURAS.figSVG(e.id, 'otago', { label: 'Figura: ' + e.nome }) : ''}</div>
          <div class="pa-titulo">${esc(e.nome)}</div>
          <div class="pa-texto">${esc(comoDe(e, nivel))}</div>
          ${e.pos === 'de pé' ? '<div class="pa-pressao pa-p-firme">🪑 De pé: uma mão no encosto da cadeira, cadeira firme encostada na parede.</div>' : '<div class="pa-pressao pa-p-leve">🪑 Sentado na cadeira firme, encostada na parede, com as costas apoiadas.</div>'}
          ${e.peso && nivel === 3 ? `<div class="sa-small">${esc(PESO)}</div>` : ''}${notas}
          <div class="pf-alvo"><b>${serieTxt}:</b> ${reps} repetições${e.lados ? ' <span class="sa-small">(de cada lado)</span>' : ''}${e.hold ? ` <span class="sa-small">(segure ${e.hold} s)</span>` : ''}</div>
          <div class="pa-cont" id="pn-ritmo-txt"></div></div>
        <div class="pa-ctl"><button class="sa-btn green" id="pn-ok" style="margin:0">✔ Terminei a série</button></div>
        <div class="pa-ctl"><button class="sa-btn sec pa-peq" id="pn-pula">Pular este exercício</button><button class="sa-btn sec pa-peq" id="pn-dor">Senti dor</button></div>
        <div class="sa-small" style="text-align:center">${esc(REGRAS[0])} ${esc(REGRAS[3])}</div></div>`, 'pa-tela');
      if (sess.serie === 1 && !e._falado) { fala(`${e.nome}. ${comoDe(e, nivel)}`); }
      if (ritmo) { let k = 0; const t = setInterval(() => { k++; bip(k % 2 ? 640 : 520, 0.08); const r = $('pn-ritmo-txt'); if (r) r.textContent = k % 2 ? 'Faça o movimento…' : 'Volte devagar…'; }, 3000 * ESC()); timers.push(t); }
      $('pn-sair').onclick = () => { if (confirm('Encerrar a sessão agora?')) fim(sess, true); };
      $('pn-pula').onclick = () => { sess.puladas++; sess.i++; sess.serie = 1; mostrar(); };
      $('pn-dor').onclick = () => { sess.dor = true; janela(`<div class="sa-h">Sentiu dor?</div><p class="sa-p">Dor não faz parte do exercício. Pare esse exercício e descanse. Se a dor for forte, no peito, ou não passar, procure atendimento (192 em emergência). Converse com seu médico ou fisioterapeuta antes de repetir.</p><button class="sa-btn" id="pn-seg">Pular este exercício e continuar</button><button class="sa-btn sec" id="pn-enc">Encerrar a sessão</button>`); $('pn-seg').onclick = () => { sess.puladas++; sess.i++; sess.serie = 1; mostrar(); }; $('pn-enc').onclick = () => fim(sess, true); };
      $('pn-ok').onclick = () => {
        if (sess.serie < n.series) { sess.serie++; descanso(); } else { sess.feitos++; sess.i++; sess.serie = 1; if (sess.i < fil.length && (e.pos === 'sentado') !== (fil[sess.i].pos === 'sentado')) transicao(); else mostrar(); }
      };
    };
    const descanso = () => {
      limparTimers(); let r = Math.max(2, Math.round(30 * ESC()));
      janela(`<div class="pa-run"><div class="pa-cena"><div class="pa-emoji">😮‍💨</div><div class="pa-titulo">Descanse</div><div class="pa-fase" id="pn-d">${r}</div><div class="pa-texto">Respire normalmente e solte os músculos. Próxima série em instantes.</div></div><div class="pa-ctl"><button class="sa-btn sec pa-peq" id="pn-pr">Pronto, continuar</button></div></div>`, 'pa-tela');
      fala('Descanse um pouco.');
      const t = setInterval(() => { r--; const d = $('pn-d'); if (d) d.textContent = r; if (r <= 0) { limparTimers(); mostrar(); } }, 1000); timers.push(t);
      $('pn-pr').onclick = () => { limparTimers(); mostrar(); };
    };
    const transicao = () => {
      janela(`<div class="sa-h">Agora de pé</div><p class="sa-p">Os próximos exercícios são <b>de pé</b>. Posicione a cadeira firme, encostada na parede, e fique atrás dela com uma mão no encosto. Em caso de tontura, volte a sentar.</p><button class="sa-btn green" id="pn-pr">Estou pronto</button>`); fala('Agora os exercícios de pé. Segure sempre no encosto da cadeira.'); $('pn-pr').onclick = mostrar;
    };
    mostrar();
  }

  function fim(sess, interrompida) {
    limparTimers();
    const completa = !interrompida && sess.puladas === 0 && !sess.dor && sess.feitos === sess.total;
    janela(`<div class="sa-h">${interrompida ? 'Sessão encerrada' : '✅ Sessão concluída'}</div>
      <p class="sa-p">${sess.feitos} de ${sess.total} exercícios feitos${sess.puladas ? ', ' + sess.puladas + ' pulado(s)' : ''}.</p>
      <div class="sa-p"><b>Você fez tudo sem dor e com boa postura?</b></div>
      <div class="sa-seg" id="pn-q"><button data-v="sim">Sim</button><button data-v="parcial">Em parte</button><button data-v="dor">Senti dor</button></div>
      <div class="sa-small" id="pn-msg" style="margin:.5rem 0"></div>
      <button class="sa-btn green" id="pn-salvar" disabled>Salvar</button>`);
    let resp = null;
    document.querySelectorAll('#pn-q button').forEach(b => b.onclick = () => { resp = b.dataset.v; document.querySelectorAll('#pn-q button').forEach(x => x.classList.toggle('on', x === b)); $('pn-salvar').disabled = false; $('pn-msg').textContent = resp === 'dor' ? 'Obrigado por contar. Na próxima, comece pelo nível anterior e converse com seu médico ou fisioterapeuta.' : resp === 'parcial' ? 'Sem problema. Fique no mesmo nível até conseguir fazer tudo bem.' : 'Muito bem! Quando fizer duas sessões assim seguidas, eu sugiro subir de nível.'; });
    $('pn-salvar').onclick = () => {
      const st = get(), dor = resp === 'dor' || !!sess.dor, postura = resp === 'sim';
      st.sessoes.unshift({ ts: sess.ts, nivel: sess.nivel, feitos: sess.feitos, total: sess.total, completa: completa && postura, dor, postura }); st.sessoes = st.sessoes.slice(0, 60);
      if (dor && st.nivel > 1) st.nivel = st.nivel - 1;
      salvar(st);
      const xp = interrompida && sess.feitos < 3 ? 0 : (completa ? 20 : 10);
      try { if (xp && typeof Shared !== 'undefined') { Shared.addXp(xp); Shared.touchDay(); if (typeof populateUI === 'function') populateUI(); } } catch (e) { }
      janela(`<div class="sa-h">Salvo</div><p class="sa-p">${xp ? '<b>+' + xp + ' XP</b> (compartilhado com o Escoteiro). ' : ''}${dor && st.nivel < sess.nivel ? 'Voltamos para o nível ' + st.nivel + ' por segurança. ' : ''}Descanse um dia antes da próxima sessão.</p><button class="sa-btn" id="pn-m">Voltar ao menu</button>`); $('pn-m').onclick = menu;
    };
  }

  // ════════════════════════════════════════════════════════════
  //  TESTE: SENTAR E LEVANTAR EM 30 SEGUNDOS
  // ════════════════════════════════════════════════════════════
  function teste() {
    const st = get(), u = (typeof U !== 'undefined' && U) || {}, ref = referencia(u.sexo, u.idade || 0);
    const recente = st.teste[0] && Date.now() - st.teste[0].ts < 13 * 86400000;
    janela(`<div class="sa-h">⏱️ Sentar e levantar em 30 s</div>
      <p class="sa-p">Conte quantas vezes você consegue <b>levantar da cadeira e sentar de novo em 30 segundos</b>, com os braços cruzados sobre o peito e sem usar as mãos.</p>
      <ul class="sa-list"><li>Cadeira firme, encostada na parede, sem rodinhas, de altura comum.</li><li>Comece sentado, com os pés no chão e os braços cruzados.</li><li>Cada vez que ficar totalmente de pé conta 1. Se precisar das mãos, pare: vale 0.</li><li>Tenha alguém por perto se você tem risco de queda. Pare se sentir tontura ou dor.</li></ul>
      ${recente ? '<div class="sa-alert warn">Seu último teste foi há menos de 2 semanas. O ideal é repetir a cada 2 semanas, mas você pode fazer agora.</div>' : ''}
      <button class="sa-btn green" id="pt-go">▶ Começar o teste</button><button class="sa-btn sec" id="pt-v">Voltar</button>`);
    $('pt-v').onclick = menu; $('pt-go').onclick = () => cronometro();
  }
  function cronometro() {
    let cont = 0, tempo = 30, fase = 'prep', pre = 3;
    janela(`<div class="pa-run"><div class="pa-cena"><div class="pa-titulo" id="pt-t">Prepare-se</div><div class="pa-fase" id="pt-n" style="font-size:4rem">3</div><div class="pa-cont" id="pt-c"></div>
      <button class="sa-btn pt-mais" id="pt-mais" style="display:none">＋1 (levantei e sentei)</button><button class="sa-btn sec pa-peq" id="pt-menos" style="display:none">−1 (corrigir)</button></div>
      <div class="pa-ctl"><button class="sa-btn sec pa-peq" id="pt-x">Cancelar</button></div></div>`, 'pa-tela');
    fala('Sente-se com os braços cruzados. Já vamos começar.');
    const mais = () => { if (fase === 'vai') { cont++; $('pt-c').textContent = cont + ' repetições'; bip(700, 0.04); } };
    $('pt-mais').onclick = mais; $('pt-menos').onclick = () => { if (fase === 'vai' && cont > 0) { cont--; $('pt-c').textContent = cont + ' repetições'; } };
    $('pt-x').onclick = teste;
    const tick = setInterval(() => {
      if (fase === 'prep') { pre--; const n = $('pt-n'); if (n) n.textContent = pre > 0 ? pre : 'JÁ!'; bip(520, 0.1); if (pre <= 0) { fase = 'vai'; fala('Já!'); $('pt-t').textContent = 'Levante e sente'; $('pt-mais').style.display = 'block'; $('pt-menos').style.display = 'block'; $('pt-c').textContent = '0 repetições'; $('pt-n').textContent = tempo; } }
      else if (fase === 'vai') { tempo--; $('pt-n').textContent = tempo; if (tempo === 15) fala('Metade do tempo.'); if (tempo <= 3 && tempo > 0) bip(520, 0.08); if (tempo <= 0) { fase = 'fim'; clearInterval(tick); bip(880, 0.4); fala('Tempo!'); confirmar(cont); } }
    }, 1000 * ESC());
    timers.push(tick);
  }
  function confirmar(c) {
    let n = c, maos = false;
    janela(`<div class="sa-h">Tempo!</div><p class="sa-p">Confirme quantas repetições você fez:</p>
      <div class="pt-conf"><button class="sa-btn sec pa-peq" id="pt-m">−</button><div class="pa-fase" id="pt-v" style="font-size:3.2rem">${n}</div><button class="sa-btn sec pa-peq" id="pt-p">＋</button></div>
      <label class="sa-row"><input type="checkbox" id="pt-maos"> <span>Precisei usar as mãos (vale 0)</span></label>
      <button class="sa-btn green" id="pt-ok">Salvar resultado</button><button class="sa-btn sec" id="pt-d">Descartar</button>`);
    const ver = () => { $('pt-v').textContent = maos ? 0 : n; };
    $('pt-m').onclick = () => { n = Math.max(0, n - 1); ver(); }; $('pt-p').onclick = () => { n = Math.min(60, n + 1); ver(); };
    $('pt-maos').onchange = e => { maos = e.target.checked; ver(); };
    $('pt-d').onclick = menu;
    $('pt-ok').onclick = () => { const st = get(); st.teste.unshift({ ts: Date.now(), rep: maos ? 0 : n, maos }); st.teste = st.teste.slice(0, 60); salvar(st); try { if (typeof Shared !== 'undefined') { Shared.addXp(10); Shared.touchDay(); if (typeof populateUI === 'function') populateUI(); } } catch (e) { } evolucao(true); };
  }
  function grafico(lista, ref) {
    const v = lista.slice(0, 12).reverse(); if (!v.length) return '';
    const W = 320, H = 150, max = Math.max(20, ...v.map(x => x.rep), ref ? ref.min : 0) + 2, y = r => H - 22 - r / max * (H - 36), x = i => v.length === 1 ? W / 2 : 28 + i * (W - 48) / (v.length - 1);
    let g = `<line x1="24" x2="${W}" y1="${y(0)}" y2="${y(0)}" stroke="#2A2A50"/>`;
    if (ref) g += `<line x1="24" x2="${W}" y1="${y(ref.min)}" y2="${y(ref.min)}" stroke="#9898CC" stroke-dasharray="4 3"/><text x="26" y="${H - 8 - 14}" fill="#9898CC" font-size="9">linha tracejada = referência (${ref.min})</text>`;
    g += `<polyline fill="none" stroke="#00D4AA" stroke-width="2.5" points="${v.map((p, i) => x(i).toFixed(1) + ',' + y(p.rep).toFixed(1)).join(' ')}"/>` + v.map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p.rep).toFixed(1)}" r="4" fill="#00D4AA"/><text x="${x(i).toFixed(1)}" y="${(y(p.rep) - 8).toFixed(1)}" fill="#F0F0FF" font-size="10" text-anchor="middle">${p.rep}</text><text x="${x(i).toFixed(1)}" y="${H - 6}" fill="#7878AA" font-size="8" text-anchor="middle">${dia(p.ts).slice(0, 5)}</text>`).join('');
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Gráfico: repetições no teste de sentar e levantar em 30 segundos">${g}</svg>`;
  }
  function evolucao(acabou) {
    const st = get(), u = (typeof U !== 'undefined' && U) || {}, ref = referencia(u.sexo, u.idade || 0), l = st.teste, ult = l[0];
    const refTxt = ref ? `Para ${u.sexo === 'M' ? 'homens' : 'mulheres'} de ${ref.de} a ${ref.ate} anos, quem faz menos de <b>${ref.min}</b> repetições costuma ficar abaixo da média nesse teste (referência do CDC / STEADI).` : 'Não tenho uma tabela de referência para a sua idade. Compare apenas com você mesmo.';
    janela(`<div class="sa-h">${acabou === true ? '✅ Resultado salvo' : '📈 Evolução do teste'}</div>
      ${ult ? `<p class="sa-p">Último teste: <b>${ult.rep} repetições</b> em ${dia(ult.ts)}${l[1] ? (ult.rep > l[1].rep ? '. Melhorou em relação ao anterior.' : ult.rep === l[1].rep ? '. Igual ao anterior.' : '. Um pouco abaixo do anterior; isso varia de um dia para outro.') : '.'}</p>` : '<p class="sa-p">Sem dados ainda. Faça o teste e repita a cada 2 semanas.</p>'}
      ${grafico(l, ref)}
      <details class="pa-grupo" style="margin-top:.8rem"><summary><b>Referência por idade (só para comparar)</b></summary><p class="sa-p">${refTxt}</p><p class="sa-small">É só uma referência, sem julgamento: não é um diagnóstico nem uma meta. O que importa é a sua evolução ao longo do tempo. Em caso de dúvida, converse com seu médico ou fisioterapeuta.</p></details>
      ${l.slice(0, 8).map(x => `<div class="md-linha"><span>${dia(x.ts)}</span><b>${x.rep}</b><span class="tiny muted">${x.maos ? 'usou as mãos' : 'repetições'}</span></div>`).join('')}
      <button class="sa-btn sec" id="pn-v">Voltar</button>`);
    $('pn-v').onclick = menu;
  }

  // ════════════════════════════════════════════════════════════
  //  MONTAGEM
  // ════════════════════════════════════════════════════════════
  function montar() {
    const card = (id, pai, pos) => {
      const el = $(pai); if (!el || $(id)) return;
      const d = document.createElement('div'); d.id = id; d.className = 'card';
      d.innerHTML = `<div class="card-header"><span class="card-title">🦵 Pernas Fortes (iniciante / 60+)</span></div><div class="small muted" style="margin-bottom:.6rem">10 exercícios com cadeira, 3 níveis e o teste de sentar e levantar em 30 s.</div><button class="btn btn-teal" style="width:100%" data-pf>Abrir</button>`;
      el.insertBefore(d, el.children[pos] || null); d.querySelector('[data-pf]').onclick = menu;
    };
    card('pf-card-home', 'p-home', 3); card('pf-card-treino', 'p-treino', 3);
  }

  window.Pernas = { montar, menu, comecar, teste, evolucao, EX, NIVEL, _sugestao: sugestaoNivel, _freq: avisoFrequencia, _ref: referencia, _get: get };
})();
