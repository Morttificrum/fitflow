// Prepara os sons de fundo do relaxamento guiado (SÓ CC0 / domínio público do Wikimedia Commons).
// Baixa os originais, escolhe o trecho mais estável, faz um loop sem emenda, converte para MP3 mono e
// escreve audio/sons/*.mp3 + CREDITOS.md (autor, link e licença lidos da própria API do Commons).
// Uso:  node tools/sons.mjs   (precisa de: npm i puppeteer-core lamejs; Chrome instalado)
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const LAME = fs.readFileSync(require.resolve('lamejs/lame.all.js'), 'utf8');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const SAIDA = path.resolve(import.meta.dirname, '..', 'audio', 'sons');
const CACHE = path.resolve(process.env.CACHE_SONS || path.join(import.meta.dirname, '..', '.cache-sons'));
fs.mkdirSync(SAIDA, { recursive: true }); fs.mkdirSync(CACHE, { recursive: true });
const UA = 'FitFlow-Rotina/1.0 (morttificarum@gmail.com)';

// id do som no app -> arquivo do Commons, taxa, duração do loop (s), ganho alvo (RMS)
const FONTES = [
  { id: 'agua', arquivo: '433589 jackthemurray stream-river-water-up-close.wav', hz: 22050, seg: 28, rms: 0.07 },
  { id: 'riacho', arquivo: '363120 fractalstudios water-trickle.wav', hz: 22050, seg: 60, rms: 0.06 },
  { id: 'passaros', arquivo: 'Réveil des oiseaux.ogg', hz: 22050, seg: 75, rms: 0.05 },
  { id: 'floresta', arquivo: '20090610 0 ambience.ogg', hz: 22050, seg: 60, rms: 0.05 },
  { id: 'chuva', arquivo: 'Light Rain Distant Thunder July 5th 2016.wav', hz: 22050, seg: 75, rms: 0.06 },
  { id: 'ondas', arquivo: 'Ocean Waves on a Tropical Beach.ogg', hz: 22050, seg: 75, rms: 0.07 },
  { id: 'vento', arquivo: 'Howling wind.ogg', hz: 22050, seg: 60, rms: 0.05 },
  { id: 'musica1', arquivo: 'John Bartmann - back-to-bali-master.ogg', hz: 32000, seg: 100, rms: 0.06, musica: true },
  { id: 'musica2', arquivo: 'John Bartmann - cold-morning-master.ogg', hz: 32000, seg: 100, desde: 16, rms: 0.06, musica: true }
];

async function infoCommons(arquivo) {
  const u = new URL('https://commons.wikimedia.org/w/api.php');
  Object.entries({ action: 'query', titles: 'File:' + arquivo, prop: 'imageinfo', iiprop: 'url|extmetadata|size', format: 'json' }).forEach(([k, v]) => u.searchParams.set(k, v));
  const r = await fetch(u, { headers: { 'User-Agent': UA } }); const j = await r.json();
  const p = Object.values(j.query.pages)[0]; const i = (p.imageinfo || [])[0]; if (!i) throw new Error('não achei no Commons: ' + arquivo);
  const m = i.extmetadata || {}; const t = k => ((m[k] || {}).value || '').replace(/<[^>]+>/g, '').trim();
  return { url: i.url, pagina: i.descriptionurl, licenca: t('LicenseShortName'), autor: t('Artist') || t('Credit'), tamanho: i.size };
}
async function baixar(url, destino) {
  if (fs.existsSync(destino) && fs.statSync(destino).size > 1000) return;
  for (let t = 1; t <= 3; t++) {
    const r = await fetch(url, { headers: { 'User-Agent': UA } });
    if (r.ok) { fs.writeFileSync(destino, Buffer.from(await r.arrayBuffer())); return; }
    await new Promise(s => setTimeout(s, 4000 * t));
  }
  throw new Error('download falhou: ' + url);
}

const br = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--allow-file-access-from-files'] });
const pg = await br.newPage(); await pg.goto('about:blank'); await pg.addScriptTag({ content: LAME });
const creditos = [];
for (const f of FONTES) {
  const info = await infoCommons(f.arquivo);
  if (!/CC0|Public domain|CC Zero/i.test(info.licenca)) throw new Error(`${f.arquivo}: licença não é CC0/domínio público (${info.licenca}). Abortei.`);
  const orig = path.join(CACHE, f.id + path.extname(f.arquivo)); await baixar(info.url, orig);
  const b64 = fs.readFileSync(orig).toString('base64');
  const res = await pg.evaluate(async (b64, hz, seg, alvo, desde) => {
    const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer;
    const ac = new AudioContext(); const buf = await ac.decodeAudioData(bin);
    // mono na taxa de saída
    const off = new OfflineAudioContext(1, Math.ceil(buf.duration * hz), hz); const s = off.createBufferSource(); s.buffer = buf; s.connect(off.destination); s.start(); const mono = (await off.startRendering()).getChannelData(0);
    const n = Math.min(Math.floor(seg * hz), mono.length - 1), passo = Math.floor(hz * 2), jan = Math.floor(hz * 0.5);
    // procura o trecho mais estável: menor variação do RMS por meio segundo e sem picos fortes
    const rmsJ = []; for (let i = 0; i + jan <= mono.length; i += jan) { let a = 0; for (let k = i; k < i + jan; k++) a += mono[k] * mono[k]; rmsJ.push(Math.sqrt(a / jan)); }
    let melhor = 0, melhorNota = Infinity; const nj = Math.floor(n / jan);
    for (let i = Math.floor((desde || 0) * hz); i + n <= mono.length; i += passo) {
      const j0 = Math.floor(i / jan), fatia = rmsJ.slice(j0, j0 + nj); if (fatia.length < nj) break;
      const m = fatia.reduce((x, y) => x + y, 0) / fatia.length, sd = Math.sqrt(fatia.reduce((x, y) => x + (y - m) * (y - m), 0) / fatia.length), pico = Math.max(...fatia);
      const nota = sd / (m + 1e-6) + Math.max(0, pico / (m + 1e-6) - 2.2) * 2 + (m < 0.003 ? 5 : 0);
      if (nota < melhorNota) { melhorNota = nota; melhor = i; }
    }
    let ex = Float32Array.from(mono.subarray(melhor, melhor + Math.min(n, mono.length - melhor)));
    // nivelamento suave (controle automático de ganho, janela de ~4 s) + limitador: sem sobressaltos para quem está relaxando ou dormindo
    { const N = ex.length, P = new Float64Array(N + 1); for (let i = 0; i < N; i++) P[i + 1] = P[i] + ex[i] * ex[i];
      const g = new Float32Array(N); for (let i = 0; i < N; i++) { const lo = Math.max(0, i - 2 * hz), hi = Math.min(N, i + 2 * hz), env = Math.sqrt((P[hi] - P[lo]) / (hi - lo)) + 1e-6; g[i] = Math.min(3, Math.max(0.25, alvo / env)); }
      const gs = new Float32Array(N), w = hz; let acc = 0; for (let i = 0; i < N; i++) { acc += g[i]; if (i >= w) acc -= g[i - w]; gs[i] = acc / Math.min(i + 1, w); }
      for (let i = 0; i < N; i++) ex[i] = Math.tanh(ex[i] * gs[i] * 2.2) / 2.2; }
    // loop sem emenda: o final se funde com o começo (fusão de 3 s com potência constante)
    const cf = Math.min(Math.floor(hz * 3), Math.floor(ex.length / 3)), L = ex.length - cf, loop = new Float32Array(L);
    for (let i = 0; i < L; i++) loop[i] = ex[i];
    for (let i = 0; i < cf; i++) { const t = i / cf, a = Math.cos(t * Math.PI / 2), b = Math.sin(t * Math.PI / 2); loop[i] = ex[i] * b + ex[L + i] * a; }
    // tira DC e normaliza pelo RMS alvo (sem estourar)
    let med = 0; for (const v of loop) med += v; med /= loop.length; let ac2 = 0; for (let i = 0; i < loop.length; i++) { loop[i] -= med; ac2 += loop[i] * loop[i]; }
    const rms = Math.sqrt(ac2 / loop.length) + 1e-9; let g = alvo / rms; let pk = 0; for (const v of loop) pk = Math.max(pk, Math.abs(v * g)); if (pk > 0.95) g *= 0.95 / pk;
    const pcm = new Int16Array(loop.length); for (let i = 0; i < loop.length; i++) pcm[i] = Math.max(-32768, Math.min(32767, Math.round(loop[i] * g * 32767)));
    const enc = new lamejs.Mp3Encoder(1, hz, 56); const partes = []; for (let i = 0; i < pcm.length; i += 1152) { const x = enc.encodeBuffer(pcm.subarray(i, i + 1152)); if (x.length) partes.push(x); } const fim = enc.flush(); if (fim.length) partes.push(fim);
    let tot = 0; partes.forEach(p => tot += p.length); const mp3 = new Uint8Array(tot); let o = 0; partes.forEach(p => { mp3.set(p, o); o += p.length; });
    let bin2 = ''; for (let i = 0; i < mp3.length; i += 8192) bin2 += String.fromCharCode.apply(null, mp3.subarray(i, i + 8192));
    return { mp3: btoa(bin2), seg: loop.length / hz, inicio: melhor / hz, nota: melhorNota, origSeg: mono.length / hz };
  }, b64, f.hz, f.seg, f.rms, f.desde || 0);
  fs.writeFileSync(path.join(SAIDA, f.id + '.mp3'), Buffer.from(res.mp3, 'base64'));
  console.log(`${f.id}: trecho a partir de ${res.inicio.toFixed(0)}s de ${res.origSeg.toFixed(0)}s, loop de ${res.seg.toFixed(0)}s, ${(Buffer.from(res.mp3, 'base64').length / 1024).toFixed(0)} KB, estabilidade ${res.nota == null ? "(trecho único)" : res.nota.toFixed(2)} (${info.licenca})`);
  creditos.push({ ...f, ...info });
}
await br.close();
const md = `# Créditos dos sons de fundo

Todos os sons deste app são **CC0 (domínio público)** ou **domínio público**, obtidos no Wikimedia Commons.
Cada um foi cortado em um trecho, convertido para MP3 mono e preparado como loop sem emenda
(arquivo gerado por \`tools/sons.mjs\`, que **aborta se a licença não for CC0 ou domínio público**).
Não há exigência legal de atribuição nessas licenças; registramos a origem por transparência.

| Som no app | Arquivo original | Autor / fonte | Licença | Página |
|---|---|---|---|---|
${creditos.map(c => `| ${c.id}${c.musica ? ' (música)' : ''} | ${c.arquivo} | ${c.autor.replace(/\|/g, '/').slice(0, 80)} | ${c.licenca} | ${c.pagina} |`).join('\n')}

Narração: gerada com o app Narrador (voz sintética), sem material de terceiros.
`;
fs.writeFileSync(path.resolve(import.meta.dirname, '..', 'audio', 'CREDITOS.md'), md);
console.log('CREDITOS.md escrito.');
