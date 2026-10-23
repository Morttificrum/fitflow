/* FitFlow — relaxamento guiado: roteiros de narração (texto) e fundos sonoros.
   Marcações no texto, no padrão do app Narrador:  //  = pausa breve   ///  = pausa longa.
   Cada trecho vira um áudio (gerado pelo Narrador, tools/narracao.mjs). Sem o áudio, o app lê o texto com a voz do aparelho. */
(function () {
  'use strict';
  const COMUM = [
    { id: 'respira-1', texto: 'Vamos começar com a respiração. // Inspire devagar pelo nariz, // sentindo a barriga se encher. /// E solte o ar lentamente, // como quem sopra uma vela de longe. /// De novo. // Inspire. /// E solte. /// Deixe a respiração encontrar o seu próprio ritmo.' },
    { id: 'respira-2', texto: 'Perceba sua respiração, // sem tentar mudar nada. /// A cada vez que o ar sai, // o corpo fica um pouco mais pesado, // um pouco mais solto. /// Inspire. // E solte, // devagar.' },
    { id: 'respira-3', texto: 'Mais uma vez, // inspire profundamente. /// Segure um instante, // sem esforço. /// E solte tudo, // alongando a saída do ar. /// Deixe os ombros caírem. // Deixe a mandíbula solta.' },
    { id: 'volta', texto: 'Quando estiver pronto, // comece a mover os dedos das mãos e dos pés. /// Faça uma respiração mais profunda. /// E, no seu tempo, // abra os olhos, // trazendo com você a calma que encontrou.' }
  ];

  const CENARIOS = [
    { id: 'cachoeira', nome: 'Cachoeira', emoji: '💧', fundo: { natureza: ['agua', 'passaros'], musica: 'musica1' },
      abertura: 'Acomode-se numa posição confortável. // Feche os olhos, se quiser. /// Imagine que você caminha por uma trilha tranquila, // no meio da mata, // e já ouve ao longe o som de uma cachoeira.',
      cenas: [
        'O chão da trilha é macio, // coberto de folhas. /// A cada passo, // você deixa para trás as preocupações do dia, // uma por uma.',
        'O ar é fresco e tem cheiro de terra molhada. /// Você inspira esse ar limpo // e sente o peito se abrir.',
        'O som da água fica mais próximo. /// Entre as árvores, // você vê a luz do sol desenhando manchas douradas no caminho.',
        'Você chega a uma clareira. /// Diante de você, // uma cachoeira de água clara cai suavemente sobre as pedras.',
        'Sente o frescor da névoa leve no rosto. /// Ela é gostosa, // como um carinho.',
        'Encontre uma pedra lisa e morna pelo sol, // e sente-se. /// Perceba como o corpo é sustentado pela pedra, // sem nenhum esforço seu.',
        'Observe a água descendo. /// Ela não tem pressa. // Ela simplesmente flui. /// E você pode fazer o mesmo: // deixar os pensamentos passarem, // como a água.',
        'Cada som da cachoeira leva embora um pouco de tensão. /// Os ombros ficam leves. // O rosto relaxa. // As mãos descansam.',
        'Sinta uma sensação de segurança e de paz, // como se este lugar fosse só seu. /// Aqui, // nada precisa ser resolvido agora.',
        'Respire junto com o som da água. /// Inspire, // enquanto ela cai. /// Solte, // enquanto ela se espalha.'
      ],
      fecho: 'Agradeça a este lugar por acolher você. /// Saiba que pode voltar aqui sempre que precisar, // bastando fechar os olhos e respirar. /// Leve com você esta calma, // este frescor, // esta leveza.' },

    { id: 'campo', nome: 'Campo florido', emoji: '🌼', fundo: { natureza: ['passaros', 'vento'], musica: 'musica2' },
      abertura: 'Encontre uma posição confortável e deixe os olhos se fecharem. /// Imagine um campo aberto numa manhã serena, // coberto de flores de todas as cores, // sob um céu muito azul.',
      cenas: [
        'Você caminha devagar pela grama baixa e macia. /// Sente o chão firme sob os pés, // e a terra que sustenta cada passo.',
        'Uma brisa suave toca o seu rosto. /// Ela passa pelos cabelos, // pelos braços, // e leva embora o cansaço.',
        'Ao redor, // flores amarelas, // brancas e lilases balançam devagar. /// Você sente o perfume leve e doce no ar.',
        'Ao longe, // pássaros cantam sem pressa. /// Seu canto é como uma música tranquila, // feita só para este momento.',
        'Você escolhe um lugar e se deita na grama. /// Ela é morna e acolhedora. /// O corpo inteiro se apoia, // pesado e relaxado.',
        'Olhe para o céu. /// Algumas nuvens brancas passam devagar. /// Cada nuvem carrega um pensamento, // e segue adiante.',
        'O sol aquece suavemente o seu rosto, // o peito, // a barriga. /// Um calor gostoso se espalha por todo o corpo.',
        'Sinta a respiração subir e descer, // como o balanço das flores ao vento. /// Não há nada para fazer, // nem para resolver.',
        'Neste campo, // o tempo passa sem pressa. /// Você está inteiro, // em paz, // exatamente onde precisa estar.',
        'Aproveite mais alguns instantes de silêncio, // ouvindo o vento e os pássaros.'
      ],
      fecho: 'Aos poucos, // vá se despedindo do campo, // levando no coração a leveza das flores. /// Esta paz continua com você, // onde quer que esteja.' },

    { id: 'praia', nome: 'Praia', emoji: '🏖️', fundo: { natureza: ['ondas', 'vento'], musica: 'musica1' },
      abertura: 'Fique confortável e feche os olhos. /// Imagine uma praia tranquila no fim da tarde, // com a areia macia e o mar calmo diante de você.',
      cenas: [
        'Seus pés tocam a areia morna. /// Cada passo afunda um pouquinho, // como se a terra quisesse acolher você.',
        'Ouça o som das ondas chegando // e se afastando. /// Chegando, // e se afastando. /// Sempre no mesmo ritmo calmo.',
        'O vento do mar traz um cheiro de sal e de liberdade. /// Inspire fundo esse ar leve.',
        'Você encontra um lugar e se senta na areia, // de frente para o horizonte. /// O mar se estende muito além, // e o céu fica dourado.',
        'Cada onda que chega traz paz. /// Cada onda que volta leva embora uma preocupação, // uma tensão, // um peso.',
        'Sinta a areia sustentando o corpo todo. /// As costas se soltam. // Os braços ficam pesados. // As pernas relaxam.',
        'Acompanhe sua respiração no ritmo das ondas. /// Inspire, // quando a onda chega. /// Solte, // quando ela volta ao mar.',
        'O sol vai baixando devagar, // pintando o céu de laranja e rosa. /// Uma sensação de gratidão toma conta de você.',
        'Aqui, // você não precisa ser ou fazer nada. /// Basta estar, // ouvindo o mar, // em silêncio e em paz.',
        'Deixe o som das ondas embalar seus pensamentos, // como um berço calmo.'
      ],
      fecho: 'Agradeça ao mar por esta calma. /// Saiba que ele continua aí, // e que você pode voltar sempre que quiser, // apenas respirando devagar. /// Leve com você o ritmo tranquilo das ondas.' },

    { id: 'floresta', nome: 'Floresta', emoji: '🌳', fundo: { natureza: ['floresta', 'riacho'], musica: 'musica2' },
      abertura: 'Encontre uma posição confortável. /// Feche os olhos e imagine uma floresta antiga, // silenciosa e acolhedora, // com a luz do sol passando entre as folhas.',
      cenas: [
        'Você entra devagar na floresta. /// O ar é fresco e o chão, // macio de folhas e musgo.',
        'Árvores altas se erguem ao seu redor, // firmes e calmas. /// Elas estão aqui há muitos anos, // sem nenhuma pressa.',
        'Ouça os sons da mata: // folhas se movendo, // pequenos pássaros, // a água de um riacho escondido.',
        'Você segue o som da água e encontra um riacho de água clara, // correndo entre as pedras.',
        'Sente-se ao lado de uma árvore grande e apoie as costas no tronco. /// Ele é forte e firme, // e sustenta você.',
        'Respire o cheiro de madeira e de terra úmida. /// A cada respiração, // o corpo se enraíza um pouco mais, // como as raízes da árvore.',
        'Sinta a calma da floresta entrando em você. /// Os pensamentos ficam mais lentos. // A mente fica mais clara.',
        'Raios de luz douram as folhas. /// Tudo parece suspenso, // tranquilo, // em equilíbrio.',
        'Você faz parte desta paz. /// Assim como a árvore não faz esforço para crescer, // você não precisa se esforçar para descansar.',
        'Fique mais alguns instantes aqui, // em silêncio, // ouvindo a floresta respirar.'
      ],
      fecho: 'Aos poucos, // agradeça à floresta por abrigar você. /// Leve com você a firmeza das árvores e a serenidade da água. /// Esta calma continua com você.' },

    { id: 'chuva', nome: 'Chuva leve', emoji: '🌧️', fundo: { natureza: ['chuva'], musica: 'musica2' },
      abertura: 'Acomode-se com conforto, // talvez bem agasalhado, // e feche os olhos. /// Imagine que você está num lugar seguro e aconchegante, // ouvindo uma chuva leve do lado de fora.',
      cenas: [
        'Escute o som suave da chuva caindo no telhado // e nas folhas. /// Gota após gota, // num ritmo constante e tranquilo.',
        'Aqui dentro, // você está seco, // aquecido e protegido. /// Nada pode atingir você neste momento.',
        'O cheiro de terra molhada entra pela janela. /// Inspire esse aroma fresco e deixe o corpo se aquietar.',
        'Cada gota que cai parece lavar o dia. /// As tensões vão escorrendo, // como a água pelo vidro, // até sumirem.',
        'Perceba o peso do seu corpo apoiado. /// Os olhos descansam. // O rosto se suaviza. // A testa se abre.',
        'A chuva continua, // suave e regular. /// Você não precisa fazer nada. // Basta ouvir.',
        'Se algum pensamento aparecer, // deixe-o passar como uma gota que escorre, // e volte ao som da chuva.',
        'Sinta uma sensação de aconchego, // como estar embrulhado numa manta macia. /// Tudo está bem.',
        'A respiração fica mais lenta e mais profunda, // acompanhando o ritmo da chuva. /// Inspire, // e solte.',
        'Deixe o som da chuva embalar você, // cada vez mais tranquilo.'
      ],
      fecho: 'A chuva continua lá fora, // e a calma continua aqui dentro. /// Agradeça a si mesmo por ter reservado este tempo. /// Leve este aconchego com você.' }
  ];

  const DURACOES = [3, 5, 10, 15];
  const CENAS_POR_DURACAO = { 3: 2, 5: 4, 10: 7, 15: 10 };
  const SEG_POR_PALAVRA = 0.62;                  // estimativa de fala calma, com as pausas marcadas
  const palavras = t => t.replace(/\/+/g, ' ').trim().split(/\s+/).length;
  const estimar = t => Math.round(palavras(t) * SEG_POR_PALAVRA + (t.match(/\/\/\//g) || []).length * 1.5 + (t.replace(/\/\/\//g, '').match(/\/\//g) || []).length * 0.8);

  // lista de trechos (com id do arquivo) para um cenário e duração
  function trechos(cen, min) {
    const k = Math.min(CENAS_POR_DURACAO[min] || 3, cen.cenas.length);
    const lista = [{ id: cen.id + '-abertura', texto: cen.abertura }, Object.assign({ comum: true }, COMUM[0])];
    for (let i = 0; i < k; i++) {
      lista.push({ id: cen.id + '-cena-' + (i + 1), texto: cen.cenas[i] });
      if (k >= 4 && i === Math.floor(k / 2)) lista.push(Object.assign({ comum: true }, COMUM[1]));
    }
    if (k >= 7) lista.splice(lista.length - 2, 0, Object.assign({ comum: true }, COMUM[2]));
    lista.push({ id: cen.id + '-fecho', texto: cen.fecho }, Object.assign({ comum: true }, COMUM[3]));
    return lista;
  }
  // todos os trechos que precisam de áudio (sem repetir)
  function todosTrechos() {
    const m = new Map();
    CENARIOS.forEach(c => { trechos(c, 15).forEach(t => m.set(t.id, t)); c.cenas.forEach((x, i) => m.set(c.id + '-cena-' + (i + 1), { id: c.id + '-cena-' + (i + 1), texto: x })); });
    return [...m.values()];
  }
  // linha do tempo: [{ t, dur, trecho }], total (s). durClips = { id: segundos } vindos do manifesto (áudio real); senão estimativa
  function linhaDoTempo(cen, min, durClips) {
    const T = min * 60, FADE_ENTRADA = 8, FADE_SAIDA = 15;
    const lista = trechos(cen, min); durClips = durClips || {};
    let S = lista.map(t => durClips[t.id] || estimar(t.texto));
    let n = lista.length;
    // se a fala não cabe no tempo, tira cenas do meio
    while (S.reduce((a, b) => a + b, 0) + (n - 1) * 4 > T - FADE_ENTRADA - FADE_SAIDA && n > 5) { const i = lista.findIndex(t => /-cena-/.test(t.id)); if (i < 0) break; lista.splice(i, 1); S.splice(i, 1); n--; }
    const fala = S.reduce((a, b) => a + b, 0);
    const livre = Math.max(0, T - FADE_ENTRADA - FADE_SAIDA - fala - 10);
    const gap = Math.max(4, Math.min(75, livre / (n - 1)));
    let t = FADE_ENTRADA; const itens = [];
    lista.forEach((tr, i) => { itens.push({ t, dur: S[i], trecho: tr }); t += S[i] + gap; });
    return { itens, total: T, fadeEntrada: FADE_ENTRADA, fadeSaida: FADE_SAIDA, gapMedio: gap };
  }

  // ── lições de respiração (uma por dia) ──
  const LICOES = [
    { id: 'licao-1', n: 1, titulo: 'Sentir a respiração da barriga', tema: 'Respiração diafragmática, deitado',
      porque: 'O diafragma é o principal músculo da respiração. Respirar "pela barriga" usa melhor os pulmões e acalma o corpo.',
      passos: [['Deite-se de costas', 'Dobre os joelhos e apoie uma mão no peito e outra na barriga. Solte os ombros.', 20],
        ['Inspire pelo nariz', 'Respire devagar: a mão da barriga deve subir mais que a do peito. Sem forçar.', 0, 'diafragmatica'],
        ['Descanse', 'Respire como quiser por alguns segundos e sinta o corpo.', 15]] },
    { id: 'licao-2', n: 2, titulo: 'Barriga sentado', tema: 'Respiração diafragmática, sentado',
      porque: 'Quando você sente a respiração da barriga sentado, consegue usá-la no dia a dia, no trabalho ou no sofá.',
      passos: [['Sente-se com a coluna alta', 'Apoie as costas, os pés no chão e uma mão sobre a barriga.', 20], ['Respire pela barriga', 'Inspire pelo nariz enchendo a barriga, expire solto.', 0, 'diafragmatica'], ['Relaxe', 'Observe se os ombros ficaram mais soltos.', 15]] },
    { id: 'licao-3', n: 3, titulo: 'Soltar o ar devagar', tema: 'Expiração longa',
      porque: 'Quando a expiração é mais longa que a inspiração, o corpo entende que pode relaxar.',
      passos: [['Prepare-se', 'Sente-se confortável. Vamos inspirar por 4 tempos e soltar o ar por 6 a 8.', 15], ['Expiração longa', 'Inspire pelo nariz e solte o ar bem devagar pela boca, como se soprasse num canudo fino.', 0, 'expiracao_longa'], ['Descanse', 'Respire normalmente e perceba como está o corpo.', 15]] },
    { id: 'licao-4', n: 4, titulo: 'Respirar com os lábios semicerrados', tema: 'Respiração frenolabial',
      porque: 'Soltar o ar com os lábios quase fechados, como num beijo, ajuda a esvaziar melhor os pulmões e é usada em reabilitação respiratória. Se você tem doença respiratória, siga também a orientação do seu médico ou fisioterapeuta.',
      passos: [['Posição', 'Sente-se com os ombros soltos. Inspire pelo nariz, com a boca fechada, contando 2.', 15], ['Lábios semicerrados', 'Solte o ar devagar pelos lábios quase fechados, contando 4. Sem soprar forte.', 0, 'frenolabial'], ['Descanse', 'Se sentir tontura, volte a respirar normalmente.', 15]] },
    { id: 'licao-5', n: 5, titulo: 'Barriga e expiração juntas', tema: 'Diafragmática + expiração longa',
      porque: 'Juntar a respiração da barriga com a expiração longa é a base para relaxar rápido em momentos de tensão.',
      passos: [['Posição', 'Sentado, uma mão na barriga. Inspire 4 tempos pelo nariz.', 15], ['Barriga e expiração', 'Expire em 8 tempos, devagar, esvaziando a barriga.', 0, 'expiracao_longa'], ['Descanse', 'Respire como quiser e sinta o corpo.', 15]] },
    { id: 'licao-6', n: 6, titulo: 'Ritmo de 6 respirações por minuto', tema: 'Respiração coerente',
      porque: 'Respirar cerca de 6 vezes por minuto, 5 segundos para dentro e 5 para fora, é um ritmo muito usado para relaxar.',
      passos: [['Posição', 'Sente-se com conforto. Vamos respirar em ciclos de 10 segundos.', 15], ['Respiração coerente', 'Acompanhe o círculo: inspire 5, expire 5.', 0, 'coerente'], ['Descanse', 'Respire naturalmente.', 15]] },
    { id: 'licao-7', n: 7, titulo: 'Respirar andando', tema: 'Respiração no ritmo dos passos',
      porque: 'Sincronizar a respiração com os passos ajuda a caminhar com menos cansaço e mais calma.',
      passos: [['Prepare-se', 'Fique de pé e comece a caminhar devagar no lugar ou pelo ambiente.', 20], ['No ritmo dos passos', 'Inspire por 2 passos e expire por 3 ou 4 passos, pelo nariz ou pelos lábios semicerrados. Se faltar ar, volte ao normal.', 90], ['Descanse', 'Pare, sente-se e respire normalmente.', 15]] }
  ];

  window.RELAX_DADOS = { COMUM, CENARIOS, DURACOES, trechos, todosTrechos, linhaDoTempo, estimar, LICOES, palavras };
})();
