// VActor — Fase 1 «La Cabina»
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
  if (t?.video) {
    S.videoURL = URL.createObjectURL(t.video);
    v.src = S.videoURL;
    $('#videoWrap').hidden = false;
    $('#guideRow').hidden = false;
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
function buildPrompter(body) {
  const words = []; let html = '';
  for (const line of body.split('\n')) {
    let rest = line;
    const m = rest.match(/^\s*[A-ZÀ-ÖØ-Ý][A-ZÀ-ÖØ-Ý0-9 .'’-]{0,24}:/);
    if (m) { html += `<span class="spk">${esc(m[0])}</span>`; rest = rest.slice(m[0].length); }
    for (const part of rest.split(/(\([^)\n]{1,80}\))/)) {
      if (!part) continue;
      if (/^\(.*\)$/.test(part)) { html += `<span class="par">${esc(part)}</span>`; continue; }
      for (const tok of part.split(/(\s+)/)) {
        if (!tok) continue;
        const n = norm(tok);
        if (/^\s+$/.test(tok) || !n) { html += esc(tok); continue; }
        html += `<span class="w" data-i="${words.length}">${esc(tok)}</span>`; words.push(n);
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
  stopPlayer();
  let stream;
  try { stream = await openMic(); }
  catch { alert('Non riesco ad accedere al microfono. Controlla i permessi del browser.'); return; }
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
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
function cancelRec() { teardown(S.rec); }

async function stopRec() {
  const R = S.rec;
  const stopped = new Promise((r) => (R.mr.onstop = r));
  R.mr.stop();
  const duration = performance.now() - R.t0;
  await stopped;
  teardown(R);
  if (duration < 700) return;
  const take = { id: uid(), textId: S.text.id, blob: new Blob(R.chunks, { type: R.mime }), mime: R.mime, duration, createdAt: Date.now(), mode: S.mode, starred: false };
  await DB.put('takes', take);
  await refreshTakes();
  showToast(S.takes.at(-1));
}

/* ---------- riascolto ---------- */
function showToast(take) {
  S.lastTake = take;
  $('#ttName').textContent = `Take ${take.n}`;
  $('#ttMeta').textContent = `${fmt(take.duration)} · ${take.mode === 'fuori' ? '🌳' : '🏠'} · appena registrata`;
  $('#ttStar').textContent = take.starred ? '★' : '☆';
  $('#ttPlay').textContent = '▶';
  $('#takeToast').hidden = false;
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
    const v = $('#video'); v.muted = true; v.currentTime = 0; v.play().catch(() => {});
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
  const t = { id: draft.id || uid(), title, type: draft.type, body, video: draft.video || null, videoName: draft.videoName || null,
    createdAt: draft.createdAt || Date.now(), lastUsed: Date.now() };
  await DB.put('texts', t);
  $('#sheetNew').close();
  await selectText(t.id);
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
    <button class="act ${k.starred ? 'on' : ''}" data-star="${k.id}">${k.starred ? '★' : '☆'}</button>
    <button class="act" data-dl="${k.id}">⬇️</button>
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
    const t = await DB.get('texts', k.textId); download(k.blob, fileName(k, t?.title));
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

/* ---------- avvio ---------- */
applyPrefs();
const texts = await ensureSeeds();
const curId = ls.get('cur', null);
await selectText(texts.find((t) => t.id === curId)?.id || texts.sort((a, b) => b.lastUsed - a.lastUsed)[0].id);
if (S.follow === 'parole') setTimeout(() => loadVosk().catch((e) => console.warn('vosk', e)), 1500);
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
checkInbox();
