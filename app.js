// VActor — Fase 1 «La Cabina» + Fase 2 «Palestra di dizione»
import { BREATH, DRILLS, TWISTERS, READINGS, DIZ_WORDS, DIZ_NOT, DIZ_DOUBLE, DIZ_RULES } from './content.js';
const $ = (s) => document.querySelector(s);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const fmt = (ms) => { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ls = {
  get(k, d) { try { const v = localStorage.getItem('va.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('va.' + k, JSON.stringify(v)); } catch {} },
};

const TYPES = {
  copione: { ico: '🎬', label: 'Copione' },
  audiolibro: { ico: '📚', label: 'Audiolibro' },
  articolo: { ico: '📰', label: 'Articolo' },
  poesia: { ico: '🪶', label: 'Poesia' },
  dizione: { ico: '👅', label: 'Dizione' },
  altro: { ico: '✳️', label: 'Altro' },
};

/* ---------- database ---------- */
const db = await new Promise((res, rej) => {
  const r = indexedDB.open('vactor', 1);
  r.onupgradeneeded = () => {
    const d = r.result;
    d.createObjectStore('texts', { keyPath: 'id' });
    d.createObjectStore('takes', { keyPath: 'id' }).createIndex('textId', 'textId');
  };
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
});
const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const store = (s, m = 'readonly') => db.transaction(s, m).objectStore(s);
const DB = {
  put: (s, v) => req(store(s, 'readwrite').put(v)),
  get: (s, k) => req(store(s).get(k)),
  all: (s) => req(store(s).getAll()),
  del: (s, k) => req(store(s, 'readwrite').delete(k)),
  takesOf: (id) => req(store('takes').index('textId').getAll(id)),
};
navigator.storage?.persist?.();

/* ---------- testi di partenza ---------- */
const SEEDS = [
  { title: 'Riscaldamento di dizione', type: 'dizione', body:
`Pèsca e pésca: vado a pescare con la canna, poi mangio una pesca matura.
Bótte e bòtte: la botte di vino rotola giù, e prende un sacco di botte.
Accètta e accétta: lui accetta la sfida e afferra l'accetta.

Sopra la panca la capra campa, sotto la panca la capra crepa.
Trentatré trentini entrarono a Trento, tutti e trentatré trotterellando.

Ora rileggi tutto più lentamente, aprendo bene la bocca sulle vocali.` },
  { title: 'Scena: Il faro', type: 'copione', body:
`LUCA: (affannato) Sei salita fin quassù con questa tempesta?
ELENA: Dovevo vederti. Non rispondevi più a nessuno.
LUCA: Il faro non si spegne da solo, Elena. Qualcuno deve restare.
ELENA: (piano) E chi resta per te?
LUCA: (pausa) …Nessuno l'ha mai chiesto.
ELENA: Te lo chiedo io. Adesso. Scendi con me.` },
];

async function ensureSeeds() {
  const all = await DB.all('texts');
  if (all.length) return all;
  for (const [i, s] of SEEDS.entries()) await DB.put('texts', { id: uid(), ...s, createdAt: Date.now() - i, lastUsed: Date.now() - i });
  return DB.all('texts');
}

/* ---------- stato ---------- */
const S = {
  text: null, takes: [], mode: ls.get('mode', 'casa'), speed: ls.get('speed', 40), font: ls.get('font', 30),
  guide: ls.get('guide', 0), mic: ls.get('mic', ''), rec: null, lastTake: null, player: null,
};

/* ---------- leggio ---------- */
function renderText() {
  const t = S.text;
  $('#curTitle').textContent = t ? t.title : 'Nessun testo';
  $('#curType').textContent = t ? `${TYPES[t.type]?.ico || '✳️'} ${TYPES[t.type]?.label || 'Altro'}` : '—';
  let html;
  if (!t || !t.body?.trim()) {
    html = t?.video
      ? '<span class="empty">Solo video, nessun copione.\nPuoi già registrare il doppiaggio: il video parte con il REC.\n\nNella Fase 3 la banda ritmica si creerà da sola ascoltando la voce originale.</span>'
      : '<span class="empty">Tocca «＋ Nuovo» per caricare un testo.</span>';
  } else {
    const b = buildPrompter(t.body); html = b.html; F.words = b.words;
  }
  if (!t?.body?.trim()) F.words = [];
  F.pos = 0; F.shown = -1;
  $('#ptext').innerHTML = html;
  $('#prompter').scrollTop = 0;
  const v = $('#video');
  if (S.videoURL) URL.revokeObjectURL(S.videoURL), (S.videoURL = null);
  document.body.classList.toggle('dub', !!t?.video);
  cancelAnimationFrame(DUB.raf); $('#band').hidden = true; $('#dubTools').hidden = true;
  if (!t?.video && !RT.on) rpanel('');
  if (t?.video) {
    S.videoURL = URL.createObjectURL(t.video);
    v.src = S.videoURL;
    $('#videoWrap').hidden = false;
    $('#guideRow').hidden = false;
    F.words = [];
    renderDub();
  } else {
    v.removeAttribute('src'); v.load();
    $('#videoWrap').hidden = true;
    $('#guideRow').hidden = true;
  }
}
function alignPad() {
  const pr = $('#prompter');
  pr.style.paddingTop = Math.max(16, pr.clientHeight * 0.28 - S.font * 0.9) + 'px';
}
new ResizeObserver(alignPad).observe(document.querySelector('.prompter-wrap'));
function applyPrefs() {
  document.documentElement.style.setProperty('--pfont', S.font + 'px');
  alignPad();
  $('#speedVal').textContent = S.speed;
  const out = S.mode === 'fuori';
  $('#btnMode').textContent = out ? '🌳 Fuori · riduzione rumore' : '🏠 Casa · audio puro';
  $('#btnMode').classList.toggle('out', out);
  $('#guideVol').value = S.guide;
}
async function selectText(id) {
  const t = await DB.get('texts', id);
  if (!t) return;
  t.lastUsed = Date.now();
  await DB.put('texts', t);
  S.text = t;
  ls.set('cur', id);
  $('#takeToast').hidden = true;
  renderText();
  await refreshTakes();
}
async function refreshTakes() {
  S.takes = S.text ? (await DB.takesOf(S.text.id)).sort((a, b) => a.createdAt - b.createdAt) : [];
  S.takes.forEach((k, i) => (k.n = i + 1));
  $('#takeCount').textContent = S.takes.length;
}

$('#fontUp').onclick = () => { S.font = Math.min(64, S.font + 3); ls.set('font', S.font); applyPrefs(); };
$('#fontDown').onclick = () => { S.font = Math.max(16, S.font - 3); ls.set('font', S.font); applyPrefs(); };
$('#speedUp').onclick = () => { S.speed = Math.min(200, S.speed + 5); ls.set('speed', S.speed); applyPrefs(); };
$('#speedDown').onclick = () => { S.speed = Math.max(5, S.speed - 5); ls.set('speed', S.speed); applyPrefs(); };
$('#btnMode').onclick = () => { if (S.rec) return; S.mode = S.mode === 'casa' ? 'fuori' : 'casa'; ls.set('mode', S.mode); applyPrefs(); };
$('#guideVol').oninput = (e) => { S.guide = +e.target.value; ls.set('guide', S.guide); };

/* ---------- gobbo che segue le parole ---------- */
S.follow = ls.get('follow2', 'parole');
const norm = (w) => w.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
const F = {
  words: [], pos: 0, shown: -1, active: false, rec: null,
  el: (i) => document.querySelector(`#ptext .w[data-i="${i}"]`),
};
function dizWord(core) {
  const lc = core.toLowerCase();
  if (/[àèéìòóù]/.test(lc)) return null;
  if (DIZ_DOUBLE[lc]) return { double: DIZ_DOUBLE[lc] };
  let r = DIZ_WORDS[lc];
  if (!r && !DIZ_NOT.has(lc)) for (const [re, ch, off, min] of DIZ_RULES) {
    if (lc.length < min) continue;
    const m = lc.match(re);
    if (m) { r = { i: m.index + off, ch }; break; }
  }
  return r || null;
}
function dizHTML(text) {
  return text.split(/([A-Za-zÀ-ÿ]+)/).map((part, k) => {
    if (k % 2 === 0) return esc(part);
    const r = dizWord(part);
    if (r?.double) return `<span class="dz2" title="${esc(r.double)}">${esc(part)}</span>`;
    let out = '';
    for (let i = 0; i < part.length; i++) {
      const c = part[i];
      if (r && i === r.i) { const a = c === c.toUpperCase() ? r.ch.toUpperCase() : r.ch; out += `<span class="dz ${'èò'.includes(r.ch) ? 'op' : 'cl'}">${a}</span>`; }
      else if (/s/i.test(c) && /[bdglmnrv]/i.test(part[i + 1] || '')) out += `<span class="sz">${c}</span>`;
      else out += esc(c);
    }
    return out;
  }).join('');
}
function buildPrompter(body) {
  const words = []; let html = '';
  const diz = S.diz;
  let inEm = false;
  for (const line of body.split('\n')) {
    let rest = line;
    const m = rest.match(/^\s*[A-ZÀ-ÖØ-Ý][A-ZÀ-ÖØ-Ý0-9 .'’-]{0,24}:/);
    if (m) { html += `<span class="spk">${esc(m[0])}</span>`; rest = rest.slice(m[0].length); }
    for (const part of rest.split(/(\([^)\n]{1,80}\))/)) {
      if (!part) continue;
      if (/^\(.*\)$/.test(part)) { html += `<span class="par">${esc(part)}</span>`; continue; }
      for (const tok of part.split(/(\s+)/)) {
        if (!tok) continue;
        if (/^\s+$/.test(tok)) { html += tok; continue; }
        if (/^\/{1,2}$/.test(tok)) { html += `<span class="pz${tok.length > 1 ? ' l' : ''}" aria-label="pausa">${tok.length > 1 ? '‖' : '|'}</span>`; continue; }
        const startsEm = tok.startsWith('*'), endsEm = tok.length > 1 && /\*[^\w]*$/.test(tok);
        if (startsEm) inEm = true;
        const em = inEm;
        if (endsEm) inEm = false;
        const shown = tok.replace(/\*/g, '');
        const n = norm(shown);
        const inner = diz ? dizHTML(shown) : esc(shown);
        if (!n) { html += inner; continue; }
        html += `<span class="w${em ? ' em' : ''}" data-i="${words.length}">${inner}</span>`; words.push(n);
      }
    }
    html += '\n';
  }
  return { html, words };
}
function lev(a, b) {
  const d = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0]; d[0] = i;
    for (let j = 1; j <= b.length; j++) { const t = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = t; }
  }
  return d[b.length];
}
function similar(a, b) {
  if (a === b) return true;
  const L = Math.max(a.length, b.length), m = Math.min(a.length, b.length);
  if (L < 4) return false;
  if (m >= 4 && (a.startsWith(b) || b.startsWith(a))) return true;
  return lev(a, b) <= (L >= 7 ? 2 : 1);
}
// avanza il segnalibro nel testo in base alle parole sentite
function advance(pos, heard, words = F.words) {
  for (let k = 0; k < heard.length; k++) {
    const w = heard[k];
    const win = w.length <= 2 ? 3 : 8;
    let found = -1;
    for (let j = pos; j < Math.min(words.length, pos + win); j++) if (similar(words[j], w)) { found = j; break; }
    if (found < 0 && k > 0) { // salto di riga: ritrova il punto con due parole di fila
      const p = heard[k - 1];
      for (let j = pos + 1; j < Math.min(words.length, pos + 80); j++) if (similar(words[j], w) && similar(words[j - 1], p)) { found = j; break; }
    }
    if (found >= 0) pos = found + 1;
  }
  return pos;
}
function paintFollow() {
  if (F.pos === F.shown) return;
  const from = Math.max(0, Math.min(F.shown, F.pos)), to = Math.max(F.shown, F.pos);
  for (let i = from; i <= to + 1 && i < F.words.length; i++) {
    const el = F.el(i); if (!el) continue;
    el.classList.toggle('r', i < F.pos); el.classList.toggle('cur', i === F.pos);
  }
  F.shown = F.pos;
}
function clearFollow() {
  document.querySelectorAll('#ptext .w.r, #ptext .w.cur').forEach((e) => e.classList.remove('r', 'cur'));
  F.shown = -1;
}
function firstVisibleWord() {
  const pr = $('#prompter'), line = pr.scrollTop + pr.clientHeight * 0.28 - 30;
  if (pr.scrollTop < 10) return 0;
  for (let i = 0; i < F.words.length; i++) { const el = F.el(i); if (el && el.offsetTop >= line) return i; }
  return 0;
}
function followNote(msg) { const n = $('#followNote'); n.textContent = msg; n.hidden = !msg; }

// Riconoscimento vocale offline (Vosk, modello italiano) che ascolta lo stesso audio della registrazione:
// nessun conflitto con il microfono, funziona anche senza internet.
const MODEL_URL = 'models/vosk-it.tar.gz';
const VOSK = { model: null, loading: null, pct: 0 };
function loadVosk() {
  if (VOSK.model) return Promise.resolve(VOSK.model);
  return (VOSK.loading ||= (async () => {
    if (!window.Vosk) await loadScript('lib/vosk.js');
    let blob = null;
    let cache = null;
    try { cache = await caches.open('vactor-models'); const hit = await cache.match(MODEL_URL); if (hit) blob = await hit.blob(); } catch {}
    if (!blob) {
      const r = await fetch(MODEL_URL);
      if (!r.ok) throw new Error('download ' + r.status);
      const total = +r.headers.get('content-length') || 49664886;
      const reader = r.body.getReader(); const chunks = []; let got = 0;
      for (;;) {
        const { done, value } = await reader.read(); if (done) break;
        chunks.push(value); got += value.length; VOSK.pct = Math.min(99, Math.round((got / total) * 100));
        if (S.follow === 'parole' && !S.rec) followNote(`⬇️ Preparo il riconoscimento vocale (una volta sola) ${VOSK.pct}%`);
      }
      blob = new Blob(chunks, { type: 'application/gzip' });
      try { await cache?.put(MODEL_URL, new Response(blob)); } catch {}
    }
    if (S.follow === 'parole' && !S.rec) followNote('⚙️ Avvio il riconoscimento vocale…');
    const url = URL.createObjectURL(blob);
    VOSK.model = await Vosk.createModel(url, -1);
    URL.revokeObjectURL(url);
    if (!S.rec) followNote('');
    return VOSK.model;
  })().catch((e) => { VOSK.loading = null; throw e; }));
}
function grammarOf(text) {
  const set = new Set();
  for (const tok of text.replace(/^\s*[A-ZÀ-ÖØ-Ý][A-ZÀ-ÖØ-Ý0-9 .'’-]{0,24}:/gm, ' ').replace(/\([^)\n]*\)/g, ' ').toLowerCase().split(/[^a-zà-öø-ÿ0-9'’]+/)) {
    const w = tok.replace(/’/g, "'").replace(/^'+|'+$/g, '');
    if (!w) continue;
    set.add(w);
    if (w.includes("'")) w.split("'").forEach((x, i, a) => x && set.add(i < a.length - 1 ? x + "'" : x).add(x));
  }
  return JSON.stringify([...set, '[unk]']);
}
async function startFollow(R) {
  clearFollow();
  F.pos = firstVisibleWord(); F.committed = F.pos; F.shown = -1; paintFollow();
  F.active = true; F.fatal = false; F.heard = [];
  let model;
  try {
    if (!VOSK.model) followNote(VOSK.pct ? `⬇️ Preparo il riconoscimento ${VOSK.pct}%…` : '⚙️ Preparo il riconoscimento vocale…');
    model = await loadVosk();
  } catch (e) {
    console.error(e);
    if (S.rec !== R) return;
    F.active = false; F.fatal = true;
    followNote('🔊 Riconoscimento non disponibile: scorro con la voce');
    return;
  }
  if (S.rec !== R) return;
  let rec;
  try { rec = new model.KaldiRecognizer(R.ctx.sampleRate, grammarOf(S.text.body)); }
  catch { rec = new model.KaldiRecognizer(R.ctx.sampleRate); }
  const words = (t) => (t || '').split(/\s+/).filter((w) => w && w !== '[unk]');
  const show = (ws) => { if (ws.length) followNote('🎙️ ' + ws.slice(-5).join(' ')); };
  rec.on('partialresult', (m) => {
    if (F.rec !== rec) return;
    const ws = words(m?.result?.partial);
    F.pos = Math.max(F.pos, advance(F.committed, ws.map(norm).filter(Boolean)));
    paintFollow(); show(ws);
  });
  rec.on('result', (m) => {
    if (F.rec !== rec) return;
    const ws = words(m?.result?.text);
    F.committed = advance(F.committed, ws.map(norm).filter(Boolean));
    F.pos = Math.max(F.pos, F.committed); F.committed = F.pos;
    paintFollow(); show(ws);
  });
  const node = R.ctx.createScriptProcessor(4096, 1, 1);
  const mute = R.ctx.createGain(); mute.gain.value = 0;
  node.onaudioprocess = (e) => { try { if (F.rec === rec) rec.acceptWaveform(e.inputBuffer); } catch {} };
  R.src.connect(node); node.connect(mute); mute.connect(R.ctx.destination);
  F.rec = rec; F.node = node;
  followNote('🎯 Ti seguo: inizia a leggere');
}
function stopFollow() {
  const rec = F.rec; F.rec = null; F.active = false;
  try { F.node?.disconnect(); } catch {}
  F.node = null;
  try { rec?.remove(); } catch {}
  followNote('');
}
function applyFollowUI() {
  const w = S.follow === 'parole';
  $('#btnFollow').textContent = w ? '🎯 Parole' : '🔊 Voce';
  $('#btnFollow').classList.toggle('on', w);
  document.querySelectorAll('.speed-ctl').forEach((e) => (e.hidden = w));
}
$('#btnFollow').onclick = () => {
  if (S.rec) return;
  S.follow = S.follow === 'parole' ? 'voce' : 'parole';
  ls.set('follow2', S.follow); applyFollowUI(); clearFollow(); followNote('');
  if (S.follow === 'parole') loadVosk().catch(() => followNote('⚠️ Non riesco a scaricare il riconoscimento: riprova con internet'));
};
applyFollowUI();

/* ---------- registrazione ---------- */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function pickMime() {
  for (const m of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']) if (window.MediaRecorder?.isTypeSupported?.(m)) return m;
  return '';
}
async function openMic() {
  const filt = S.mode === 'fuori';
  const audio = { echoCancellation: filt, noiseSuppression: filt, autoGainControl: filt, channelCount: 1 };
  if (S.mic) audio.deviceId = { exact: S.mic };
  try { return await navigator.mediaDevices.getUserMedia({ audio }); }
  catch (e) {
    if (S.mic) { S.mic = ''; ls.set('mic', ''); delete audio.deviceId; return navigator.mediaDevices.getUserMedia({ audio }); }
    throw e;
  }
}

$('#btnRec').onclick = () => (S.rec ? (S.rec.counting ? cancelRec() : stopRec()) : startRec());

async function startRec() {
  if (!S.text) return openNew();
  if (S.text.video && S.text.sync?.anelli?.length) return dubRec();
  stopPlayer();
  let stream;
  try { stream = await openMic(); }
  catch { alert('Non riesco ad accedere al microfono. Controlla i permessi del browser.'); return; }
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  ctx.resume?.().catch(() => {});
  const src = ctx.createMediaStreamSource(stream);
  const an = ctx.createAnalyser(); an.fftSize = 1024; src.connect(an);
  const buf = new Float32Array(an.fftSize);
  const rms = () => { an.getFloatTimeDomainData(buf); let s = 0; for (const x of buf) s += x * x; return Math.sqrt(s / buf.length); };
  const R = (S.rec = { stream, ctx, src, rms, counting: true, floor: 0, samples: [] });
  document.body.classList.add('recording');

  // conto alla rovescia 3-2-1, intanto misura il rumore di fondo
  const cd = $('#countdown'); cd.hidden = false;
  const calib = setInterval(() => R.samples.push(rms()), 50);
  for (const n of [3, 2, 1]) { cd.textContent = n; $('#recTime').textContent = 'pronti…'; await sleep(800); if (S.rec !== R) { clearInterval(calib); return; } }
  clearInterval(calib);
  cd.hidden = true;
  const sorted = R.samples.sort((a, b) => a - b);
  R.floor = sorted[Math.floor(sorted.length / 2)] || 0.005;
  R.thr = Math.max(0.012, R.floor * 3);
  R.counting = false;

  const mimeType = pickMime();
  const mr = new MediaRecorder(stream, { ...(mimeType && { mimeType }), audioBitsPerSecond: S.mode === 'casa' ? 256000 : 128000 });
  R.chunks = []; R.mr = mr; R.mime = mr.mimeType || mimeType || 'audio/webm';
  mr.ondataavailable = (e) => e.data.size && R.chunks.push(e.data);
  mr.start(250);
  R.t0 = performance.now();
  try { R.lock = await navigator.wakeLock?.request('screen'); } catch {}
  const v = $('#video');
  if (S.text.video) { v.currentTime = 0; v.volume = S.guide; v.muted = S.guide === 0; v.play().catch(() => {}); }

  let last = performance.now(), quiet = 0;
  const loop = (now) => {
    if (S.rec !== R) return;
    const dt = (now - last) / 1000; last = now;
    const lv = rms();
    $('#level').style.transform = `translate(-50%,-50%) scale(${1 + Math.min(0.6, lv * 6)})`;
    quiet = lv > R.thr ? 0 : quiet + dt;
    const pr = $('#prompter');
    if (S.follow === 'parole' && F.words.length && !F.fatal) {
      // segue le parole riconosciute: porta la parola corrente sulla linea verde
      const el = F.el(Math.min(F.pos, F.words.length - 1));
      if (el) { const target = el.offsetTop - pr.clientHeight * 0.28 + el.offsetHeight * 0.2; pr.scrollTop += (target - pr.scrollTop) * Math.min(1, dt * 5); }
    } else if (quiet < 0.35) pr.scrollTop += S.speed * dt; // modalità voce: scorre solo mentre parli
    $('#recTime').textContent = '● ' + fmt(now - R.t0);
    R.raf = requestAnimationFrame(loop);
  };
  R.raf = requestAnimationFrame(loop);
  if (S.follow === 'parole' && F.words.length) startFollow(R);
}

function teardown(R) {
  stopFollow();
  cancelAnimationFrame(R.raf);
  R.stream.getTracks().forEach((t) => t.stop());
  R.ctx.close().catch(() => {});
  R.lock?.release?.().catch(() => {});
  $('#video').pause();
  $('#countdown').hidden = true;
  document.body.classList.remove('recording');
  $('#recTime').textContent = 'tocca per registrare';
  S.rec = null;
}
function cancelRec() { teardown(S.rec); recStopped(null); }
let recStopHooks = [];
const recStopped = (take) => { const h = recStopHooks; recStopHooks = []; h.forEach((f) => f(take)); };
const waitRecStop = () => new Promise((r) => recStopHooks.push(r));

async function stopRec() {
  const R = S.rec;
  if (!R || R.stopping) return;
  if (R.counting) return cancelRec();
  R.stopping = true;
  const stopped = new Promise((r) => (R.mr.onstop = r));
  R.mr.stop();
  const duration = performance.now() - R.t0;
  await stopped;
  teardown(R);
  if (duration < 700) return recStopped(null);
  const take = { id: uid(), textId: S.text.id, blob: new Blob(R.chunks, { type: R.mime }), mime: R.mime, duration, createdAt: Date.now(), mode: S.mode, starred: false };
  if (R.dub) { take.anello = R.dub.an; take.vs = R.dub.vs; }
  await DB.put('takes', take);
  await refreshTakes();
  showToast(S.takes.at(-1));
  recStopped(S.takes.at(-1));
  if (COACH.auto) coachQueue(take.id);
  paintCoachBtn();
  if (R.dub) { $('#ttName').textContent = `Anello ${R.dub.an + 1} · take ${S.takes.filter((k) => k.anello === R.dub.an).length}`; $('#ttMeta').textContent = 'misuro il sync…'; afterDubTake(S.takes.at(-1)); renderAnelli(); }
}

/* ---------- riascolto ---------- */
function showToast(take) {
  S.lastTake = take;
  $('#ttName').textContent = `Take ${take.n}`;
  $('#ttMeta').textContent = `${fmt(take.duration)} · ${take.mode === 'fuori' ? '🌳' : '🏠'} · appena registrata`;
  $('#ttStar').textContent = take.starred ? '★' : '☆';
  $('#ttPlay').textContent = '▶';
  $('#takeToast').hidden = false;
  paintCoachBtn();
}
function stopPlayer() {
  if (!S.player) return;
  S.player.audio.pause();
  URL.revokeObjectURL(S.player.url);
  if (S.text?.video) $('#video').pause();
  S.player.onEnd?.();
  S.player = null;
}
function playTake(take, onEnd) {
  const same = S.player?.id === take.id;
  stopPlayer();
  if (same) return false;
  const url = URL.createObjectURL(take.blob);
  const audio = new Audio(url);
  S.player = { id: take.id, audio, url, onEnd };
  audio.onended = () => { if (S.player?.audio === audio) stopPlayer(); };
  if (S.text?.video && take.textId === S.text.id) {
    const v = $('#video'); v.muted = true; v.currentTime = take.vs || 0; v.play().catch(() => {});
  }
  audio.play();
  return true;
}
$('#ttPlay').onclick = () => {
  if (!S.lastTake) return;
  const b = $('#ttPlay');
  b.textContent = playTake(S.lastTake, () => (b.textContent = '▶')) ? '⏸' : '▶';
};
$('#ttStar').onclick = async () => {
  const t = S.lastTake; if (!t) return;
  t.starred = !t.starred; await DB.put('takes', strip(t));
  $('#ttStar').textContent = t.starred ? '★' : '☆';
};
$('#ttAll').onclick = () => openTakes();
const strip = ({ n, ...rest }) => rest;

/* ---------- fogli ---------- */
document.querySelectorAll('dialog').forEach((d) => {
  d.addEventListener('click', (e) => { if (e.target === d || e.target.closest('[data-close]')) d.close(); });
  d.addEventListener('close', () => { stopPlayer(); stopAB(); });
});
const open = (id) => { document.querySelectorAll('dialog[open]').forEach((d) => d.close()); $(id).showModal(); };

/* nuovo testo */
let draft = null;
function typeButtons(sel) {
  $('#newTypes').innerHTML = Object.entries(TYPES).map(([k, v]) => `<button data-t="${k}" class="${k === sel ? 'on' : ''}">${v.ico} ${v.label}</button>`).join('');
}
$('#newTypes').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; draft.type = b.dataset.t; draft.typeTouched = true; typeButtons(draft.type); };
function openNew(edit) {
  draft = edit ? { ...edit, typeTouched: true } : { id: null, type: 'copione', video: null, typeTouched: false };
  $('#newTitle').textContent = edit ? 'Modifica testo' : 'Nuovo testo';
  $('#newName').value = edit?.title || '';
  $('#newBody').value = edit?.body || '';
  $('#newStatus').textContent = '';
  renderAttach(); typeButtons(draft.type);
  open('#sheetNew');
}
function renderAttach() {
  const a = $('#attach');
  if (!draft.video) { a.hidden = true; return; }
  a.hidden = false;
  a.innerHTML = `🎞️ <span>${esc(draft.videoName || 'video')} · ${(draft.video.size / 1048576).toFixed(1)} MB</span><button id="rmVid">✕</button>`;
  $('#rmVid').onclick = () => { draft.video = null; renderAttach(); };
}
function guessType(t) {
  const lines = t.split('\n').map((l) => l.trim()).filter(Boolean);
  const spk = lines.filter((l) => /^[A-ZÀ-ÖØ-Ý][A-ZÀ-ÖØ-Ý .'’-]{1,24}:/.test(l)).length;
  if (spk >= 2) return 'copione';
  if (t.length > 2500) return 'audiolibro';
  if (lines.length >= 4 && lines.every((l) => l.length < 70)) return 'poesia';
  return t.length ? 'articolo' : 'copione';
}
$('#newBody').oninput = () => { if (!draft.typeTouched) { draft.type = guessType($('#newBody').value); typeButtons(draft.type); } };

function loadScript(src) {
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.append(s); });
}
async function pdfToText(file) {
  if (!window.pdfjsLib) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const c = await (await pdf.getPage(i)).getTextContent();
    pages.push(c.items.map((it) => it.str + (it.hasEOL ? '\n' : '')).join(''));
  }
  return pages.join('\n\n').replace(/[ \t]+\n/g, '\n').trim();
}
let ocrWorker = null;
async function imageToText(file, status) {
  if (!window.Tesseract) { status('Preparo la lettura delle immagini (solo la prima volta)…'); await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.0/dist/tesseract.min.js'); }
  ocrWorker ||= await Tesseract.createWorker('ita');
  const { data } = await ocrWorker.recognize(file);
  return data.text.trim();
}
function srtToText(s) {
  return s.replace(/\r/g, '').split(/\n\n+/).map((b) => b.split('\n').filter((l) => !/^\d+$/.test(l.trim()) && !/-->/.test(l)).join(' ')).filter(Boolean).join('\n');
}
async function ingest(files) {
  const status = (m) => ($('#newStatus').textContent = m);
  const parts = [];
  const imgs = [...files].filter((f) => f.type.startsWith('image/'));
  let i = 0;
  for (const f of files) {
    try {
      if (f.type.startsWith('video/')) {
        draft.video = f; draft.videoName = f.name;
        if (!$('#newName').value) $('#newName').value = f.name.replace(/\.[^.]+$/, '');
        if (!draft.typeTouched) draft.type = 'copione';
        renderAttach();
      } else if (f.type.startsWith('image/')) {
        status(`Leggo il testo dall'immagine ${++i} di ${imgs.length}…`);
        parts.push(await imageToText(f, status));
      } else if (f.type === 'application/pdf' || /\.pdf$/i.test(f.name)) {
        status('Leggo il PDF…'); parts.push(await pdfToText(f));
        if (!$('#newName').value) $('#newName').value = f.name.replace(/\.[^.]+$/, '');
      } else {
        const t = await f.text(); parts.push(/\.srt$/i.test(f.name) ? srtToText(t) : t);
        if (!$('#newName').value) $('#newName').value = f.name.replace(/\.[^.]+$/, '');
      }
    } catch (e) { console.error(e); status(`Non sono riuscito a leggere «${f.name}» (serve internet la prima volta).`); return; }
  }
  if (parts.length) {
    const cur = $('#newBody').value.trim();
    $('#newBody').value = [cur, ...parts].filter(Boolean).join('\n\n');
    $('#newBody').oninput();
  }
  typeButtons(draft.type);
  status('✓ Pronto. Controlla il testo e premi «Vai al leggio».');
}
$('#fileIn').onchange = async (e) => { await ingest(e.target.files); e.target.value = ''; };
$('#btnPaste').onclick = async () => {
  try { const t = await navigator.clipboard.readText(); if (t) { $('#newBody').value += ($('#newBody').value ? '\n\n' : '') + t; $('#newBody').oninput(); } }
  catch { $('#newBody').focus(); $('#newStatus').textContent = 'Tieni premuto nel riquadro e scegli «Incolla».'; }
};
$('#btnSaveNew').onclick = async () => {
  const body = $('#newBody').value.trim();
  if (!body && !draft.video) { $('#newStatus').textContent = 'Aggiungi un testo o un video.'; return; }
  const title = $('#newName').value.trim() || body.split('\n')[0].replace(/^[A-ZÀ-Ý .'’-]{1,24}:\s*/, '').slice(0, 48) || 'Senza titolo';
  const old = draft.id ? await DB.get('texts', draft.id) : null;
  const t = { id: draft.id || uid(), title, type: draft.type, body, video: draft.video || null, videoName: draft.videoName || null,
    createdAt: draft.createdAt || Date.now(), lastUsed: Date.now() };
  const sameVideo = old?.video && t.video === old.video;
  if (old?.sync && sameVideo) t.sync = old.sync;
  await DB.put('texts', t);
  $('#sheetNew').close();
  await selectText(t.id);
  if (t.video && (!t.sync || old?.body !== body || !sameVideo)) analyzeVideo(t.id);
};
$('#btnNew').onclick = () => openNew();

/* libreria */
async function openLibrary() {
  const texts = (await DB.all('texts')).sort((a, b) => b.lastUsed - a.lastUsed);
  const takes = await DB.all('takes');
  const cnt = {}; takes.forEach((k) => (cnt[k.textId] = (cnt[k.textId] || 0) + 1));
  $('#libList').innerHTML = texts.map((t) => `
    <div class="row ${t.id === S.text?.id ? 'cur' : ''}">
      <button class="main" data-sel="${t.id}"><b>${TYPES[t.type]?.ico || '✳️'} ${esc(t.title)}</b>
        <small>${TYPES[t.type]?.label || ''}${t.video ? ' · 🎞️ video' : ''} · ${cnt[t.id] || 0} take</small></button>
      <button class="act" data-edit="${t.id}" aria-label="Modifica">✏️</button>
      <button class="act" data-del="${t.id}" aria-label="Elimina">🗑️</button>
    </div>`).join('') || '<div class="empty-note">Nessun testo ancora.</div>';
  open('#sheetLib');
}
$('#libList').onclick = async (e) => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.sel) { $('#sheetLib').close(); selectText(b.dataset.sel); }
  if (b.dataset.edit) openNew(await DB.get('texts', b.dataset.edit));
  if (b.dataset.del) {
    const ks = await DB.takesOf(b.dataset.del);
    if (!confirm(`Eliminare questo testo${ks.length ? ` e le sue ${ks.length} take` : ''}?`)) return;
    for (const k of ks) await DB.del('takes', k.id);
    await DB.del('texts', b.dataset.del);
    if (S.text?.id === b.dataset.del) {
      const rest = (await DB.all('texts')).sort((a, c) => c.lastUsed - a.lastUsed);
      rest.length ? await selectText(rest[0].id) : ((S.text = null), renderText(), await refreshTakes());
    }
    openLibrary();
  }
};
$('#btnLibrary').onclick = openLibrary;
$('#libNew').onclick = () => openNew();

/* take + confronto A/B */
const takeLabel = (k) => `Take ${k.n}${k.starred ? ' ★' : ''} · ${fmt(k.duration)}`;
const ext = (mime) => (mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm');
function download(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
const fileName = (k, title) => `${(title || 'take').replace(/[^\w\- àèéìòù]/gi, '').trim()} - take ${k.n || ''} ${new Date(k.createdAt).toISOString().slice(0, 10)}.${ext(k.mime)}`;

function takeRow(k, title) {
  const d = new Date(k.createdAt);
  return `<div class="row">
    <button class="act play" data-play="${k.id}">▶</button>
    <div class="main"><b>${title ? esc(title) + ' · ' : ''}Take ${k.n}</b>
      <small>${fmt(k.duration)} · ${k.mode === 'fuori' ? '🌳 fuori' : '🏠 casa'} · ${d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} ${d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</small></div>
    <button class="act coach" data-coach="${k.id}">🧠${k.coach?.count != null ? `<sup>${k.coach.count}</sup>` : ''}</button>
    <button class="act ${k.starred ? 'on' : ''}" data-star="${k.id}">${k.starred ? '★' : '☆'}</button>
    <button class="act" data-dl="${k.id}" aria-label="Prepara per il cliente">📦</button>
    <button class="act" data-rm="${k.id}">🗑️</button>
  </div>`;
}
function renderTakes() {
  const ks = [...S.takes].reverse();
  $('#takeList').innerHTML = ks.map((k) => takeRow(k)).join('') || '<div class="empty-note">Ancora nessuna take: premi il bottone rosso.</div>';
  $('#abBox').hidden = S.takes.length < 2;
  const opts = ks.map((k) => `<option value="${k.id}">${takeLabel(k)}</option>`).join('');
  $('#abA').innerHTML = opts; $('#abB').innerHTML = opts;
  if (ks[1]) { $('#abA').value = ks[1].id; $('#abB').value = ks[0].id; }
}
async function openTakes() { await refreshTakes(); renderTakes(); open('#sheetTakes'); }
$('#btnTakes').onclick = openTakes;

async function takeListClick(e, after) {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.coach) return openCoach(b.dataset.coach);
  const id = b.dataset.play || b.dataset.star || b.dataset.dl || b.dataset.rm; if (!id) return;
  const k = await DB.get('takes', id);
  const n = S.takes.find((x) => x.id === id)?.n; k.n = n;
  if (b.dataset.play) {
    stopAB();
    document.querySelectorAll('[data-play]').forEach((x) => (x.textContent = '▶'));
    if (playTake(k, () => (b.textContent = '▶'))) b.textContent = '⏸';
  } else if (b.dataset.star) {
    k.starred = !k.starred; await DB.put('takes', strip(k));
    b.textContent = k.starred ? '★' : '☆'; b.classList.toggle('on', k.starred);
    if (S.lastTake?.id === id) { S.lastTake.starred = k.starred; $('#ttStar').textContent = k.starred ? '★' : '☆'; }
  } else if (b.dataset.dl) {
    return openDeliver(id);
  } else if (b.dataset.rm) {
    if (!confirm('Eliminare questa take?')) return;
    stopPlayer(); await DB.del('takes', id);
    if (S.lastTake?.id === id) $('#takeToast').hidden = true;
    await refreshTakes(); after();
  }
}
$('#takeList').onclick = (e) => takeListClick(e, renderTakes);

let AB = null;
function stopAB() {
  if (!AB) return;
  AB.a.pause(); AB.b.pause(); URL.revokeObjectURL(AB.a.src); URL.revokeObjectURL(AB.b.src);
  if (S.text?.video) $('#video').pause();
  AB = null; $('#abPlay').textContent = '▶ Confronta'; $('#abSwitch').textContent = 'Ora: A — passa a B ⇄';
}
$('#abPlay').onclick = async () => {
  if (AB) return stopAB();
  stopPlayer();
  const [ka, kb] = await Promise.all([DB.get('takes', $('#abA').value), DB.get('takes', $('#abB').value)]);
  const a = new Audio(URL.createObjectURL(ka.blob)), b = new Audio(URL.createObjectURL(kb.blob));
  AB = { a, b, cur: 'a' };
  a.onended = b.onended = () => stopAB();
  if (S.text?.video) { const v = $('#video'); v.muted = true; v.currentTime = 0; v.play().catch(() => {}); }
  a.play(); $('#abPlay').textContent = '⏹ Stop';
};
$('#abSwitch').onclick = () => {
  if (!AB) return $('#abPlay').onclick();
  const from = AB[AB.cur], to = AB[AB.cur === 'a' ? 'b' : 'a'];
  to.currentTime = Math.min(from.currentTime, (to.duration || 1e9) - 0.05);
  from.pause(); to.play();
  AB.cur = AB.cur === 'a' ? 'b' : 'a';
  $('#abSwitch').textContent = AB.cur === 'a' ? 'Ora: A — passa a B ⇄' : 'Ora: B — passa ad A ⇄';
};

/* archivio */
async function openArchive() {
  const [texts, takes] = await Promise.all([DB.all('texts'), DB.all('takes')]);
  const byText = Object.fromEntries(texts.map((t) => [t.id, t]));
  const groups = {};
  takes.sort((a, b) => a.createdAt - b.createdAt).forEach((k) => (groups[k.textId] ||= []).push(k));
  Object.values(groups).forEach((g) => g.forEach((k, i) => (k.n = i + 1)));
  const total = takes.reduce((s, k) => s + k.duration, 0);
  const days = new Set(takes.map((k) => new Date(k.createdAt).toDateString())).size;
  const cab = total >= 3600000 ? [(total / 3600000).toFixed(1), 'ore di cabina'] : [Math.round(total / 60000), 'minuti di cabina'];
  $('#stats').innerHTML = `<div><b>${cab[0]}</b><small>${cab[1]}</small></div>
    <div><b>${takes.length}</b><small>take registrate</small></div><div><b>${days}</b><small>giorni in cabina</small></div>`;
  const order = Object.keys(groups).sort((a, b) => groups[b].at(-1).createdAt - groups[a].at(-1).createdAt);
  $('#archList').innerHTML = order.map((tid) => `<div class="group">${TYPES[byText[tid]?.type]?.ico || '✳️'} ${esc(byText[tid]?.title || 'Testo eliminato')}</div>` +
    [...groups[tid]].reverse().map((k) => takeRow(k)).join('')).join('') || '<div class="empty-note">L\'archivio è vuoto. La prima take ti aspetta.</div>';
  open('#sheetArchive');
}
$('#archList').onclick = (e) => takeListClick(e, () => { openArchive(); });
$('#btnArchive').onclick = openArchive;

/* impostazioni */
$('#btnSettings').onclick = async () => {
  open('#sheetSettings');
  try {
    let devs = await navigator.mediaDevices.enumerateDevices();
    if (!devs.some((d) => d.kind === 'audioinput' && d.label)) {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true }); s.getTracks().forEach((t) => t.stop());
      devs = await navigator.mediaDevices.enumerateDevices();
    }
    $('#micSel').innerHTML = '<option value="">Predefinito</option>' + devs.filter((d) => d.kind === 'audioinput' && d.deviceId !== 'default')
      .map((d) => `<option value="${d.deviceId}">${esc(d.label || 'Microfono')}</option>`).join('');
    $('#micSel').value = S.mic;
  } catch {}
  const est = await navigator.storage?.estimate?.();
  $('#storage').textContent = est ? `${(est.usage / 1048576).toFixed(1)} MB` : '—';
};
$('#micSel').onchange = (e) => { S.mic = e.target.value; ls.set('mic', S.mic); };

let installEvt = null;
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; $('#btnInstall').hidden = false; });
$('#btnInstall').onclick = async () => { if (!installEvt) return; installEvt.prompt(); await installEvt.userChoice; installEvt = null; $('#btnInstall').hidden = true; };

/* ---------- file condivisi da altre app (Android: Condividi → VActor) ---------- */
async function checkInbox() {
  if (!new URLSearchParams(location.search).has('shared') || !('caches' in window)) return;
  history.replaceState(null, '', location.pathname);
  const c = await caches.open('vactor-inbox');
  const files = [];
  for (const r of await c.keys()) {
    const res = await c.match(r);
    const name = decodeURIComponent(res.headers.get('x-name') || 'file');
    files.push(new File([await res.blob()], name, { type: res.headers.get('content-type') || '' }));
    await c.delete(r);
  }
  if (files.length) { openNew(); await ingest(files); }
}

/* ---------- Fase 3: leggio di doppiaggio ---------- */
const PXS = 170;          // pixel per secondo della banda ritmica
const PRE = 3.3;          // pre-roll prima dell'anello (3 bip)
const DUB = { an: 0, raf: 0, loop: false, prova: false, spans: [], cur: -1, busy: null };
const fmtT = (x) => `${Math.floor(x / 60)}:${(x % 60).toFixed(1).padStart(4, '0')}`;

// 1. audio del video → 16 kHz mono
async function decodeVideoAudio(blob) {
  const AC = window.AudioContext || window.webkitAudioContext;
  const ac = new AC();
  const buf = await ac.decodeAudioData(await blob.arrayBuffer());
  ac.close().catch(() => {});
  const off = new OfflineAudioContext(1, Math.ceil(buf.duration * 16000), 16000);
  const src = off.createBufferSource(); src.buffer = buf; src.connect(off.destination); src.start();
  const out = await off.startRendering();
  return { pcm: out.getChannelData(0), duration: buf.duration };
}
// 2. trascrizione con i tempi di ogni parola
async function transcribe(pcm, grammar, onProgress) {
  const model = await loadVosk();
  const rec = grammar ? new model.KaldiRecognizer(16000, grammar) : new model.KaldiRecognizer(16000);
  rec.setWords(true);
  const words = [];
  const CH = 8000;
  const chunks = Math.ceil(pcm.length / CH);
  let events = 0, finalSent = false;
  return new Promise((resolve) => {
    let idle = null;
    const bump = () => {
      events++; onProgress?.(Math.min(0.99, events / (chunks + 1)));
      if (finalSent) { clearTimeout(idle); idle = setTimeout(done, events >= chunks + 1 ? 300 : 4000); }
    };
    const done = () => { try { rec.remove(); } catch {} resolve(words); };
    rec.on('result', (m) => { for (const r of m?.result?.result || []) if (r.word && r.word !== '[unk]') words.push({ w: r.word, s: r.start, e: r.end }); bump(); });
    rec.on('partialresult', bump);
    (async () => {
      for (let i = 0; i < chunks; i++) {
        rec.acceptWaveformFloat(pcm.slice(i * CH, (i + 1) * CH), 16000);
        if (i % 20 === 19) await sleep(0);
      }
      rec.retrieveFinalResult(); finalSent = true;
      idle = setTimeout(done, 15000);
    })();
  });
}
// parole del copione (senza nomi, indicazioni e segni di pausa)
function copioneTokens(body) {
  const toks = [];
  body.split('\n').forEach((line, li) => {
    let rest = line; let spk = '';
    const m = rest.match(/^\s*([A-ZÀ-ÖØ-Ý][A-ZÀ-ÖØ-Ý0-9 .'’-]{0,24}):/);
    if (m) { spk = m[1].trim(); rest = rest.slice(m[0].length); }
    for (const part of rest.split(/(\([^)\n]{1,80}\))/)) {
      if (/^\(.*\)$/.test(part)) { if (toks.length && toks.at(-1).line === li) toks.at(-1).br = true; continue; }
      for (const tok of part.split(/\s+/)) {
        if (!tok) continue;
        if (/^\/{1,2}$/.test(tok)) { if (toks.length) toks.at(-1).pz = tok.length; continue; }
        const shown = tok.replace(/\*/g, ''); const n = norm(shown);
        if (n) toks.push({ w: shown, n, line: li, spk });
      }
    }
  });
  return toks;
}
// 3. allinea il copione alle parole riconosciute (programmazione dinamica)
function align(toks, rec) {
  let n = toks.length; const m = rec.length;
  const rn = rec.map((r) => norm(r.w));
  const S2 = Array.from({ length: n + 1 }, () => new Float32Array(m + 1));
  for (let i = 1; i <= n; i++) S2[i][0] = -i * 0.5;
  for (let j = 1; j <= m; j++) S2[0][j] = -j * 0.5;
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
    const ok = similar(toks[i - 1].n, rn[j - 1]);
    S2[i][j] = Math.max(S2[i - 1][j - 1] + (ok ? 2 : -1), S2[i - 1][j] - 0.5, S2[i][j - 1] - 0.5);
  }
  let i = n, j = m;
  while (i > 0 && j > 0) {
    const ok = similar(toks[i - 1].n, rn[j - 1]);
    if (S2[i][j] === S2[i - 1][j - 1] + (ok ? 2 : -1)) { if (ok) { toks[i - 1].s = rec[j - 1].s; toks[i - 1].e = rec[j - 1].e; } i--; j--; }
    else if (S2[i][j] === S2[i - 1][j] - 0.5) i--; else j--;
  }
  // battute del copione che nel video non si sentono: le tolgo dalla banda
  const lines = {};
  toks.forEach((t) => { const L = (lines[t.line] ||= { n: 0, ok: 0 }); L.n++; if (t.s != null) L.ok++; });
  toks = toks.filter((t) => { const L = lines[t.line]; return !(L.n >= 2 && L.ok / L.n < 0.25) && !(L.n < 2 && L.ok === 0 && rec.length); });
  n = toks.length;
  // parole non trovate: tempi interpolati tra le vicine
  let k = 0;
  while (k < n) {
    if (toks[k].s != null) { k++; continue; }
    let a = k; while (k < n && toks[k].s == null) k++;
    const t0 = a > 0 ? toks[a - 1].e : Math.max(0, (toks[k]?.s ?? 0.3) - 0.35 * (k - a));
    const t1 = k < n ? toks[k].s : t0 + 0.35 * (k - a);
    const step = Math.max(0.12, (t1 - t0) / (k - a));
    for (let q = a; q < k; q++) { toks[q].s = t0 + (q - a) * step; toks[q].e = toks[q].s + step * 0.9; }
  }
  return toks;
}
// 4. divide in anelli (battute)
function buildAnelli(toks) {
  const an = [];
  let cur = null;
  toks.forEach((t, i) => {
    const prev = toks[i - 1];
    const gap = prev ? t.s - prev.e : 0;
    const newLine = prev && t.line !== prev.line;
    const long = cur && t.e - cur.s > 7.5 && gap > 0.25;
    if (!cur || gap > 1.1 || (newLine && (gap > 0.25 || t.spk !== prev.spk)) || long || (newLine && t.spk && t.spk !== prev.spk)) {
      cur = { s: t.s, e: t.e, i0: i, i1: i, spk: t.spk };
      an.push(cur);
    } else { cur.e = t.e; cur.i1 = i; }
  });
  return an.map((a) => ({ ...a, text: toks.slice(a.i0, a.i1 + 1).map((t) => t.w).join(' ') }));
}
async function analyzeVideo(id) {
  if (DUB.busy) return;
  DUB.busy = id;
  const show = (msg, p) => { if (S.text?.id === id) rpanel(`<div class="drill"><div class="dnum">Banda ritmica</div><h3>${msg}</h3>
    <div class="dbar"><i class="static" style="transform:scaleX(${p || 0})"></i></div><p class="small">Ascolto la voce originale e metto ogni parola al suo tempo. Rimane tutto sul telefono.</p></div>`); };
  try {
    let t = await DB.get('texts', id);
    show('Preparo il riconoscimento…', 0.02);
    await loadVosk();
    show('Estraggo l\'audio dal video…', 0.05);
    const { pcm, duration } = await decodeVideoAudio(t.video);
    const hasCop = !!t.body?.trim();
    const grammar = hasCop ? grammarOf(t.body) : null;
    const raw = await transcribe(pcm, grammar, (p) => show(`Analizzo la voce originale… ${Math.round(p * 100)}%`, 0.05 + p * 0.9));
    t = await DB.get('texts', id);
    let toks;
    if (hasCop) toks = align(copioneTokens(t.body), raw);
    else {
      toks = raw.map((r) => ({ w: r.w, n: norm(r.w), s: r.s, e: r.e, line: 0, spk: '' }));
      const an0 = buildAnelli(toks);
      an0.forEach((a, k) => { for (let q = a.i0; q <= a.i1; q++) toks[q].line = k; });
      t.body = an0.map((a) => a.text).join('\n');
    }
    const anelli = buildAnelli(toks);
    t.sync = { toks: toks.map(({ w, s, e, spk, pz, br, line }) => ({ w, s, e, spk, pz, br, line })), anelli, duration, auto: !hasCop, raw, at: Date.now() };
    await DB.put('texts', t);
    rpanel('');
    if (S.text?.id === id) { S.text = t; DUB.an = 0; renderText(); }
    if (!raw.length) toast2('Non ho sentito parole nel video. Controlla che abbia l\'audio originale.');
  } catch (e) {
    console.error(e);
    if (S.text?.id === id) rpanel(`<div class="drill"><h3>Non riesco ad analizzare questo video</h3><p>${esc(String(e.message || e))}</p><button class="cta" id="dubRetry">Riprova</button></div>`);
    $('#dubRetry') && ($('#dubRetry').onclick = () => { rpanel(''); DUB.busy = null; analyzeVideo(id); });
  } finally { DUB.busy = null; }
}
function toast2(msg) { followNote(msg); setTimeout(() => followNote(''), 4000); }

// 5. interfaccia
function renderDub() {
  const t = S.text;
  const band = $('#band');
  cancelAnimationFrame(DUB.raf);
  if (!t.sync?.anelli?.length) {
    band.hidden = true; $('#dubTools').hidden = true;
    $('#ptext').innerHTML = '';
    if (DUB.busy !== t.id) rpanel(`<div class="drill"><div class="dnum">Leggio di doppiaggio</div><h3>Creo la banda ritmica?</h3>
      <p>Ascolto la voce originale del video, metto ogni parola al suo tempo e divido la scena in anelli.${t.body?.trim() ? ' Userò il tuo copione.' : ' Se hai il copione, aggiungilo prima con ✏️: sarà più preciso.'}</p>
      <button class="cta" id="dubGo">🎞️ Crea la banda ritmica</button></div>`);
    $('#dubGo') && ($('#dubGo').onclick = () => analyzeVideo(t.id));
    return;
  }
  rpanel('');
  const sy = t.sync;
  DUB.an = Math.min(DUB.an, sy.anelli.length - 1);
  // banda
  band.hidden = false; $('#dubTools').hidden = false;
  const track = $('#bandTrack');
  track.innerHTML = sy.toks.map((k, i) => `<span class="bw" data-i="${i}" style="left:${(k.s * PXS).toFixed(1)}px">${esc(k.w)}${k.br ? '<em class="br">↑</em>' : ''}</span>${k.pz ? `<i class="bp${k.pz > 1 ? ' l' : ''}" style="left:${((k.e + 0.05) * PXS).toFixed(1)}px"></i>` : ''}`).join('')
    + sy.anelli.map((a, i) => `<b class="ba" style="left:${(a.s * PXS - 6).toFixed(1)}px">${String(i + 1).padStart(2, '0')}${a.spk ? ' · ' + esc(a.spk) : ''}</b>`).join('');
  DUB.spans = [...track.querySelectorAll('.bw')];
  requestAnimationFrame(() => DUB.spans.forEach((el, i) => {
    const k = sy.toks[i]; const nx = sy.toks[i + 1]; const room = Math.min(k.e, nx ? nx.s : k.e) - k.s; const want = Math.max(0.12 * PXS, room * PXS - 10); const w = el.offsetWidth || 1;
    el.style.transform = `scaleX(${Math.min(1.7, Math.max(0.45, want / w)).toFixed(3)})`;
  }));
  DUB.cur = -1;
  // anelli
  renderAnelli();
  const v = $('#video');
  const an = sy.anelli[DUB.an];
  const seekTo = () => { if (v.paused) v.currentTime = Math.max(0, an.s - 0.05); };
  v.readyState >= 1 ? seekTo() : v.addEventListener('loadedmetadata', seekTo, { once: true });
  const loop = () => { bandTick(); DUB.raf = requestAnimationFrame(loop); };
  DUB.raf = requestAnimationFrame(loop);
}
async function renderAnelli() {
  const t = S.text, sy = t.sync;
  const takes = await DB.takesOf(t.id);
  const by = {};
  takes.sort((a, b) => a.createdAt - b.createdAt).forEach((k) => { if (k.anello != null) (by[k.anello] ||= []).push(k); });
  $('#ptext').innerHTML = `<div class="anelli">` + sy.anelli.map((a, i) => {
    const ks = by[i] || []; const last = ks.at(-1);
    return `<button class="an ${i === DUB.an ? 'cur' : ''}" data-an="${i}">
      <span class="an-n">${String(i + 1).padStart(2, '0')}</span>
      <span class="an-b"><small>${fmtT(a.s)}${a.spk ? ' · ' + esc(a.spk) : ''}</small>${esc(a.text)}</span>
      <span class="an-k">${ks.length ? `${ks.length} take${last?.sync ? '<br>' + syncBadge(last.sync) : ''}` : ''}</span></button>`;
  }).join('') + `</div>` + (sy.auto ? `<p class="hint pad">Testo ricavato dall'audio: se vedi parole sbagliate correggile con ✏️ (in alto, tocca il titolo), la banda si rifà da sola.</p>` : '');
  $('#ptext').querySelector('.an.cur')?.scrollIntoView({ block: 'center' });
}
$('#ptext').addEventListener('click', (e) => {
  const b = e.target.closest('.an'); if (!b || S.rec) return;
  selectAnello(+b.dataset.an);
});
function selectAnello(i) {
  const sy = S.text?.sync; if (!sy) return;
  DUB.an = Math.max(0, Math.min(sy.anelli.length - 1, i));
  stopProva();
  const v = $('#video'); v.pause(); v.currentTime = Math.max(0, sy.anelli[DUB.an].s - 0.05);
  document.querySelectorAll('.an').forEach((el) => el.classList.toggle('cur', +el.dataset.an === DUB.an));
  document.querySelector('.an.cur')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  $('#takeToast').hidden = true;
}
function bandTick() {
  const sy = S.text?.sync; if (!sy) return;
  const v = $('#video'); const t = v.currentTime;
  const lineX = $('#band').clientWidth * 0.25;
  $('#bandTrack').style.transform = `translateX(${(lineX - t * PXS).toFixed(1)}px)`;
  // parola corrente
  let lo = 0, hi = sy.toks.length - 1, idx = -1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (sy.toks[mid].s <= t) { idx = mid; lo = mid + 1; } else hi = mid - 1; }
  if (idx !== DUB.cur) {
    const a = Math.min(idx, DUB.cur), b = Math.max(idx, DUB.cur);
    for (let i = Math.max(0, a); i <= b && i < DUB.spans.length; i++) { DUB.spans[i].classList.toggle('past', i < idx); DUB.spans[i].classList.toggle('now', i === idx && t <= sy.toks[i].e + 0.15); }
    DUB.cur = idx;
  } else if (idx >= 0 && DUB.spans[idx]) DUB.spans[idx].classList.toggle('now', t <= sy.toks[idx].e + 0.15);
  // prova in loop
  if (DUB.prova && !S.rec) {
    const an = sy.anelli[DUB.an];
    if (t >= an.e + 0.6) { if (DUB.loop) { v.currentTime = Math.max(0, an.s - 1.2); } else stopProva(); }
  }
  // fine anello durante la registrazione
  if (S.rec?.dub && !S.rec.stopping && t >= S.rec.dub.end) stopRec();
}
function stopProva() {
  if (!DUB.prova) return;
  DUB.prova = false; $('#video').pause(); $('#dubPlay').textContent = '▶ Prova';
}
$('#dubPlay').onclick = () => {
  if (S.rec) return;
  const sy = S.text?.sync; if (!sy) return;
  if (DUB.prova) return stopProva();
  stopPlayer();
  const v = $('#video'); const an = sy.anelli[DUB.an];
  v.currentTime = Math.max(0, an.s - 1.2); v.muted = false; v.volume = 1;
  v.play().catch(() => {}); DUB.prova = true; $('#dubPlay').textContent = '⏸ Stop';
};
$('#dubLoop').onclick = () => { DUB.loop = !DUB.loop; $('#dubLoop').classList.toggle('on', DUB.loop); };
$('#dubPrev').onclick = () => !S.rec && selectAnello(DUB.an - 1);
$('#dubNext').onclick = () => !S.rec && selectAnello(DUB.an + 1);

let beepCtx = null;
function beep(freq = 1000, dur = 0.09) {
  try {
    beepCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    const o = beepCtx.createOscillator(), g = beepCtx.createGain();
    o.frequency.value = freq; g.gain.value = 0.25; o.connect(g); g.connect(beepCtx.destination);
    o.start(); o.stop(beepCtx.currentTime + dur);
  } catch {}
}
async function dubRec() {
  stopPlayer(); stopProva();
  const sy = S.text.sync; const an = sy.anelli[DUB.an];
  let stream;
  try { stream = await openMic(); } catch { alert('Non riesco ad accedere al microfono. Controlla i permessi del browser.'); return; }
  const ctx = new (window.AudioContext || window.webkitAudioContext)(); ctx.resume?.().catch(() => {});
  const src = ctx.createMediaStreamSource(stream);
  const anl = ctx.createAnalyser(); anl.fftSize = 1024; src.connect(anl);
  const buf = new Float32Array(anl.fftSize);
  const rms = () => { anl.getFloatTimeDomainData(buf); let q = 0; for (const x of buf) q += x * x; return Math.sqrt(q / buf.length); };
  const vs = Math.max(0, an.s - PRE);
  const R = (S.rec = { stream, ctx, src, rms, counting: false, dub: { an: DUB.an, vs, end: an.e + 0.9 } });
  document.body.classList.add('recording');
  beep(1, 0.001); // sblocca l'audio
  const v = $('#video');
  v.pause(); v.currentTime = vs;
  await new Promise((r) => { const f = () => r(); v.addEventListener('seeked', f, { once: true }); setTimeout(f, 800); });
  if (S.rec !== R) return;
  v.volume = S.guide; v.muted = S.guide === 0;
  const mimeType = pickMime();
  const mr = new MediaRecorder(stream, { ...(mimeType && { mimeType }), audioBitsPerSecond: S.mode === 'casa' ? 256000 : 128000 });
  R.chunks = []; R.mr = mr; R.mime = mr.mimeType || mimeType || 'audio/webm';
  mr.ondataavailable = (e) => e.data.size && R.chunks.push(e.data);
  mr.start(100);
  R.t0 = performance.now();
  await v.play().catch(() => {});
  R.dub.vs = v.currentTime; // posizione reale del video all'avvio
  try { R.lock = await navigator.wakeLock?.request('screen'); } catch {}
  // 3 bip prima dell'attacco
  const cd = $('#dubCount');
  for (const k of [3, 2, 1]) {
    const at = (an.s - k - v.currentTime) * 1000;
    if (at >= -50) setTimeout(() => { if (S.rec !== R) return; beep(k === 1 ? 1400 : 1000); cd.textContent = k; cd.hidden = false; setTimeout(() => (cd.hidden = true), 450); }, Math.max(0, at));
  }
  const loop = (now) => {
    if (S.rec !== R) return;
    $('#level').style.transform = `translate(-50%,-50%) scale(${1 + Math.min(0.6, rms() * 6)})`;
    $('#recTime').textContent = '● ' + fmt(now - R.t0);
    R.raf = requestAnimationFrame(loop);
  };
  R.raf = requestAnimationFrame(loop);
}
// 6. misuratore di sync: quando hai attaccato e chiuso rispetto all'originale
async function measureSync(take, an) {
  const AC = window.AudioContext || window.webkitAudioContext;
  const ac = new AC();
  const b = await ac.decodeAudioData(await take.blob.arrayBuffer());
  ac.close().catch(() => {});
  const d = b.getChannelData(0), sr = b.sampleRate, hop = Math.round(sr * 0.01);
  const env = [];
  for (let i = 0; i + hop <= d.length; i += hop) { let q = 0; for (let j = i; j < i + hop; j++) q += d[j] * d[j]; env.push(Math.sqrt(q / hop)); }
  const sorted = [...env].sort((x, y) => x - y);
  const floor = sorted[Math.floor(sorted.length * 0.2)] || 0;
  const thr = Math.max(0.015, floor * 4);
  const from = Math.max(0, Math.round((an.s - take.vs - 0.6) * 100));
  let on = -1, offI = -1;
  for (let i = from; i < env.length - 3; i++) if (env[i] > thr && env[i + 1] > thr && env[i + 2] > thr) { on = i; break; }
  for (let i = env.length - 1; i > on && on >= 0; i--) if (env[i] > thr && env[i - 1] > thr) { offI = i; break; }
  if (on < 0) return null;
  return { ds: +(take.vs + on / 100 - an.s).toFixed(2), de: offI > 0 ? +(take.vs + offI / 100 - an.e).toFixed(2) : null };
}
function syncWord(d, what) {
  if (d == null) return '';
  if (Math.abs(d) < 0.12) return `${what} perfetto`;
  return `${what} ${Math.abs(d).toFixed(2).replace('.', ',')} s ${d > 0 ? 'in ritardo' : 'in anticipo'}`;
}
function syncBadge(sy) {
  const bad = Math.max(Math.abs(sy.ds || 0), Math.abs(sy.de || 0));
  return `<i class="sb ${bad < 0.12 ? 'ok' : bad < 0.3 ? 'mid' : 'ko'}">${bad < 0.12 ? 'in sync' : (bad < 0.3 ? '±' : '±') + bad.toFixed(1).replace('.', ',') + 's'}</i>`;
}
async function afterDubTake(take) {
  const an = S.text?.sync?.anelli?.[take.anello]; if (!an) return;
  try {
    const r = await measureSync(take, an);
    if (!r) { $('#ttMeta').textContent = `${fmt(take.duration)} · non sento la voce: controlla il microfono`; return; }
    take.sync = r;
    await DB.put('takes', strip(take));
    if (S.lastTake?.id === take.id) $('#ttMeta').innerHTML = `${esc(syncWord(r.ds, 'Attacco'))}${r.de != null ? ' · ' + esc(syncWord(r.de, 'chiusura')) : ''}`;
    renderAnelli();
  } catch (e) { console.warn('sync', e); }
}

// 7. esporta il video doppiato
async function exportDub() {
  const t = S.text, sy = t.sync; if (!sy || S.rec) return;
  const takes = (await DB.takesOf(t.id)).filter((k) => k.anello != null).sort((a, b) => a.createdAt - b.createdAt);
  const pick = {};
  for (const k of takes) if (!pick[k.anello] || k.starred || !pick[k.anello].starred) pick[k.anello] = k;
  const chosen = Object.values(pick);
  if (!chosen.length) { toast2('Registra almeno un anello prima di esportare.'); return; }
  stopPlayer(); stopProva();
  let cancel = false;
  rpanel(`<div class="drill"><div class="dnum">Esporto il video doppiato</div><h3 id="exT">Preparo…</h3>
    <div class="dbar"><i class="static" id="exBar" style="transform:scaleX(0)"></i></div>
    <p class="small">${chosen.length} anelli su ${sy.anelli.length} (la take ★ preferita, altrimenti l'ultima). Il video viene registrato in tempo reale: tieni lo schermo acceso.</p>
    <button class="cta ghost" id="exStop">Annulla</button></div>`);
  $('#exStop').onclick = () => { cancel = true; };
  const ac = new (window.AudioContext || window.webkitAudioContext)();
  try {
    const bufs = await Promise.all(chosen.map(async (k) => ({ k, b: await ac.decodeAudioData(await k.blob.arrayBuffer()) })));
    const v = document.createElement('video');
    v.src = URL.createObjectURL(t.video); v.playsInline = true; v.muted = false; v.crossOrigin = 'anonymous';
    await new Promise((r, j) => { v.onloadedmetadata = r; v.onerror = () => j(new Error('video')); });
    const scale = Math.min(1, 1280 / Math.max(v.videoWidth, v.videoHeight));
    const cv = document.createElement('canvas'); cv.width = Math.round(v.videoWidth * scale / 2) * 2; cv.height = Math.round(v.videoHeight * scale / 2) * 2;
    const g = cv.getContext('2d');
    const dest = ac.createMediaStreamDestination();
    const orig = ac.createMediaElementSource(v); const og = ac.createGain(); og.gain.value = S.guide; orig.connect(og); og.connect(dest);
    const stream = new MediaStream([...cv.captureStream(30).getVideoTracks(), ...dest.stream.getAudioTracks()]);
    const types = ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4;codecs=avc1', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
    const mimeType = types.find((x) => MediaRecorder.isTypeSupported(x)) || '';
    const mr = new MediaRecorder(stream, { ...(mimeType && { mimeType }), videoBitsPerSecond: 4e6, audioBitsPerSecond: 192000 });
    const parts = []; mr.ondataavailable = (e) => e.data.size && parts.push(e.data);
    const stopped = new Promise((r) => (mr.onstop = r));
    await ac.resume();
    v.currentTime = 0;
    await new Promise((r) => { v.onseeked = r; setTimeout(r, 500); });
    mr.start(500);
    await v.play();
    const T0 = ac.currentTime - v.currentTime;
    for (const { k, b } of bufs) { const s = ac.createBufferSource(); s.buffer = b; s.connect(dest); s.start(Math.max(ac.currentTime, T0 + k.vs), Math.max(0, ac.currentTime - (T0 + k.vs))); }
    await new Promise((res) => {
      const draw = () => {
        if (cancel || v.ended) return res();
        g.drawImage(v, 0, 0, cv.width, cv.height);
        const p = v.currentTime / (v.duration || 1);
        $('#exBar') && ($('#exBar').style.transform = `scaleX(${p})`);
        $('#exT') && ($('#exT').textContent = `Registro… ${Math.round(p * 100)}%`);
        requestAnimationFrame(draw);
      };
      draw();
      v.onended = res;
    });
    v.pause(); mr.stop(); await stopped;
    URL.revokeObjectURL(v.src);
    if (cancel) { rpanel(''); renderDub(); return; }
    const out = new Blob(parts, { type: mr.mimeType || mimeType });
    const ext2 = (mr.mimeType || mimeType).includes('mp4') ? 'mp4' : 'webm';
    download(out, `${t.title.replace(/[^\w\- àèéìòù]/gi, '').trim() || 'doppiaggio'} - doppiato.${ext2}`);
    rpanel(`<div class="drill done"><div class="big-check">✓</div><h3>Video esportato</h3><p>Lo trovi nei download (${(out.size / 1048576).toFixed(1)} MB, ${ext2.toUpperCase()}).</p><button class="cta" id="exOk">Ok</button></div>`);
    $('#exOk').onclick = () => { rpanel(''); renderDub(); };
  } catch (e) {
    console.error(e);
    rpanel(`<div class="drill"><h3>Esportazione non riuscita</h3><p>${esc(String(e.message || e))}</p><button class="cta" id="exOk">Ok</button></div>`);
    $('#exOk').onclick = () => { rpanel(''); renderDub(); };
  } finally { ac.close().catch(() => {}); }
}
$('#dubExport').onclick = exportDub;

/* ---------- segni di dizione ---------- */
S.diz = ls.get('diz', false);
function applyDiz() {
  $('#btnDiz').classList.toggle('on', S.diz);
  $('#dizLegend').hidden = !S.diz;
}
$('#btnDiz').onclick = () => {
  if (S.rec) return;
  S.diz = !S.diz; ls.set('diz', S.diz); applyDiz();
  const top = $('#prompter').scrollTop; renderText(); $('#prompter').scrollTop = top;
};
applyDiz();

/* ---------- Fase 2: allenamento di 10 minuti ---------- */
const pad2 = (n) => String(n).padStart(2, '0');
const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const dayNum = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);
const STEPS = [
  { k: 'respiro', label: 'Respiro', dur: 60 },
  { k: 'artic', label: 'Articolazione', dur: 60 },
  { k: 'twist', label: 'Scioglilingua', dur: 180 },
  { k: 'read', label: 'Lettura del giorno', dur: 300 },
];
function todayPlan() {
  const d = dayNum();
  const drills = [0, 1, 2, 3].map((i) => DRILLS[(d * 4 + i) % DRILLS.length]);
  const twisters = [1, 2, 3].map((lv) => {
    const list = TWISTERS.map((t, i) => ({ ...t, idx: i })).filter((t) => t.l === lv);
    return list[d % list.length];
  });
  const ri = d % READINGS.length;
  return { drills, twisters, reading: { ...READINGS[ri], idx: ri } };
}
async function ensureText(id, data) {
  let t = await DB.get('texts', id);
  if (!t) { t = { id, ...data, builtin: true, video: null, createdAt: Date.now(), lastUsed: 0 }; await DB.put('texts', t); }
  return t;
}
const RT = { on: false, step: -1, stepT0: 0, tick: null, abort: false, skip: null };
const rpanel = (html, card) => { const p = $('#rpanel'); p.hidden = !html; p.innerHTML = html || ''; p.classList.toggle('card', !!card); };
function routineDone() { const log = ls.get('routineLog', {}); return !!log[dayKey()]; }
function paintRoutineBtn() {
  const b = $('#btnRoutine');
  const done = routineDone();
  b.textContent = done ? '✓ Fatto oggi' : '▶ Allenati';
  b.classList.toggle('done', done);
}
function paintBar() {
  if (!RT.on) return;
  const st = STEPS[RT.step]; if (!st) return;
  const left = Math.max(0, st.dur - (Date.now() - RT.stepT0) / 1000);
  const sec = Math.ceil(left);
  $('#rTime').textContent = sec > 0 ? `${Math.floor(sec / 60)}:${pad2(sec % 60)}` : (st.k === 'read' ? 'tempo!' : '0:00');
  [...$('#rSegs').children].forEach((el, i) => {
    el.style.setProperty('--p', i < RT.step ? 1 : i > RT.step ? 0 : Math.min(1, (Date.now() - RT.stepT0) / 1000 / st.dur));
  });
}
const wait = (ms) => new Promise((res) => {
  const t = setTimeout(() => { RT.skip = null; res('time'); }, ms);
  RT.skip = () => { clearTimeout(t); RT.skip = null; res('skip'); };
});
function setStep(i, hint) {
  RT.step = i; RT.stepT0 = Date.now();
  $('#rStep').textContent = STEPS[i].label;
  $('#rHint').textContent = hint || `${i + 1} di ${STEPS.length}`;
  paintBar();
}

async function stepBreath() {
  setStep(0, 'Rilassa le spalle, respira con la pancia');
  rpanel(`<div class="breath"><div class="bcircle" id="bc"></div><div class="btext" id="bt">Pronto…</div><div class="bsub" id="bs"></div></div>`);
  const phases = [['Inspira dal naso', BREATH.inhale, 'in'], ['Trattieni', BREATH.hold, 'hold'], ['Espira su «sss»', BREATH.exhale, 'out']];
  const end = Date.now() + STEPS[0].dur * 1000;
  while (Date.now() < end && RT.on && !RT.abort) {
    for (const [txt, sec, cls] of phases) {
      if (!RT.on || RT.abort) return;
      const bc = $('#bc'); if (!bc) return;
      bc.style.transitionDuration = sec + 's'; bc.className = 'bcircle ' + cls;
      $('#bt').textContent = txt; $('#bs').textContent = `${sec} secondi`;
      if ((await wait(sec * 1000)) === 'skip') return;
    }
  }
}
async function stepArtic(plan) {
  setStep(1, '4 esercizi da 15 secondi');
  for (let i = 0; i < plan.drills.length; i++) {
    if (!RT.on || RT.abort) return;
    const d = plan.drills[i];
    rpanel(`<div class="drill"><div class="dnum">${i + 1} / ${plan.drills.length}</div><h3>${esc(d.t)}</h3><p>${esc(d.d)}</p>
      <div class="dbar"><i style="animation-duration:15s"></i></div></div>`);
    await wait(15000);
  }
}
async function recordOn(textId, limitSec, hint) {
  await selectText(textId);
  $('#rHint').textContent = hint;
  rpanel('');
  await startRec();
  if (!S.rec) return 'fail';
  const stop = waitRecStop();
  let timer = null;
  if (limitSec) timer = setTimeout(() => { if (S.rec) stopRec(); }, limitSec * 1000);
  RT.skip = () => { RT.skip = null; if (S.rec) stopRec(); };
  await stop;
  clearTimeout(timer); RT.skip = null;
  return 'ok';
}
async function stepTwist(plan) {
  setStep(2);
  for (let i = 0; i < plan.twisters.length; i++) {
    if (!RT.on || RT.abort) return;
    const tw = plan.twisters[i];
    await ensureText(`tw-${tw.idx}`, { title: `Scioglilingua · ${tw.f}`, type: 'dizione', body: tw.t });
    await selectText(`tw-${tw.idx}`);
    rpanel(`<div class="drill"><div class="dnum">Scioglilingua ${i + 1} di 3 · livello ${'●'.repeat(tw.l)}${'○'.repeat(3 - tw.l)}</div>
      <h3>Ripetilo 3 volte</h3><p>Prima <b>lento</b>, poi <b>normale</b>, poi <b>veloce</b>. Ogni sillaba pulita.</p>
      <button class="cta" id="twGo">● Registra</button></div>`, true);
    const go = await new Promise((res) => { $('#twGo').onclick = () => res('go'); RT.skip = () => res('skip'); setTimeout(() => res('go'), 4000); });
    RT.skip = null;
    if (go === 'skip' || !RT.on) continue;
    if ((await recordOn(`tw-${tw.idx}`, 55, `${i + 1} di 3 · lento → normale → veloce`)) === 'fail') return 'fail';
  }
}
async function stepRead(plan) {
  setStep(3);
  const r = plan.reading;
  const id = `rd-${r.idx}`;
  await ensureText(id, { title: r.title, type: r.type, body: r.body });
  rpanel(`<div class="drill"><div class="dnum">Lettura del giorno · ${esc(r.g)}</div><h3>${esc(r.title)}</h3>
    <p><span class="pz">|</span> pausa breve · <span class="pz l">‖</span> pausa lunga · <b class="em-demo">evidenziato</b> = parola chiave.<br>Leggila una volta per capirla, poi registra con l'intenzione giusta.</p>
    <button class="cta" id="rdGo">● Registra</button></div>`, true);
  await selectText(id);
  const go = await new Promise((res) => { $('#rdGo').onclick = () => res('go'); RT.skip = () => res('skip'); });
  RT.skip = null;
  if (go === 'skip' || !RT.on) return;
  RT.stepT0 = Date.now();
  return recordOn(id, 0, 'Leggi con calma: il gobbo ti segue');
}
async function startRoutine() {
  if (RT.on || S.rec) return;
  stopPlayer();
  const plan = todayPlan();
  RT.on = true; RT.abort = false; RT.t0 = Date.now(); RT.plan = plan;
  document.body.classList.add('routine');
  $('#rbar').hidden = false;
  RT.tick = setInterval(paintBar, 250);
  try {
    await stepBreath(); if (!RT.on) return;
    await stepArtic(plan); if (!RT.on) return;
    if ((await stepTwist(plan)) === 'fail' || !RT.on) return endRoutine();
    await stepRead(plan); if (!RT.on) return;
    await finishRoutine(plan);
  } catch (e) { console.error(e); endRoutine(); }
}
async function finishRoutine(plan) {
  const secs = Math.round((Date.now() - RT.t0) / 1000);
  const log = ls.get('routineLog', {}); log[dayKey()] = (log[dayKey()] || 0) + secs; ls.set('routineLog', log);
  paintRoutineBtn();
  clearInterval(RT.tick);
  $('#rStep').textContent = 'Allenamento completato'; $('#rHint').textContent = `${Math.floor(secs / 60)} min ${secs % 60} s`;
  $('#rTime').textContent = '✓';
  [...$('#rSegs').children].forEach((el) => el.style.setProperty('--p', 1));
  const ks = (await DB.takesOf(`rd-${plan.reading.idx}`)).sort((a, b) => a.createdAt - b.createdAt);
  const days = Object.keys(log).length;
  let ab = '';
  if (ks.length >= 2) {
    const prev = ks.at(-2), cur = ks.at(-1);
    ab = `<div class="pd"><h4>Prima e dopo</h4><p>Hai già letto questo testo il ${new Date(prev.createdAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}. Ascolta la differenza:</p>
      <div class="pd-row"><button class="cta small ghost" data-pd="${prev.id}">▶ Volta scorsa</button><button class="cta small" data-pd="${cur.id}">▶ Oggi</button></div></div>`;
  }
  rpanel(`<div class="drill done"><div class="big-check">✓</div><h3>Fatto, ottimo lavoro.</h3>
    <p>${days === 1 ? 'Primo giorno di allenamento.' : `${days} giorni di allenamento in tutto.`} Le registrazioni sono nell'archivio.</p>${ab}
    <div id="rDrive"></div>
    <div class="co-list" id="rCoach"></div>
    <button class="cta" id="rEnd">Chiudi</button></div>`);
  const rtk = (await DB.all('takes')).filter((k) => k.createdAt >= RT.t0).sort((a, b) => a.createdAt - b.createdAt);
  const titles = Object.fromEntries((await DB.all('texts')).map((x) => [x.id, x.title]));
  $('#rCoach').innerHTML = rtk.length ? `<h4 class="co-h">🧠 Il coach sulle registrazioni di oggi</h4>` + rtk.map((k) => `<button class="cta small ghost co-item" data-coach="${k.id}">${esc(titles[k.textId] || 'Take')} ›</button>`).join('') : '';
  $('#rpanel').onclick = async (e) => {
    const cb = e.target.closest('[data-coach]'); if (cb) return openCoach(cb.dataset.coach);
    const b = e.target.closest('[data-pd]');
    if (b) { const k = await DB.get('takes', b.dataset.pd); const txt = b.textContent; if (playTake(k, () => (b.textContent = txt))) b.textContent = '⏸ Stop'; }
    if (e.target.id === 'rEnd') endRoutine();
  };
  $('#rNext').hidden = true;
  gdAfterRoutine();
}
function endRoutine() {
  RT.on = false; RT.abort = true;
  RT.skip?.();
  clearInterval(RT.tick);
  if (S.rec) S.rec.counting ? cancelRec() : stopRec();
  stopPlayer();
  rpanel(''); $('#rpanel').onclick = null;
  $('#rbar').hidden = true; $('#rNext').hidden = false;
  document.body.classList.remove('routine');
  paintRoutineBtn();
}
$('#btnRoutine').onclick = () => (RT.on ? null : startRoutine());
$('#rNext').onclick = () => RT.skip?.();
$('#rClose').onclick = () => { if (confirm('Interrompere l\'allenamento? Le registrazioni fatte restano salvate.')) endRoutine(); };
paintRoutineBtn();

/* ---------- promemoria (Google Calendar) ---------- */
const WD = [['Lun', 1, 'MO'], ['Mar', 2, 'TU'], ['Mer', 3, 'WE'], ['Gio', 4, 'TH'], ['Ven', 5, 'FR'], ['Sab', 6, 'SA'], ['Dom', 0, 'SU']];
S.remind = ls.get('remind', { 1: '21:00', 2: '21:00', 3: '21:00', 4: '21:00', 5: '21:00' });
const appURL = () => new URL('./?routine=1', location.href).href;
function calURL({ start, recur }) {
  const end = new Date(start.getTime() + 10 * 60000);
  const f = (d) => `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}T${pad2(d.getHours())}${pad2(d.getMinutes())}00`;
  const u = new URL('https://calendar.google.com/calendar/render');
  u.searchParams.set('action', 'TEMPLATE');
  u.searchParams.set('text', '🎙️ VActor · allenamento 10 minuti');
  u.searchParams.set('dates', `${f(start)}/${f(end)}`);
  u.searchParams.set('ctz', Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Rome');
  u.searchParams.set('details', `Respiro, articolazione, scioglilingua e lettura del giorno.\nApri: ${appURL()}`);
  if (recur) u.searchParams.set('recur', recur);
  return u.href;
}
function nextDate(days, hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  for (let i = 0; i < 8; i++) {
    const d = new Date(); d.setDate(d.getDate() + i); d.setHours(h, m, 0, 0);
    if (days.includes(d.getDay()) && d > new Date()) return d;
  }
  return new Date();
}
function renderDays() {
  $('#days').innerHTML = WD.map(([lab, n]) => `<label class="day ${S.remind[n] ? 'on' : ''}">
    <input type="checkbox" data-d="${n}" ${S.remind[n] ? 'checked' : ''}><span>${lab}</span>
    <input type="time" data-t="${n}" value="${S.remind[n] || '21:00'}" ${S.remind[n] ? '' : 'disabled'}></label>`).join('');
  $('#calLinks').innerHTML = '';
  const t = $('#todayTime'); $('#todayLink').href = calURL({ start: nextDate([new Date().getDay(), (new Date().getDay() + 1) % 7], t.value) });
}
$('#days').onchange = (e) => {
  const n = e.target.dataset.d ?? e.target.dataset.t;
  if (e.target.dataset.d !== undefined) { if (e.target.checked) S.remind[n] = $(`[data-t="${n}"]`).value || '21:00'; else delete S.remind[n]; }
  else if (S.remind[n]) S.remind[n] = e.target.value;
  ls.set('remind', S.remind); renderDays();
};
$('#todayTime').oninput = () => renderDays();
$('#btnCal').onclick = () => {
  const groups = {};
  for (const [lab, n, code] of WD) if (S.remind[n]) (groups[S.remind[n]] ||= []).push([lab, n, code]);
  const entries = Object.entries(groups);
  if (!entries.length) { $('#calLinks').innerHTML = '<small class="hint">Scegli almeno un giorno.</small>'; return; }
  $('#calLinks').innerHTML = `<small class="hint">${entries.length > 1 ? 'Tocca ogni riga e premi «Salva» in Calendar:' : 'Tocca e premi «Salva» in Calendar:'}</small>` +
    entries.map(([time, ds]) => `<a class="cal-link" target="_blank" rel="noopener" href="${calURL({ start: nextDate(ds.map((d) => d[1]), time), recur: `RRULE:FREQ=WEEKLY;BYDAY=${ds.map((d) => d[2]).join(',')}` })}">📅 ${ds.map((d) => d[0]).join(', ')} alle ${time} ›</a>`).join('');
};
renderDays();

/* ---------- Fase 4: coach «Sergente» ---------- */
const COACH = { key: ls.get('gkey', ''), auto: ls.get('coachAuto', true), model: ls.get('coachModel', 'lite'), queue: Promise.resolve(), running: new Set(), showing: null };
const GAPI = 'https://generativelanguage.googleapis.com/v1beta';
const coachCount = () => (ls.get('coachCount', {})[dayKey()] || 0);
function bumpCoachCount() { const c = ls.get('coachCount', {}); c[dayKey()] = (c[dayKey()] || 0) + 1; ls.set('coachCount', c); }

// riferimento: cosa dovevi dire
function refFor(take, text) {
  if (take.anello != null && text.sync?.anelli?.[take.anello]) {
    const an = text.sync.anelli[take.anello];
    const toks = text.sync.toks.slice(an.i0, an.i1 + 1).map((k) => ({ ...k, n: norm(k.w) }));
    return { toks, text: an.text, genre: 'doppiaggio (battuta in sync con il video)' };
  }
  const body = text.id?.startsWith('tw-') ? [text.body, text.body, text.body].join('\n') : (text.body || '');
  const toks = copioneTokens(body);
  const genre = { copione: 'copione / recitazione', audiolibro: 'audiolibro / narrativa', articolo: 'testo informativo, spot o documentario', poesia: 'poesia', dizione: 'scioglilingua / esercizio di dizione', altro: 'lettura' }[text.type] || 'lettura';
  return { toks, text: body.replace(/\*/g, ''), genre: text.id?.startsWith('tw-') ? 'scioglilingua ripetuto 3 volte (lento, normale, veloce)' : genre };
}
// coppie riferimento → parole sentite (programmazione dinamica)
function dpPairs(a, b, eq) {
  const n = a.length, m = b.length;
  const D = Array.from({ length: n + 1 }, (_, i) => { const r = new Float32Array(m + 1); r[0] = -i; return r; });
  for (let j = 1; j <= m; j++) D[0][j] = -j;
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) D[i][j] = Math.max(D[i - 1][j - 1] + (eq(a[i - 1], b[j - 1]) ? 2 : -1), D[i - 1][j] - 1, D[i][j - 1] - 1);
  const map = new Array(n).fill(-1), sub = new Array(n).fill(-1), used = new Set();
  let i = n, j = m;
  while (i > 0 && j > 0) {
    const ok = eq(a[i - 1], b[j - 1]);
    if (D[i][j] === D[i - 1][j - 1] + (ok ? 2 : -1)) { (ok ? map : sub)[i - 1] = j - 1; used.add(j - 1); i--; j--; }
    else if (D[i][j] === D[i - 1][j] - 1) i--; else j--;
  }
  return { map, sub, ins: b.map((_, k) => k).filter((k) => !used.has(k)) };
}
// altezza della voce (Hz) ogni 10 ms, 0 = non vocalizzato
function pitchTrack(pcm, sr = 16000) {
  const win = 640, hop = 160, out = [];
  for (let i = 0; i + win < pcm.length; i += hop) {
    let e = 0; for (let k = i; k < i + win; k++) e += pcm[k] * pcm[k];
    if (Math.sqrt(e / win) < 0.01) { out.push(0); continue; }
    let best = 0, bl = 0;
    for (let lag = 40; lag <= 230; lag++) { // 70–400 Hz
      let c = 0, n1 = 0, n2 = 0;
      for (let k = i; k < i + win - lag; k += 2) { c += pcm[k] * pcm[k + lag]; n1 += pcm[k] * pcm[k]; n2 += pcm[k + lag] * pcm[k + lag]; }
      const r = c / Math.sqrt(n1 * n2 + 1e-9);
      if (r > best) { best = r; bl = lag; }
    }
    out.push(best > 0.55 ? sr / bl : 0);
  }
  return out;
}
// analisi oggettiva sul telefono
async function localAnalysis(take, text) {
  const { pcm, duration } = await decodeVideoAudio(take.blob);
  const ref = refFor(take, text);
  const R = { duration: +duration.toFixed(1), genre: ref.genre };
  if (!ref.toks.length) return { R, pcm, ref };
  const refN = ref.toks.map((t) => t.n);
  // 1. tempi delle parole (riconoscimento guidato dal testo)
  const timed = await transcribe(pcm, grammarOf(ref.text), null);
  const tp = dpPairs(refN, timed.map((w) => norm(w.w)), similar);
  const at = (i) => (i < ref.toks.length && tp.map[i] >= 0 ? timed[tp.map[i]] : null);
  // 2. ascolto severo senza aiuti: cosa hai detto davvero
  const free = await transcribe(pcm, null, null);
  const fp = dpPairs(refN, free.map((w) => norm(w.w)), (x, y) => x === y);
  R.heard = free.map((w) => w.w).join(' ');
  R.subs = []; R.miss = [];
  ref.toks.forEach((t, i) => {
    if (fp.map[i] >= 0) return;
    const t0 = at(i)?.s ?? (fp.sub[i] >= 0 ? free[fp.sub[i]].s : null);
    if (fp.sub[i] >= 0) R.subs.push({ ref: t.w, heard: free[fp.sub[i]].w, t: t0 });
    else if (!at(i)) {
      const last = R.miss.at(-1);
      const tPrev = (() => { for (let q = i - 1; q >= 0; q--) if (at(q)) return at(q).e; return 0; })();
      if (last && last.i1 === i - 1) { last.ref += ' ' + t.w; last.i1 = i; } else R.miss.push({ ref: t.w, t: +tPrev.toFixed(2), i0: i, i1: i });
    }
  });
  R.times = ref.toks.map((_, i) => (at(i) ? +at(i).s.toFixed(2) : null));
  R.ins = fp.ins.map((k) => ({ heard: free[k].w, t: free[k].s })).slice(0, 12);
  // 3. velocità e pause
  const hit = ref.toks.map((_, i) => at(i)).filter(Boolean);
  if (hit.length >= 3) {
    const speak = Math.max(0.5, hit.at(-1).e - hit[0].s);
    R.wpm = Math.round((hit.length / speak) * 60);
    R.coverage = Math.round((hit.length / ref.toks.length) * 100);
  }
  R.pauseMissed = []; R.pauseExtra = [];
  ref.toks.forEach((t, i) => {
    const a = at(i), b = at(i + 1); if (!a || !b) return;
    const gap = +(b.s - a.e).toFixed(2);
    if (t.pz) { const need = t.pz > 1 ? 0.55 : 0.22; if (gap < need) R.pauseMissed.push({ w: t.w, t: a.e, gap, need, i }); }
    else if (gap > 0.75 && !/[.,;:!?…»"]$/.test(t.w) && t.line === ref.toks[i + 1].line) R.pauseExtra.push({ w: t.w, t: a.e, gap, i });
  });
  // 4. intonazione e cadenza
  const f0 = pitchTrack(pcm);
  const voiced = f0.filter((x) => x > 0);
  if (voiced.length > 30) {
    const st = (hz) => 12 * Math.log2(hz / 100);
    const sorted = voiced.map(st).sort((x, y) => x - y);
    R.pitchRange = +(sorted[Math.floor(sorted.length * 0.9)] - sorted[Math.floor(sorted.length * 0.1)]).toFixed(1);
    R.rising = []; R.flatQ = [];
    const avg = (arr) => arr.reduce((x, y) => x + y, 0) / arr.length;
    ref.toks.forEach((t, i) => {
      const a = at(i); if (!a || !/[.!?…]["»]?$/.test(t.w)) return;
      const f = f0.slice(Math.floor(a.s * 100), Math.ceil(a.e * 100) + 1).filter((x) => x > 0).map(st);
      if (f.length < 6) return;
      const k = Math.max(2, Math.floor(f.length * 0.35));
      const slope = avg(f.slice(-k)) - avg(f.slice(0, k));
      if (/\?["»]?$/.test(t.w)) { if (slope < 0.8) R.flatQ.push({ w: t.w, t: a.s, slope: +slope.toFixed(1), i }); }
      else if (slope > 2) R.rising.push({ w: t.w, t: a.s, slope: +slope.toFixed(1), i });
    });
  }
  // 5. volume
  let peak = 0, clip = 0; for (const x of pcm) { const v = Math.abs(x); if (v > peak) peak = v; if (v > 0.985) clip++; }
  R.peakDb = +(20 * Math.log10(peak + 1e-9)).toFixed(1); R.clip = clip > pcm.length * 0.0005;
  return { R, pcm, ref };
}
// WAV 16 kHz mono per il coach
function wavBase64(pcm) {
  const n = pcm.length, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const w = (o, s2) => [...s2].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 16000, true); v.setUint32(28, 32000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, pcm[i])) * 0x7fff, true);
  const bytes = new Uint8Array(buf); let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
async function geminiModels(key) {
  const cached = ls.get('gmodels', null);
  const order = (x) => (COACH.model === 'flash' ? [...x.full, ...x.lite] : [...x.lite, ...x.full]);
  if (cached && cached.day === dayKey() && cached.k === key.slice(-6) && cached.full) return order(cached);
  const r = await fetch(`${GAPI}/models?pageSize=200`, { headers: { 'x-goog-api-key': key } });
  if (!r.ok) throw new Error(r.status === 400 || r.status === 403 ? 'Chiave non valida' : 'Google non risponde (' + r.status + ')');
  const js = await r.json();
  const ok = (js.models || []).filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map((m) => m.name.replace('models/', '')).filter((n) => /^gemini-[\d.]+-flash/.test(n) && !/(tts|image|live|audio|embed|exp|thinking)/.test(n));
  const ver = (n) => parseFloat(n.match(/gemini-([\d.]+)/)[1]);
  const byVer = (a, b) => ver(b) - ver(a) || a.length - b.length;
  const full = ok.filter((n) => !/lite/.test(n)).sort(byVer);
  const lite = ok.filter((n) => /lite/.test(n)).sort(byVer);
  const x = { day: dayKey(), k: key.slice(-6), full: full.slice(0, 2), lite: lite.slice(0, 2) };
  ls.set('gmodels', x);
  return order(x);
}
const COACH_SCHEMA = {
  type: 'OBJECT',
  properties: {
    sintesi: { type: 'STRING' },
    prima_cosa: { type: 'STRING' },
    errori: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
      parola: { type: 'STRING' }, contesto: { type: 'STRING' },
      tipo: { type: 'STRING', enum: ['pronuncia', 'accento', 'pausa_mancante', 'pausa_di_troppo', 'parola_saltata', 'parola_sbagliata', 'intonazione', 'ritmo', 'interpretazione', 'voce'] },
      spiegazione: { type: 'STRING' }, soluzione: { type: 'STRING' }, prova: { type: 'STRING' }, secondo: { type: 'NUMBER' },
      gravita: { type: 'INTEGER' }, certezza: { type: 'STRING', enum: ['alta', 'media', 'bassa'] } },
      required: ['parola', 'tipo', 'spiegazione', 'soluzione', 'gravita', 'certezza'] } },
    miglioramenti: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['sintesi', 'prima_cosa', 'errori', 'miglioramenti'],
};
function dizHints(text) {
  const seen = new Set(), out = [];
  for (const w of text.toLowerCase().split(/[^a-zà-ÿ]+/)) {
    if (!w || seen.has(w)) continue; seen.add(w);
    const r = dizWord(w);
    if (r?.double) out.push(`${w}: ${r.double} (decidi dal contesto)`);
    else if (r) out.push(`${w} → ${w.slice(0, r.i)}${r.ch}${w.slice(r.i + 1)} (${'èò'.includes(r.ch) ? 'aperta' : 'chiusa'})`);
  }
  return out.slice(0, 80);
}
function coachPrompt(L, prev) {
  const local = { ...L.R }; delete local.heard; delete local.times;
  return `Sei un insegnante italiano di dizione, lettura espressiva e doppiaggio. Stile: SERGENTE, cioè severo e diretto, ma parli in modo SEMPLICE, come a voce. L'allievo vuole lavorare come doppiatore e voce professionista e vuole sentirsi dire la verità.

Ascolta la registrazione allegata e confrontala con il TESTO DI RIFERIMENTO.

REGOLE
1. Segnala TUTTI gli errori veri, anche piccoli. Nessun complimento di cortesia. Non segnalare come errore una parola detta bene.
2. Pronuncia secondo la DIZIONE ITALIANA STANDARD (non regionale): accento tonico, vocali aperte/chiuse (è/é, ò/ó), s e z sorde/sonore, doppie, consonanti nette. Ogni inflessione regionale è un errore.
3. Per ogni errore:
   - "parola": la parola (o al massimo 4 parole) ESATTAMENTE come è scritta nel testo;
   - "contesto": le 2-3 parole che la PRECEDONO nel testo (serve a trovarla se è ripetuta);
   - "spiegazione": UNA frase semplice, in seconda persona, massimo 18 parole, senza termini tecnici, senza secondi e senza numeri. Esempi: «La e va chiusa: «vedérti», non «vedèrti».» · «Qui dovevi fermarti un attimo.» · «La r non vibra: sembra quasi una l.» · «Accento sbagliato: si dice «rùbrica», non «rubrìca».»
   - "soluzione": COME SI CORREGGE in pratica: cosa fare con bocca, labbra, lingua, respiro o voce. 1-2 frasi semplici, massimo 30 parole, concrete. Esempi: «Tieni la bocca poco aperta e gli angoli delle labbra leggermente tirati, come un mezzo sorriso.» · «Appoggia la punta della lingua dietro i denti di sopra e soffia: deve vibrare da sola.» · «Sull'ultima parola alza la voce, come se fossi sorpreso.»
   - "prova": un esercizio brevissimo per allenarlo (facoltativo, massimo 15 parole);
   - "secondo": il secondo dall'inizio della registrazione in cui succede;
   - "gravita" 1-3 (3 = grave); "certezza" alta/media/bassa (se non sei sicuro dillo, non inventare).
4. Valuta anche pause, ritmo, intonazione/cadenza e interpretazione rispetto al genere: ${L.ref.genre}. Per problemi che riguardano tutta la lettura (es. voce monotona) metti in "parola" la prima parola del pezzo interessato.
5. "miglioramenti": SOLO errori della volta precedente (elenco in fondo) che ora sono spariti, scritti in modo semplice. Altrimenti lista vuota.
6. "sintesi": una frase secca e semplice sul risultato. "prima_cosa": la UNA cosa da correggere per prima, in poche parole.
7. Usa le MISURE OGGETTIVE (calcolate sull'audio): non contraddirle.
8. Rispondi in italiano.

TESTO DI RIFERIMENTO:
«${L.ref.text.slice(0, 4000)}»

PRONUNCIA ATTESA DI ALCUNE PAROLE (dizione standard):
${dizHints(L.ref.text).join('\n') || '(nessuna indicazione)'}

MISURE OGGETTIVE (JSON):
${JSON.stringify(local)}

QUELLO CHE HA SENTITO IL RICONOSCITORE AUTOMATICO (può sbagliare):
${L.R.heard || '(niente)'}

PROBLEMI NOTI DELL'ALLIEVO (controllali in modo mirato, segnalali ogni volta che si ripresentano):
${(ls.get('coachNotes', []) || []).map((n) => '- ' + n).join('\n') || '(nessuno)'}

ERRORI DELLA VOLTA PRECEDENTE SU QUESTO TESTO:
${prev?.length ? prev.map((e) => `- «${e.parola}»: ${e.spiegazione || e.va_detto || ''}`).join('\n') : '(nessuna volta precedente)'}`;
}
// soluzioni pronte, quando il coach non ne scrive una
const FIX = {
  pronuncia: 'Dilla prima lentamente, sillaba per sillaba, esagerando il suono giusto; poi a velocità normale.',
  accento: 'Batti le mani sulla sillaba accentata mentre la dici, poi ripeti la parola tre volte.',
  pausa_mancante: 'Quando vedi la barra, chiudi la bocca e prendi un piccolo respiro dal naso, poi riparti.',
  pausa_lunga: 'Conta mentalmente «uno, due» e prendi fiato prima di ripartire.',
  pausa_di_troppo: 'Prendi fiato prima di iniziare la frase, così arrivi in fondo senza fermarti.',
  parola_saltata: 'Prima di registrare rileggi la frase a bassa voce e tieni lo sguardo una parola più avanti di quella che dici.',
  parola_sbagliata: 'Rileggi la frase a bassa voce prima di registrare, poi dilla guardando bene ogni parola.',
  domanda: 'Sull\'ultima parola alza la voce, come se fossi sorpreso.',
  sale: 'Sull\'ultima sillaba lascia scendere la voce, come se chiudessi una porta con calma.',
  intonazione: 'Pensa a come lo diresti parlando a un amico e riproduci quella melodia.',
  ritmo: 'Segna dove respirare e leggi un po\' più piano: ogni frase deve avere il suo tempo.',
  interpretazione: 'Prima di leggere chiediti a chi parli e cosa vuoi ottenere, poi dillo con quell\'intenzione.',
  voce: 'Respira con la pancia e sostieni la voce fino alla fine della frase.',
  piatta: 'Scegli una o due parole importanti per frase e dille un po\' più alte e più lente.',
  distorto: 'Allontanati di una spanna dal microfono o abbassa il guadagno della scheda audio.',
  basso: 'Avvicinati al microfono, a circa una spanna, e parla con la voce piena.',
};
// uniforma risposte vecchie e nuove, scarta quelle senza senso
function cleanAI(ai) {
  const n2 = (x) => norm(x || '');
  ai.errori = (ai.errori || []).map((e) => {
    let spiegazione = e.spiegazione;
    if (!spiegazione && e.va_detto) {
      if (e.hai_detto && n2(e.hai_detto) === n2(e.va_detto) && e.hai_detto.trim() === e.va_detto.trim()) return null;
      spiegazione = e.hai_detto ? `Si dice «${e.va_detto}», non «${e.hai_detto}».` : e.va_detto;
    }
    if (!spiegazione || !e.parola) return null;
    return { ...e, spiegazione, soluzione: e.soluzione || FIX[e.tipo] || '', prova: e.prova || e.esercizio || '' };
  }).filter(Boolean);
  ai.prima_cosa = ai.prima_cosa || ai.priorita || '';
  ai.miglioramenti = ai.miglioramenti || [];
  return ai;
}
async function geminiCoach(L, prev) {
  const key = COACH.key; if (!key) return null;
  const models = await geminiModels(key);
  if (!models.length) throw new Error('nessun modello Gemini disponibile per questa chiave');
  const body = JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: coachPrompt(L, prev) }, { inline_data: { mime_type: 'audio/wav', data: wavBase64(L.pcm) } }] }],
    generationConfig: { temperature: 0.2, responseMimeType: 'application/json', responseSchema: COACH_SCHEMA },
  });
  let lastErr = null;
  for (const model of models) {
    const r = await fetch(`${GAPI}/models/${model}:generateContent`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body });
    if (r.status === 429 || r.status === 503 || r.status === 404) { lastErr = new Error(r.status === 429 ? 'limite gratuito di oggi raggiunto' : 'modello non disponibile'); continue; }
    if (!r.ok) throw new Error('Gemini: errore ' + r.status);
    const js = await r.json();
    const txt = js.candidates?.[0]?.content?.parts?.map((x) => x.text || '').join('') || '';
    bumpCoachCount();
    return { ...cleanAI(JSON.parse(txt)), model };
  }
  throw lastErr || new Error('Gemini non disponibile');
}
async function runCoach(takeId, force) {
  if (COACH.running.has(takeId)) return;
  COACH.running.add(takeId); paintCoachBtn();
  try {
    const take = await DB.get('takes', takeId); if (!take) return;
    if (take.coach && !force) return take.coach;
    const text = await DB.get('texts', take.textId); if (!text) return;
    const L = await localAnalysis(take, text);
    const coach = { local: L.R, at: Date.now() };
    const prevs = (await DB.takesOf(take.textId)).filter((k) => k.id !== take.id && k.coach?.ai && k.createdAt < take.createdAt && k.anello === take.anello).sort((a, b) => b.createdAt - a.createdAt);
    if (COACH.key) { try { coach.ai = await geminiCoach(L, prevs[0]?.coach?.ai?.errori); } catch (e) { coach.aiError = String(e.message || e); } }
    else coach.aiError = 'nessuna chiave Gemini';
    const fresh = await DB.get('takes', takeId); if (!fresh) return;
    fresh.coach = coach;
    const v = coachView(fresh, text); coach.count = v.items.length + v.general.length;
    await DB.put('takes', fresh);
    if (S.lastTake?.id === takeId) S.lastTake.coach = coach;
    return coach;
  } catch (e) { console.error('coach', e); }
  finally {
    COACH.running.delete(takeId); paintCoachBtn();
    if ($('#sheetCoach').open && COACH.showing === takeId) DB.get('takes', takeId).then((k) => k && renderCoach(k));
  }
}
function coachQueue(takeId) { COACH.queue = COACH.queue.then(() => runCoach(takeId)).catch(() => {}); return COACH.queue; }
function paintCoachBtn() {
  const b = $('#ttCoach'); if (!b || !S.lastTake) return;
  const busy = COACH.running.has(S.lastTake.id);
  const n = S.lastTake.coach?.count;
  b.textContent = busy ? '🧠 …' : n != null ? `🧠 ${n}` : '🧠';
  b.classList.toggle('busy', busy);
}
const dec = (x, d = 1) => String(+x.toFixed(d)).replace('.', ',');

// «Penna rossa»: errori agganciati alle parole del testo
function coachView(take, text) {
  const c = take.coach || {}, R = c.local || {}, ai = c.ai;
  const ref = refFor(take, text), toks = ref.toks, times = R.times || [];
  const items = [], general = [];
  const taken = new Set();
  const add = (it) => {
    const key = `${it.kind}:${it.i1}`;
    if (taken.has(key)) return;
    taken.add(key); items.push(it);
  };
  const tAt = (i, fallback) => (times[i] != null ? times[i] : fallback ?? null);
  const find = (parola, contesto, sec) => {
    const pw = String(parola || '').split(/\s+/).map(norm).filter(Boolean).slice(0, 6);
    if (!pw.length) return null;
    const cands = [];
    for (let i = 0; i + pw.length <= toks.length; i++) {
      let ok = true;
      for (let k = 0; k < pw.length; k++) if (toks[i + k].n !== pw[k] && !similar(toks[i + k].n, pw[k])) { ok = false; break; }
      if (ok) cands.push(i);
    }
    if (!cands.length) return null;
    const ctx = String(contesto || '').split(/\s+/).map(norm).filter(Boolean);
    const score = (i) => {
      let s = 0;
      for (const w of ctx) for (let q = Math.max(0, i - 5); q < i; q++) if (toks[q].n === w) s += 2;
      if (sec != null && times[i] != null) s -= Math.abs(times[i] - sec) / 3;
      return s;
    };
    const best = cands.sort((a, b) => score(b) - score(a))[0];
    return { i0: best, i1: best + pw.length - 1 };
  };
  if (ai) for (const e of ai.errori) {
    const pos = find(e.parola, e.contesto, e.secondo);
    const unsure = e.certezza === 'bassa';
    const msg = unsure ? 'Forse ' + e.spiegazione.charAt(0).toLowerCase() + e.spiegazione.slice(1) : e.spiegazione;
    if (!pos) { if (['intonazione', 'ritmo', 'interpretazione', 'voce'].includes(e.tipo)) general.push({ msg, fix: e.soluzione, prova: e.prova, t: e.secondo ?? null }); continue; } // parola non presente nel testo: abbaglio
    const kind = e.tipo === 'pausa_mancante' ? 'pause' : e.tipo === 'parola_saltata' ? 'skip' : 'word';
    if (kind === 'pause' && toks[pos.i1]?.pz && times[pos.i1] != null && times[pos.i1 + 1] != null && !(R.pauseMissed || []).some((p) => p.i === pos.i1)) continue; // il telefono ha misurato la pausa: non è un errore
    add({ ...pos, kind, msg, fix: (e.soluzione && e.soluzione !== FIX[e.tipo] ? e.soluzione : null) || (e.tipo === 'intonazione' && /\?/.test(toks[pos.i1]?.w || '') ? FIX.domanda : FIX[e.tipo]), prova: e.prova, t: tAt(pos.i0, e.secondo) });
  }
  for (const m of R.miss || []) if (m.i0 != null) add({ i0: m.i0, i1: m.i1, kind: 'skip', msg: m.i1 > m.i0 ? 'Hai saltato queste parole.' : 'Hai saltato questa parola.', fix: FIX.parola_saltata, t: m.t });
  for (const p of R.pauseMissed || []) if (p.i != null) add({ i0: p.i, i1: p.i, kind: 'pause', msg: p.need > 0.5 ? 'Qui serviva una pausa lunga.' : 'Qui dovevi fermarti un attimo.', fix: p.need > 0.5 ? FIX.pausa_lunga : FIX.pausa_mancante, t: tAt(p.i, p.t) });
  for (const p of R.pauseExtra || []) if (p.i != null) add({ i0: p.i, i1: p.i, kind: 'word', msg: 'Qui ti sei fermato senza motivo: la frase va detta tutta di seguito.', fix: FIX.pausa_di_troppo, t: tAt(p.i, p.t) });
  for (const p of R.rising || []) if (p.i != null) add({ i0: p.i, i1: p.i, kind: 'word', msg: 'Qui la voce sale come in una domanda: a fine frase deve scendere.', fix: FIX.sale, t: tAt(p.i, p.t) });
  for (const p of R.flatQ || []) if (p.i != null) add({ i0: p.i, i1: p.i, kind: 'word', msg: 'È una domanda: alla fine la voce deve salire.', fix: FIX.domanda, t: tAt(p.i, p.t) });
  if (R.pitchRange != null && R.pitchRange < 4) general.push({ msg: 'Voce troppo piatta: fai salire e scendere di più la voce.', fix: FIX.piatta });
  if (R.clip) general.push({ msg: 'Audio distorto.', fix: FIX.distorto });
  else if (R.peakDb != null && R.peakDb < -18) general.push({ msg: 'Volume basso.', fix: FIX.basso });
  items.sort((a, b) => a.i0 - b.i0 || a.i1 - b.i1);
  items.forEach((it, k) => (it.n = k + 1));
  return { toks, items, general };
}
async function openCoach(takeId) {
  const take = await DB.get('takes', takeId); if (!take) return;
  COACH.showing = takeId;
  await renderCoach(take);
  open('#sheetCoach');
  $('#sheetCoach').scrollTop = 0;
  if (!take.coach && !COACH.running.has(takeId)) { runCoach(takeId); renderCoach(take); }
}
async function renderCoach(take) {
  const c = take.coach, ai = c?.ai, R = c?.local || {};
  const busy = COACH.running.has(take.id);
  const text = await DB.get('texts', take.textId);
  let h = '';
  if (!c || !text) h = `<div class="empty-note">${busy ? '🧠 Ti sto ascoltando con attenzione…' : 'Nessuna analisi ancora.'}</div>`;
  else {
    const { toks, items, general } = coachView(take, text);
    const verdict = ai ? esc(ai.sintesi || '') : items.length || general.length ? `Ho trovato ${items.length + general.length} cose da sistemare.` : 'Non ho trovato errori misurabili.';
    h += `<div class="pr-verdict">${verdict}${ai?.prima_cosa ? ` <b>Prima cosa: ${esc(ai.prima_cosa)}</b>` : ''}</div>`;
    if (!ai) h += `<div class="pr-note">${COACH.key ? `Il coach AI non ha risposto (${esc(c.aiError || '')}): qui vedi solo quello che misura il telefono.` : 'Per il giudizio su accenti e vocali aperte/chiuse inserisci la chiave Gemini in ⚙️ Impostazioni.'}</div>`;
    if (items.length) {
      // testo con la penna rossa: solo le righe con errori (tutte se il testo è corto)
      const byLine = {};
      toks.forEach((t, i) => (byLine[t.line] ||= []).push(i));
      const lines = Object.keys(byLine).map(Number).sort((a, b) => a - b);
      const hot = new Set(items.flatMap((it) => [toks[it.i0]?.line, toks[it.i1]?.line]));
      const showAll = toks.length <= 60;
      const markAt = {}; items.forEach((it) => { for (let q = it.i0; q <= it.i1; q++) (markAt[q] ||= []).push(it); });
      let paper = '', gap = false;
      for (const L of lines) {
        if (!showAll && !hot.has(L)) { if (!gap) paper += '<span class="pr-gap">…</span><br>'; gap = true; continue; }
        gap = false;
        paper += byLine[L].map((i) => {
          const ms = markAt[i] || [];
          const w = esc(toks[i].w);
          let s = ms.length ? `<span class="pr-mk${ms.some((m) => m.kind === 'skip') ? ' skip' : ''}">${w}</span>` : w;
          for (const m of ms.filter((m) => m.i1 === i)) s += `<span class="pr-n">${m.n}</span>${m.kind === 'pause' ? '<span class="pr-stop">‖</span>' : ''}`;
          return s;
        }).join(' ') + '<br>';
      }
      h += `<div class="pr-paper">${paper}</div>`;
      h += `<div class="pr-notes">` + items.map((it) => `<div class="pr-item"><span class="pr-n big">${it.n}</span><div>
        <div class="pr-msg">${esc(it.msg)}</div>${it.fix ? `<div class="pr-fix"><b>Come si fa</b>${esc(it.fix)}</div>` : ''}${it.prova ? `<div class="pr-try">Prova: ${esc(it.prova)}</div>` : ''}
        ${it.t != null ? `<button class="pr-play" data-at="${it.t}">▶ Riascoltati</button>` : ''}</div></div>`).join('') + `</div>`;
    }
    if (general.length) h += `<div class="pr-notes">` + general.map((g) => `<div class="pr-item"><span class="pr-n big dot">•</span><div><div class="pr-msg">${esc(g.msg)}</div>${g.fix ? `<div class="pr-fix"><b>Come si fa</b>${esc(g.fix)}</div>` : ''}${g.prova ? `<div class="pr-try">Prova: ${esc(g.prova)}</div>` : ''}${g.t != null ? `<button class="pr-play" data-at="${g.t}">▶ Riascoltati</button>` : ''}</div></div>`).join('') + `</div>`;
    if (ai?.miglioramenti?.length) h += `<div class="pr-better"><b>Migliorato dalla volta scorsa</b>${ai.miglioramenti.map((m) => `<div>✓ ${esc(m)}</div>`).join('')}</div>`;
    h += `<details class="pr-tech"><summary>Dettagli tecnici</summary><div>${R.wpm ? `${R.wpm} parole al minuto · ` : ''}${R.pitchRange != null ? `escursione voce ${dec(R.pitchRange)} semitoni · ` : ''}${R.peakDb != null ? `picco ${R.peakDb} dB` : ''}${ai?.model ? `<br>Analisi: ${esc(ai.model)} · ${coachCount()} oggi` : ''}</div></details>`;
  }
  h += `<div class="co-actions"><button class="cta small" id="coAsk">💬 Chiedi al coach</button><button class="cta small ghost" id="coRedo">${busy ? 'Analisi in corso…' : '🔄 Rifai'}</button></div>`;
  $('#coachBody').innerHTML = h;
  $('#coachBody').dataset.take = take.id;
  $('#coachSub').textContent = text ? `${text.title}${take.anello != null ? ` · anello ${take.anello + 1}` : ''}` : '';
}
$('#coachBody').addEventListener('click', async (e) => {
  const id = $('#coachBody').dataset.take;
  const t = e.target.closest('[data-at]');
  if (t) {
    const k = await DB.get('takes', id); stopPlayer();
    const url = URL.createObjectURL(k.blob); const a = new Audio(url);
    S.player = { id: 'co', audio: a, url };
    a.currentTime = Math.max(0, +t.dataset.at - 0.6); a.play();
    setTimeout(() => { if (S.player?.audio === a) stopPlayer(); }, 4000);
  }
  if (e.target.id === 'coAsk') { $('#sheetCoach').close(); return openChat(id); }
  if (e.target.id === 'coRedo' && !COACH.running.has(id)) { runCoach(id, true); renderCoach(await DB.get('takes', id)); }
});
$('#ttCoach').onclick = () => S.lastTake && openCoach(S.lastTake.id);
// impostazioni coach
function paintCoachSettings() {
  $('#gkey').value = COACH.key ? '••••••••' + COACH.key.slice(-4) : '';
  $('#coachAuto').checked = COACH.auto;
  $('#coachInfo').textContent = COACH.key ? `✓ Coach AI attivo · analisi fatte oggi: ${coachCount()}` : 'Senza chiave il coach usa solo le misure fatte sul telefono.';
}
$('#gkeySave').onclick = async () => {
  const v = $('#gkey').value.trim();
  if (!v || v.startsWith('••')) return;
  $('#coachInfo').textContent = 'Controllo la chiave…';
  try { ls.set('gmodels', null); const list = await geminiModels(v); COACH.key = v; ls.set('gkey', v); paintCoachSettings(); $('#coachInfo').textContent = `✓ Chiave valida. Modelli: ${list.join(', ')}`; }
  catch (e) { $('#coachInfo').textContent = '✗ ' + (e.message || e); }
};
$('#gkeyDel').onclick = () => { COACH.key = ''; ls.set('gkey', ''); ls.set('gmodels', null); paintCoachSettings(); };
$('#coachAuto').onchange = (e) => { COACH.auto = e.target.checked; ls.set('coachAuto', COACH.auto); };
document.querySelectorAll('[name=coachModel]').forEach((r) => { r.checked = r.value === COACH.model; r.onchange = () => { COACH.model = r.value; ls.set('coachModel', COACH.model); }; });
paintCoachSettings();

/* ---------- chat con il coach ---------- */
const CHAT = { hist: ls.get('chat', []), notes: ls.get('coachNotes', []), audio: null, rec: null, take: null, busy: false };
const CHAT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    risposta: { type: 'STRING' },
    nuove_note: { type: 'ARRAY', items: { type: 'STRING' } },
    esercizi: { type: 'ARRAY', items: { type: 'OBJECT', properties: { titolo: { type: 'STRING' }, testo: { type: 'STRING' } }, required: ['titolo', 'testo'] } },
  },
  required: ['risposta', 'nuove_note', 'esercizi'],
};
function notesText() { return CHAT.notes.length ? CHAT.notes.map((n) => '- ' + n).join('\n') : '(ancora nessuna)'; }
async function recentErrors() {
  const since = Date.now() - 14 * 86400000;
  const ks = (await DB.all('takes')).filter((k) => k.createdAt > since && k.coach?.ai?.errori?.length);
  const by = {};
  for (const k of ks) for (const e of k.coach.ai.errori) { const key = `«${e.parola}»: ${e.spiegazione || e.va_detto || ''}`; by[key] = (by[key] || 0) + 1; }
  return Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, n]) => `- ${k}${n > 1 ? ` (×${n})` : ''}`).join('\n') || '(nessuna analisi recente)';
}
async function chatSystem() {
  let takeCtx = '';
  if (CHAT.take) {
    const k = await DB.get('takes', CHAT.take); const t = k && (await DB.get('texts', k.textId));
    if (k?.coach) takeCtx = `\n\nL'ALLIEVO STA PARLANDO DI QUESTA TAKE («${t?.title || ''}»). Report:\n${JSON.stringify({ ai: k.coach.ai ? { sintesi: k.coach.ai.sintesi, errori: k.coach.ai.errori } : null, misure: { ...k.coach.local, heard: undefined } })}`;
  }
  return `Sei il coach personale di dizione, lettura espressiva e doppiaggio dell'allievo. Stile SERGENTE: diretto, severo, concreto, niente complimenti di cortesia. L'allievo ha fatto un corso di doppiaggio, è principiante e vuole lavorare come doppiatore e voce professionista, anche da remoto. Riferimento: dizione italiana standard; ogni inflessione regionale va corretta.

Quando l'allievo ti descrive un problema (es. un'inflessione) o ti manda una registrazione:
- spiega in modo preciso cosa succede (quali suoni, quali parole, perché), senza giri di parole;
- se mandata una registrazione, giudica quello che senti davvero, con i secondi;
- dai 1-3 esercizi pratici e brevi in "esercizi" (titolo + testo da leggere ad alta voce, con le pause / e // e le parole chiave tra *asterischi* se servono);
- in "nuove_note" metti SOLO fatti nuovi e stabili sull'allievo da ricordare (es. "tende ad aprire la e di bene/sempre"), frasi brevi; lista vuota se non c'è niente di nuovo;
- "risposta": testo semplice, frasi brevi, niente markdown, al massimo 120 parole.

COSA SAI GIÀ DELL'ALLIEVO:
${notesText()}

ERRORI PIÙ FREQUENTI NELLE ULTIME DUE SETTIMANE (dal coach automatico):
${await recentErrors()}${takeCtx}`;
}
function renderChat() {
  $('#chatNotes').innerHTML = CHAT.notes.length
    ? `<div class="cn-h">Cosa so di te</div>` + CHAT.notes.map((n, i) => `<span class="cn">${esc(n)}<button data-rmnote="${i}" aria-label="Dimentica">✕</button></span>`).join('')
    : '';
  const list = $('#chatList');
  list.innerHTML = (CHAT.hist.length ? '' : `<div class="msg c"><p>Dimmi cosa senti che non va: un'inflessione, una lettera, un ritmo. Se vuoi registrati con 🎙️ e lo ascolto. Più sei preciso, più sono utile.</p></div>`) +
    CHAT.hist.map((m, i) => `<div class="msg ${m.r === 'user' ? 'u' : 'c'}">${m.audio ? '<span class="m-a">🎙️ registrazione</span>' : ''}<p>${esc(m.t).replace(/\n/g, '<br>')}</p>${(m.ex || []).map((x, j) => `<div class="m-ex"><b>${esc(x.titolo)}</b><span>${esc(x.testo).replace(/\n/g, '<br>')}</span><button class="link2" data-ex="${i}:${j}">＋ Aggiungi ai miei testi</button></div>`).join('')}</div>`).join('') +
    (CHAT.busy ? '<div class="msg c"><p class="typing">sto ascoltando…</p></div>' : '');
  list.scrollTop = list.scrollHeight;
  $('#chatAtt').hidden = !CHAT.audio;
  if (CHAT.audio) $('#chatAtt').innerHTML = `🎙️ registrazione pronta (${fmt(CHAT.audio.dur)}) <button id="chatAttRm">✕</button>`;
  $('#chatAttRm') && ($('#chatAttRm').onclick = () => { CHAT.audio = null; renderChat(); });
  $('#chatCtx').hidden = !CHAT.take;
  $('#chatSend').disabled = CHAT.busy;
}
function openChat(takeId) {
  CHAT.take = takeId || null;
  if (!COACH.key) { $('#chatList').innerHTML = `<div class="msg c"><p>Per parlare con il coach serve la chiave gratuita di Gemini: ⚙️ Impostazioni → Coach AI.</p></div>`; $('#chatNotes').innerHTML = ''; open('#sheetChat'); return; }
  renderChat(); open('#sheetChat');
  setTimeout(() => $('#chatIn').focus(), 200);
}
async function sendChat() {
  const txt = $('#chatIn').value.trim();
  if ((!txt && !CHAT.audio) || CHAT.busy || !COACH.key) return;
  const audio = CHAT.audio; CHAT.audio = null;
  CHAT.hist.push({ r: 'user', t: txt || '(ascolta la registrazione)', audio: !!audio });
  $('#chatIn').value = '';
  CHAT.busy = true; renderChat();
  try {
    const models = await geminiModels(COACH.key);
    const contents = CHAT.hist.slice(-20).map((m, i, arr) => {
      const parts = [{ text: m.t }];
      if (i === arr.length - 1 && audio) parts.push({ inline_data: { mime_type: 'audio/wav', data: audio.b64 } });
      return { role: m.r === 'user' ? 'user' : 'model', parts };
    });
    const body = JSON.stringify({ system_instruction: { parts: [{ text: await chatSystem() }] }, contents, generationConfig: { temperature: 0.4, responseMimeType: 'application/json', responseSchema: CHAT_SCHEMA } });
    let out = null, lastErr = null;
    for (const model of models) {
      const r = await fetch(`${GAPI}/models/${model}:generateContent`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': COACH.key }, body });
      if (r.status === 429 || r.status === 503 || r.status === 404) { lastErr = new Error(r.status === 429 ? 'limite gratuito di oggi raggiunto' : 'modello non disponibile'); continue; }
      if (!r.ok) throw new Error('errore ' + r.status);
      const js = await r.json();
      out = JSON.parse(js.candidates?.[0]?.content?.parts?.map((x) => x.text || '').join('') || '{}');
      bumpCoachCount(); break;
    }
    if (!out) throw lastErr || new Error('Gemini non disponibile');
    CHAT.hist.push({ r: 'model', t: out.risposta || '…', ex: out.esercizi || [] });
    for (const n of out.nuove_note || []) if (n && !CHAT.notes.includes(n)) CHAT.notes.push(n);
    CHAT.notes = CHAT.notes.slice(-25);
  } catch (e) {
    CHAT.hist.push({ r: 'model', t: `Non riesco a rispondere: ${e.message || e}.` });
  }
  CHAT.hist = CHAT.hist.slice(-60);
  ls.set('chat', CHAT.hist.map(({ r, t, ex, audio: a }) => ({ r, t, ex, audio: a }))); ls.set('coachNotes', CHAT.notes);
  CHAT.busy = false; renderChat();
}
$('#chatSend').onclick = sendChat;
$('#chatIn').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } });
$('#chatMic').onclick = async () => {
  if (CHAT.rec) { CHAT.rec.stop(); return; }
  let stream; try { stream = await openMic(); } catch { return; }
  const mime = pickMime(); const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : {});
  const chunks = []; const t0 = performance.now();
  mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  mr.onstop = async () => {
    stream.getTracks().forEach((t) => t.stop()); CHAT.rec = null; $('#chatMic').classList.remove('on'); $('#chatMic').textContent = '🎙️';
    try { const { pcm } = await decodeVideoAudio(new Blob(chunks, { type: mr.mimeType })); CHAT.audio = { b64: wavBase64(pcm), dur: performance.now() - t0 }; } catch { CHAT.audio = null; }
    renderChat();
  };
  mr.start(); CHAT.rec = mr; $('#chatMic').classList.add('on'); $('#chatMic').textContent = '■';
};
$('#chatList').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-ex]'); if (!b) return;
  const [i, j] = b.dataset.ex.split(':').map(Number); const x = CHAT.hist[i]?.ex?.[j]; if (!x) return;
  const t = { id: uid(), title: x.titolo, type: 'dizione', body: x.testo, video: null, createdAt: Date.now(), lastUsed: Date.now() };
  await DB.put('texts', t); b.textContent = '✓ Aggiunto'; b.disabled = true;
  setTimeout(async () => { $('#sheetChat').close(); await selectText(t.id); }, 600);
});
$('#chatNotes').addEventListener('click', (e) => {
  const b = e.target.closest('[data-rmnote]'); if (!b) return;
  CHAT.notes.splice(+b.dataset.rmnote, 1); ls.set('coachNotes', CHAT.notes); renderChat();
});
$('#chatClear').onclick = () => { if (!confirm('Cancellare la conversazione? (Le cose che il coach sa di te restano.)')) return; CHAT.hist = []; ls.set('chat', []); renderChat(); };
$('#btnChat').onclick = () => openChat();

/* ---------- backup su Google Drive ---------- */
const GD_DEFAULT_CLIENT = '850459069167-um4pv9vtnoniap3int1pao0hff6ifg6r.apps.googleusercontent.com';
const GD_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const GDAPI = 'https://www.googleapis.com/drive/v3';
const GDUP = 'https://www.googleapis.com/upload/drive/v3';
const GD = {
  client: ls.get('gdClient', '') || GD_DEFAULT_CLIENT, token: null, exp: 0, tc: null, pending: null,
  on: ls.get('gdOn', false), auto: ls.get('gdAuto', true), video: ls.get('gdVideo', false),
  state: ls.get('gdState', {}), map: ls.get('gdMap', {}), busy: false,
};
const gdSave = () => { ls.set('gdState', GD.state); ls.set('gdMap', GD.map); ls.set('gdOn', GD.on); };
function gdLoad() { return window.google?.accounts?.oauth2 ? Promise.resolve() : loadScript('https://accounts.google.com/gsi/client'); }
function gdTokenValid() { return GD.token && Date.now() < GD.exp - 60000; }
// chiede il permesso a Google (popup): va chiamata da un tocco dell'utente
function gdAuth(consent) {
  if (gdTokenValid()) return Promise.resolve(GD.token);
  if (!GD.client) return Promise.reject(new Error('manca l\'ID client di Google'));
  if (!window.google?.accounts?.oauth2) return Promise.reject(new Error('Google non è ancora pronto, riprova tra un secondo'));
  return new Promise((res, rej) => {
    GD.tc = google.accounts.oauth2.initTokenClient({
      client_id: GD.client, scope: GD_SCOPE,
      callback: (r) => {
        if (r.error || !r.access_token) return rej(new Error(r.error_description || r.error || 'accesso negato'));
        GD.token = r.access_token; GD.exp = Date.now() + (r.expires_in || 3600) * 1000; res(GD.token);
      },
      error_callback: (e) => rej(new Error(e?.type === 'popup_closed' ? 'finestra di Google chiusa' : e?.message || 'accesso non riuscito')),
    });
    GD.tc.requestAccessToken({ prompt: consent || !GD.on ? 'consent' : '' });
  });
}
async function gdFetch(url, opt = {}) {
  const r = await fetch(url, { ...opt, headers: { ...(opt.headers || {}), Authorization: `Bearer ${GD.token}` } });
  if (r.status === 401) { GD.token = null; throw new Error('accesso a Google scaduto: tocca di nuovo «Salva ora»'); }
  if (!r.ok) throw new Error(`Google Drive: errore ${r.status}`);
  return r;
}
async function gdFolder() {
  if (GD.state.folder) {
    try { const r = await gdFetch(`${GDAPI}/files/${GD.state.folder}?fields=id,trashed`); const j = await r.json(); if (!j.trashed) return GD.state.folder; } catch {}
  }
  const q = encodeURIComponent("name='VActor' and mimeType='application/vnd.google-apps.folder' and trashed=false");
  const found = await (await gdFetch(`${GDAPI}/files?q=${q}&fields=files(id)&spaces=drive`)).json();
  if (found.files?.length) { GD.state.folder = found.files[0].id; return GD.state.folder; }
  const made = await (await gdFetch(`${GDAPI}/files?fields=id`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'VActor', mimeType: 'application/vnd.google-apps.folder' }) })).json();
  GD.state.folder = made.id; return made.id;
}
async function gdFind(name, folder) {
  const q = encodeURIComponent(`name='${name}' and '${folder}' in parents and trashed=false`);
  const j = await (await gdFetch(`${GDAPI}/files?q=${q}&fields=files(id)&spaces=drive`)).json();
  return j.files?.[0]?.id || null;
}
async function gdUpload(blob, name, folder, existingId) {
  const type = blob.type || 'application/octet-stream';
  const meta = existingId ? {} : { name, parents: [folder] };
  const start = await gdFetch(existingId ? `${GDUP}/files/${existingId}?uploadType=resumable` : `${GDUP}/files?uploadType=resumable&fields=id`, {
    method: existingId ? 'PATCH' : 'POST',
    headers: { 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': type, 'X-Upload-Content-Length': String(blob.size) },
    body: JSON.stringify(meta),
  });
  const loc = start.headers.get('Location');
  if (!loc) throw new Error('Google Drive non ha accettato il caricamento');
  const r = await gdFetch(loc, { method: 'PUT', headers: { 'Content-Type': type }, body: blob });
  const j = await r.json().catch(() => ({}));
  return j.id || existingId;
}
const takeFileName = (k) => `take-${k.id}.${ext(k.mime || 'audio/webm')}`;
const videoExt = (b) => (/mp4/.test(b.type) ? 'mp4' : /quicktime/.test(b.type) ? 'mov' : 'webm');
function gdMsg(t) { const m = $('#gdMsg'); if (m) m.textContent = t || ''; }
// backup incrementale: carica solo ciò che manca, poi l'indice dei dati
async function gdBackup(onMsg = gdMsg) {
  if (GD.busy) return null;
  GD.busy = true; paintDrive();
  try {
    const [texts, takes] = await Promise.all([DB.all('texts'), DB.all('takes')]);
    const folder = await gdFolder();
    if (!takes.length && !Object.keys(GD.map).length && (await gdFind('vactor-data.json', folder))) throw new Error('su Drive c\'è già un backup e qui il telefono è vuoto: usa prima «Ripristina»');
    let nNew = 0;
    const todo = takes.filter((k) => !GD.map[k.id]);
    for (const [i, k] of todo.entries()) {
      onMsg(`Carico le registrazioni… ${i + 1} di ${todo.length}`);
      GD.map[k.id] = await gdUpload(k.blob, takeFileName(k), folder); nNew++;
      if (i % 5 === 4) gdSave();
    }
    if (GD.video) for (const t of texts.filter((x) => x.video && !GD.map['v-' + x.id])) {
      onMsg(`Carico il video «${t.title}»…`);
      GD.map['v-' + t.id] = await gdUpload(t.video, `video-${t.id}.${videoExt(t.video)}`, folder);
    }
    // registrazioni eliminate su questo telefono: le tolgo anche da Drive
    const alive = new Set([...takes.map((k) => k.id), ...texts.map((t) => 'v-' + t.id)]);
    for (const [id, fid] of Object.entries(GD.map)) if (!alive.has(id)) { try { await gdFetch(`${GDAPI}/files/${fid}`, { method: 'DELETE' }); } catch {} delete GD.map[id]; }
    onMsg('Salvo l\'indice…');
    const data = {
      app: 'VActor', version: 1, at: Date.now(),
      texts: texts.map(({ video, ...t }) => ({ ...t, hasVideo: !!video, videoFile: GD.map['v-' + t.id] || null, videoName: t.videoName || null, videoType: video?.type || null })),
      takes: takes.map(({ blob, n, ...k }) => ({ ...k, file: GD.map[k.id] })),
      settings: Object.fromEntries(['chat', 'coachNotes', 'routineLog', 'remind', 'coachCount', 'font', 'speed', 'mode', 'diz', 'follow2', 'coachModel', 'coachAuto'].map((x) => [x, ls.get(x, null)])),
    };
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    GD.state.index = await gdUpload(blob, 'vactor-data.json', folder, GD.state.index || (await gdFind('vactor-data.json', folder)));
    try { const a = await (await gdFetch(`${GDAPI}/about?fields=storageQuota`)).json(); GD.state.quota = a.storageQuota; } catch {}
    GD.state.last = Date.now(); GD.state.counts = { takes: takes.length, texts: texts.length };
    gdSave();
    onMsg(nNew ? `✓ Salvate ${nNew} nuove registrazioni su Drive` : '✓ Tutto già salvato su Drive');
    return nNew;
  } finally { GD.busy = false; paintDrive(); }
}
async function gdRestore() {
  if (GD.busy) return;
  GD.busy = true; paintDrive();
  try {
    const folder = await gdFolder();
    const idx = await gdFind('vactor-data.json', folder);
    if (!idx) throw new Error('su questo Drive non c\'è ancora nessun backup di VActor');
    gdMsg('Leggo il backup…');
    const data = await (await gdFetch(`${GDAPI}/files/${idx}?alt=media`)).json();
    GD.state.index = idx;
    let nt = 0, nk = 0;
    const local = await DB.all('texts'), remap = {};
    for (const t of data.texts || []) {
      if (await DB.get('texts', t.id)) continue;
      const twin = local.find((x) => x.title === t.title && (x.body || '') === (t.body || '') && !x.video === !t.hasVideo);
      if (twin) { remap[t.id] = twin.id; continue; } // stesso testo già presente (es. quelli di esempio)
      const { hasVideo, videoFile, videoType, ...rest } = t;
      let video = null;
      if (videoFile) { gdMsg(`Scarico il video «${t.title}»…`); video = await (await gdFetch(`${GDAPI}/files/${videoFile}?alt=media`)).blob(); if (videoType) video = new Blob([video], { type: videoType }); GD.map['v-' + t.id] = videoFile; }
      await DB.put('texts', { ...rest, video }); nt++;
    }
    const takes = data.takes || [];
    for (const [i, k] of takes.entries()) {
      if (await DB.get('takes', k.id) || !k.file) continue;
      gdMsg(`Scarico le registrazioni… ${i + 1} di ${takes.length}`);
      const b = await (await gdFetch(`${GDAPI}/files/${k.file}?alt=media`)).blob();
      const { file, ...rest } = k;
      await DB.put('takes', { ...rest, textId: remap[rest.textId] || rest.textId, blob: new Blob([b], { type: k.mime || 'audio/webm' }) });
      GD.map[k.id] = k.file; nk++;
    }
    for (const [key, v] of Object.entries(data.settings || {})) if (v != null && ls.get(key, null) == null) ls.set(key, v);
    GD.on = true; GD.state.last = data.at; gdSave();
    gdMsg(`✓ Ripristinati ${nt} testi e ${nk} registrazioni`);
    const all = (await DB.all('texts')).sort((a, b) => b.lastUsed - a.lastUsed);
    if (all[0]) await selectText(S.text?.id || all[0].id);
    CHAT.hist = ls.get('chat', []); CHAT.notes = ls.get('coachNotes', []);
    paintRoutineBtn();
  } finally { GD.busy = false; paintDrive(); }
}
function fmtGB(b) { const g = b / 1073741824; return g >= 1 ? `${dec(g)} GB` : `${Math.round(b / 1048576)} MB`; }
function paintDrive() {
  if (!$('#gdBox')) return;
  $('#gdClientRow').hidden = !!GD_DEFAULT_CLIENT || (GD.on && !!GD.client);
  $('#gdOff').hidden = GD.on; $('#gdOn').hidden = !GD.on;
  $('#gdAuto').checked = GD.auto; $('#gdVideo').checked = GD.video;
  const st = GD.state;
  if (GD.on) {
    const when = st.last ? new Date(st.last) : null;
    const today = when && when.toDateString() === new Date().toDateString();
    $('#gdStatusT').textContent = GD.busy ? 'Salvataggio in corso…' : when ? `Tutto salvato · ${today ? 'oggi' : when.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} alle ${when.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}` : 'Collegato, nessun backup ancora';
    const q = st.quota;
    $('#gdStatusS').textContent = [st.counts ? `${st.counts.takes} registrazioni · ${st.counts.texts} testi` : '', q?.limit ? `${fmtGB(+q.usage)} su ${fmtGB(+q.limit)}` : ''].filter(Boolean).join(' · ');
    $('#gdBar').style.transform = `scaleX(${q?.limit ? Math.min(1, q.usage / q.limit) : 0})`;
    $('#gdIcon').textContent = GD.busy ? '…' : '✓';
  }
  ['#gdConnect', '#gdRestore1', '#gdSaveNow', '#gdRestore2'].forEach((s) => { const b = $(s); if (b) b.disabled = GD.busy; });
}
async function gdAction(fn, consent) {
  gdMsg('');
  try {
    if (!GD.client) { const v = $('#gdClientIn').value.trim(); if (!/\.apps\.googleusercontent\.com$/.test(v)) throw new Error('incolla prima l\'ID client (finisce con .apps.googleusercontent.com)'); GD.client = v; ls.set('gdClient', v); }
    await gdLoad();
    await gdAuth(consent);
    await fn();
  } catch (e) { gdMsg('✗ ' + (e.message || e)); GD.busy = false; paintDrive(); }
}
$('#gdConnect').onclick = () => gdAction(async () => { GD.on = true; gdSave(); paintDrive(); await gdBackup(); }, true);
$('#gdRestore1').onclick = () => gdAction(gdRestore, true);
$('#gdSaveNow').onclick = () => gdAction(() => gdBackup());
$('#gdRestore2').onclick = () => gdAction(gdRestore);
$('#gdAuto').onchange = (e) => { GD.auto = e.target.checked; ls.set('gdAuto', GD.auto); };
$('#gdVideo').onchange = (e) => { GD.video = e.target.checked; ls.set('gdVideo', GD.video); };
$('#gdLogout').onclick = () => {
  if (!confirm('Scollegare Google Drive? Il backup già fatto resta su Drive.')) return;
  try { if (GD.token) google.accounts.oauth2.revoke(GD.token, () => {}); } catch {}
  GD.on = false; GD.token = null; GD.map = {}; GD.state = {}; gdSave(); paintDrive(); gdMsg('');
};
$('#btnSettings').addEventListener('click', () => { paintDrive(); if (GD.client) gdLoad().catch(() => {}); });
// a fine allenamento
async function gdAfterRoutine() {
  if (!GD.on || !GD.auto) return;
  const box = $('#rDrive'); if (!box) return;
  const run = async () => {
    box.innerHTML = '<div class="gd-toast">☁️ Salvo su Drive…</div>';
    try { const n = await gdBackup(() => {}); box.innerHTML = `<div class="gd-toast">☁️ ${n ? `Salvate <b>${n} nuove registrazioni</b> su Drive` : 'Tutto già salvato su Drive'}</div>`; }
    catch (e) { box.innerHTML = `<div class="gd-toast">☁️ Backup non riuscito: ${esc(e.message || String(e))}</div>`; }
  };
  if (gdTokenValid()) return run();
  gdLoad().catch(() => {});
  box.innerHTML = '<button class="cta small ghost" id="rDriveGo">☁️ Salva su Drive</button>';
  $('#rDriveGo').onclick = () => gdAuth().then(run).catch((e) => (box.innerHTML = `<div class="gd-toast">☁️ ${esc(e.message || String(e))}</div>`));
}
if (GD.on && GD.client) setTimeout(() => gdLoad().catch(() => {}), 3000);
paintDrive();

/* ---------- Fase 5: verso il lavoro ---------- */
// --- elaborazione audio comune ---
const PRESETS = {
  web: { label: 'Spot / web', sub: 'volume standard web', sr: 48000, rms: -16, peak: -1, floor: -50, head: 0.4, tail: 0.6 },
  acx: { label: 'Audiolibro', sub: 'standard ACX/Audible', sr: 44100, rms: -20, peak: -3.5, floor: -60, head: 0.7, tail: 2 },
  dub: { label: 'Doppiaggio', sub: 'WAV 48 kHz', sr: 48000, rms: -23, peak: -1, floor: -55, head: 0.3, tail: 0.5 },
};
const db2 = (x) => 20 * Math.log10(Math.max(1e-9, x));
async function renderMono(blob, sr, highpass) {
  const AC = window.AudioContext || window.webkitAudioContext;
  const ac = new AC(); const buf = await ac.decodeAudioData(await blob.arrayBuffer()); ac.close().catch(() => {});
  const off = new OfflineAudioContext(1, Math.ceil(buf.duration * sr), sr);
  const src = off.createBufferSource(); src.buffer = buf;
  let node = src;
  if (highpass) { const f = off.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 80; node.connect(f); node = f; }
  node.connect(off.destination); src.start();
  return (await off.startRendering()).getChannelData(0).slice();
}
function frames(pcm, sr, ms = 50) {
  const hop = Math.round((sr * ms) / 1000), out = [];
  for (let i = 0; i + hop <= pcm.length; i += hop) { let q = 0; for (let j = i; j < i + hop; j++) q += pcm[j] * pcm[j]; out.push(Math.sqrt(q / hop)); }
  return { env: out, hop };
}
function audioStats(pcm, sr) {
  const { env, hop } = frames(pcm, sr);
  const sorted = [...env].sort((a, b) => a - b);
  const floor = sorted[Math.floor(sorted.length * 0.1)] || 1e-6;
  const thr = Math.max(floor * 4, 0.003);
  const voiced = env.filter((x) => x > thr);
  const rms = voiced.length ? Math.sqrt(voiced.reduce((a, x) => a + x * x, 0) / voiced.length) : 1e-6;
  let peak = 0, clip = 0; for (const x of pcm) { const v = Math.abs(x); if (v > peak) peak = v; if (v > 0.985) clip++; }
  let first = env.findIndex((x) => x > thr), last = env.length - 1; while (last > 0 && env[last] <= thr) last--;
  return { rmsDb: db2(rms), peakDb: db2(peak), floorDb: db2(floor), clipped: clip > pcm.length * 0.0003, start: Math.max(0, first) * hop, end: (last + 1) * hop, thr };
}
function limiter(pcm, ceilDb, sr) {
  const ceil = Math.pow(10, ceilDb / 20), rel = Math.exp(-1 / (0.08 * sr));
  let g = 1;
  for (let i = 0; i < pcm.length; i++) {
    const a = Math.abs(pcm[i]) * g;
    if (a > ceil) g = ceil / Math.abs(pcm[i]); else g = 1 - (1 - g) * rel;
    pcm[i] *= g;
  }
  return pcm;
}
// riduce il rumore tra una frase e l'altra (espansore dolce, senza tagli netti)
function gentleGate(pcm, sr, thr, depthDb = 12) {
  const { env, hop } = frames(pcm, sr, 20);
  const low = Math.pow(10, -depthDb / 20);
  let g = 1;
  for (let k = 0; k < env.length; k++) {
    const target = env[k] > thr * 1.5 ? 1 : low;
    for (let i = k * hop; i < (k + 1) * hop; i++) { g += (target - g) * (target > g ? 0.02 : 0.0015); pcm[i] *= g; }
  }
  return pcm;
}
async function processTake(blob, preset) {
  const P = PRESETS[preset];
  const raw = await renderMono(blob, P.sr, true);
  const before = audioStats(raw, P.sr);
  const s0 = Math.max(0, before.start - Math.round(P.head * P.sr)), s1 = Math.min(raw.length, before.end + Math.round(P.tail * P.sr));
  let pcm = raw.slice(s0, s1);
  const gain = Math.pow(10, (P.rms - before.rmsDb) / 20);
  for (let i = 0; i < pcm.length; i++) pcm[i] *= gain;
  let after = audioStats(pcm, P.sr);
  let gated = false;
  if (after.floorDb > P.floor) { gentleGate(pcm, P.sr, after.thr, preset === 'acx' ? 18 : 12); gated = true; }
  limiter(pcm, P.peak, P.sr);
  const fi = Math.min(pcm.length, Math.round(0.01 * P.sr)); for (let i = 0; i < fi; i++) { pcm[i] *= i / fi; pcm[pcm.length - 1 - i] *= i / fi; }
  after = audioStats(pcm, P.sr);
  return { pcm, sr: P.sr, before, after, gated, P };
}
function wavBlob(pcm, sr, bits = 24) {
  const n = pcm.length, bps = bits / 8, buf = new ArrayBuffer(44 + n * bps), v = new DataView(buf);
  const w = (o, s2) => [...s2].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + n * bps, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * bps, true); v.setUint16(32, bps, true); v.setUint16(34, bits, true); w(36, 'data'); v.setUint32(40, n * bps, true);
  for (let i = 0; i < n; i++) {
    const x = Math.max(-1, Math.min(1, pcm[i]));
    if (bits === 24) { const s = Math.round(x * 8388607); v.setUint8(44 + i * 3, s & 255); v.setUint8(45 + i * 3, (s >> 8) & 255); v.setUint8(46 + i * 3, (s >> 16) & 255); }
    else v.setInt16(44 + i * 2, x * 32767, true);
  }
  return new Blob([buf], { type: 'audio/wav' });
}
async function mp3Blob(pcm, sr, kbps = 192) {
  if (!window.lamejs) await loadScript('lib/lame.min.js');
  const enc = new lamejs.Mp3Encoder(1, sr, kbps);
  const i16 = new Int16Array(pcm.length); for (let i = 0; i < pcm.length; i++) i16[i] = Math.max(-1, Math.min(1, pcm[i])) * 32767;
  const out = [];
  for (let i = 0; i < i16.length; i += 1152 * 20) { out.push(enc.encodeBuffer(i16.subarray(i, i + 1152 * 20))); if (i % (1152 * 400) === 0) await sleep(0); }
  out.push(enc.flush());
  return new Blob(out, { type: 'audio/mpeg' });
}
const safeName = (t) => (t || 'voce').replace(/[^\w\- àèéìòù]/gi, '').trim() || 'voce';

// --- consegna al cliente ---
const DLV = { take: null, preset: ls.get('dlvPreset', 'web'), res: null, busy: false };
async function openDeliver(takeId) {
  const k = await DB.get('takes', takeId); if (!k) return;
  const t = await DB.get('texts', k.textId);
  const n = (await DB.takesOf(k.textId)).sort((a, b) => a.createdAt - b.createdAt).findIndex((x) => x.id === k.id) + 1;
  DLV.take = { ...k, n, title: t?.title || 'Take' };
  $('#dlvTake').innerHTML = `<b>${esc(DLV.take.title)}${k.anello != null ? ` · anello ${k.anello + 1}` : ''} · take ${n}</b><small>${fmt(k.duration)} · registrata in ${k.mode === 'fuori' ? '🌳 Fuori' : '🏠 Casa'}</small>`;
  open('#sheetDeliver');
  runDeliver();
}
function paintPresets() {
  $('#dlvPresets').innerHTML = Object.entries(PRESETS).map(([k, p]) => `<button class="pre ${k === DLV.preset ? 'on' : ''}" data-pre="${k}">${p.label}<small>${p.sub}</small></button>`).join('');
}
$('#dlvPresets').addEventListener('click', (e) => { const b = e.target.closest('[data-pre]'); if (!b || DLV.busy) return; DLV.preset = b.dataset.pre; ls.set('dlvPreset', DLV.preset); runDeliver(); });
async function runDeliver() {
  paintPresets();
  DLV.busy = true; DLV.res = null;
  $('#dlvChecks').innerHTML = '<div class="empty-note">Analizzo e preparo l\'audio…</div>'; $('#dlvFix').hidden = true;
  try {
    const r = await processTake(DLV.take.blob, DLV.preset);
    DLV.res = r;
    const P = r.P, A = r.after;
    const checks = [
      [Math.abs(A.rmsDb - P.rms) < 1.5, 'Volume giusto', 'sistemato in automatico', ''],
      [!r.before.clipped, r.before.clipped ? 'Registrazione distorta' : 'Nessuna distorsione', r.before.clipped ? 'la voce era troppo forte per il microfono: non si può sistemare' : 'i picchi restano sotto il limite', 'Allontanati di una spanna dal microfono o abbassa il guadagno della scheda audio, poi registra di nuovo.'],
      [true, 'Silenzi tagliati', `${String(P.head).replace('.', ',')} s di aria all'inizio, ${String(P.tail).replace('.', ',')} s alla fine`, ''],
      [A.floorDb <= P.floor, A.floorDb <= P.floor ? 'Rumore di fondo basso' : 'Rumore di fondo alto', A.floorDb <= P.floor ? (r.gated ? 'ridotto in automatico tra una frase e l\'altra' : 'la stanza è silenziosa') : 'si sente il ronzio della stanza tra le frasi', 'Spegni frigo e ventilatori, registra in modalità 🏠 Casa e avvicinati al microfono di una spanna.'],
    ];
    $('#dlvChecks').innerHTML = checks.map(([ok, t, s]) => `<div class="chk ${ok ? 'ok' : 'ko'}"><span class="s">${ok ? '✓' : '✗'}</span><div>${t}<small>${s}</small></div></div>`).join('');
    const bad = checks.filter((c) => !c[0]);
    $('#dlvFix').hidden = !bad.length;
    $('#dlvFix').innerHTML = bad.map((c) => `<b>Come si fa:</b> ${esc(c[3])}`).join('<br>');
    $('#dlvTech').textContent = `Volume medio ${A.rmsDb.toFixed(1)} dB · picco ${A.peakDb.toFixed(1)} dB · rumore ${A.floorDb < -90 ? 'sotto -90' : A.floorDb.toFixed(0)} dB · ${P.sr / 1000} kHz`;
  } catch (e) { console.error(e); $('#dlvChecks').innerHTML = `<div class="empty-note">Non riesco a preparare questo audio (${esc(String(e.message || e))}).</div>`; }
  DLV.busy = false;
}
$('#dlvWav').onclick = () => { if (!DLV.res) return; download(wavBlob(DLV.res.pcm, DLV.res.sr, 24), `${safeName(DLV.take.title)} - take ${DLV.take.n} - ${DLV.preset}.wav`); };
$('#dlvMp3').onclick = async () => {
  if (!DLV.res) return; const b = $('#dlvMp3'); b.disabled = true; b.textContent = 'Preparo l\'MP3…';
  try { download(await mp3Blob(DLV.res.pcm, DLV.res.sr === 48000 && DLV.preset !== 'acx' ? 48000 : 44100, 192), `${safeName(DLV.take.title)} - take ${DLV.take.n} - ${DLV.preset}.mp3`); }
  catch (e) { alert('MP3 non disponibile: scarica il WAV.'); }
  b.disabled = false; b.textContent = '⬇️ MP3';
};

// --- demo reel ---
const REEL = { list: ls.get('reel', []), playing: null };
const reelSave = () => ls.set('reel', REEL.list);
function catOf(take, text) {
  if (take.anello != null) return ['Doppiaggio', 'c4'];
  const rd = READINGS.find((r) => r.title === text?.title);
  const g = rd?.g || '';
  if (/spot/i.test(g)) return ['Spot', 'c1'];
  if (/documentario|divulgazione/i.test(g)) return ['Documentario', 'c2'];
  if (/notiziario/i.test(g)) return ['Notiziario', 'c2'];
  if (/learning/i.test(g)) return ['E-learning', 'c2'];
  return { audiolibro: ['Audiolibro', 'c3'], copione: ['Recitazione', 'c4'], poesia: ['Poesia', 'c3'], articolo: ['Spot', 'c1'], dizione: ['Dizione', 'c2'] }[text?.type] || ['Lettura', 'c2'];
}
async function reelItems() {
  const out = [];
  for (const it of REEL.list) {
    const k = await DB.get('takes', it.id); if (!k) continue;
    const t = await DB.get('texts', k.textId);
    const n = (await DB.takesOf(k.textId)).filter((x) => x.anello === k.anello).sort((a, b) => a.createdAt - b.createdAt).findIndex((x) => x.id === k.id) + 1;
    out.push({ it, k, t, n, cat: catOf(k, t) });
  }
  return out;
}
async function trimInfo(it, k) {
  if (it.len != null) return it.len;
  try { const pcm = await renderMono(k.blob, 16000); const st = audioStats(pcm, 16000); it.len = +((st.end - st.start) / 16000 + 0.6).toFixed(1); }
  catch { it.len = +(k.duration / 1000).toFixed(1); }
  reelSave(); return it.len;
}
async function renderReel() {
  const items = await reelItems();
  REEL.list = items.map((x) => x.it); reelSave();
  for (const x of items) await trimInfo(x.it, x.k);
  const total = items.reduce((a, x) => a + (x.it.len || 0), 0);
  $('#reelTot').textContent = `${Math.floor(total / 60)}:${String(Math.round(total % 60)).padStart(2, '0')}`;
  $('#reelTot').classList.toggle('warn', total > 0 && (total < 45 || total > 100));
  const colors = { c1: 'var(--neon)', c2: 'var(--teal)', c3: 'var(--lime)', c4: 'var(--amber)' };
  $('#reelWave').innerHTML = items.length ? items.map((x) => `<i style="flex:${x.it.len || 1};background:${colors[x.cat[1]]}"></i>`).join('') : '<span class="hint">Ancora vuoto: aggiungi le tue take migliori.</span>';
  $('#reelList').innerHTML = items.map((x, i) => {
    const c = x.k.coach, sync = x.k.sync;
    const judge = x.k.anello != null && sync ? (Math.max(Math.abs(sync.ds || 0), Math.abs(sync.de || 0)) < 0.12 ? 'in sync' : 'sync da migliorare') : c?.count != null ? `coach: ${c.count} ${c.count === 1 ? 'errore' : 'errori'}` : '';
    return `<div class="clip" data-i="${i}"><span class="grip" data-grip="${i}">⋮⋮</span><div class="m"><b>${esc(x.t?.title || 'Take')}${x.k.anello != null ? ` · anello ${x.k.anello + 1}` : ''} · take ${x.n}</b>
      <small><span class="chip ${x.cat[1]}">${x.cat[0]}</span>${dec(x.it.len || 0)} s${judge ? ' · ' + judge : ''}</small></div>
      <button class="pl" data-rp="${i}">▶</button><button class="rm" data-rr="${i}" aria-label="Togli dal reel">✕</button></div>`;
  }).join('');
  $('#reelExport').disabled = !items.length; $('#reelPlayAll').disabled = !items.length;
}
async function openReel() { open('#sheetReel'); $('#reelPick').hidden = true; await renderReel(); }
function stopReelAudio() { if (REEL.playing) { REEL.playing.pause(); URL.revokeObjectURL(REEL.playing.src); REEL.playing = null; } document.querySelectorAll('[data-rp]').forEach((b) => (b.textContent = '▶')); $('#reelPlayAll').textContent = '▶ Ascolta tutto'; }
async function reelMix(onP) {
  const items = await reelItems();
  const SR = 44100, gap = Math.round(0.6 * SR);
  const parts = [];
  for (const [i, x] of items.entries()) {
    onP?.(`Preparo la clip ${i + 1} di ${items.length}…`);
    const r = await processTake(x.k.blob, 'web');
    parts.push(r.pcm.length && r.sr !== SR ? await (async () => { const off = new OfflineAudioContext(1, Math.ceil((r.pcm.length / r.sr) * SR), SR); const b = off.createBuffer(1, r.pcm.length, r.sr); b.copyToChannel(r.pcm, 0); const s = off.createBufferSource(); s.buffer = b; s.connect(off.destination); s.start(); return (await off.startRendering()).getChannelData(0); })() : r.pcm);
  }
  const len = parts.reduce((a, p) => a + p.length + gap, 0);
  const out = new Float32Array(len); let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length + gap; }
  limiter(out, -1, SR);
  return { pcm: out, sr: SR };
}
$('#reelList').addEventListener('click', async (e) => {
  const rp = e.target.closest('[data-rp]'), rr = e.target.closest('[data-rr]');
  if (rr) { stopReelAudio(); REEL.list.splice(+rr.dataset.rr, 1); reelSave(); renderReel(); return; }
  if (rp) {
    const was = rp.textContent === '⏸'; stopReelAudio(); if (was) return;
    const x = (await reelItems())[+rp.dataset.rp];
    const r = await processTake(x.k.blob, 'web');
    const a = new Audio(URL.createObjectURL(wavBlob(r.pcm, r.sr, 16))); REEL.playing = a; a.onended = stopReelAudio; a.play(); rp.textContent = '⏸';
  }
});
// trascina per riordinare
$('#reelList').addEventListener('pointerdown', (e) => {
  const g = e.target.closest('[data-grip]'); if (!g) return;
  e.preventDefault();
  const row = g.closest('.clip'); const list = $('#reelList');
  let from = +g.dataset.grip; row.classList.add('drag');
  const move = (ev) => {
    const rows = [...list.children];
    const y = ev.clientY;
    let to = rows.findIndex((r) => { const b = r.getBoundingClientRect(); return y < b.top + b.height / 2; });
    if (to < 0) to = rows.length - 1;
    if (to !== from) {
      const [it] = REEL.list.splice(from, 1); REEL.list.splice(to, 0, it);
      list.insertBefore(row, to > from ? rows[to].nextSibling : rows[to]); from = to;
    }
  };
  const up = () => { row.classList.remove('drag'); document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); reelSave(); renderReel(); };
  document.addEventListener('pointermove', move); document.addEventListener('pointerup', up);
});
$('#reelAdd').onclick = async () => {
  const box = $('#reelPick');
  if (!box.hidden) { box.hidden = true; return; }
  const inReel = new Set(REEL.list.map((x) => x.id));
  const all = (await DB.all('takes')).filter((k) => !inReel.has(k.id)).sort((a, b) => (b.starred - a.starred) || b.createdAt - a.createdAt);
  const titles = Object.fromEntries((await DB.all('texts')).map((t) => [t.id, t.title]));
  const fav = all.filter((k) => k.starred);
  const list = (fav.length ? fav : all).slice(0, 40);
  box.innerHTML = (fav.length ? '' : '<div class="hint">Non hai ancora take con la ★: ecco le ultime registrazioni.</div>') +
    list.map((k) => `<button class="pick" data-add="${k.id}">${k.starred ? '★ ' : ''}${esc(titles[k.textId] || 'Take')}${k.anello != null ? ` · anello ${k.anello + 1}` : ''}<small>${fmt(k.duration)} · ${new Date(k.createdAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}</small></button>`).join('') || '<div class="hint">Nessuna registrazione da aggiungere.</div>';
  box.hidden = false;
};
$('#reelPick').addEventListener('click', (e) => {
  const b = e.target.closest('[data-add]'); if (!b) return;
  REEL.list.push({ id: b.dataset.add }); reelSave(); b.remove(); renderReel();
});
$('#reelPlayAll').onclick = async () => {
  if (REEL.playing) return stopReelAudio();
  const b = $('#reelPlayAll'); b.textContent = 'Preparo…';
  const m = await reelMix(); const a = new Audio(URL.createObjectURL(wavBlob(m.pcm, m.sr, 16)));
  REEL.playing = a; a.onended = stopReelAudio; a.play(); b.textContent = '⏸ Stop';
};
$('#reelExport').onclick = async () => {
  const b = $('#reelExport'); b.disabled = true;
  try {
    const m = await reelMix((t) => (b.textContent = t));
    b.textContent = 'Creo l\'MP3…';
    let file, name = `Demo reel ${dayKey()}`;
    try { file = await mp3Blob(m.pcm, m.sr, 192); name += '.mp3'; } catch { file = wavBlob(m.pcm, m.sr, 16); name += '.wav'; }
    download(file, name);
    b.textContent = '✓ Reel scaricato';
    setTimeout(() => (b.textContent = '⬇️ Esporta reel'), 2500);
  } catch (e) { console.error(e); b.textContent = '⬇️ Esporta reel'; alert('Esportazione non riuscita.'); }
  b.disabled = false;
};
$('#openReel').onclick = () => openReel();
$('#sheetReel').addEventListener('close', stopReelAudio);

// --- report della domenica ---
function weekRange(d = new Date()) {
  const end = new Date(d); end.setHours(23, 59, 59, 999);
  const dow = (end.getDay() + 6) % 7; // 0 = lunedì
  const start = new Date(end); start.setDate(end.getDate() - dow); start.setHours(0, 0, 0, 0);
  const sunday = new Date(start); sunday.setDate(start.getDate() + 6); sunday.setHours(23, 59, 59, 999);
  return { start, end: sunday, key: dayKey(start) };
}
async function weekData() {
  const { start, end, key } = weekRange();
  const takes = (await DB.all('takes')).filter((k) => k.createdAt >= +start && k.createdAt <= +end);
  const log = ls.get('routineLog', {});
  const days = [...Array(7)].map((_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); const k2 = dayKey(d); return log[k2] ? 'on' : takes.some((t) => dayKey(new Date(t.createdAt)) === k2) ? 'half' : ''; });
  const routines = days.filter((x) => x === 'on').length;
  const mins = Math.round(takes.reduce((a, k) => a + k.duration, 0) / 60000 + routines * 2); // + respiro e articolazione
  const better = [...new Set(takes.flatMap((k) => k.coach?.ai?.miglioramenti || []))].slice(0, 4);
  // errori ricorrenti (raggruppati)
  const groups = {};
  const bump = (name, ex) => { const g = (groups[name] ||= { n: 0, ex: new Set() }); g.n++; if (ex) g.ex.add(ex); };
  for (const k of takes) {
    const R = k.coach?.local || {};
    (R.rising || []).forEach(() => bump('Fine frase che sale'));
    (R.flatQ || []).forEach(() => bump('Domande che non salgono'));
    (R.pauseMissed || []).forEach(() => bump('Pause saltate'));
    (R.miss || []).forEach(() => bump('Parole saltate'));
    for (const e of k.coach?.ai?.errori || []) {
      const name = { pronuncia: 'Pronuncia', accento: 'Accenti sbagliati', pausa_mancante: 'Pause saltate', pausa_di_troppo: 'Pause di troppo', parola_saltata: 'Parole saltate', parola_sbagliata: 'Parole sbagliate', intonazione: 'Intonazione', ritmo: 'Ritmo', interpretazione: 'Interpretazione', voce: 'Voce' }[e.tipo] || 'Altro';
      if (e.tipo !== 'pausa_mancante' && e.tipo !== 'parola_saltata') bump(name, e.parola);
    }
  }
  const errs = Object.entries(groups).sort((a, b) => b[1].n - a[1].n).slice(0, 4).map(([name, g]) => ({ name, n: g.n, ex: [...g.ex].slice(0, 2) }));
  return { key, start, end, takes: takes.length, mins, routines, days, better, errs, allErr: takes.flatMap((k) => (k.coach?.ai?.errori || []).map((e) => `«${e.parola}»: ${e.spiegazione}`)).slice(0, 60) };
}
async function weekGoal(w) {
  const cached = ls.get('weekGoal', {});
  if (cached.key === w.key && cached.n === w.takes) return cached.goal;
  let goal = '';
  if (COACH.key && (w.errs.length || w.allErr.length)) {
    try {
      const models = await geminiModels(COACH.key);
      const body = JSON.stringify({ contents: [{ role: 'user', parts: [{ text: `Sei il coach di dizione e doppiaggio dell'allievo, stile sergente ma semplice. Ecco gli errori della settimana:\n${w.allErr.join('\n') || w.errs.map((e) => `${e.name} (${e.n} volte)`).join('\n')}\n\nCose da ricordare sull'allievo:\n${notesText()}\n\nScrivi l'OBIETTIVO DELLA SETTIMANA PROSSIMA: una sola cosa su cui concentrarsi e un esercizio quotidiano concreto. Massimo 35 parole, frasi semplici, niente markdown.` }] }], generationConfig: { temperature: 0.4 } });
      for (const model of models) {
        const r = await fetch(`${GAPI}/models/${model}:generateContent`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': COACH.key }, body });
        if (!r.ok) continue;
        goal = ((await r.json()).candidates?.[0]?.content?.parts?.map((x) => x.text || '').join('') || '').trim(); bumpCoachCount(); break;
      }
    } catch {}
  }
  if (!goal && w.errs[0]) goal = { 'Fine frase che sale': 'Chiudere le frasi scendendo con la voce. Ogni giorno 3 frasi lette lente, con l\'ultima parola più bassa.', 'Pause saltate': 'Rispettare le barre. Ogni giorno una lettura in cui sulla barra chiudi la bocca e respiri dal naso.', 'Domande che non salgono': 'Far salire le domande. Ogni giorno 5 domande lette con l\'ultima parola più alta, come se fossi sorpreso.', 'Parole saltate': 'Non saltare niente. Prima di registrare rileggi il testo a bassa voce, una volta intera.' }[w.errs[0].name] || `Lavorare su: ${w.errs[0].name.toLowerCase()}. Ogni giorno 5 minuti sulle parole dove sbagli.`;
  if (!goal) goal = 'Registrare almeno 5 giorni su 7: senza registrazioni il coach non può misurare i progressi.';
  ls.set('weekGoal', { key: w.key, n: w.takes, goal });
  return goal;
}
async function openWeek() {
  open('#sheetWeek');
  const w = await weekData();
  const f = (d) => d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' });
  $('#weekSub').textContent = `${w.start.getDate()} – ${f(w.end)}`;
  $('#weekBody').innerHTML = `<div class="stats"><div><b>${w.mins || (w.takes ? '<1' : 0)}</b><small>minuti in cabina</small></div><div><b>${w.routines}</b><small>allenamenti</small></div><div><b>${w.takes}</b><small>registrazioni</small></div></div>
    <div class="wk-days">${['L', 'M', 'M', 'G', 'V', 'S', 'D'].map((d, i) => `<span><i class="${w.days[i]}"></i>${d}</span>`).join('')}</div>
    <div class="gd-lbl">Cosa è migliorato</div>${w.better.length ? w.better.map((b) => `<div class="wk-li">✓ ${esc(b)}</div>`).join('') : '<div class="wk-li muted">Ancora niente di misurato: rileggi gli stessi testi e il coach confronterà le volte.</div>'}
    <div class="gd-lbl">Errori che tornano</div>${w.errs.length ? w.errs.map((e) => `<div class="wk-rep"><span>${esc(e.name)}${e.ex.length ? ` <small>(${e.ex.map((x) => '«' + esc(x) + '»').join(', ')})</small>` : ''}</span><span>${e.n} ${e.n === 1 ? 'volta' : 'volte'}</span></div>`).join('') : '<div class="wk-li muted">Nessun errore registrato questa settimana.</div>'}
    <div class="wk-goal"><b>Obiettivo della settimana</b><span id="weekGoal">Il coach sta scrivendo…</span></div>`;
  $('#weekGoal').textContent = await weekGoal(w);
  ls.set('weekSeen', w.key);
}
$('#openWeek').onclick = () => openWeek();
$('#weekGo').onclick = () => { $('#sheetWeek').close(); startRoutine(); };
// la domenica si apre da solo
setTimeout(() => { if (new Date().getDay() === 0 && ls.get('weekSeen', '') !== weekRange().key && !S.rec && !RT.on && !document.querySelector('dialog[open]')) openWeek(); }, 2500);

/* ---------- avvio ---------- */
applyPrefs();
const texts = await ensureSeeds();
const curId = ls.get('cur', null);
await selectText(texts.find((t) => t.id === curId)?.id || texts.sort((a, b) => b.lastUsed - a.lastUsed)[0].id);
if (S.follow === 'parole') setTimeout(() => loadVosk().catch((e) => console.warn('vosk', e)), 1500);
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
checkInbox();
if (new URLSearchParams(location.search).has('routine')) {
  history.replaceState(null, '', location.pathname);
  rpanel(`<div class="drill"><div class="dnum">È l'ora dell'allenamento</div><h3>10 minuti per la tua voce</h3>
    <p>Respiro, articolazione, scioglilingua e lettura del giorno. Ti guido io.</p><button class="cta" id="rStart">▶ Inizia</button></div>`);
  $('#rStart').onclick = () => { rpanel(''); startRoutine(); };
}
