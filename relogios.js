/* FitFlow — tabela de "famílias" de relógios (fácil de ampliar).
   Cada família diz como reconhecer o protocolo de um relógio pelo que ele anuncia por Bluetooth:
   - fabricante: texto do campo "Manufacturer Name" (Device Information 0x180A / 0x2A29), lido depois de conectar
   - servicos:   UUIDs de serviço que o relógio anuncia ou expõe
   - nomes:      nome anunciado (menos confiável, só como pista)
   Para adicionar um relógio novo: copie um bloco, mude os campos e pronto. O Rotina só IDENTIFICA a família;
   a leitura de dados por protocolo próprio é uma etapa separada, feita só depois de testada num aparelho real.
   Fontes: documentação pública (Gadgetbridge, "MoYoung protocol"). Nenhum código foi copiado (licença AGPL). */
(function () {
  const u16 = n => '0000' + n.toString(16).padStart(4, '0') + '-0000-1000-8000-00805f9b34fb';

  // serviços padrão do Bluetooth SIG que o Rotina usa automaticamente quando existem
  window.SERVICOS_PADRAO = {
    fc: { uuid: u16(0x180d), nome: 'Frequência cardíaca', medicao: u16(0x2a37) },
    bateria: { uuid: u16(0x180f), nome: 'Bateria', nivel: u16(0x2a19) },
    info: { uuid: u16(0x180a), nome: 'Informações do aparelho',
      carac: { fabricante: u16(0x2a29), modelo: u16(0x2a24), firmware: u16(0x2a26), hardware: u16(0x2a27), software: u16(0x2a28) } },
    rsc: { uuid: u16(0x1814), nome: 'Velocidade e cadência de corrida', medicao: u16(0x2a53) }
  };
  window.u16uuid = u16;

  window.RELOGIOS_FAMILIAS = [
    {
      id: 'moyoung',
      nome: 'MOYOUNG / Da Fit (inclui relógios COLMI)',
      fabricante: [/^MOYOUNG(-V2)?$/i],           // "MOYOUNG" = V1 (pacotes fixos), "MOYOUNG-V2" = V2 (pelo MTU)
      servicos: [u16(0xfeea)],                    // pacotes V2 começam com os bytes FE EA
      nomes: [/^(da ?fit|moyoung|colmi)/i],       // pista: a confirmar com o diagnóstico
      protocolo: 'Proprietário (cabeçalho FE EA; versão 1 ou 2 conforme o fabricante informado)',
      suporte: 'identificado',                    // 'identificado' = só reconhece; 'leitura' = já lê dados
      observacao: 'Costuma sincronizar pelo app Da Fit ou COLMI Fit. Os dados dele chegam ao Rotina pelo Health Connect, se o app oficial gravar lá.'
    }
    // Exemplo de novo bloco:
    // { id: 'xiaomi-band', nome: 'Xiaomi / Mi Band', fabricante: [/xiaomi/i], servicos: ['0000fee0-0000-1000-8000-00805f9b34fb'], nomes: [/^mi (smart )?band/i], protocolo: '...', suporte: 'identificado', observacao: '...' }
  ];

  /* Reconhece a família. info = { nome, localName, servicos: [uuid...], fabricante }.
     Retorna { familia, motivo: [...], confianca: 'alta'|'media'|'baixa' } ou null. */
  window.reconhecerFamilia = function (info) {
    const svc = (info.servicos || []).map(s => String(s).toLowerCase());
    const nomes = [info.nome, info.localName].filter(Boolean);
    let melhor = null;
    for (const f of window.RELOGIOS_FAMILIAS) {
      const motivo = []; let pts = 0;
      if (info.fabricante && f.fabricante && f.fabricante.some(r => r.test(info.fabricante))) { motivo.push('fabricante informado: ' + info.fabricante); pts += 3; }
      if (f.servicos && f.servicos.some(s => svc.includes(s.toLowerCase()))) { motivo.push('serviço próprio presente'); pts += 2; }
      if (f.nomes && nomes.some(n => f.nomes.some(r => r.test(n)))) { motivo.push('nome anunciado parecido'); pts += 1; }
      if (pts && (!melhor || pts > melhor.pts)) melhor = { familia: f, motivo, pts };
    }
    return melhor ? { familia: melhor.familia, motivo: melhor.motivo, confianca: melhor.pts >= 3 ? 'alta' : melhor.pts >= 2 ? 'media' : 'baixa' } : null;
  };
})();
