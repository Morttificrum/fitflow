/* FitFlow — Bluetooth LE no app Android (o WebView não tem Web Bluetooth).
   Usa @capacitor-community/bluetooth-le (plugin "BluetoothLe").
   - Batimento ao vivo pelo serviço padrão Heart Rate (0x180D / 0x2A37), no mesmo fluxo do timer e do alerta de limite.
   - Scanner de aparelhos próximos, conexão e leitura dos serviços padrão: Heart Rate, Battery 0x180F,
     Device Information 0x180A e Running Speed and Cadence 0x1814.
   - Reconhecimento de "famílias" de relógios (relogios.js) e modo diagnóstico, sem dados pessoais de saúde.
   Prioridade do batimento: Bluetooth ao vivo > Health Connect. */
(function () {
  'use strict';
  const NATIVE = () => !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform());
  if (!NATIVE()) return;
  const $ = id => document.getElementById(id);
  const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const B = () => Capacitor.Plugins.BluetoothLe;
  const SP = window.SERVICOS_PADRAO;
  const hex2 = n => n.toString(16).padStart(2, '0');
  const bytes = h => { const s = String(h || '').replace(/[^0-9a-fA-F]/g, ''); const o = []; for (let i = 0; i + 1 < s.length; i += 2) o.push(parseInt(s.substr(i, 2), 16)); return o; };
  const texto = b => b.filter(x => x >= 32 && x < 127).map(x => String.fromCharCode(x)).join('').trim();
  const eq = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
  const temUuid = (lista, u) => (lista || []).some(x => eq(x, u));

  // ════════════════════════════════════════════════════════════
  //  Camada básica
  // ════════════════════════════════════════════════════════════
  let iniciado = false;
  async function iniciar() {
    if (!B()) throw new Error('Bluetooth indisponível neste aparelho.');
    if (!iniciado) { await B().initialize({ androidNeverForLocation: true }); iniciado = true; }
    const on = (await B().isEnabled()).value;
    if (!on) { try { await B().requestEnable(); } catch (e) { throw new Error('Ligue o Bluetooth do celular e tente de novo.'); } }
  }

  let scanH = null, scanTimer = null;
  async function pararScan() {
    clearTimeout(scanTimer); scanTimer = null;
    try { await B().stopLEScan(); } catch (e) { }
    if (scanH) { try { scanH.remove(); } catch (e) { } scanH = null; }
  }
  async function escanear(ms, filtroServicos, aoMudar, aoFim) {
    await iniciar(); await pararScan();
    const vistos = new Map();
    scanH = await B().addListener('onScanResult', r => {
      const id = r.device.deviceId, ant = vistos.get(id) || {};
      vistos.set(id, { id, nome: r.device.name || r.localName || ant.nome || '', localName: r.localName || ant.localName || '', rssi: r.rssi != null ? r.rssi : ant.rssi,
        uuids: (r.uuids || ant.uuids || []).map(x => String(x).toLowerCase()), empresas: Object.keys(r.manufacturerData || {}) });
      aoMudar([...vistos.values()].sort((a, b) => (b.rssi || -120) - (a.rssi || -120)));
    });
    await B().requestLEScan(filtroServicos && filtroServicos.length ? { services: filtroServicos } : {});
    scanTimer = setTimeout(async () => { await pararScan(); if (aoFim) aoFim(); }, ms);
  }

  const conn = { id: null, nome: '', local: '', anunciados: [], empresas: [], servicos: [], info: {}, bateria: null, familia: null, offH: null, parar: [] };
  async function conectar(disp, aoCair) {
    await pararScan();
    await B().connect({ deviceId: disp.id, timeout: 15000 });
    conn.id = disp.id; conn.nome = disp.nome; conn.local = disp.localName; conn.anunciados = disp.uuids || []; conn.empresas = disp.empresas || [];
    if (conn.offH) { try { conn.offH.remove(); } catch (e) { } }
    conn.offH = await B().addListener('disconnected|' + disp.id, () => { if (aoCair) aoCair(); });
    let r = await B().getServices({ deviceId: disp.id });
    if (!r.services || !r.services.length) { await B().discoverServices({ deviceId: disp.id }); r = await B().getServices({ deviceId: disp.id }); }
    conn.servicos = (r.services || []).map(s => ({ uuid: String(s.uuid).toLowerCase(), carac: (s.characteristics || []).map(c => ({ uuid: String(c.uuid).toLowerCase(), props: Object.keys(c.properties || {}).filter(k => c.properties[k]) })) }));
    conn.info = {}; conn.bateria = null;
    const temSvc = u => conn.servicos.some(s => eq(s.uuid, u));
    const ler = async (svc, car) => { try { return bytes((await B().read({ deviceId: disp.id, service: svc, characteristic: car })).value); } catch (e) { return null; } };
    if (temSvc(SP.info.uuid)) for (const [k, u] of Object.entries(SP.info.carac)) { const b = await ler(SP.info.uuid, u); if (b) conn.info[k] = texto(b); }
    if (temSvc(SP.bateria.uuid)) { const b = await ler(SP.bateria.uuid, SP.bateria.nivel); if (b && b.length) conn.bateria = b[0]; }
    conn.familia = window.reconhecerFamilia({ nome: conn.nome, localName: conn.local, servicos: conn.servicos.map(s => s.uuid).concat(conn.anunciados), fabricante: conn.info.fabricante });
    return conn;
  }
  async function notificar(svc, car, cb) {
    const key = `notification|${conn.id}|${svc}|${car}`;
    const h = await B().addListener(key, ev => cb(bytes(ev && ev.value)));
    await B().startNotifications({ deviceId: conn.id, service: svc, characteristic: car });
    const parar = async () => { try { h.remove(); } catch (e) { } try { await B().stopNotifications({ deviceId: conn.id, service: svc, characteristic: car }); } catch (e) { } };
    conn.parar.push(parar); return parar;
  }
  async function desconectarTudo() {
    for (const p of conn.parar.splice(0)) { try { await p(); } catch (e) { } }
    if (conn.offH) { try { conn.offH.remove(); } catch (e) { } conn.offH = null; }
    if (conn.id) { try { await B().disconnect({ deviceId: conn.id }); } catch (e) { } }
    conn.id = null;
  }

  // ════════════════════════════════════════════════════════════
  //  Padrões: frequência cardíaca e corrida
  // ════════════════════════════════════════════════════════════
  const parseFC = b => { if (b.length < 2) return 0; return (b[0] & 1) ? (b[1] | (b[2] << 8)) : b[1]; };
  function parseRSC(b) {
    if (b.length < 4) return null; const f = b[0]; let i = 4; const o = { velocidade: ((b[1] | (b[2] << 8)) / 256) * 3.6, cadencia: b[3], correndo: !!(f & 4) };
    if (f & 1) { o.passada = (b[i] | (b[i + 1] << 8)) / 100; i += 2; }
    if (f & 2) { o.distancia = ((b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] * 16777216)) / 10); }
    return o;
  }
  let rsc = null;

  function alimentarFC(bpm) {
    if (!bpm || bpm < 25 || bpm > 250) return;
    HR.bpm = bpm; HR.source = 'ble';
    if (typeof timerRunning !== 'undefined' && timerRunning && typeof wkt !== 'undefined') wkt.bpm.push(bpm);
    if (typeof updateHRLive === 'function') updateHRLive();
    if (window.SA) SA.hrSample(bpm);                       // mesmo alerta de limite do restante do app
  }
  let fcParar = null;
  async function ligarFC() {
    if (fcParar) { try { await fcParar(); } catch (e) { } }
    fcParar = await notificar(SP.fc.uuid, SP.fc.medicao, b => alimentarFC(parseFC(b)));
    HR.dev = { ble: true, id: conn.id }; HR.name = conn.nome || conn.local || 'Aparelho Bluetooth'; HR.connected = true; HR.tries = 0; HR.status = ''; HR.manualStop = false;
    if (typeof U !== 'undefined' && !U.hrConnected) { U.hrConnected = true; DB.save('profile', U); if (typeof checkAchievements === 'function') checkAchievements(); }
    renderHR();
  }
  let retomando = false;
  async function aoCair() {
    const antes = HR.dev && HR.dev.ble ? HR.dev : null;
    HR.connected = false; HR.bpm = 0; fcParar = null; conn.parar.length = 0;
    if (!antes || HR.manualStop || retomando) { renderHR(); return; }
    retomando = true;
    for (let t = 1; t <= 3 && !HR.manualStop; t++) {
      HR.status = `Reconectando (${t}/3)...`; renderHR();
      await new Promise(r => setTimeout(r, 2500));
      try { await conectar({ id: antes.id, nome: HR.name, localName: '', uuids: conn.anunciados, empresas: conn.empresas }, aoCair); await ligarFC(); retomando = false; return; } catch (e) { /* tenta de novo */ }
    }
    retomando = false; HR.status = 'Conexão perdida. Toque em conectar para tentar de novo.'; renderHR();
  }
  async function desconectarFC() {
    HR.manualStop = true;
    await desconectarTudo(); fcParar = null; rsc = null;
    HR.connected = false; HR.bpm = 0; HR.status = ''; renderHR();
  }

  // ════════════════════════════════════════════════════════════
  //  Telas
  // ════════════════════════════════════════════════════════════
  function janela(html) { fechar(); const ov = document.createElement('div'); ov.className = 'sa-ov modal'; ov.id = 'ble-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.innerHTML = '<div class="sa-box">' + html + '</div>'; document.body.appendChild(ov); return ov; }
  function fechar() { const o = $('ble-ov'); if (o) o.remove(); }

  const COMO_LIGAR = (aberto) => `<details ${aberto ? "open" : ""} class="sa-alert warn" style="margin:.6rem 0"><summary><b>Como ligar a transmissão de FC no relógio</b></summary>
    <div class="sa-small" style="margin-top:.5rem;line-height:1.65">
    No relógio, procure nas configurações (o nome muda de marca para marca): <b>"Transmitir FC"</b>, <b>"Heart rate broadcast"</b>, <b>"Compartilhar frequência cardíaca"</b> ou <b>"FC externa"</b>.<br>
    • <b>Garmin:</b> nas configurações de frequência cardíaca no pulso, ligue "Transmitir FC".<br>
    • <b>Polar, cintas peitorais e bandas de braço:</b> transmitem sozinhas; umedeça os eletrodos e ajuste a cinta ao corpo.<br>
    • <b>Smartbands genéricas:</b> muitas têm a opção dentro do menu de frequência cardíaca ou de exercício.<br>
    • <b>Samsung Galaxy Watch e Apple Watch</b> normalmente não transmitem: para eles use o Health Connect.<br>
    Com a transmissão ligada, toque em <b>Procurar</b>: o relógio deve aparecer com a etiqueta "Frequência cardíaca".</div></details>`;
  const AVISO_UMA_CONEXAO = '<div class="sa-alert warn"><b>Uma conexão por vez:</b> enquanto estiver conectado ao Rotina, o relógio pode parar de sincronizar com o app oficial dele. Quando terminar, toque em <b>Desconectar</b> para ele voltar ao normal.</div>';

  function barras(rssi) { if (rssi == null) return ''; const n = rssi > -60 ? 4 : rssi > -72 ? 3 : rssi > -85 ? 2 : 1; return '▂▄▆█'.slice(0, n) + '<span style="opacity:.25">' + '▂▄▆█'.slice(n) + '</span>'; }

  function seletor(modo) {
    const soFC = modo === 'fc';
    janela(`<div class="sa-h">${soFC ? '⌚ Batimento ao vivo' : '📡 Aparelhos Bluetooth'}</div>
      ${soFC ? '<p class="sa-p">Conecte um relógio ou cinta que esteja <b>transmitindo a frequência cardíaca</b>. Os batimentos aparecem no timer e o app avisa se passar do limite.</p>' : '<p class="sa-p">Lista aparelhos Bluetooth próximos. Conecte para ver os serviços e a bateria.</p>'}
      ${COMO_LIGAR(true)}${AVISO_UMA_CONEXAO}
      ${soFC ? '<label class="sa-row"><input type="checkbox" id="ble-todos"> <span>Mostrar todos os aparelhos (não só os que anunciam frequência cardíaca)</span></label>' : ''}
      <button class="sa-btn" id="ble-scan">🔍 Procurar</button>
      <div id="ble-lista" aria-live="polite"></div>
      <div class="sa-small" id="ble-erro" style="color:var(--yellow)"></div>
      <button class="sa-btn sec" id="ble-x">Fechar</button>`);
    let lista = []; let buscando = false;
    const desenhar = () => {
      const alvo = soFC && !$('ble-todos').checked ? lista.filter(d => temUuid(d.uuids, SP.fc.uuid)) : lista;
      $('ble-lista').innerHTML = alvo.length ? alvo.map(d => {
        const fam = window.reconhecerFamilia({ nome: d.nome, localName: d.localName, servicos: d.uuids });
        return `<div class="sa-row" data-id="${esc(d.id)}" role="button" tabindex="0"><div style="flex:1"><b>${esc(d.nome || d.localName || '(sem nome)')}</b>
          <div class="sa-small">${temUuid(d.uuids, SP.fc.uuid) ? '❤️ Frequência cardíaca · ' : ''}${fam ? '🏷️ ' + esc(fam.familia.nome) + ' · ' : ''}<span aria-label="sinal">${barras(d.rssi)}</span></div></div></div>`;
      }).join('') : (buscando ? '<div class="sa-small">Procurando…</div>' : '<div class="sa-small">Nenhum aparelho encontrado ainda.' + (soFC ? ' Confirme que a transmissão de FC está ligada no relógio.' : '') + '</div>');
      $('ble-lista').querySelectorAll('.sa-row').forEach(el => el.onclick = () => escolher(lista.find(x => x.id === el.dataset.id)));
    };
    const procurar = async () => {
      $('ble-erro').textContent = ''; buscando = true; $('ble-scan').textContent = '⏳ Procurando… (10 s)'; $('ble-scan').disabled = true; lista = []; desenhar();
      try {
        await escanear(10000, soFC && !$('ble-todos').checked ? [SP.fc.uuid] : [], l => { lista = l; desenhar(); }, () => { buscando = false; $('ble-scan').textContent = '🔍 Procurar de novo'; $('ble-scan').disabled = false; desenhar(); });
      } catch (e) { buscando = false; $('ble-scan').disabled = false; $('ble-scan').textContent = '🔍 Procurar'; $('ble-erro').textContent = e.message || String(e); }
    };
    const escolher = async d => {
      if (!d) return;
      $('ble-erro').textContent = 'Conectando a ' + (d.nome || 'aparelho') + '…';
      try {
        await conectar(d, aoCair);
        if (soFC) {
          if (!conn.servicos.some(s => eq(s.uuid, SP.fc.uuid))) { await desconectarTudo(); $('ble-erro').textContent = 'Este aparelho não oferece frequência cardíaca por Bluetooth. Ligue a transmissão de FC nele ou escolha outro.'; return; }
          await ligarFC(); fechar();
          if (typeof showNotif === 'function') showNotif('⌚', 'Conectado', HR.name + ' · batimento ao vivo');
        } else detalhes();
      } catch (e) { await desconectarTudo(); $('ble-erro').textContent = 'Não consegui conectar: ' + (e.message || e) + '. Aproxime o relógio e tente de novo.'; }
    };
    $('ble-scan').onclick = procurar;
    $('ble-x').onclick = () => { pararScan(); fechar(); };
    if ($('ble-todos')) $('ble-todos').onchange = desenhar;
    desenhar(); procurar();
  }

  function detalhes() {
    const tem = u => conn.servicos.some(s => eq(s.uuid, u));
    const nomePadrao = u => { for (const k in SP) if (eq(SP[k].uuid, u)) return SP[k].nome; return null; };
    const fam = conn.familia;
    janela(`<div class="sa-h">${esc(conn.nome || conn.local || 'Aparelho')}</div>
      ${conn.bateria != null ? `<p class="sa-p">🔋 Bateria: <b>${conn.bateria}%</b></p>` : ''}
      ${Object.keys(conn.info).length ? `<div class="sa-small" style="margin-bottom:.5rem">${['fabricante', 'modelo', 'firmware', 'hardware', 'software'].filter(k => conn.info[k]).map(k => k + ': ' + esc(conn.info[k])).join(' · ')}</div>` : ''}
      ${fam ? `<div class="sa-alert ok">🏷️ <b>Família reconhecida:</b> ${esc(fam.familia.nome)} (confiança ${fam.confianca}; ${esc(fam.motivo.join(', '))}).<br>Protocolo: ${esc(fam.familia.protocolo)}.<br>${fam.familia.suporte === 'identificado' ? 'O Rotina <b>ainda não lê dados</b> desse protocolo. ' : ''}${esc(fam.familia.observacao || '')}</div>` : '<div class="sa-alert warn">Família de relógio não reconhecida. Use "Ajude a reconhecer meu relógio" para nos mandar o relatório.</div>'}
      <div class="sa-p"><b>Serviços</b></div>
      <ul class="sa-list" style="font-size:.8rem">${conn.servicos.map(s => `<li>${nomePadrao(s.uuid) ? '✅ <b>' + nomePadrao(s.uuid) + '</b> ' : ''}<code>${esc(s.uuid.length > 8 && s.uuid.endsWith('-0000-1000-8000-00805f9b34fb') ? '0x' + s.uuid.slice(4, 8) : s.uuid)}</code> (${s.carac.length} características)</li>`).join('') || '<li>nenhum serviço listado</li>'}</ul>
      <div id="ble-rsc" class="sa-small" style="margin:.4rem 0"></div>
      ${AVISO_UMA_CONEXAO}
      ${tem(SP.fc.uuid) ? '<button class="sa-btn green" id="bd-fc">❤️ Usar para batimento ao vivo</button>' : ''}
      ${tem(SP.rsc.uuid) ? '<button class="sa-btn sec" id="bd-rsc">🏃 Ver velocidade e cadência</button>' : ''}
      <button class="sa-btn sec" id="bd-diag">🩺 Ajude a reconhecer meu relógio</button>
      <button class="sa-btn red" id="bd-off">Desconectar</button>`);
    if ($('bd-fc')) $('bd-fc').onclick = async () => { try { await ligarFC(); fechar(); } catch (e) { $('ble-rsc').textContent = 'Erro: ' + (e.message || e); } };
    if ($('bd-rsc')) $('bd-rsc').onclick = async () => { try { await notificar(SP.rsc.uuid, SP.rsc.medicao, b => { const r = parseRSC(b); if (r && $('ble-rsc')) $('ble-rsc').innerHTML = `🏃 ${r.velocidade.toFixed(1)} km/h · cadência ${r.cadencia} ${r.correndo ? 'passos/min' : '/min'}${r.passada ? ' · passada ' + r.passada.toFixed(2) + ' m' : ''}${r.distancia != null ? ' · ' + (r.distancia / 1000).toFixed(2) + ' km' : ''} <i>(do aparelho)</i>`; }); $('ble-rsc').textContent = 'Aguardando leitura…'; } catch (e) { $('ble-rsc').textContent = 'Erro: ' + (e.message || e); } };
    $('bd-diag').onclick = diagnostico;
    $('bd-off').onclick = async () => { await desconectarFC(); fechar(); };
  }

  // ════════════════════════════════════════════════════════════
  //  Modo diagnóstico: "Ajude a reconhecer meu relógio"
  //  O relatório NÃO leva: endereço do aparelho (MAC), número de série, nem VALORES de saúde.
  // ════════════════════════════════════════════════════════════
  const PADRAO_SIGILOSO = [SP.fc.medicao, SP.rsc.medicao, SP.bateria.nivel, '00002a25-0000-1000-8000-00805f9b34fb'];
  async function diagnostico() {
    janela(`<div class="sa-h">🩺 Ajude a reconhecer meu relógio</div>
      <p class="sa-p">Vou observar o relógio por uns <b>10 segundos</b> e montar um relatório para você compartilhar. Ele ajuda a incluir a sua marca na lista.</p>
      <div class="sa-alert ok"><b>O que vai no relatório:</b> nome anunciado (opcional), UUIDs dos serviços e características, quais delas notificam, e só a <b>forma</b> das notificações (quantas, tamanhos, 2 primeiros bytes e quais posições mudam).<br><b>Não vai:</b> endereço do aparelho, número de série, batimentos, passos, sono ou qualquer valor de saúde.</div>
      <label class="sa-row"><input type="checkbox" id="dg-nome" checked> <span>Incluir o nome anunciado do relógio (desmarque se ele tiver o seu nome)</span></label>
      <button class="sa-btn" id="dg-go">Gerar relatório</button><div id="dg-st" class="sa-small"></div><textarea id="dg-txt" class="sa-in" rows="10" style="display:none;font:12px monospace" readonly></textarea>
      <div id="dg-bt" style="display:none"><button class="sa-btn green" id="dg-copy">📋 Copiar</button><button class="sa-btn sec" id="dg-share">📤 Compartilhar</button></div>
      <button class="sa-btn sec" id="dg-x">Voltar</button>`);
    $('dg-x').onclick = detalhes;
    $('dg-go').onclick = async () => {
      $('dg-go').disabled = true; $('dg-st').textContent = 'Observando o relógio… (10 s)';
      const amostras = new Map();
      for (const s of conn.servicos) for (const c of s.carac) if (c.props.some(p => p === 'notify' || p === 'indicate')) amostras.set(s.uuid + '|' + c.uuid, { service: s.uuid, char: c.uuid, qtd: 0, tam: new Set(), cab: [], bytes: [], erro: null, omitido: PADRAO_SIGILOSO.some(x => eq(x, c.uuid)) });
      const paradas = [];
      for (const a of amostras.values()) {
        if (a.omitido) continue;
        try { paradas.push(await notificar(a.service, a.char, b => { a.qtd++; a.tam.add(b.length); if (a.cab.length < 5) a.cab.push(b.slice(0, 2).map(hex2).join(' ')); if (a.bytes.length < 40) a.bytes.push(b); })); }
        catch (e) { a.erro = String(e.message || e).slice(0, 80); }
      }
      await new Promise(r => setTimeout(r, 10000));
      for (const p of paradas) { try { await p(); } catch (e) { } }
      const variam = a => { const n = Math.max(0, ...a.bytes.map(b => b.length)); const v = []; for (let i = 2; i < n; i++) { const set = new Set(a.bytes.map(b => b[i])); if (set.size > 1) v.push(i); } return v; };
      const rel = {
        relatorio: 'Rotina — reconhecimento de relógio', versao: 1, data: new Date().toISOString().slice(0, 10),
        aparelho: { nomeAnunciado: $('dg-nome').checked ? (conn.nome || conn.local || '') : '(omitido)', uuidsAnunciados: conn.anunciados, idsDeEmpresa: conn.empresas },
        deviceInformation: { fabricante: conn.info.fabricante || null, modelo: conn.info.modelo || null, firmware: conn.info.firmware || null, hardware: conn.info.hardware || null },
        familiaReconhecida: conn.familia ? { id: conn.familia.familia.id, confianca: conn.familia.confianca, motivo: conn.familia.motivo } : null,
        servicos: conn.servicos.map(s => ({ uuid: s.uuid, caracteristicas: s.carac.map(c => ({ uuid: c.uuid, propriedades: c.props })) })),
        notificacoes: [...amostras.values()].map(a => a.omitido ? { servico: a.service, caracteristica: a.char, valores: 'omitidos (dado de saúde)' } : { servico: a.service, caracteristica: a.char, quantidade: a.qtd, tamanhos: [...a.tam], doisPrimeirosBytes: a.cab, posicoesQueMudam: variam(a), erro: a.erro })
      };
      const txt = JSON.stringify(rel, null, 2);
      $('dg-txt').value = txt; $('dg-txt').style.display = 'block'; $('dg-bt').style.display = 'block'; $('dg-st').textContent = 'Relatório pronto. Confira o texto antes de compartilhar.'; $('dg-go').style.display = 'none';
      $('dg-copy').onclick = async () => { try { await navigator.clipboard.writeText(txt); $('dg-st').textContent = '✅ Copiado.'; } catch (e) { $('dg-txt').select(); $('dg-st').textContent = 'Selecione o texto e copie manualmente.'; } };
      if (navigator.share) $('dg-share').onclick = () => navigator.share({ title: 'Relatório do relógio (Rotina)', text: txt }).catch(() => { }); else $('dg-share').style.display = 'none';
    };
  }

  // ════════════════════════════════════════════════════════════
  //  Ganchos no app: substitui o Web Bluetooth (que não existe no WebView)
  // ════════════════════════════════════════════════════════════
  const _render = window.renderHR;
  window.connectHR = function () { seletor('fc'); };
  window.disconnectHR = desconectarFC;
  window.renderHR = function () {
    _render();
    const tb = $('t-hr-box'), sb = $('saude-hr-box');
    if (tb && !HR.connected) tb.innerHTML = '<button class="btn btn-secondary btn-sm" style="width:100%" onclick="connectHR()">⌚ Conectar relógio ou cinta (BPM ao vivo)</button>';
    if (sb) {
      sb.innerHTML = HR.connected
        ? `<div class="tiny muted" style="text-align:center;margin-bottom:.4rem">${esc(HR.name)}${conn.bateria != null ? ' · 🔋 ' + conn.bateria + '%' : ''} · Bluetooth ao vivo</div>${hrLiveHTML()}
           <button class="btn btn-secondary btn-sm" style="width:100%;margin-top:.8rem" onclick="disconnectHR()">Desconectar</button>`
        : `<div class="small muted" style="line-height:1.6;margin-bottom:.7rem">Mostra o BPM em tempo real no timer e avisa se passar do limite. Quando conectado, o batimento do Bluetooth vale mais que o do Health Connect.</div>
           ${HR.status ? `<div class="small" style="color:var(--orange);margin-bottom:.6rem">${esc(HR.status)}</div>` : ''}
           <button class="btn btn-primary" onclick="connectHR()">⌚ Conectar relógio ou cinta</button>
           <button class="btn btn-secondary btn-sm" style="width:100%;margin-top:.5rem" id="ble-scanner">📡 Aparelhos Bluetooth próximos (scanner)</button>
           ${COMO_LIGAR(false)}
           <div class="tiny muted" style="line-height:1.6">Conectado ao Rotina, o relógio pode parar de sincronizar com o app oficial dele (uma conexão por vez).</div>`;
      const sc = $('ble-scanner'); if (sc) sc.onclick = () => seletor('scanner');
    }
    if (typeof updateHRLive === 'function') updateHRLive();
  };
  window.hrRetry = function () { };
  window.BLE = { seletor, conn, _parseFC: parseFC, _parseRSC: parseRSC, _diag: diagnostico };
  window.addEventListener('load', () => setTimeout(() => { try { window.renderHR(); } catch (e) { } }, 800));
})();
