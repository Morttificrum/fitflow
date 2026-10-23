/* FitFlow — conteúdo da "Pausa Anti-Estresse" e do Do-In (fácil de ampliar).
   Respiração, mãos/pescoço, relaxamento, olhos, Do-In/acupressão por objetivo, sinusite e bem-estar por condição.
   Avisos fixos e filtros de segurança estão aqui, num lugar só. */
(function () {
  'use strict';

  // ── textos fixos ──
  const ROTULO_DOIN = 'Prática tradicional de autocuidado: pode ajudar no relaxamento e no bem-estar. Não trata a doença e não substitui remédio ou orientação médica. Nunca pare um tratamento.';
  const EVIDENCIA_DOIN = 'A evidência científica sobre essas práticas é limitada.';
  const CUIDADOS_DOIN = 'Não pressione sobre feridas, varizes, inchaço, fratura, queimadura ou pele irritada. A pressão é firme, nunca dolorosa. Pare se sentir dor, formigamento forte ou tontura.';
  const AVISO_OLHOS = 'Visão turva súbita, ou com dor de cabeça forte, fraqueza ou fala enrolada: procure atendimento ou ligue 192.';
  const AVISO_SINUSITE = 'Inchaço ou vermelhidão ao redor do olho, dor ao mexer o olho, visão dupla ou febre alta: procure atendimento no mesmo dia. Sintomas por mais de 10 dias, ou que pioram depois de melhorar, também merecem consulta.';
  const AVISO_GERAL = 'Se sentir tontura, falta de ar ou mal-estar, pare e respire normalmente. Em emergência, ligue 192.';

  // ── pontos (autoaplicação: só o que a pessoa alcança sozinha) ──
  // lados: 2 = faça um lado e depois o outro. seg = segundos por lado.
  // grav: não indicado na gravidez. pe: ponto no pé. pesc: região do pescoço/ombro (pressão ainda mais cuidadosa com anticoagulante).
  const PONTOS = {
    ig4: { nome: 'IG4 · Hegu', fig: 'mao-dorso', pos: [[37, 68]], lados: 2, seg: 30, pressao: 'firme', grav: true,
      local: 'No dorso da mão, na "teia" entre o polegar e o indicador, na parte mais carnuda.',
      como: 'Apoie o polegar da outra mão por baixo e o indicador por cima, e aperte com círculos pequenos.' },
    pc6: { nome: 'PC6 · Neiguan', fig: 'antebraco', pos: [[60, 66]], lados: 2, seg: 30, pressao: 'firme',
      local: 'Na face de dentro do antebraço, a três dedos de largura acima da dobra do punho, entre os dois tendões.',
      como: 'Com o polegar da outra mão, aperte e solte devagar, ou faça círculos pequenos.' },
    ta5: { nome: 'TA5 · Waiguan', fig: 'antebraco', pos: [[60, 66]], lados: 2, seg: 30, pressao: 'firme', rotuloFig: 'face de fora do antebraço',
      local: 'Na face de fora do antebraço, também a três dedos acima da dobra do punho (do lado oposto ao PC6).',
      como: 'Aperte com o polegar, em círculos pequenos, respirando devagar.' },
    c7: { nome: 'C7 · Shenmen', fig: 'mao-palma', pos: [[75, 99]], lados: 2, seg: 30, pressao: 'leve',
      local: 'Na dobra do punho, do lado do dedo mínimo, no pequeno vão ao lado do osso, na face da palma.',
      como: 'Apoie a ponta do polegar da outra mão e faça uma pressão leve e constante.' },
    pc8: { nome: 'PC8 · Laogong', fig: 'mao-palma', pos: [[60, 76]], lados: 2, seg: 30, pressao: 'firme',
      local: 'No centro da palma, onde a ponta do dedo médio toca quando você fecha a mão.',
      como: 'Aperte com o polegar da outra mão e solte, ou faça círculos amplos e lentos.' },
    yintang: { nome: 'Yintang', fig: 'rosto', pos: [[60, 45]], lados: 1, seg: 40, pressao: 'leve',
      local: 'No meio da testa, entre as sobrancelhas.',
      como: 'Apoie a ponta do dedo médio e faça círculos bem suaves ou pressão leve e constante.' },
    b2: { nome: 'B2 · Zanzhu', fig: 'rosto', pos: [[53, 44], [67, 44]], lados: 1, seg: 40, pressao: 'leve',
      local: 'Na ponta de dentro de cada sobrancelha, junto ao nariz (onde o osso faz uma pequena reentrância).',
      como: 'Use os dois polegares ou indicadores ao mesmo tempo, com pressão leve para cima, sem encostar nos olhos.' },
    taiyang: { nome: 'Taiyang', fig: 'rosto', pos: [[28, 54], [92, 54]], lados: 1, seg: 40, pressao: 'leve',
      local: 'Nas têmporas, na pequena depressão atrás do canto externo de cada olho.',
      como: 'Com as pontas dos dedos nos dois lados, faça círculos lentos e suaves.' },
    ig20: { nome: 'IG20 · Yingxiang', fig: 'rosto', pos: [[52, 79], [68, 79]], lados: 1, seg: 40, pressao: 'leve',
      local: 'De cada lado do nariz, no sulco entre a narina e a bochecha.',
      como: 'Com os indicadores, faça círculos suaves ou pressão leve, 30 a 60 segundos, respirando pelo nariz se der.' },
    e3: { nome: 'E3 · Juliao', fig: 'rosto', pos: [[41, 71], [79, 71]], lados: 1, seg: 40, pressao: 'leve',
      local: 'Embaixo da maçã do rosto, na linha da pupila, na altura da base do nariz.',
      como: 'Com as pontas dos dedos, pressione suavemente e faça pequenos círculos. Não encoste nos olhos.' },
    e6: { nome: 'E6 · Jiache', fig: 'rosto', pos: [[32, 90], [88, 90]], lados: 1, seg: 40, pressao: 'firme',
      local: 'No ângulo da mandíbula, onde o músculo "incha" quando você cerra os dentes.',
      como: 'Com os dedos, faça círculos pequenos enquanto solta a mandíbula e deixa a boca entreaberta.' },
    vb20: { nome: 'VB20 · Fengchi', fig: 'nuca', pos: [[47, 80], [73, 80]], lados: 1, seg: 45, pressao: 'firme', pesc: true,
      local: 'Na base do crânio, nas duas covinhas ao lado dos músculos grossos da nuca.',
      como: 'Entrelace os dedos atrás da cabeça e apoie os polegares nas covinhas; incline a cabeça levemente para trás contra eles, sem forçar.' },
    baihui: { nome: 'VG20 · Baihui', fig: 'cabeca-lado', pos: [[60, 17]], lados: 1, seg: 30, pressao: 'leve',
      local: 'No alto da cabeça, no meio, na linha que liga as pontas das duas orelhas.',
      como: 'Apoie a ponta do dedo médio e faça uma pressão leve ou círculos lentos.' },
    anmian: { nome: 'Anmian', fig: 'cabeca-lado', pos: [[77, 64]], lados: 2, seg: 30, pressao: 'leve',
      local: 'Atrás da orelha, entre o osso saliente (mastoide) e o músculo do pescoço.',
      como: 'Pressão leve com a ponta do dedo, em círculos pequenos, soltando o ar devagar.' },
    vb21: { nome: 'VB21 · Jianjing', fig: 'ombro', pos: [[36, 63], [84, 63]], lados: 2, seg: 30, pressao: 'firme', grav: true, pesc: true,
      local: 'No alto do ombro, no meio do músculo entre a base do pescoço e a ponta do ombro.',
      como: 'Com os dedos da mão oposta, aperte o músculo e solte, enquanto respira devagar e deixa o ombro cair.' },
    r1: { nome: 'R1 · Yongquan', fig: 'pe', pos: [[60, 56]], lados: 2, seg: 40, pressao: 'firme', pe: true,
      local: 'Na planta do pé, no vão em forma de "Y" abaixo da bola do pé, entre o 2º e o 3º dedos.',
      como: 'Sentado, apoie o pé no joelho oposto e faça círculos com o polegar. Só se a sensibilidade do pé estiver normal.' }
  };

  // ── figuras: desenho simples com o(s) ponto(s) pulsando ──
  const BASES = {
    'mao-dorso': '<rect x="38" y="56" width="46" height="46" rx="12"/><line x1="44" y1="56" x2="44" y2="24"/><line x1="55" y1="56" x2="55" y2="14"/><line x1="66" y1="56" x2="66" y2="20"/><line x1="77" y1="56" x2="77" y2="30"/><line x1="40" y1="84" x2="18" y2="58"/><text x="60" y="116" text-anchor="middle" class="pt-lbl">dorso da mão</text>',
    'mao-palma': '<rect x="38" y="56" width="46" height="46" rx="12"/><line x1="44" y1="56" x2="44" y2="24"/><line x1="55" y1="56" x2="55" y2="14"/><line x1="66" y1="56" x2="66" y2="20"/><line x1="77" y1="56" x2="77" y2="30"/><line x1="40" y1="84" x2="18" y2="58"/><line x1="40" y1="100" x2="82" y2="100" stroke-dasharray="3 3"/><text x="60" y="116" text-anchor="middle" class="pt-lbl">palma da mão</text>',
    'antebraco': '<rect x="40" y="14" width="40" height="92" rx="10"/><line x1="40" y1="92" x2="80" y2="92" stroke-dasharray="3 3"/><line x1="54" y1="22" x2="54" y2="88" opacity=".35"/><line x1="66" y1="22" x2="66" y2="88" opacity=".35"/><path d="M88 92 L88 66" /><path d="M85 92 h6 M85 66 h6"/><text x="98" y="82" class="pt-lbl">3 dedos</text><text x="60" y="118" text-anchor="middle" class="pt-lbl">antebraço (punho embaixo)</text>',
    'rosto': '<ellipse cx="60" cy="60" rx="32" ry="42"/><ellipse cx="47" cy="54" rx="6" ry="3"/><ellipse cx="73" cy="54" rx="6" ry="3"/><line x1="40" y1="46" x2="54" y2="44"/><line x1="66" y1="44" x2="80" y2="46"/><path d="M60 56 L58 72 L63 72"/><path d="M52 92 Q60 97 68 92"/><text x="60" y="118" text-anchor="middle" class="pt-lbl">rosto</text>',
    'nuca': '<circle cx="60" cy="48" r="34"/><path d="M48 80 L48 108 M72 80 L72 108"/><line x1="34" y1="80" x2="86" y2="80" stroke-dasharray="3 3"/><text x="60" y="119" text-anchor="middle" class="pt-lbl">nuca (visto por trás)</text>',
    'cabeca-lado': '<circle cx="60" cy="52" r="34"/><ellipse cx="73" cy="58" rx="6" ry="10"/><path d="M26 56 L19 62 L27 64"/><text x="60" y="118" text-anchor="middle" class="pt-lbl">cabeça (de lado)</text>',
    'ombro': '<circle cx="60" cy="24" r="13"/><path d="M52 36 L52 52 M68 36 L68 52"/><path d="M10 84 Q14 54 52 52 M110 84 Q106 54 68 52"/><text x="60" y="108" text-anchor="middle" class="pt-lbl">ombros (visto por trás)</text>',
    'pe': '<path d="M42 36 C32 52 36 96 52 106 C68 114 84 102 84 88 C88 60 86 40 72 36 Z"/><circle cx="46" cy="26" r="5"/><circle cx="57" cy="22" r="5"/><circle cx="68" cy="23" r="5"/><circle cx="78" cy="27" r="4"/><text x="60" y="124" text-anchor="middle" class="pt-lbl">planta do pé</text>'
  };
  function figuraPonto(id, tam) {
    const p = PONTOS[id]; if (!p) return '';
    const dots = p.pos.map(([x, y]) => `<circle class="pt-dot" cx="${x}" cy="${y}" r="5"/><circle class="pt-halo" cx="${x}" cy="${y}" r="5"/>`).join('');
    return `<svg class="pt-fig" viewBox="0 0 120 128" ${tam ? 'width="' + tam + '" height="' + tam + '"' : ''} role="img" aria-label="Figura: ${p.nome}. ${p.local}"><g class="pt-base" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${BASES[p.fig]}</g>${dots}</svg>`;
  }

  // ── sessões ──
  const R = (padrao, dur) => ({ t: 'resp', padrao, dur });
  const T = (titulo, texto, dur, emoji, fala) => ({ t: 'txt', titulo, texto, dur, emoji: emoji || '🌿', fala: fala || (titulo + '. ' + texto) });
  const P = (ponto, mult) => ({ t: 'ponto', ponto, dur: null, mult: mult || 1 });
  const dur = s => s;

  // padrões de respiração: [fase, segundos, escala 0..1 do círculo, rótulo falado]
  const PADROES = {
    coerente: { nome: 'Respiração coerente (~6 por minuto)', ciclo: [['Inspire', 5, 1], ['Expire', 5, 0]], nota: 'Inspire pelo nariz por 5 segundos e solte o ar devagar por 5 segundos, sem pausa.' },
    quadrada: { nome: 'Respiração quadrada 4-4-4-4', ciclo: [['Inspire', 4, 1], ['Segure', 4, 1], ['Expire', 4, 0], ['Pause', 4, 0]], nota: 'Inspire 4, segure 4, expire 4, pause 4. Se segurar o ar incomodar, faça sem pausas ou com pausas bem curtas.' },
    diafragmatica: { nome: 'Respiração pela barriga (diafragmática)', ciclo: [['Inspire pelo nariz: a barriga sobe', 4, 1], ['Expire devagar: a barriga desce', 6, 0]], nota: 'Inspire 4 pelo nariz deixando a barriga subir; expire 6, devagar.' },
    expiracao_longa: { nome: 'Expiração longa', ciclo: [['Inspire pelo nariz', 4, 1], ['Solte o ar bem devagar', 8, 0]], nota: 'Inspire 4 e solte o ar em 8, como se soprasse num canudo fino.' },
    frenolabial: { nome: 'Lábios semicerrados (frenolabial)', ciclo: [['Inspire pelo nariz', 2, 1], ['Solte pelos lábios quase fechados', 4, 0]], nota: 'Inspire 2 pelo nariz e solte em 4 pelos lábios quase fechados, sem soprar forte.' },
    suspiro: { nome: 'Suspiro duplo', ciclo: [['Inspire', 2.5, 0.7], ['Mais um pouco', 1.5, 1], ['Solte pela boca', 5, 0]], nota: 'Duas inspirações curtas pelo nariz (uma depois da outra) e uma expiração longa pela boca, como um suspiro.' }
  };

  const SESSOES = [
    // — respiração —
    ...[['coerente', 1], ['coerente', 3], ['coerente', 5], ['quadrada', 1], ['quadrada', 3], ['quadrada', 5], ['suspiro', 1], ['suspiro', 3]].map(([p, m]) => ({
      id: `resp-${p}-${m}`, grupo: 'resp', icone: '🌬️', titulo: `${PADROES[p].nome}`, min: m, desc: PADROES[p].nota, tipo: 'resp', passos: [R(p, m * 60)], xp: m === 1 ? 5 : m === 3 ? 10 : 15 })),
    // — corpo na cadeira —
    { id: 'maos-punhos', grupo: 'corpo', icone: '🙌', titulo: 'Mãos e punhos', min: 3, desc: 'Abrir e fechar as mãos, alongar os dedos e soltar os punhos. Bom depois de teclado e celular.', tipo: 'corpo', xp: 10, passos: [
      T('Sente-se bem', 'Apoie as costas na cadeira e deixe os ombros caírem. Respire devagar.', 15, '🪑'),
      T('Abrir e fechar', 'Abra as mãos com os dedos bem separados e feche em punho, devagar. Repita no ritmo da respiração.', 40, '✋'),
      T('Alongar os dedos', 'Estique um braço à frente com a palma para cima. Com a outra mão, puxe os dedos suavemente para baixo e segure. Depois troque.', 40, '🖐️'),
      T('Círculos com os punhos', 'Com os braços à frente, faça círculos lentos com os punhos, 5 para cada lado.', 35, '🔄'),
      T('Palma e dorso', 'Estique o braço com a palma para frente e puxe os dedos para trás; depois vire e puxe para baixo. Sem dor, só uma sensação de alongar.', 35, '🤲'),
      T('Sacudir', 'Sacuda as mãos soltas, como se tirasse água delas, por alguns segundos. Depois deixe-as descansar no colo.', 15, '💧')] },
    { id: 'pescoco-ombros', grupo: 'corpo', icone: '🧘', titulo: 'Pescoço e ombros na cadeira', min: 3, desc: 'Movimentos suaves para soltar a nuca e os ombros sem sair do lugar.', tipo: 'corpo', xp: 10, passos: [
      T('Postura', 'Sente-se com a coluna alta e os pés no chão. Solte a mandíbula e respire pelo nariz.', 15, '🪑'),
      T('Ombros para cima e para baixo', 'Suba os ombros até as orelhas ao inspirar e solte de uma vez ao expirar. Repita algumas vezes.', 30, '⬆️'),
      T('Círculos com os ombros', 'Faça círculos grandes e lentos com os ombros para trás, depois para frente.', 35, '🔄'),
      T('Inclinar para o lado', 'Incline a orelha em direção ao ombro, sem levantar o ombro. Fique 15 segundos e troque de lado. Sem forçar.', 40, '↔️'),
      T('Queixo ao peito', 'Leve o queixo suavemente em direção ao peito e sinta a nuca alongar. Não jogue a cabeça para trás.', 25, '⬇️'),
      T('Olhar para os lados', 'Gire a cabeça devagar para um lado, depois para o outro, só até onde for confortável.', 25, '👀'),
      T('Soltar', 'Solte os braços, respire fundo e deixe os ombros longe das orelhas.', 10, '😌')] },
    { id: 'prm', grupo: 'corpo', icone: '😌', titulo: 'Relaxamento muscular progressivo (curto)', min: 5, desc: 'Você contrai cada parte do corpo por 5 segundos e solta por 10, notando a diferença entre tensão e descanso.', tipo: 'corpo', xp: 15,
      passos: ['Mãos e antebraços|Feche os punhos com força.', 'Braços|Dobre os cotovelos e contraia os braços.', 'Ombros|Suba os ombros até as orelhas.', 'Rosto|Franza a testa e feche os olhos com firmeza.', 'Mandíbula|Cerre os dentes de leve e depois abra a boca bem devagar.', 'Barriga|Contraia a barriga como quem espera um leve empurrão.', 'Pernas|Estique as pernas e contraia coxas e panturrilhas.', 'Pés|Encolha os dedos dos pés.'].flatMap(s => { const [n, c] = s.split('|'); return [T(n + ': contrair', c + ' Mantenha por 5 segundos, sem dor.', 5, '💪', n + '. ' + c), T(n + ': soltar', 'Solte de uma vez e sinta o relaxamento por 10 segundos.', 10, '😌', 'Solte.')]; })
        .concat([T('Corpo todo', 'Respire devagar e perceba o corpo mais solto.', 15, '🌿')]) },
    // — olhos —
    { id: 'olhos', grupo: 'olhos', icone: '👁️', titulo: 'Cansaço visual: 20-20-20 e olhos', min: 3, desc: 'Para quem passa muito tempo em tela. Regra 20-20-20: a cada 20 minutos, olhe para algo a 20 pés (cerca de 6 metros) por 20 segundos.', tipo: 'olhos', aviso: 'olhos', xp: 10, passos: [
      T('Afaste os olhos da tela', 'Olhe para algo distante, a cerca de 6 metros, por 20 segundos. Pode ser a janela ou o fim do corredor.', 20, '🪟', 'Regra vinte, vinte, vinte. Olhe para algo distante por vinte segundos.'),
      T('Piscar devagar', 'Pisque bem devagar, fechando os olhos por inteiro, 10 vezes. Isso espalha a lágrima e alivia o ressecamento.', 20, '😌'),
      T('Olhar para os lados e para cima e para baixo', 'Sem mexer a cabeça, olhe devagar para a direita, esquerda, para cima e para baixo. Sem forçar.', 30, '↔️'),
      T('Desenhar um oito', 'Imagine um oito deitado grande à sua frente e acompanhe o desenho com os olhos, devagar, nos dois sentidos.', 30, '♾️'),
      T('Perto e longe', 'Olhe para a ponta do dedo a um braço de distância, depois para algo distante. Alterne algumas vezes.', 30, '☝️'),
      T('Palming', 'Esfregue as mãos para aquecer e cubra os olhos fechados com as palmas, sem apertar. Respire e descanse no escuro.', 40, '🤲')] },
    // — Do-In por objetivo —
    { id: 'din-tensao', grupo: 'doin', icone: '🤲', titulo: 'Do-In: tensão do dia', min: 5, desc: 'Pontos de mãos, braços e ombros para soltar a tensão.', tipo: 'doin', xp: 10, passos: [R('coerente', 30), P('pc6'), P('ig4'), P('pc8'), P('vb21'), P('yintang')] },
    { id: 'din-cabeca', grupo: 'doin', icone: '💆', titulo: 'Do-In: dor de cabeça por tensão', min: 5, desc: 'Para aquela dor de cabeça "em faixa", ligada a tensão e postura. Não é para dor súbita ou muito forte.', tipo: 'doin', xp: 10, aviso: 'cabeca', passos: [R('coerente', 30), P('vb20'), P('taiyang'), P('ig4'), P('yintang'), P('e6')] },
    { id: 'din-maos', grupo: 'doin', icone: '🤲', titulo: 'Do-In: mãos cansadas', min: 4, desc: 'Pontos e massagem para mãos que trabalham muito.', tipo: 'doin', xp: 10, passos: [T('Aquecer as mãos', 'Esfregue as palmas uma na outra até sentir calor.', 15, '🤲'), P('pc8'), P('ig4'), P('c7'), P('ta5')] },
    { id: 'din-sono', grupo: 'doin', icone: '🌙', titulo: 'Do-In: relaxar antes de dormir', min: 6, desc: 'Respiração lenta e pontos calmantes para a hora de deitar.', tipo: 'doin', xp: 10, passos: [R('coerente', 60), P('c7'), P('pc6'), P('yintang'), P('anmian'), P('baihui'), P('r1')] },
    { id: 'din-treino-antes', grupo: 'doin', icone: '🔥', titulo: 'Do-In: aquecer antes do treino', min: 3, desc: 'Mobilidade de mãos e nuca e pontos de ativação suave.', tipo: 'doin', xp: 10, passos: [T('Mãos e punhos', 'Abra e feche as mãos e faça círculos com os punhos.', 25, '🙌'), T('Nuca', 'Gire a cabeça devagar para os lados e incline a orelha ao ombro, sem forçar.', 30, '🧘'), P('ig4'), P('pc6'), P('vb20')] },
    { id: 'din-treino-depois', grupo: 'doin', icone: '🧊', titulo: 'Do-In: recuperar depois do treino', min: 4, desc: 'Solta ombros, nuca e mãos depois do esforço.', tipo: 'doin', xp: 10, passos: [R('coerente', 30), P('vb21'), P('vb20'), P('ig4'), P('pc8')] },
    { id: 'din-olhos', grupo: 'doin', icone: '👁️', titulo: 'Do-In: olhos cansados', min: 3, desc: 'Pontos ao redor dos olhos para a tensão de quem olha tela. Sem encostar nos olhos.', tipo: 'doin', aviso: 'olhos', xp: 10, passos: [P('b2'), P('taiyang'), P('yintang'), P('ig4')] },
    { id: 'sinusite', grupo: 'nariz', icone: '👃', titulo: 'Nariz entupido / sinusite', min: 6, desc: 'Guia de lavagem nasal com soro fisiológico (a medida com melhor evidência) e pontos tradicionais para os seios da face.', tipo: 'doin', aviso: 'sinusite', xp: 10, passos: [
      T('1. Prepare', 'Lave as mãos. Use soro fisiológico a 0,9% em frasco próprio, seringa limpa ou kit de lavagem. Se for preparar a solução, use água fervida e esfriada ou filtrada/esterilizada, nunca água direta da torneira.', 25, '🧼'),
      T('2. Posição', 'Incline-se sobre a pia, com a cabeça de lado e a boca aberta, respirando pela boca.', 15, '🚰'),
      T('3. Lavar', 'Aplique o soro na narina de cima, devagar. Ele deve sair pela outra narina. Depois repita do outro lado.', 40, '💧'),
      T('4. Soltar', 'Assoe o nariz com suavidade, uma narina de cada vez, sem força. Troque a solução e lave o frasco a cada uso; não compartilhe.', 20, '🤧'),
      P('yintang'), P('b2'), P('ig20'), P('e3')] }
  ];

  // lições de respiração (uma por dia), a partir de relax-dados.js
  if (window.RELAX_DADOS) window.RELAX_DADOS.LICOES.forEach(l => SESSOES.push({ id: l.id, grupo: 'licao', licao: l.n, icone: '📚', titulo: 'Lição ' + l.n + ': ' + l.titulo, min: 3, desc: l.tema + '. ' + l.porque, tipo: 'resp-licao', xp: 15,
    passos: [T('Por que isto ajuda', l.porque, 15, '💡')].concat(l.passos.map(([t, tx, seg, pad]) => pad ? R(pad, 90) : T(t, tx, seg, '🌬️'))).concat([T('Se sentir tontura', 'Volte a respirar normalmente. Em doença respiratória ou do coração, siga a orientação do seu médico.', 10, '⚠️')]) }));

  // bem-estar por condição da Saúde Adaptada
  const BEM_ESTAR = {
    hipertensao: { titulo: 'Hipertensão', desc: 'Respiração lenta e pontos calmantes. Ajuda a relaxar; não substitui a medicação nem controla a pressão.', passos: [R('coerente', 60), P('c7'), P('pc6'), P('yintang'), P('baihui')] },
    diabetes: { titulo: 'Diabetes', desc: 'Mãos, braços e cabeça, sem pontos nos pés. Não substitui o controle da glicemia nem os remédios.', passos: [R('coerente', 45), P('pc6'), P('pc8'), P('ig4'), P('yintang')] },
    artrose: { titulo: 'Artrose', desc: 'Mãos e punhos soltos e pontos suaves. Não trata a articulação.', passos: [T('Aquecer as mãos', 'Esfregue as palmas até sentir calor e mexa os dedos devagar.', 20, '🤲'), P('pc8'), P('ta5'), P('c7'), R('coerente', 30)] },
    osteoporose: { titulo: 'Osteoporose', desc: 'Pontos de mãos e cabeça com pressão bem leve e respiração calma.', passos: [R('coerente', 45), P('pc8'), P('c7'), P('yintang'), P('baihui')] },
    cardiopatia: { titulo: 'Problema no coração', desc: 'Respiração tranquila e pontos leves. Não use no lugar de nenhum tratamento; se sentir dor no peito, pare e peça ajuda.', passos: [R('coerente', 60), P('c7'), P('pc6'), P('yintang')] },
    avc: { titulo: 'Pós-AVC', desc: 'Mãos e braços com atenção à sensibilidade: se um lado sente pouco, use pressão leve e olhe a pele.', passos: [R('coerente', 45), P('pc8'), P('pc6'), P('c7'), P('yintang')] },
    respiratoria: { titulo: 'Doença respiratória', desc: 'Respiração calma e pontos do rosto e das mãos. Mantenha a medicação de resgate por perto.', passos: [R('coerente', 60), P('yintang'), P('ig20'), P('pc8'), P('c7')] },
    obesidade: { titulo: 'Obesidade', desc: 'Pontos de ombros, mãos e cabeça para relaxar depois de um dia puxado.', passos: [R('coerente', 45), P('vb21'), P('pc6'), P('ig4'), P('yintang')] }
  };
  Object.keys(BEM_ESTAR).forEach(k => SESSOES.push(Object.assign({ id: 'cond-' + k, grupo: 'cond', cond: k, icone: '🌿', min: 4, tipo: 'doin', xp: 10 }, BEM_ESTAR[k], { titulo: 'Bem-estar: ' + BEM_ESTAR[k].titulo })));

  // ── filtros de segurança (dependem do perfil) ──
  // ctx = { gravida: true|false|null, anticoag: true|false|null, conds: [...] }
  function pontoPermitido(id, ctx) {
    const p = PONTOS[id]; if (!p) return false;
    if (p.grav && ctx.gravida !== false) return false;                  // não sabe ou grávida: esconde
    if (p.pe && ctx.conds.includes('diabetes')) return false;           // diabetes: sem pressão nos pés
    return true;
  }
  function pressaoDoPonto(id, ctx) {
    const p = PONTOS[id];
    const leve = ctx.conds.includes('osteoporose') || ctx.anticoag === true || ctx.anticoag === null || ctx.conds.includes('avc');
    if (leve) return { nivel: 'leve', txt: 'Pressão leve: só encoste e faça círculos suaves, sem apertar' + (ctx.anticoag === true ? ' (você usa anticoagulante: pele e vasos sangram com mais facilidade).' : '.') };
    return { nivel: p.pressao, txt: p.pressao === 'leve' ? 'Pressão leve, sem dor' : 'Pressão firme, sem dor' };
  }
  // devolve os passos já filtrados e com durações calculadas
  function montarPassos(sessao, ctx) {
    const out = [];
    for (const s of sessao.passos) {
      if (s.t === 'ponto') {
        if (!pontoPermitido(s.ponto, ctx)) continue;
        const p = PONTOS[s.ponto];
        out.push(Object.assign({}, s, { dur: p.seg * p.lados }));
      } else out.push(s);
    }
    return out;
  }
  const duracaoTotal = passos => passos.reduce((a, s) => a + (s.dur || 0), 0);

  window.PAUSA_DADOS = { ROTULO_DOIN, EVIDENCIA_DOIN, CUIDADOS_DOIN, AVISO_OLHOS, AVISO_SINUSITE, AVISO_GERAL, PONTOS, PADROES, SESSOES, figuraPonto, pontoPermitido, pressaoDoPonto, montarPassos, duracaoTotal };
})();
