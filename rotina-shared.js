/* ROTINA — módulo compartilhado (clima + ponte com o Android + tela cheia).
 * ATENÇÃO: esta é a MESMA cópia em ../escoteiro-moderno/rotina-shared.js e ../fitflow/rotina-shared.js
 * (o "npm run sync-web" do rotina-app confere se as três são idênticas). A fonte é rotina-app/shared/.
 * No navegador (sem o app Android) só o clima e o cabeçalho que some ao rolar funcionam; o resto é no-op.
 */
(function (root) {
  'use strict';
  var NATIVE = !!(root.Capacitor && root.Capacitor.isNativePlatform && root.Capacitor.isNativePlatform());
  var P = function (n) { return root.Capacitor && root.Capacitor.Plugins && root.Capacitor.Plugins[n]; };
  var LAT = -23.6737, LON = -46.5432;   // Santo André/SP
  var WX_URL = 'https://api.open-meteo.com/v1/forecast?latitude=' + LAT + '&longitude=' + LON +
    '&current=temperature_2m&hourly=temperature_2m,precipitation_probability,precipitation,cloud_cover,relative_humidity_2m' +
    '&daily=precipitation_sum,precipitation_probability_max,temperature_2m_max&forecast_days=7&timezone=America%2FSao_Paulo';
  var KEY = 'rotina_clima_v2';
  var MEIA_HORA = 30 * 60 * 1000;

  var pad = function (n) { return String(n).padStart(2, '0'); };
  var dstr = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  var hhmm = function (ts) { var d = new Date(ts); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };

  // ══ regras do clima (as MESMAS do Kotlin: Clima.kt) ═══════════════════════════════════
  var seca = function (h) { return h.prob < 30 && h.mm < 0.3; };           // chance de chuva < 30% e < 0,3 mm
  var quente = function (h) { return h.temp >= 32; };                       // calor forte: 32 °C ou mais
  var molhada = function (h) { return h.mm >= 0.3 || h.prob >= 60; };

  /** Converte a resposta da Open-Meteo em lista de horas [{ts, dia, h, prob, mm, temp, nuv}]. */
  function parseHoras(d) {
    var H = d.hourly, out = [];
    for (var i = 0; i < H.time.length; i++) {
      var t = H.time[i];   // "2026-11-24T14:00" (horário de Brasília)
      out.push({
        ts: new Date(+t.slice(0, 4), +t.slice(5, 7) - 1, +t.slice(8, 10), +t.slice(11, 13), 0, 0).getTime(),
        dia: t.slice(0, 10), h: +t.slice(11, 13),
        prob: H.precipitation_probability[i] == null ? 0 : H.precipitation_probability[i],
        mm: H.precipitation[i] == null ? 0 : H.precipitation[i],
        temp: H.temperature_2m[i] == null ? 20 : H.temperature_2m[i],
        nuv: H.cloud_cover && H.cloud_cover[i] != null ? H.cloud_cover[i] : 50
      });
    }
    return out;
  }

  /** Melhor início {min, calor} (minutos desde 0h) para uma tarefa externa de durMin no dia ('yyyy-MM-dd'), entre deH e ateH,
   *  só em horas sem chuva e depois de 'agora'. Prefere perto das 10h e foge do calor forte. null = sem janela. */
  function janela(horas, dia, durMin, deH, ateH, agora) {
    var n = Math.max(1, Math.ceil(durMin / 60)), map = {};
    horas.forEach(function (x) { if (x.dia === dia) map[x.h] = x; });
    var melhor = null, melhorPts = -Infinity;
    for (var h = deH; h <= ateH - n; h++) {
      var ini = map[h]; if (!ini || ini.ts <= agora) continue;
      var ok = true, calor = 0, soma = 0;
      for (var k = 0; k < n; k++) { var x = map[h + k]; if (!x || !seca(x)) { ok = false; break; } if (quente(x)) calor++; soma += x.temp; }
      if (!ok) continue;
      var pts = -Math.abs(h - 10) - 2 * calor - (soma / n) / 100;
      if (pts > melhorPts) { melhorPts = pts; melhor = { min: h * 60, calor: calor > 0 }; }
    }
    return melhor;
  }
  function proximaChuva(horas, agora, ateHoras) {
    return horas.filter(function (x) { return x.ts > agora && x.ts <= agora + ateHoras * 3600000; })
      .filter(function (x) { return x.prob >= 50 || x.mm >= 0.5; })[0] || null;
  }
  function horaAtual(horas, agora) {
    var r = null; horas.forEach(function (x) { if (x.ts <= agora && agora < x.ts + 3600000) r = x; }); return r;
  }
  function maisFresca(horas, agora) {
    var hoje = dstr(new Date(agora));
    return horas.filter(function (x) { return x.ts > agora && x.dia === hoje && seca(x) && !quente(x) && x.h >= 7 && x.h <= 19; })[0] || null;
  }

  /** Texto do aviso/dica pelo clima (igual ao do Android). it = {ext, frase, dentro, dur}. */
  function textoPeloClima(it, agora, horas) {
    var padrao = 'Hora de ' + it.frase + ' (' + it.dur + ' min)';
    if (!it.ext) return padrao;
    var h0 = horaAtual(horas, agora); if (!h0) return padrao;
    if (quente(h0)) {
      var f = maisFresca(horas, agora);
      return 'Calor forte (' + Math.round(h0.temp) + '°): melhor ' + it.frase + ' ' + (f ? 'às ' + f.h + 'h, mais fresco' : 'mais tarde, quando esfriar');
    }
    if (molhada(h0)) return 'Está chovendo: troque por uma tarefa interna';
    var c = proximaChuva(horas, agora, 3);
    if (c) return 'Vai chover às ' + new Date(c.ts).getHours() + 'h: ' + it.dentro;
    if (!seca(h0)) return 'Tempo incerto (' + h0.prob + '% de chuva): ' + padrao;
    return (h0.nuv < 60 ? 'Sol agora' : 'Sem chuva agora') + ': bom pra ' + it.frase;
  }

  // ══ busca e atualização do clima ═══════════════════════════════════════════════════
  var estado = { dados: null, t: 0, ok: false, erro: '' };   // ok: true = veio da internet nesta sessão
  var ouvintes = [];
  function lerCache() { try { var c = JSON.parse(localStorage.getItem(KEY) || 'null'); if (c && c.data && c.t) { estado.dados = c.data; estado.t = c.t; } } catch (e) {} }
  lerCache();
  function avisar() { ouvintes.forEach(function (f) { try { f(estado); } catch (e) {} }); }

  /** Atualiza a previsão. force = ignora o cache de 30 min. Devolve a Promise do estado. */
  function atualizar(force) {
    if (!force && estado.dados && Date.now() - estado.t < MEIA_HORA) return Promise.resolve(estado);
    return fetch(WX_URL).then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); }).then(function (d) {
      parseHoras(d);   // valida
      estado.dados = d; estado.t = Date.now(); estado.ok = true; estado.erro = '';
      try { localStorage.setItem(KEY, JSON.stringify({ t: estado.t, data: d })); } catch (e) {}
      var L = P('Lembretes'); if (NATIVE && L && L.atualizarClima) L.atualizarClima().catch(function () {});
      avisar(); return estado;
    }).catch(function (e) { estado.ok = false; estado.erro = (e && e.message) || 'sem internet'; avisar(); return estado; });
  }
  var timer = null;
  /** Ao abrir, ao voltar pro app depois de 30 min e a cada 30 min com o app aberto. */
  function iniciarAuto() {
    if (iniciarAuto.feito) return; iniciarAuto.feito = true;
    if (!estado.dados || Date.now() - estado.t > 5 * 60000) atualizar(true); else avisar();   // ao abrir
    document.addEventListener('visibilitychange', function () { if (!document.hidden && Date.now() - estado.t >= MEIA_HORA) atualizar(true); });
    timer = setInterval(function () { if (!document.hidden) atualizar(true); }, MEIA_HORA);
  }
  function horas() { try { return estado.dados ? parseHoras(estado.dados) : []; } catch (e) { return []; } }
  function atualizadoTxt() {
    if (!estado.t) return 'sem previsão ainda';
    return 'atualizado às ' + hhmm(estado.t) + (estado.erro ? ' (sem internet: mostrando dados guardados)' : '');
  }

  // ══ ponte com o Android (no navegador: no-op) ═════════════════════════════════════
  var nativo = {
    ativo: NATIVE,
    P: P,
    sensores: function () { var s = P('Sensores'); return NATIVE && s ? s.detectar().catch(function () { return null; }) : Promise.resolve(null); },
    permissoes: function () { var s = P('Permissoes'); return NATIVE && s ? s.estado().catch(function () { return null; }) : Promise.resolve(null); },
    pedir: function (quais) { var s = P('Permissoes'); return NATIVE && s ? s.pedir({ quais: quais }) : Promise.resolve(null); },
    abrir: function (qual) { var s = P('Permissoes'); return NATIVE && s && s[qual] ? s[qual]().catch(function () { return null; }) : Promise.resolve(null); },
    /** fonte: 'rotina' (Escoteiro) ou 'fitflow'. itens: [{id, kind, nome, emoji, ext, dur, dias:[0..6], hora:'HH:mm'|'auto', frase, dentro, texto, feito, trocada}] */
    sincronizarLembretes: function (fonte, itens) { var s = P('Lembretes'); return NATIVE && s ? s.sincronizar({ fonte: fonte, itens: itens }).catch(function () { return null; }) : Promise.resolve(null); },
    acaoPendente: function () { var s = P('Lembretes'); return NATIVE && s ? s.acao().catch(function () { return null; }) : Promise.resolve(null); },
    limparAcao: function () { var s = P('Lembretes'); return NATIVE && s ? s.limparAcao().catch(function () {}) : Promise.resolve(); },
    aoReceberAcao: function (fn) { var s = P('Lembretes'); if (NATIVE && s && s.addListener) s.addListener('acao', fn); },
    testarLembrete: function (id) { var s = P('Lembretes'); return NATIVE && s ? s.testar({ id: id }) : Promise.resolve(); }
  };

  // ══ tela de permissões e bateria (realme UI) ═══════════════════════════════════════
  var PERM_CSS = '#rt-perm{position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.72);display:flex;align-items:flex-end;justify-content:center;font-family:system-ui,sans-serif}' +
    '#rt-perm .rt-box{background:#fff;color:#222;width:100%;max-width:460px;max-height:92vh;overflow:auto;border-radius:18px 18px 0 0;padding:16px 16px calc(16px + env(safe-area-inset-bottom,0px));box-sizing:border-box}' +
    '#rt-perm h2{font-size:18px;margin:0 0 6px}#rt-perm p{font-size:14px;line-height:1.45;margin:6px 0;color:#444}' +
    '#rt-perm .rt-it{display:flex;gap:10px;align-items:flex-start;padding:10px 0;border-top:1px solid #eee}' +
    '#rt-perm .rt-it b{display:block;font-size:14px}#rt-perm .rt-it span.rt-d{font-size:12.5px;color:#666;line-height:1.4;display:block}' +
    '#rt-perm .rt-st{flex:0 0 auto;font-size:12px;font-weight:700;padding:3px 8px;border-radius:10px;white-space:nowrap}' +
    '#rt-perm .rt-ok{background:#E3F6EA;color:#1E7A45}#rt-perm .rt-no{background:#FDECEC;color:#B03030}' +
    '#rt-perm button{font:inherit;font-weight:700;font-size:14px;border:0;border-radius:10px;padding:10px 12px;margin:4px 6px 0 0;background:#3D6B4F;color:#fff;min-height:44px}' +
    '#rt-perm button.g{background:#e8e8e8;color:#333}#rt-perm ol{margin:6px 0 6px 18px;padding:0;font-size:13.5px;line-height:1.5;color:#333}';
  function abrirPermissoes() {
    var antigo = document.getElementById('rt-perm'); if (antigo) antigo.remove();
    if (!document.getElementById('rt-perm-css')) { var st = document.createElement('style'); st.id = 'rt-perm-css'; st.textContent = PERM_CSS; document.head.appendChild(st); }
    var ov = document.createElement('div'); ov.id = 'rt-perm'; document.body.appendChild(ov);
    function pintar(e) {
      e = e || {};
      var linha = function (ok, titulo, desc, btn) {
        return '<div class="rt-it"><div style="flex:1"><b>' + titulo + '</b><span class="rt-d">' + desc + '</span>' + (ok || !btn ? '' : '<button data-a="' + btn + '">Permitir</button>') + '</div>' +
          '<span class="rt-st ' + (ok ? 'rt-ok' : 'rt-no') + '">' + (ok ? 'Liberado' : 'Falta') + '</span></div>';
      };
      ov.innerHTML = '<div class="rt-box"><h2>🔧 Permissões e bateria</h2>' +
        '<p>Sem isto o ' + (e.realme ? 'realme/Android' : 'Android') + ' fecha o app em segundo plano: os passos param de contar e os avisos não tocam.</p>' +
        linha(e.atividade, 'Atividade física', 'Conta passos, tempo ativo e reconhece se você está andando, correndo ou parado.', 'atividade') +
        linha(e.notificacao, 'Notificações', 'Avisos das tarefas e do treino no horário.', 'notificacao') +
        linha(e.alarmeExato, 'Alarmes e lembretes (alarme exato)', 'Para o aviso tocar na hora certa, e não com atraso.', 'alarmeExato') +
        linha(e.bateriaLivre, 'Ignorar otimização de bateria', 'Deixa o app trabalhar em segundo plano sem o sistema matar.', 'ignorarBateria') +
        linha(e.microfone, 'Microfone (só para o sono)', 'Mede só o volume do quarto durante o monitor de sono. Nada é gravado. Pode deixar sem, se não for usar o sono.', 'microfone') +
        '<div class="rt-it"><div style="flex:1"><b>Início automático (realme UI)</b><span class="rt-d">Não dá pra o app saber se está ligado: confira você.</span>' +
        '<ol><li>Toque em <b>Abrir Início automático</b>.</li><li>Procure <b>Rotina</b> e ligue <b>Permitir início automático</b> (e <b>Atividade em segundo plano</b>, se aparecer).</li>' +
        '<li>Em Configurações &gt; Bateria &gt; Rotina, escolha <b>Sem restrições</b>.</li><li>Nos apps recentes, segure o card da Rotina e toque no <b>cadeado</b> para o realme não fechá-lo.</li></ol>' +
        '<button data-a="inicioAutomatico">Abrir Início automático</button><button class="g" data-a="detalhes">Detalhes do app</button></div></div>' +
        '<div style="margin-top:10px"><button data-a="tudo">Permitir tudo que falta</button><button class="g" data-a="fechar">Fechar</button></div></div>';
    }
    function recarregar() { return nativo.permissoes().then(function (e) { pintar(e); return e; }); }
    ov.addEventListener('click', function (ev) {
      var a = ev.target && ev.target.getAttribute && ev.target.getAttribute('data-a'); if (!a) { if (ev.target === ov) ov.remove(); return; }
      if (a === 'fechar') { try { localStorage.setItem('rotina_perm_vista', '1'); } catch (e) {} ov.remove(); return; }
      if (a === 'atividade' || a === 'notificacao' || a === 'microfone') nativo.pedir([a]).then(recarregar);
      else if (a === 'tudo') nativo.pedir(['atividade', 'notificacao']).then(function () { return nativo.abrir('alarmeExato'); });
      else if (a === 'alarmeExato' || a === 'ignorarBateria' || a === 'inicioAutomatico') nativo.abrir(a);
      else if (a === 'detalhes') nativo.abrir('detalhesDoApp');
    });
    document.addEventListener('visibilitychange', function () { if (!document.hidden && document.getElementById('rt-perm')) recarregar(); });
    pintar({}); recarregar();
  }
  /** Mostra a tela de permissões uma vez, na primeira abertura do app Android. */
  function permissoesNaPrimeiraVez() {
    if (!NATIVE) return;
    var vista = false; try { vista = localStorage.getItem('rotina_perm_vista') === '1'; } catch (e) {}
    if (vista) return;
    try { localStorage.setItem('rotina_perm_vista', '1'); } catch (e) {}
    setTimeout(abrirPermissoes, 1200);
  }

  // ══ cabeçalho que some ao rolar pra baixo e volta ao rolar pra cima ═══════════════════
  function esconderAoRolar(el, opcoes) {
    var ctl = { mostrar: function () {} };
    if (!el) return ctl;
    opcoes = opcoes || {};
    var ult = 0, oculto = false, limite = 12;
    var alvo = function (ev) { return ev && ev.target && ev.target !== document && ev.target.scrollTop != null ? ev.target : null; };
    function mostrar() { if (oculto) { oculto = false; el.classList.remove('rt-oculto'); if (opcoes.aoMudar) opcoes.aoMudar(false); } ult = 0; }
    document.addEventListener('scroll', function (ev) {
      var t = alvo(ev), y = t ? t.scrollTop : (window.pageYOffset || document.documentElement.scrollTop || 0);
      var d = y - ult;
      if (Math.abs(d) < limite) return;
      var h = el.offsetHeight + 4;
      if (d > 0 && y > h && !oculto) { oculto = true; el.classList.add('rt-oculto'); if (opcoes.aoMudar) opcoes.aoMudar(true); }
      else if ((d < 0 || y <= 2) && oculto) mostrar();
      ult = y;
    }, true);
    ctl.mostrar = mostrar;
    return ctl;
  }

  root.Rotina = {
    nativo: nativo, nativoAtivo: NATIVE, pad: pad, dstr: dstr, hhmm: hhmm,
    clima: { seca: seca, quente: quente, molhada: molhada, parseHoras: parseHoras, janela: janela, proximaChuva: proximaChuva, horaAtual: horaAtual,
      maisFresca: maisFresca, textoPeloClima: textoPeloClima, atualizar: atualizar, iniciarAuto: iniciarAuto, horas: horas,
      estado: function () { return estado; }, atualizadoTxt: atualizadoTxt, aoMudar: function (f) { ouvintes.push(f); }, URL: WX_URL },
    abrirPermissoes: abrirPermissoes, permissoesNaPrimeiraVez: permissoesNaPrimeiraVez, esconderAoRolar: esconderAoRolar
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.Rotina;
})(typeof window !== 'undefined' ? window : globalThis);
