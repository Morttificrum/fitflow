/* FitFlow — modo "Saúde Adaptada" (terceira idade e comorbidades)
   Triagem baseada no PAR-Q+, perfil de condições, filtro/adaptação de exercícios,
   escala de esforço 0-10 + teste da fala, "Estou passando mal", alerta de frequência
   cardíaca, interface acessível e Health Connect (no app Android).
   Carregado depois do script principal: embrulha as funções dele sem reescrevê-las.
   AVISO: este app não substitui orientação médica. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const NATIVE = () => !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform());
  const today = () => (window.Shared ? Shared.day(new Date()) : new Date().toISOString().slice(0, 10));

  // ════════════════════════════════════════════════════════════
  //  DADOS
  // ════════════════════════════════════════════════════════════
  const DISCLAIMER = 'Este aplicativo oferece orientações gerais de atividade física e NÃO substitui consulta, diagnóstico, tratamento ou orientação de médico ou de outro profissional de saúde. Converse com seu médico antes de começar ou mudar sua rotina de exercícios. Em emergência, ligue 192.';

  // Versão resumida e adaptada do PAR-Q+ (7 perguntas de triagem). Não é o formulário oficial completo.
  const PARQ = [
    'Algum médico já disse que você tem um problema de coração, ou pressão alta?',
    'Você sente dor no peito em repouso, nas atividades do dia a dia ou quando faz atividade física?',
    'Você perde o equilíbrio por causa de tontura, ou já perdeu a consciência (desmaiou) nos últimos 12 meses? (Responda NÃO se a tontura foi só por respirar muito rápido durante um exercício intenso.)',
    'Algum médico já disse que você tem outra doença crônica, que não seja do coração ou pressão alta? (por exemplo: diabetes, asma, doença do pulmão, artrose, osteoporose, AVC)',
    'Você usa hoje algum remédio para tratar uma doença crônica?',
    'Você tem, ou teve nos últimos 12 meses, algum problema nos ossos, nas articulações ou nos músculos/tendões que poderia piorar se você ficasse mais ativo(a)? (Responda NÃO se o problema já foi resolvido.)',
    'Algum médico já disse que você só deve fazer atividade física com supervisão de um profissional de saúde?'
  ];

  const COND = {
    hipertensao: { label: 'Hipertensão', icon: '🩺',
      hide: ['isom', 'inversao', 'intenso'], adapt: ['isom_leve', 'cabeca_abaixo'],
      tips: ['Sem manobra de Valsalva e sem isometria pesada: expire durante o esforço, nunca prenda a respiração.', 'Levante-se devagar e evite ficar muito tempo com a cabeça abaixo do coração.', 'Se a pressão em repouso estiver acima de 180/110 mmHg (ou do limite que seu médico definiu), não treine hoje.'],
      pre: ['Tomei meus remédios de pressão como de costume.', 'Minha pressão em repouso hoje está abaixo de 180/110 mmHg (ou do limite que meu médico passou).'] },
    diabetes: { label: 'Diabetes', icon: '🍬',
      hide: [], adapt: ['intenso'],
      tips: ['Meça a glicemia antes de treinar e tenha SEMPRE um lanche rápido à mão (suco, bala ou glicose).', 'Abaixo de 100 mg/dL: coma um lanche com carboidrato antes. Acima de 250 mg/dL com cetonas, ou acima de 300 mg/dL: não treine hoje.', 'Confira os pés antes e depois do treino e use calçado fechado. Siga sempre a orientação do seu médico.'],
      pre: ['Medi minha glicemia agora e ela está dentro do que meu médico orientou (na dúvida: entre 100 e 250 mg/dL).', 'Estou com um lanche rápido à mão (suco, bala ou glicose).'] },
    artrose: { label: 'Artrose', icon: '🦴',
      hide: ['impacto', 'joelho_alto'], adapt: ['impacto_leve', 'joelho', 'chao'],
      tips: ['Só exercícios de baixo impacto: sem saltos, sem corrida.', 'Dor leve que passa em minutos é aceitável; dor forte, ou dor que piora e dura mais de 2 horas depois, é sinal para reduzir.', 'Faça 2 a 3 minutos de movimentos suaves para aquecer as articulações antes de começar.'],
      pre: ['Aqueci as articulações com 2 a 3 minutos de movimento suave.'] },
    osteoporose: { label: 'Osteoporose', icon: '🦴',
      hide: ['flex', 'torcao', 'impacto', 'equilibrio_alto'], adapt: ['equilibrio', 'flex_leve', 'torcao_leve', 'chao'],
      tips: ['Sem flexão de coluna com carga (abdominais, tocar os pés) e sem torção forçada do tronco.', 'Evite saltos e exercícios com risco de queda; use sempre apoio firme.', 'Mantenha a coluna alta e dobre o corpo pelos quadris, não pelas costas.'],
      pre: ['O local está seguro: piso firme, sem tapete solto ou obstáculos.'] },
    cardiopatia: { label: 'Cardiopatia (problema no coração)', icon: '❤️',
      hide: ['isom', 'intenso', 'impacto', 'inversao'], adapt: ['isom_leve', 'cabeca_abaixo', 'impacto_leve'],
      tips: ['Respeite o limite de frequência cardíaca que seu cardiologista passou. Remédios como betabloqueadores mudam a frequência: confie mais na escala de esforço.', 'Sem esforço máximo, sem prender a respiração e sem alta intensidade.', 'Qualquer dor ou aperto no peito, falta de ar anormal ou tontura: pare e use o botão "Estou passando mal".'],
      pre: ['Estou me sentindo bem hoje: sem dor no peito, falta de ar anormal ou tontura.', 'Tomei meus remédios como de costume.'] },
    avc: { label: 'Pós-AVC', icon: '🧠',
      hide: ['equilibrio_alto', 'inversao', 'intenso', 'isom', 'impacto'], adapt: ['equilibrio', 'chao', 'isom_leve'],
      tips: ['Faça sempre perto de uma cadeira ou parede firme e, de preferência, com alguém por perto.', 'Vá devagar com o lado do corpo mais afetado; o Tai Chi na cadeira é um ótimo começo.', 'Fraqueza súbita de um lado, boca torta ou fala enrolada: ligue 192 na hora.'],
      pre: ['Tem alguém por perto, ou meu telefone está ao alcance da mão.'] },
    respiratoria: { label: 'Doença respiratória (asma, DPOC...)', icon: '🫁',
      hide: ['intenso', 'impacto'], adapt: ['impacto_leve', 'isom_leve'],
      tips: ['Deixe a bombinha/medicação de resgate ao alcance durante todo o treino.', 'Respire pelo nariz quando der e solte o ar devagar, com os lábios semicerrados, durante o esforço.', 'Evite treinar com ar muito frio, seco ou poluído.'],
      pre: ['Minha bombinha ou medicação de resgate está comigo, ao alcance.'] },
    obesidade: { label: 'Obesidade', icon: '⚖️',
      hide: ['intenso', 'impacto', 'joelho_alto'], adapt: ['impacto_leve', 'joelho', 'chao'],
      tips: ['Comece devagar: o ritmo certo é o que deixa você conversar durante o exercício.', 'Sem saltos, para poupar joelhos e tornozelos. Hidrate-se e use roupas leves.', 'Use apoio ou cadeira para descer e levantar do chão.'],
      pre: ['Estou hidratado(a) e com roupa leve e calçado firme.'] }
  };
  const COND_KEYS = Object.keys(COND);

  const TAG_IDS = {
    isom: 'f10 f11 k15 k25 k21 k22 k23 k24 k13 y21 y22 y19 y17 y15',
    isom_leve: 'k04 y04 y05 y12 t21 c10 f01 f02 f03 f15 k01 k11 k12 y23',
    flex: 'f12 f13 x03 y11 y18 y15 k14 k24',
    flex_leve: 'x04 x08 y03',
    torcao: 'x02 x07 y13 y16 f13',
    torcao_leve: 't05 t12',
    impacto: 'f06 c01 c02 c03 c04 c05 c06 c07 c09 h01 h02 h03 h04 d02 d03 d05 d06 d07 d08 d10',
    impacto_leve: 'd01 d04 d09 c08',
    intenso: 'h01 h02 h03 h04 c03 c04 c06 c09 f06 k11 k21',
    inversao: 'y21 k22 y20',
    cabeca_abaixo: 'y03 y11 y18 x03 x04 y13 k12 y23',
    equilibrio: 'y06 t07 t21 t22 t23 f07 y04 y05',
    equilibrio_alto: 'k10 k16 k20 y19 y22 y14 y16',
    joelho: 'f04 f05 f07 y04 y05 y12 y18 c08 t14 k02 t21',
    joelho_alto: 'k10 k16 k20 f06 x05',
    chao: 'f08 f09 f10 f11 f12 f13 f14 f18 k01 k04 k05 k06 k14 y07 y08 y09 y17 y22 x02 x04 x05 x06 x08 x10 c10 y01 y10'
  };
  const EXTAGS = {};
  Object.keys(TAG_IDS).forEach(tag => TAG_IDS[tag].split(' ').forEach(id => (EXTAGS[id] = EXTAGS[id] || []).push(tag)));

  const TAG_LABEL = {
    isom: 'Isometria pesada / prender a respiração (Valsalva)', flex: 'Flexão de coluna com carga', torcao: 'Torção forçada da coluna',
    impacto: 'Alto impacto (saltos, corrida)', intenso: 'Alta intensidade', inversao: 'Posições invertidas (cabeça abaixo do corpo)',
    equilibrio_alto: 'Equilíbrio difícil (risco de queda)', joelho_alto: 'Sobrecarga forte no joelho'
  };
  const TAG_NOTE = {
    isom_leve: 'Segure no máximo 10 a 15 segundos e respire normalmente: expire no esforço, nunca prenda o ar.',
    cabeca_abaixo: 'Não fique com a cabeça abaixo do coração por muito tempo e levante-se devagar.',
    equilibrio: 'Faça perto de uma parede ou cadeira firme, com uma mão de apoio.',
    joelho: 'Desça só até onde não doer e mantenha os joelhos alinhados com os pés.',
    chao: 'Use apoio ou cadeira para descer e levantar do chão. Se for difícil levantar, pule este exercício.',
    flex_leve: 'Mantenha a coluna reta e dobre pelos quadris, sem arredondar as costas.',
    torcao_leve: 'Gire só até onde for confortável, sem forçar.',
    impacto_leve: 'Sem saltos: mantenha sempre um pé no chão.',
    intenso: 'Esforço forte pode mudar a glicemia: fique atento aos sinais e mantenha o lanche à mão.'
  };

  const RPE_COLOR = ['#9ae6b4', '#9ae6b4', '#9ae6b4', '#c6f6a0', '#e9f58a', '#fbe66b', '#fbbf4a', '#fb923c', '#f87171', '#ef4444', '#dc2626'];
  const RPE_TXT = [
    'Repouso.', 'Muito, muito leve.', 'Leve: você mal sente o esforço.', 'Leve: bom para aquecer e para começar.',
    'Moderado leve: está no ponto certo.', 'Moderado: dentro da meta, você ainda consegue conversar.',
    'Um pouco forte: fale pouco e diminua o ritmo.', 'Forte: DIMINUA o ritmo agora.',
    'Muito forte: reduza bastante ou pare.', 'Quase máximo: PARE o exercício.', 'Máximo: PARE agora.'
  ];

  // ════════════════════════════════════════════════════════════
  //  ESTADO
  // ════════════════════════════════════════════════════════════
  const BLANK = () => ({ v: 1, parq: null, cleared: null, conds: [], contact: { name: '', phone: '' }, hrLimit: null,
    adaptMode: 'auto', acc: { size: 0, contrast: false }, ack: false, preDay: null, log: [] });
  let S = BLANK();
  const load = () => { try { S = Object.assign(BLANK(), DB.load('saude', null) || {}); } catch (e) { S = BLANK(); } S.acc = Object.assign({ size: 0, contrast: false }, S.acc || {}); };
  const save = () => DB.save('saude', S);
  const logEvt = (type, extra) => { S.log = (S.log || []).concat(Object.assign({ t: new Date().toISOString(), type }, extra || {})).slice(-40); save(); };

  const age = () => (typeof U !== 'undefined' && U && U.idade) || 0;
  const forced = () => S.conds.length > 0 || !!(S.parq && S.parq.risk);
  const isAdapt = () => forced() || S.adaptMode === 'on' || (S.adaptMode === 'auto' && age() >= 60);
  const blocked = () => !!(S.parq && S.parq.risk && !(S.cleared && S.cleared.ok));
  const needTriage = () => !S.parq;

  // ── filtro de exercícios ──
  let hideMap = {}, noteMap = {};
  function rebuild() {
    hideMap = {}; noteMap = {};
    Object.keys(EXTAGS).forEach(id => {
      EXTAGS[id].forEach(tag => {
        S.conds.forEach(c => {
          const C = COND[c]; if (!C) return;
          if (C.hide.includes(tag)) (hideMap[id] = hideMap[id] || []).push({ cond: c, tag });
          else if (C.adapt.includes(tag) && TAG_NOTE[tag]) {
            const arr = (noteMap[id] = noteMap[id] || []);
            let n = arr.find(x => x.tag === tag);
            if (!n) arr.push(n = { tag, text: TAG_NOTE[tag], conds: [] });
            if (!n.conds.includes(c)) n.conds.push(c);
          }
        });
      });
    });
  }
  const hidden = id => !!hideMap[id];
  function notesHtml(id) {
    const n = noteMap[id]; if (!n || !n.length || hidden(id)) return '';
    return n.map(x => `<div class="ex-adapt">⚠️ <b>Adaptação</b> (${x.conds.map(c => COND[c].label.split(' (')[0]).join(', ')}): ${esc(x.text)}</div>`).join('');
  }
  function hiddenCount() { return Object.keys(hideMap).length; }

  // ════════════════════════════════════════════════════════════
  //  JANELAS
  // ════════════════════════════════════════════════════════════
  function openOv(html, modal, onClose) {
    closeOv();
    const ov = document.createElement('div');
    ov.className = 'sa-ov' + (modal ? ' modal' : '');
    ov.id = 'sa-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    ov.innerHTML = `<div class="sa-box">${html}</div>`;
    ov._onClose = onClose;
    document.body.appendChild(ov);
    ov.scrollTop = 0;
    return ov;
  }
  function closeOv() { const o = $('sa-ov'); if (o) { o.remove(); } }

  // ── triagem ──────────────────────────────────────────────
  let tri = null;
  function startTriage(redo) {
    tri = { step: 0, ans: (redo && S.parq && S.parq.ans) ? S.parq.ans.slice() : Array(PARQ.length).fill(null),
      age: age() || null, conds: S.conds.slice(), contact: Object.assign({}, S.contact), hrLimit: S.hrLimit, cleared: S.cleared ? Object.assign({}, S.cleared) : { ok: false, date: '', note: '' },
      ack: false, anySim: false };
    renderTri();
  }
  const dots = n => `<div class="sa-steps" aria-hidden="true">${[0, 1, 2, 3].map(i => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</div>`;

  function renderTri() {
    const t = tri;
    let h = '';
    if (t.step === 0) {
      h = `${dots(0)}<div class="sa-h">🛟 Antes de começar</div>
      <p class="sa-p">Vamos fazer algumas perguntas rápidas sobre a sua saúde para deixar os treinos mais seguros para você. Leva 2 minutos.</p>
      <div class="sa-alert warn"><b>Importante:</b> ${esc(DISCLAIMER)}</div>
      <label class="sa-row ${t.ack ? 'sel' : ''}"><input type="checkbox" id="tri-ack" ${t.ack ? 'checked' : ''}> <span>Li e entendi que o app <b>não substitui</b> orientação médica.</span></label>
      <button class="sa-btn" id="tri-next" ${t.ack ? '' : 'disabled'}>Começar</button>`;
    } else if (t.step === 1) {
      h = `${dots(1)}<div class="sa-h">Perguntas de saúde</div>
      <p class="sa-small">Baseado no PAR-Q+, questionário internacional de prontidão para atividade física (versão resumida e adaptada; não é o formulário oficial completo). Responda com sinceridade.</p>` +
        PARQ.map((q, i) => `<div class="sa-q"><div class="t"><span class="n">${i + 1}.</span>${esc(q)}</div>
          <div class="sa-yn" role="group" aria-label="Pergunta ${i + 1}">
            <button data-q="${i}" data-v="0" class="${t.ans[i] === false ? 'on-no' : ''}">NÃO</button>
            <button data-q="${i}" data-v="1" class="${t.ans[i] === true ? 'on-yes' : ''}">SIM</button></div></div>`).join('') +
        `<button class="sa-btn" id="tri-next" ${t.ans.every(a => a !== null) ? '' : 'disabled'}>Continuar</button>
         <button class="sa-btn sec" id="tri-back">Voltar</button>`;
    } else if (t.step === 2) {
      const sim = t.ans.some(a => a === true);
      t.anySim = sim;
      const risk = sim || t.conds.length > 0;
      h = `${dots(2)}<div class="sa-h">Suas condições e contato de segurança</div>
      <p class="sa-p">Marque o que se aplica a você. O FitFlow esconde ou adapta os exercícios que não servem para essas condições.</p>` +
        COND_KEYS.map(k => `<label class="sa-row ${t.conds.includes(k) ? 'sel' : ''}"><input type="checkbox" data-c="${k}" ${t.conds.includes(k) ? 'checked' : ''}> <span>${COND[k].icon} <b>${esc(COND[k].label)}</b></span></label>`).join('') +
        `<label class="sa-lbl" for="tri-age">Sua idade, em anos (obrigatória)</label><input class="sa-in" id="tri-age" type="number" inputmode="numeric" min="10" max="110" value="${t.age || ''}" placeholder="Ex.: 65"><div class="sa-small" id="tri-agewarn" style="color:var(--yellow)"></div>
        <div class="sa-p" style="margin-top:1rem"><b>Contato de emergência</b> <span class="sa-small">(vai aparecer no botão "Estou passando mal")</span></div>
        <label class="sa-lbl" for="tri-cn">Nome</label><input class="sa-in" id="tri-cn" value="${esc(t.contact.name)}" placeholder="Ex.: Maria (filha)" maxlength="40" autocomplete="off">
        <label class="sa-lbl" for="tri-cp">Telefone com DDD</label><input class="sa-in" id="tri-cp" value="${esc(t.contact.phone)}" placeholder="Ex.: 11 91234-5678" inputmode="tel" maxlength="20" autocomplete="off">
        <label class="sa-lbl" for="tri-hr">Limite de frequência cardíaca, em bpm (opcional)</label>
        <input class="sa-in" id="tri-hr" type="number" inputmode="numeric" min="60" max="220" value="${t.hrLimit || ''}" placeholder="Padrão: ${defaultHrLimit()} bpm">
        <div class="sa-small">Se seu médico passou um limite, digite aqui. Sem número, usamos 70% da frequência máxima estimada para a sua idade. Se você tem um relógio ou cinta conectado, o app avisa quando o limite for passado.</div>
        <button class="sa-btn" id="tri-next">Continuar</button><button class="sa-btn sec" id="tri-back">Voltar</button>`;
    } else if (t.step === 3) {
      const sim = t.ans.some(a => a === true), risk = sim || t.conds.length > 0;
      t.risk = risk;
      if (!risk) {
        h = `${dots(3)}<div class="sa-h">✅ Tudo certo</div>
        <div class="sa-alert ok">Pelas suas respostas, você pode começar com exercícios leves e ir aumentando aos poucos. Respeite sempre os sinais do corpo.</div>
        <div class="sa-stop"><b>⛔ Pare na hora se sentir:</b><ul><li>dor ou aperto no peito</li><li>falta de ar fora do normal</li><li>tontura, visão turva ou vontade de desmaiar</li><li>batimentos disparados ou irregulares</li><li>dor forte em articulação ou músculo</li></ul></div>
        <p class="sa-small">${esc(DISCLAIMER)}</p>
        <button class="sa-btn green" id="tri-done">Entrar no FitFlow</button>`;
      } else {
        const tips = t.conds.map(c => `<p class="sa-p"><b>${COND[c].icon} ${esc(COND[c].label)}</b></p><ul class="sa-list">${COND[c].tips.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`).join('');
        h = `${dots(3)}<div class="sa-h">⚠️ Converse com seu médico</div>
        <div class="sa-alert warn">${sim ? 'Você respondeu <b>SIM</b> a pelo menos uma pergunta de saúde' : 'Você marcou uma condição de saúde'}. Antes de treinar, é importante ter a <b>liberação do seu médico</b>. Os treinos só aparecem depois que você confirmar abaixo que já foi liberado(a).</div>
        <p class="sa-p"><b>Leve estas perguntas à consulta:</b></p>
        <ul class="sa-list"><li>Posso fazer atividade física? De que tipo e com que intensidade?</li><li>Existe algum exercício que devo evitar?</li><li>Qual é o limite de frequência cardíaca para mim?</li><li>Preciso medir pressão ou glicemia antes de treinar?</li></ul>
        <label class="sa-row ${t.cleared.ok ? 'sel' : ''}"><input type="checkbox" id="tri-cl" ${t.cleared.ok ? 'checked' : ''}> <span><b>Confirmo que meu médico já me liberou</b> para praticar atividade física.</span></label>
        <div id="tri-clbox" style="display:${t.cleared.ok ? 'block' : 'none'}">
          <label class="sa-lbl" for="tri-cd">Data aproximada da liberação (obrigatória)</label>
          <input class="sa-in" id="tri-cd" type="date" max="${today()}" value="${esc(t.cleared.date || '')}">
          <label class="sa-lbl" for="tri-cnote">Orientações ou limitações que o médico passou (opcional)</label>
          <input class="sa-in" id="tri-cnote" maxlength="140" value="${esc(t.cleared.note || '')}" placeholder="Ex.: caminhar e fazer alongamento, sem carga">
        </div>
        ${tips ? `<div class="sa-p" style="margin-top:1rem"><b>Regras que o app vai seguir por você:</b></div>${tips}` : ''}
        <div class="sa-stop"><b>⛔ Pare na hora se sentir:</b><ul><li>dor ou aperto no peito</li><li>falta de ar fora do normal</li><li>tontura, visão turva ou vontade de desmaiar</li><li>batimentos disparados ou irregulares</li><li>dor forte em articulação ou músculo</li></ul></div>
        <p class="sa-small">${esc(DISCLAIMER)}</p>
        <button class="sa-btn green" id="tri-done">${'Salvar e entrar no FitFlow'}</button>
        <div class="sa-small" id="tri-warn" style="color:var(--yellow)"></div>`;
      }
    }
    openOv(h, false);
    bindTri();
  }

  function bindTri() {
    const t = tri, on = (id, fn) => { const e = $(id); if (e) e.onclick = fn; };
    const ack = $('tri-ack'); if (ack) ack.onchange = () => { t.ack = ack.checked; $('tri-next').disabled = !t.ack; ack.closest('.sa-row').classList.toggle('sel', t.ack); };
    document.querySelectorAll('.sa-yn button').forEach(b => b.onclick = () => {
      t.ans[+b.dataset.q] = b.dataset.v === '1';
      const sc = $('sa-ov').scrollTop; renderTri(); $('sa-ov').scrollTop = sc;
    });
    document.querySelectorAll('input[data-c]').forEach(c => c.onchange = () => {
      const k = c.dataset.c; t.conds = c.checked ? t.conds.concat(k) : t.conds.filter(x => x !== k);
      c.closest('.sa-row').classList.toggle('sel', c.checked);
    });
    const cl = $('tri-cl'); if (cl) cl.onchange = () => { t.cleared.ok = cl.checked; $('tri-clbox').style.display = cl.checked ? 'block' : 'none'; cl.closest('.sa-row').classList.toggle('sel', cl.checked); };
    on('tri-back', () => { grabStep2(); t.step = Math.max(1, t.step - 1); renderTri(); });
    on('tri-next', () => {
      if (t.step === 2) { grabStep2(); if (!t.age) { $('tri-agewarn').textContent = 'Informe a sua idade (de 10 a 110 anos). Ela ajusta os treinos e o limite de frequência.'; $('tri-age').focus(); return; } }
      t.step++; renderTri();
    });
    on('tri-done', finishTri);
  }
  function grabStep2() {
    const n = $('tri-cn'); if (!n) return;
    const ag = parseInt($('tri-age').value, 10); tri.age = (ag >= 10 && ag <= 110) ? ag : null;
    tri.contact = { name: n.value.trim(), phone: $('tri-cp').value.trim() };
    const hr = parseInt($('tri-hr').value, 10); tri.hrLimit = (hr >= 60 && hr <= 220) ? hr : null;
  }
  function finishTri() {
    const t = tri;
    if (t.risk) {
      const cl = $('tri-cl');
      t.cleared.ok = !!(cl && cl.checked);
      if (t.cleared.ok) {
        t.cleared.date = $('tri-cd').value; t.cleared.note = $('tri-cnote').value.trim();
        if (!t.cleared.date) { $('tri-warn').textContent = 'Informe a data aproximada da liberação médica para continuar.'; $('tri-cd').focus(); return; }
      }
    }
    if (t.age && typeof U !== 'undefined' && U && U.idade !== t.age) { U.idade = t.age; try { U.kcalMeta = calcKcal(U.peso, U.altura, U.idade, U.sexo, U.goal); } catch (e) {} DB.save('profile', U); }
    S.ack = true;
    S.parq = { ans: t.ans.slice(), risk: !!t.risk, date: today() };
    S.cleared = t.risk && t.cleared.ok ? { ok: true, date: t.cleared.date, note: t.cleared.note, saved: today() } : null;
    S.conds = t.conds.slice(); S.contact = t.contact; S.hrLimit = t.hrLimit;
    if (!S.acc.size && age() >= 60) S.acc.size = 1;   // sugestão inicial para 60+; dá para mudar no Perfil
    logEvt('triagem', { risk: S.parq.risk, cleared: !!S.cleared });
    closeOv(); tri = null;
    afterChange();
    if (S.parq.risk && !S.cleared) setTimeout(() => modalGate(), 300);
  }

  // ── bloqueio sem liberação médica ──
  function modalGate() {
    openOv(`<div class="sa-h">🔒 Treinos bloqueados</div>
      <div class="sa-alert warn">Pelas suas respostas, os treinos só são liberados depois que você confirmar que seu <b>médico já autorizou</b> a atividade física.</div>
      <p class="sa-p">Converse com seu médico e volte aqui. Enquanto isso, você pode usar o cardápio, a água, a saúde e o coach.</p>
      <label class="sa-row"><input type="checkbox" id="g-cl"> <span><b>Confirmo que meu médico já me liberou</b> para praticar atividade física.</span></label>
      <label class="sa-lbl" for="g-cd">Data aproximada da liberação (obrigatória)</label><input class="sa-in" id="g-cd" type="date" max="${today()}">
      <label class="sa-lbl" for="g-cn">Orientações ou limitações do médico (opcional)</label><input class="sa-in" id="g-cn" maxlength="140">
      <div class="sa-small" id="g-warn" style="color:var(--yellow)"></div>
      <button class="sa-btn green" id="g-ok">Confirmar liberação</button>
      <button class="sa-btn sec" id="g-close">Fechar</button>
      <p class="sa-small">${esc(DISCLAIMER)}</p>`, true);
    $('g-close').onclick = () => { closeOv(); if (typeof nav === 'function') _nav('home'); };
    $('g-ok').onclick = () => {
      if (!$('g-cl').checked) { $('g-warn').textContent = 'Marque a confirmação para liberar os treinos.'; return; }
      if (!$('g-cd').value) { $('g-warn').textContent = 'Informe a data aproximada da liberação.'; return; }
      S.cleared = { ok: true, date: $('g-cd').value, note: $('g-cn').value.trim(), saved: today() };
      logEvt('liberacao', { date: S.cleared.date }); closeOv(); afterChange();
      if (typeof showNotif === 'function') showNotif('✅', 'Treinos liberados', 'Lembre-se: pare sempre que sentir algum sinal de alerta.');
    };
  }

  // ── "Estou passando mal" ──
  function modalSOS(fromHr) {
    stopWorkout();
    const c = S.contact || {};
    const phone = (c.phone || '').replace(/[^\d+]/g, '');
    const blocks = [];
    if (S.conds.includes('diabetes')) blocks.push(`<div class="sa-alert warn"><b>🍬 Diabetes:</b> tremor, suor frio, fome súbita, tontura ou confusão podem ser <b>hipoglicemia</b>. Se conseguir engolir, tome cerca de 15 g de açúcar (1 colher de sopa de açúcar ou meio copo de suco) e meça a glicemia. Repita em 15 minutos se continuar baixa. Se não melhorar ou houver confusão, ligue 192.</div>`);
    if (S.conds.includes('respiratoria')) blocks.push(`<div class="sa-alert warn"><b>🫁 Respiratória:</b> sente-se inclinado(a) para a frente, respire devagar com os lábios semicerrados e use a bombinha de resgate conforme seu médico orientou.</div>`);
    if (S.conds.includes('hipertensao') || S.conds.includes('cardiopatia')) blocks.push(`<div class="sa-alert warn"><b>❤️ Pressão/coração:</b> sente-se, afrouxe a roupa e fique quieto(a). Use medicação de resgate <b>somente</b> se seu médico já orientou. Dor no peito = 192.</div>`);
    if (S.conds.includes('avc')) blocks.push(`<div class="sa-alert bad"><b>🧠 Pós-AVC:</b> fraqueza súbita de um lado do corpo, boca torta, fala enrolada ou dor de cabeça forte e repentina: <b>ligue 192 imediatamente</b> e anote a hora em que começou.</div>`);
    openOv(`<div class="sa-h" style="color:var(--red)">🆘 PARE AGORA</div>
      ${fromHr ? '<div class="sa-alert bad">Sua frequência cardíaca passou do limite.</div>' : ''}
      <p class="sa-p"><b>O treino foi pausado.</b> Sente-se ou deite-se em um lugar seguro, apoie-se e respire devagar. Não fique sozinho(a) se puder evitar.</p>
      <a class="sa-btn red" href="tel:192" id="sos-192">📞 Ligar para o SAMU (192)</a>
      ${phone ? `<a class="sa-btn" href="tel:${esc(phone)}" id="sos-contact">📞 Ligar para ${esc(c.name || 'meu contato')}</a>` : `<button class="sa-btn sec" id="sos-add">➕ Cadastrar contato de emergência</button>`}
      <div class="sa-alert bad"><b>Ligue 192 na hora</b> se tiver: dor ou aperto no peito (ou que vai para braço, mandíbula ou costas), falta de ar forte, desmaio, confusão, fala enrolada, boca torta, fraqueza em um lado do corpo ou batimentos muito irregulares.</div>
      ${blocks.join('')}
      <button class="sa-btn sec" id="sos-ok">Já passou. Vou descansar</button>
      <p class="sa-small">${esc(DISCLAIMER)}</p>`, true);
    logEvt('mal-estar', { hr: !!fromHr });
    const ok = $('sos-ok'); if (ok) ok.onclick = () => closeOv();
    const add = $('sos-add'); if (add) add.onclick = () => { closeOv(); if (typeof nav === 'function') { _nav('perfil'); } setTimeout(() => modalContact(), 100); };
  }
  function stopWorkout() {
    try { if (typeof timerRunning !== 'undefined' && timerRunning && typeof pauseTimer === 'function') pauseTimer(); } catch (e) {}
    try { if (typeof restIv !== 'undefined') clearInterval(restIv); const ro = $('rest-overlay'); if (ro) ro.classList.remove('show'); } catch (e) {}
    try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) {}
    try { if (typeof vibra === 'function') vibra([400, 150, 400]); } catch (e) {}
  }

  // ── lembrete antes do treino ──
  function preItems() {
    const items = ['Estou me sentindo bem hoje (sem dor no peito, falta de ar ou tontura).', 'Sei que devo parar se sentir qualquer sinal de alerta.'];
    S.conds.forEach(c => COND[c].pre.forEach(p => items.push(p)));
    return items;
  }
  function preflight(go) {
    if (!isAdapt() || S.preDay === today()) { go(); return; }
    const items = preItems();
    openOv(`<div class="sa-h">✅ Antes de começar</div>
      <p class="sa-p">Marque cada item para liberar o treino de hoje.</p>
      ${items.map((x, i) => `<label class="sa-row"><input type="checkbox" class="pf"> <span>${esc(x)}</span></label>`).join('')}
      <button class="sa-btn green" id="pf-go" disabled>Começar o treino</button>
      <button class="sa-btn sec" id="pf-cancel">Agora não</button>
      <p class="sa-small">${esc(DISCLAIMER)}</p>`, true);
    const upd = () => { $('pf-go').disabled = ![...document.querySelectorAll('.pf')].every(c => c.checked); };
    document.querySelectorAll('.pf').forEach(c => c.onchange = () => { c.closest('.sa-row').classList.toggle('sel', c.checked); upd(); });
    $('pf-cancel').onclick = () => closeOv();
    $('pf-go').onclick = () => { S.preDay = today(); save(); closeOv(); go(); };
  }

  // ── lista do que foi escondido ──
  function modalHidden() {
    const by = {};
    Object.keys(hideMap).forEach(id => hideMap[id].forEach(r => { const k = r.tag; (by[k] = by[k] || { ids: new Set(), conds: new Set() }); by[k].ids.add(id); by[k].conds.add(r.cond); }));
    const name = id => { for (const c in EX) { const e = EX[c].find(x => x.id === id); if (e) return e.name; } return id; };
    openOv(`<div class="sa-h">Exercícios escondidos</div>
      <p class="sa-p">Por causa das suas condições, o FitFlow esconde estes exercícios para a sua segurança:</p>
      ${Object.keys(by).map(tag => `<p class="sa-p"><b>${esc(TAG_LABEL[tag] || tag)}</b> <span class="sa-small">(${[...by[tag].conds].map(c => COND[c].label.split(' (')[0]).join(', ')})</span></p>
        <div class="sa-small">${[...by[tag].ids].map(name).map(esc).join(' · ')}</div>`).join('') || '<p class="sa-p">Nenhum exercício escondido.</p>'}
      <button class="sa-btn sec" id="hid-ok">Fechar</button>`, true);
    $('hid-ok').onclick = () => closeOv();
  }

  function modalContact() {
    openOv(`<div class="sa-h">Contato e frequência cardíaca</div>
      <label class="sa-lbl" for="ct-n">Nome do contato de emergência</label><input class="sa-in" id="ct-n" value="${esc(S.contact.name)}" maxlength="40">
      <label class="sa-lbl" for="ct-p">Telefone com DDD</label><input class="sa-in" id="ct-p" value="${esc(S.contact.phone)}" inputmode="tel" maxlength="20">
      <label class="sa-lbl" for="ct-h">Limite de frequência cardíaca (bpm)</label><input class="sa-in" id="ct-h" type="number" inputmode="numeric" min="60" max="220" value="${S.hrLimit || ''}" placeholder="Padrão: ${defaultHrLimit()} bpm">
      <div class="sa-small">Deixe em branco para usar o padrão (70% da frequência máxima estimada para a sua idade).</div>
      <button class="sa-btn green" id="ct-ok">Salvar</button><button class="sa-btn sec" id="ct-x">Cancelar</button>`, true);
    $('ct-x').onclick = () => closeOv();
    $('ct-ok').onclick = () => {
      S.contact = { name: $('ct-n').value.trim(), phone: $('ct-p').value.trim() };
      const hr = parseInt($('ct-h').value, 10); S.hrLimit = (hr >= 60 && hr <= 220) ? hr : null;
      save(); closeOv(); renderProfileCard();
    };
  }
  function modalConds() {
    const sel = S.conds.slice();
    openOv(`<div class="sa-h">Minhas condições</div>
      <p class="sa-p">Mudar as condições muda quais exercícios aparecem.</p>
      ${COND_KEYS.map(k => `<label class="sa-row ${sel.includes(k) ? 'sel' : ''}"><input type="checkbox" data-c="${k}" ${sel.includes(k) ? 'checked' : ''}> <span>${COND[k].icon} <b>${esc(COND[k].label)}</b></span></label>`).join('')}
      <button class="sa-btn green" id="cd-ok">Salvar</button><button class="sa-btn sec" id="cd-x">Cancelar</button>`, true);
    document.querySelectorAll('#sa-ov input[data-c]').forEach(c => c.onchange = () => { const k = c.dataset.c; const i = sel.indexOf(k); if (c.checked && i < 0) sel.push(k); if (!c.checked && i >= 0) sel.splice(i, 1); c.closest('.sa-row').classList.toggle('sel', c.checked); });
    $('cd-x').onclick = () => closeOv();
    $('cd-ok').onclick = () => {
      const added = sel.some(k => !S.conds.includes(k));
      S.conds = sel; if (sel.length && S.parq) S.parq.risk = true;
      if (added && S.cleared) { S.cleared = null; }   // condição nova: pede liberação de novo
      save(); closeOv(); afterChange();
      if (blocked()) setTimeout(modalGate, 200);
    };
  }

  // ════════════════════════════════════════════════════════════
  //  FREQUÊNCIA CARDÍACA
  // ════════════════════════════════════════════════════════════
  const maxHRest = () => (typeof maxHR === 'function' ? maxHR() : Math.round(208 - 0.7 * (age() || 60)));
  function defaultHrLimit() { return Math.round(maxHRest() * 0.70); }
  const hrLimit = () => S.hrLimit || (isAdapt() ? defaultHrLimit() : null);
  let hrHigh = 0, hrCool = 0;
  function hrSample(bpm) {
    const lim = hrLimit(); if (!lim || !bpm) return;
    if (bpm > lim) hrHigh++; else hrHigh = 0;
    if (hrHigh >= 3 && Date.now() > hrCool) {
      hrCool = Date.now() + 60000; hrHigh = 0;
      stopWorkout();
      const el = document.createElement('div');
      el.className = 'sa-hr'; el.setAttribute('role', 'alert');
      el.innerHTML = `<b>❤️ ${bpm} bpm: acima do seu limite (${lim} bpm).</b><br>Treino pausado. Diminua o ritmo, sente-se e respire devagar. Se sentir algum mal-estar, use o botão de socorro.
        <div style="display:flex;gap:.5rem;margin-top:.6rem"><button class="sa-btn sec" style="margin:0;min-height:2.8rem" id="hr-ok">Entendi</button><button class="sa-btn red" style="margin:0;min-height:2.8rem" id="hr-sos">🆘 Estou passando mal</button></div>`;
      document.body.appendChild(el);
      try { if (typeof beep === 'function') { beep(440, 0.4, 0.5); setTimeout(() => beep(440, 0.4, 0.5), 500); } if (typeof say === 'function') say('Frequência cardíaca acima do limite. Treino pausado. Diminua o ritmo e respire devagar.'); } catch (e) {}
      logEvt('fc-alta', { bpm, lim });
      $('hr-ok').onclick = () => el.remove();
      $('hr-sos').onclick = () => { el.remove(); modalSOS(true); };
    }
  }

  // ════════════════════════════════════════════════════════════
  //  ESFORÇO 0-10 E TESTE DA FALA (no timer)
  // ════════════════════════════════════════════════════════════
  let cur = { rpe: null, talk: null };
  function renderRpe() {
    const box = $('sa-rpe'); if (!box) return;
    if (!isAdapt()) { box.style.display = 'none'; return; }
    box.style.display = 'block';
    const talkOpt = [['ok', 'Consigo falar frases inteiras'], ['pouco', 'Só consigo falar poucas palavras'], ['nao', 'Quase não consigo falar']];
    box.innerHTML = `<h4>🎚️ Como está o esforço agora? (0 a 10)</h4>
      <div class="sa-small">Meta: entre <b>3 e 5</b>. Sem pressa e sem meta de desempenho.</div>
      <div class="sa-rpe-row" role="group" aria-label="Escala de esforço de 0 a 10">${RPE_COLOR.map((c, i) => `<button style="background:${c}" data-r="${i}" class="${cur.rpe === i ? 'sel' : ''}" aria-label="Esforço ${i}">${i}</button>`).join('')}</div>
      <h4 style="margin-top:.7rem">🗣️ Teste da fala</h4>
      <div class="sa-talk" role="group">${talkOpt.map(([k, t]) => `<button data-t="${k}" class="${cur.talk === k ? 'sel' : ''}">${t}</button>`).join('')}</div>
      <div class="sa-rpe-msg" id="sa-rpe-msg" aria-live="polite">${rpeAdvice()}</div>`;
    box.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { cur.rpe = +b.dataset.r; rpeReact(); renderRpe(); });
    box.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { cur.talk = b.dataset.t; rpeReact(); renderRpe(); });
  }
  function rpeAdvice() {
    if (cur.rpe == null && !cur.talk) return 'Toque no número que mostra o seu esforço, ou responda ao teste da fala.';
    const out = [];
    if (cur.rpe != null) out.push(`<b>${cur.rpe}:</b> ${RPE_TXT[cur.rpe]}`);
    if (cur.talk === 'ok') out.push('Teste da fala: ótimo, é a intensidade certa.');
    if (cur.talk === 'pouco') out.push('Teste da fala: você está forçando. <b>Diminua o ritmo</b> até conseguir conversar.');
    if (cur.talk === 'nao') out.push('Teste da fala: <b>PARE e descanse</b>. Esse esforço está forte demais.');
    return out.join('<br>');
  }
  function rpeReact() {
    const hard = (cur.rpe != null && cur.rpe >= 9) || cur.talk === 'nao';
    const mid = (cur.rpe != null && cur.rpe >= 7) || cur.talk === 'pouco';
    if (hard) { stopWorkout(); try { say('Esforço forte demais. Pare e descanse.'); } catch (e) {} }
    else if (mid) { try { vibra([200, 100, 200]); } catch (e) {} }
  }

  // ════════════════════════════════════════════════════════════
  //  INTERFACE: acessibilidade, perfil, avisos fixos
  // ════════════════════════════════════════════════════════════
  const REST0 = {};
  function applyUI() {
    const h = document.documentElement;
    h.classList.remove('acc-1', 'acc-2');
    if (S.acc.size === 1) h.classList.add('acc-1'); else if (S.acc.size === 2) h.classList.add('acc-2');
    h.classList.toggle('hc', !!S.acc.contrast);
    const ad = isAdapt();
    h.classList.toggle('sa-adapt', ad);
    // descansos mais longos no modo adaptado
    if (typeof CAT_INFO !== 'undefined') Object.keys(CAT_INFO).forEach(k => { if (REST0[k] == null) REST0[k] = CAT_INFO[k].rest; CAT_INFO[k].rest = ad ? Math.max(20, Math.round(REST0[k] * 1.5)) : REST0[k]; });
    // marca elementos de "meta de desempenho"
    [['d-kcal', '.stat-card'], ['h-steps-bar', '.pbar-wrap'], ['nb-conquistas', null]].forEach(([id, sel]) => { const e = $(id); const t = e && (sel ? e.closest(sel) : e); if (t) t.classList.add('perf'); });
    const sf = $('dash-streak'); if (sf) { const f = sf.closest('.streak-fire'); if (f) f.classList.add('perf'); }
    document.querySelectorAll('.lvl-chip[data-l="avancado"]').forEach(b => { b.style.display = ad ? 'none' : ''; });
    const sos = $('sa-sos'); if (sos) sos.innerHTML = ad ? '🆘 Estou passando mal' : '🆘 Socorro';
    if (sos) sos.setAttribute('aria-label', 'Estou passando mal');
    const aa = $('sa-aa'); if (aa) aa.textContent = ['Aa', 'Aa+', 'Aa++'][S.acc.size || 0];
    renderRpe(); navH();
  }

  // altura real da barra de baixo (cresce com a letra grande): a barra da playlist e o fim da tela se ajustam
  function navH() { const n = document.querySelector('.bottom-nav'); if (n) document.documentElement.style.setProperty('--navh', n.offsetHeight + 'px'); }
  window.addEventListener('resize', navH);
  if (window.ResizeObserver) { const t = setInterval(() => { const n = document.querySelector('.bottom-nav'); if (n) { new ResizeObserver(navH).observe(n); clearInterval(t); } }, 300); }

  function stopStripHtml(withBtn) {
    return `<div class="sa-stop" role="note" aria-label="Sinais para parar o exercício"><b>⛔ Pare na hora se sentir:</b>
      <ul><li>dor ou aperto no peito</li><li>falta de ar fora do normal</li><li>tontura, visão turva ou vontade de desmaiar</li><li>batimentos disparados ou irregulares</li><li>dor forte em articulação ou músculo</li></ul>
      ${withBtn ? '<button class="sa-sos-big" style="margin:.5rem 0 0" onclick="SA.sos()">🆘 Estou passando mal</button>' : ''}</div>`;
  }

  function inject() {
    // treino
    const pt = $('p-treino');
    if (pt && !$('sa-treino-top')) {
      const d = document.createElement('div'); d.id = 'sa-treino-top';
      pt.insertBefore(d, pt.children[1] || null);
      const f = document.createElement('div'); f.className = 'sa-disc'; f.id = 'sa-treino-disc'; f.textContent = DISCLAIMER; pt.appendChild(f);
    }
    // timer
    const tp = $('p-timer');
    if (tp && !$('sa-timer-top')) {
      const d = document.createElement('div'); d.id = 'sa-timer-top';
      tp.insertBefore(d, tp.children[1] || null);
      const f = document.createElement('div'); f.className = 'sa-disc'; f.textContent = DISCLAIMER; tp.appendChild(f);
    }
    const wrap = document.querySelector('#timer-active .timer-wrap');
    if (wrap && !$('t-fig')) {
      const fig = document.createElement('div'); fig.id = 't-fig'; fig.className = 't-fig'; wrap.insertBefore(fig, wrap.children[1] || null);
      const rpe = document.createElement('div'); rpe.id = 'sa-rpe'; rpe.className = 'sa-rpe'; rpe.style.display = 'none';
      const tb = wrap.querySelector('.timer-btns'); wrap.insertBefore(rpe, tb ? tb.nextSibling : null);
    }
    // barra de ferramentas fixa no topo: socorro, tamanho da letra e troca de app (nada flutua sobre a tela)
    const topbar = document.querySelector('.topbar');
    if (topbar && !$('sa-bar')) {
      const bar = document.createElement('div'); bar.id = 'sa-bar'; bar.className = 'sa-bar';
      const sos = document.createElement('button'); sos.id = 'sa-sos'; sos.className = 'sa-sos-bar'; sos.type = 'button'; sos.onclick = () => modalSOS();
      const aa = document.createElement('button'); aa.id = 'sa-aa'; aa.className = 'sa-aa'; aa.type = 'button'; aa.setAttribute('aria-label', 'Tamanho da letra');
      aa.onclick = () => { S.acc.size = ((S.acc.size || 0) + 1) % 3; save(); applyUI(); renderProfileCard(); };
      const sw = document.createElement('a'); sw.id = 'sw-btn'; sw.className = 'sa-sw'; sw.title = 'Trocar para o Escoteiro Moderno'; sw.innerHTML = '🏕️ <span class="lbl">Escoteiro</span> ⇄'; sw.setAttribute('aria-label', 'Trocar para o Escoteiro Moderno');
      // web: link relativo; app Android (Capacitor): caminho absoluto com index.html explícito
      sw.setAttribute('href', NATIVE() ? '/escoteiro-moderno/index.html' : '../escoteiro-moderno/');
      bar.appendChild(sos); bar.appendChild(aa); bar.appendChild(sw);
      topbar.appendChild(bar);
    }
    // perfil
    const pp = $('p-perfil');
    if (pp && !$('sa-profile')) { const d = document.createElement('div'); d.id = 'sa-profile'; pp.insertBefore(d, pp.children[1] || null); }
    // saúde: Health Connect
    const ps = $('p-saude');
    if (ps && NATIVE() && !$('sa-hc')) {
      const d = document.createElement('div'); d.id = 'sa-hc'; d.className = 'card';
      d.innerHTML = `<div class="card-header"><span class="card-title">📲 Health Connect (Android)</span></div>
        <div class="small muted" style="line-height:1.6;margin-bottom:.6rem">Traz passos, frequência cardíaca e calorias do seu relógio/celular. Durante o treino, o app usa a frequência para avisar se passar do limite.</div>
        <button class="btn btn-teal" style="width:100%" id="hc-btn">Conectar e sincronizar</button><div class="tiny muted" id="hc-msg" style="margin-top:.5rem"></div>`;
      ps.insertBefore(d, ps.children[1] || null);
      $('hc-btn').onclick = hcSync;
    }
  }

  function refreshPanels() {
    const top = $('sa-treino-top');
    if (top) {
      const n = hiddenCount();
      top.innerHTML = stopStripHtml(true) +
        (S.conds.length ? `<div class="sa-hidden-note">${S.conds.map(c => COND[c].icon + ' ' + esc(COND[c].label.split(' (')[0])).join(' · ')}.${n ? ` ${n} exercício${n > 1 ? 's' : ''} escondido${n > 1 ? 's' : ''} para a sua segurança. <a onclick="SA.hiddenList()">Ver quais</a>.` : ''} Os demais podem trazer avisos de adaptação.</div>` : '');
    }
    const tt = $('sa-timer-top'); if (tt) tt.innerHTML = stopStripHtml(false) + '<button class="sa-sos-big" onclick="SA.sos()">🆘 Estou passando mal</button>';
  }

  function renderProfileCard() {
    const el = $('sa-profile'); if (!el) return;
    const c = S.contact || {};
    const lim = hrLimit();
    el.innerHTML = `<div class="sa-card">
      <div class="card-title" style="margin-bottom:.6rem">🛟 Saúde Adaptada</div>
      <div class="row"><span>Modo adaptado</span><b>${isAdapt() ? 'Ligado' : 'Desligado'}${forced() ? ' (obrigatório)' : ''}</b></div>
      <div class="row"><span>Liberação médica</span><b>${S.parq && S.parq.risk ? (S.cleared ? 'Confirmada em ' + esc(String(S.cleared.date).split('-').reverse().join('/')) : 'PENDENTE') : 'Não necessária'}</b></div>
      <div class="row"><span>Condições</span><b style="text-align:right">${S.conds.length ? S.conds.map(k => COND[k].icon + ' ' + esc(COND[k].label.split(' (')[0])).join(', ') : 'Nenhuma'}</b></div>
      <div class="row"><span>Contato de emergência</span><b>${c.phone ? esc(c.name || '') + ' ' + esc(c.phone) : 'Não cadastrado'}</b></div>
      <div class="row"><span>Limite de frequência</span><b>${lim ? lim + ' bpm' + (S.hrLimit ? '' : ' (padrão)') : '–'}</b></div>
      <div style="margin-top:.8rem"><div class="small muted">Modo Saúde Adaptada</div>
        <div class="sa-seg" role="group">${['auto', 'on', 'off'].map(m => `<button class="${S.adaptMode === m ? 'on' : ''}" data-m="${m}" ${m === 'off' && forced() ? 'disabled style="opacity:.4"' : ''}>${{ auto: 'Automático', on: 'Ligado', off: 'Desligado' }[m]}</button>`).join('')}</div>
        <div class="tiny muted">Automático liga sozinho para 60+ anos ou com condições de saúde. Descansos mais longos, escala de esforço e sem metas de desempenho.</div></div>
      <div style="margin-top:.8rem"><div class="small muted">Tamanho da letra</div>
        <div class="sa-seg" role="group">${['Normal', 'Grande', 'Muito grande'].map((t, i) => `<button class="${S.acc.size === i ? 'on' : ''}" data-z="${i}">${t}</button>`).join('')}</div>
        <label class="sa-row" style="margin-top:.4rem"><input type="checkbox" id="sa-hc-chk" ${S.acc.contrast ? 'checked' : ''}> <span>Alto contraste</span></label></div>
      <div id="sa-hc-slot"></div>
      <button class="btn btn-secondary" style="width:100%;margin-top:.7rem" id="sa-b-conds">🩺 Editar condições</button>
      <button class="btn btn-secondary" style="width:100%;margin-top:.5rem" id="sa-b-contact">📞 Contato e limite de frequência</button>
      ${hiddenCount() ? '<button class="btn btn-secondary" style="width:100%;margin-top:.5rem" id="sa-b-hid">👁️ Ver exercícios escondidos</button>' : ''}
      <button class="btn btn-secondary" style="width:100%;margin-top:.5rem" id="sa-b-redo">📋 Refazer o questionário de saúde</button>
      <div class="sa-disc">${esc(DISCLAIMER)}</div></div>`;
    el.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { S.adaptMode = b.dataset.m; save(); afterChange(); });
    el.querySelectorAll('[data-z]').forEach(b => b.onclick = () => { S.acc.size = +b.dataset.z; save(); applyUI(); renderProfileCard(); });
    $('sa-hc-chk').onchange = e => { S.acc.contrast = e.target.checked; save(); applyUI(); };
    $('sa-b-conds').onclick = modalConds; $('sa-b-contact').onclick = modalContact; $('sa-b-redo').onclick = () => startTriage(true);
    const h = $('sa-b-hid'); if (h) h.onclick = modalHidden;
  }

  // ════════════════════════════════════════════════════════════
  //  HEALTH CONNECT (só no app Android)
  // ════════════════════════════════════════════════════════════
  const HC = () => window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.Health;
  let hcOk = false, hcPoll = null;
  const dayStart = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString(); };
  async function hcSync() {
    const msg = $('hc-msg'); const say_ = t => { if (msg) msg.textContent = t; };
    try {
      const h = HC(); if (!h) throw new Error('Health Connect indisponível neste aparelho.');
      const av = await h.isAvailable();
      if (!av.available) throw new Error(av.reason || 'Instale o app "Health Connect" na Play Store e tente de novo.');
      say_('Pedindo permissão…');
      const st = await h.requestAuthorization({ read: ['steps', 'heartRate', 'calories'], write: [] });
      if (!st.readAuthorized || !st.readAuthorized.length) throw new Error('Permissão negada no Health Connect.');
      hcOk = true;
      const sum = a => a.reduce((x, y) => x + (y.value || 0), 0);
      const q = (dataType, limit) => h.readSamples({ dataType, startDate: dayStart(), endDate: new Date().toISOString(), limit: limit || 1000 }).then(r => r.samples || []).catch(() => []);
      const [steps, hr, kcal] = await Promise.all([q('steps', 5000), q('heartRate', 5000), q('calories', 2000)]);
      const entry = {};
      if (steps.length) entry.passos = Math.round(sum(steps));
      if (hr.length) { const v = hr.map(x => x.value).filter(Boolean); entry.bpm_repouso = Math.round(Math.min(...v)); entry.bpm_pico = Math.round(Math.max(...v)); }
      if (kcal.length) entry.calorias_dia = Math.round(sum(kcal));
      if (!Object.keys(entry).length) { say_('Conectado, mas ainda não há dados de hoje no Health Connect.'); return; }
      const log = DB.load('healthlog', {}); const k = isoDay();
      log[k] = Object.assign({}, log[k] || {}, entry); DB.save('healthlog', log);
      loadHealth(); loadWeek(); renderHealth();
      say_('Sincronizado: ' + [entry.passos != null ? entry.passos + ' passos' : '', entry.bpm_pico ? 'FC ' + entry.bpm_repouso + '–' + entry.bpm_pico + ' bpm' : ''].filter(Boolean).join(' · '));
    } catch (e) { say_(e.message || String(e)); }
  }
  // durante o treino: lê a frequência mais recente do Health Connect e confere o limite
  async function hcLiveTick() {
    if (!hcOk || typeof timerRunning === 'undefined' || !timerRunning) return;
    try {
      const r = await HC().readSamples({ dataType: 'heartRate', startDate: new Date(Date.now() - 120000).toISOString(), endDate: new Date().toISOString(), limit: 10, ascending: false });
      const s = (r.samples || [])[0]; if (!s) return;
      const bpm = Math.round(s.value);
      if (typeof HR !== 'undefined' && !HR.connected) { HR.bpm = bpm; }
      if (typeof wkt !== 'undefined') wkt.bpm.push(bpm);
      hrSample(bpm);
    } catch (e) {}
  }

  // ════════════════════════════════════════════════════════════
  //  GANCHOS NO APP PRINCIPAL
  // ════════════════════════════════════════════════════════════
  const _nav = window.nav, _levelOk = window.levelOk, _toggleEx = window.toggleEx, _initTimer = window.initTimer,
    _loadEx = window.loadEx, _toggleTimer = window.toggleTimer, _finish = window.finishWorkout, _onHR = window.onHRValue,
    _populate = window.populateUI, _launch = window.launch, _showNotif = window.showNotif, _loadSession = window.loadSession;

  window.nav = function (p) {
    if (blocked() && (p === 'treino' || p === 'timer')) { modalGate(); return; }
    _nav(p);
    if (p === 'perfil') renderProfileCard();
    if (p === 'timer') renderRpe();
  };
  window.levelOk = function (ex) { return _levelOk(ex) && !hidden(ex.id) && !(isAdapt() && ex.level === 'avancado'); };
  window.toggleEx = function (ex, cat) { if (hidden(ex.id)) return; _toggleEx(ex, cat); };
  window.loadSession = function (id, start) { if (start && blocked()) { modalGate(); return; } _loadSession(id, start); };
  window.initTimer = function () {
    if (blocked()) { modalGate(); return; }
    if (typeof playlist !== 'undefined') { const keep = playlist.filter(p => !hidden(p.id)); if (keep.length !== playlist.length) { playlist.length = 0; keep.forEach(k => playlist.push(k)); DB.save('playlist', playlist); if (typeof updatePlaylistBar === 'function') updatePlaylistBar(); if (typeof updateDashPlaylist === 'function') updateDashPlaylist(); } }
    cur = { rpe: null, talk: null }; renderRpe();
    _initTimer();
  };
  window.loadEx = function (i) {
    _loadEx(i);
    try { const ex = timerQ[i]; const f = $('t-fig'); if (f && ex) f.innerHTML = window.FIGURAS ? FIGURAS.figSVG(ex.id, ex.cat, { label: 'Figura: ' + ex.name }) : ''; } catch (e) {}
  };
  window.toggleTimer = function () {
    if (blocked()) { modalGate(); return; }
    const starting = typeof wkt !== 'undefined' && !wkt.started && !wkt.done && !timerRunning;
    if (starting) { preflight(() => _toggleTimer()); return; }
    _toggleTimer();
  };
  window.finishWorkout = function () {
    const wasDone = typeof wkt !== 'undefined' && wkt.done;
    _finish();
    if (wasDone || !isAdapt()) return;
    try {
      const how = $('t-how'); const secs = wkt.activeSec;
      how.innerHTML = `<strong>Resumo:</strong> ${fmtTime(secs)} de treino. Parabéns por se cuidar! <div class="sa-small" style="margin-top:.5rem">Como foi o esforço no geral? (0 a 10)</div>
        <div class="sa-rpe-row" id="sa-final-rpe">${RPE_COLOR.map((c, i) => `<button style="background:${c}" data-r="${i}">${i}</button>`).join('')}</div>`;
      how.querySelectorAll('[data-r]').forEach(b => b.onclick = () => {
        const hist = DB.load('sessions', []); if (hist[0]) { hist[0].rpe = +b.dataset.r; DB.save('sessions', hist); }
        how.querySelectorAll('[data-r]').forEach(x => x.classList.toggle('sel', x === b));
      });
      const hist = DB.load('sessions', []); if (hist[0]) { delete hist[0].kcal; if (cur.rpe != null) hist[0].rpe = cur.rpe; DB.save('sessions', hist); }
    } catch (e) {}
  };
  window.onHRValue = function (e) { _onHR(e); try { hrSample(HR.bpm); } catch (x) {} };
  window.populateUI = function () { _populate(); applyUI(); };
  window.showNotif = function (icon, title, msg) { return _showNotif(icon, title, isAdapt() && typeof msg === 'string' ? msg.replace(/\s*·\s*~\d+ kcal/, '') : msg); };

  function afterChange() {
    rebuild(); applyUI(); refreshPanels(); renderProfileCard();
    if (typeof renderExercises === 'function') { renderExercises(); if (typeof renderSessions === 'function') renderSessions(); }
    if (typeof playlist !== 'undefined' && playlist.some(p => hidden(p.id))) { const keep = playlist.filter(p => !hidden(p.id)); playlist.length = 0; keep.forEach(k => playlist.push(k)); DB.save('playlist', playlist); if (typeof updatePlaylistBar === 'function') updatePlaylistBar(); if (typeof updateDashPlaylist === 'function') updateDashPlaylist(); }
    // lembrete de glicemia (diabetes)
    if (typeof REMINDER_LIST !== 'undefined') {
      const has = REMINDER_LIST.some(r => r.id === 'glicemia');
      if (S.conds.includes('diabetes') && !has) { REMINDER_LIST.push({ id: 'glicemia', icon: '🩸', name: 'Medir a glicemia (e deixar o lanche à mão)', h: 7, m: 30 }); if (typeof reminderState !== 'undefined' && reminderState.glicemia === undefined) { reminderState.glicemia = true; DB.save('reminders', reminderState); } if (typeof renderReminders === 'function') renderReminders(); }
    }
    if (typeof populateUI === 'function' && typeof U !== 'undefined' && U && U.nome) _populate();
  }

  window.launch = function () {
    _launch();
    load(); rebuild(); inject(); document.body.classList.add('sa-ready');
    afterChange();
    if (hcPoll) clearInterval(hcPoll); hcPoll = setInterval(hcLiveTick, 15000);
    if (needTriage()) startTriage(false);
    else if (blocked() && false) modalGate();
  };

  // ── API pública ──
  window.SA = {
    sos: () => modalSOS(), hiddenList: modalHidden, hidden, notesHtml, isAdapt, blocked, hrSample, state: () => S,
    figHtml: (ex, cat) => window.FIGURAS ? FIGURAS.figSVG(ex.id, cat, { label: 'Figura: ' + ex.name }) : esc(ex.icon || '🏋️'),
    startTriage, hcSync, _test: { PARQ, COND, EXTAGS, TAG_IDS }
  };
  load();
})();
