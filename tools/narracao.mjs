// Gera a narração do relaxamento guiado usando o app NARRADOR (C:\projetos\Narrador).
//
// Como usar:
//   1) Em C:\projetos\Narrador:  npm run dev   (a API sobe na porta 3000)
//   2) A chave da Gemini pode estar no .env.local do Narrador (GEMINI_API_KEY) ou num arquivo SEU, fora do repositório:
//        node tools/narracao.mjs --chave-arquivo "C:\Users\voce\gemini.txt"      (o arquivo só tem a chave; a chave NUNCA é impressa)
//   3) node tools/narracao.mjs            (gera só o que falta)   |   --refazer  (gera tudo de novo)
// Saída: audio/narracao/<id>.mp3 + audio/narracao/manifest.json. O app usa esses arquivos; sem eles, lê o texto com a voz do aparelho.
// Variáveis: NARRADOR_URL (padrão http://localhost:3000), NARRADOR_VOZ (padrão Achernar), NARRADOR_TOM (padrão Calmo), SAIDA_NARRACAO.
import fs from 'node:fs'; import path from 'node:path'; import vm from 'node:vm'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core'); const LAME = fs.readFileSync(require.resolve('lamejs/lame.all.js'), 'utf8');
const RAIZ = path.resolve(import.meta.dirname, '..');
const SAIDA = path.resolve(process.env.SAIDA_NARRACAO || path.join(RAIZ, 'audio', 'narracao'));
const URL_N = (process.env.NARRADOR_URL || 'http://localhost:3000').replace(/\/$/, '');
const VOZ = process.env.NARRADOR_VOZ || 'Achernar', TOM = process.env.NARRADOR_TOM || 'Calmo';
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const args = process.argv.slice(2), refazer = args.includes('--refazer');
const ia = args.indexOf('--chave-arquivo'); let chave = process.env.GEMINI_API_KEY || '';
if (ia >= 0) chave = fs.readFileSync(args[ia + 1], 'utf8').trim();

// lê os roteiros (o mesmo arquivo que o app usa)
const sandbox = { window: {} }; vm.runInNewContext(fs.readFileSync(path.join(RAIZ, 'relax-dados.js'), 'utf8'), sandbox);
const trechos = sandbox.window.RELAX_DADOS.todosTrechos();
fs.mkdirSync(SAIDA, { recursive: true });
const manPath = path.join(SAIDA, 'manifest.json');
const man = fs.existsSync(manPath) ? JSON.parse(fs.readFileSync(manPath, 'utf8')) : { clips: {} };
man.clips = man.clips || {};

const br = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
const pg = await br.newPage(); await pg.goto('about:blank'); await pg.addScriptTag({ content: LAME });

// converte a resposta do Narrador (PCM cru L16, WAV, etc.) em MP3 mono 24 kHz, sem silêncio nas pontas, volume uniforme
async function paraMp3(buf, mime) {
  const m = /rate=(\d+)/.exec(mime || ''); const bruto = /L16|pcm/i.test(mime || '') && !/wav/i.test(mime || '');
  return pg.evaluate(async (b64, bruto, taxa) => {
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0)); let mono, hz = 24000;
    if (bruto) { const dv = new DataView(bytes.buffer); mono = new Float32Array(Math.floor(bytes.length / 2)); for (let i = 0; i < mono.length; i++) mono[i] = dv.getInt16(i * 2, true) / 32768; hz = taxa || 24000; }
    else { const ac = new AudioContext(); const ab = await ac.decodeAudioData(bytes.buffer); const off = new OfflineAudioContext(1, Math.ceil(ab.duration * 24000), 24000); const s = off.createBufferSource(); s.buffer = ab; s.connect(off.destination); s.start(); mono = (await off.startRendering()).getChannelData(0); }
    let a = 0, z = mono.length - 1; const lim = 0.006; while (a < z && Math.abs(mono[a]) < lim) a++; while (z > a && Math.abs(mono[z]) < lim) z--;
    const x = Float32Array.from(mono.subarray(Math.max(0, a - Math.floor(hz * 0.15)), Math.min(mono.length, z + Math.floor(hz * 0.35))));
    let e = 0; for (const v of x) e += v * v; const rms = Math.sqrt(e / x.length) + 1e-9; let g = 0.09 / rms; let pk = 0; for (const v of x) pk = Math.max(pk, Math.abs(v * g)); if (pk > 0.92) g *= 0.92 / pk;
    const n = Math.floor(hz * 0.04); for (let i = 0; i < n && i < x.length; i++) { x[i] *= i / n; x[x.length - 1 - i] *= i / n; }
    const pcm = new Int16Array(x.length); for (let i = 0; i < x.length; i++) pcm[i] = Math.max(-32768, Math.min(32767, Math.round(x[i] * g * 32767)));
    const enc = new lamejs.Mp3Encoder(1, hz, 48), partes = []; for (let i = 0; i < pcm.length; i += 1152) { const c = enc.encodeBuffer(pcm.subarray(i, i + 1152)); if (c.length) partes.push(c); } const f = enc.flush(); if (f.length) partes.push(f);
    let tot = 0; partes.forEach(p => tot += p.length); const mp3 = new Uint8Array(tot); let o = 0; partes.forEach(p => { mp3.set(p, o); o += p.length; });
    let s2 = ''; for (let i = 0; i < mp3.length; i += 8192) s2 += String.fromCharCode.apply(null, mp3.subarray(i, i + 8192));
    return { mp3: btoa(s2), dur: x.length / hz };
  }, buf.toString('base64'), bruto, m ? +m[1] : 24000);
}

async function gerar(t) {
  const u = `${URL_N}/api/tts?voice=${encodeURIComponent(VOZ)}&emotion=${encodeURIComponent(TOM)}&text=${encodeURIComponent(t.texto)}`;
  for (let tent = 1; tent <= 3; tent++) {
    const r = await fetch(u, { headers: chave ? { 'X-Gemini-Key': chave } : {} });
    const mime = r.headers.get('content-type') || '';
    if (!r.ok) { if (tent === 3) throw new Error(`Narrador respondeu ${r.status}: ${(await r.text()).slice(0, 200)}`); await new Promise(s => setTimeout(s, 3000 * tent)); continue; }
    if (/mpeg|mp3/i.test(mime)) throw new Error('O Narrador usou a voz reserva (Google Translate) em vez da Gemini. Confira a chave da Gemini e tente de novo; não uso essa voz no app.');
    return paraMp3(Buffer.from(await r.arrayBuffer()), mime);
  }
}

let feitos = 0, pulados = 0;
for (const t of trechos) {
  const arq = t.id + '.mp3';
  if (!refazer && man.clips[t.id] && fs.existsSync(path.join(SAIDA, arq))) { pulados++; continue; }
  const r = await gerar(t);
  fs.writeFileSync(path.join(SAIDA, arq), Buffer.from(r.mp3, 'base64'));
  man.clips[t.id] = { arquivo: arq, dur: Math.round(r.dur * 10) / 10, voz: VOZ, tom: TOM };
  fs.writeFileSync(manPath, JSON.stringify(Object.assign(man, { voz: VOZ, geradoEm: new Date().toISOString().slice(0, 10), fonte: 'Narrador' }), null, 1));
  feitos++; console.log(`✓ ${t.id} (${r.dur.toFixed(1)} s)`);
}
await br.close();
console.log(`Pronto: ${feitos} gerados, ${pulados} já existiam, ${trechos.length} no total. Manifesto: ${manPath}`);
