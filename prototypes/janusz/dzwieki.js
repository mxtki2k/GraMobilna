/* Dźwięki gry: syntezowane w WebAudio, bez plików audio (zero wagi, działa offline i w PWA).
   API: Dzwieki.play('tap'|'coin'|'ok'|'bad'|'modal'|'start'|'call'|'crash'|'level'|'cash'|'win'|'lose'|'meh'),
        Dzwieki.tool(kind, ms) dźwięk narzędzia w akcji, Dzwieki.result(stars), Dzwieki.toggle(), Dzwieki.muted(). */
(function (root, factory) { const m = factory(); if (typeof module === 'object' && module.exports) module.exports = m; else root.Dzwieki = m; })(typeof self !== 'undefined' ? self : this, function () {
  let radioOut = null, ctx = null, master = null, mute = false, vol = 0.5, noiseBuf = null, musicOn = true, musicBus = null, musicTimer = null, musicNext = 0, musicStep = 0, lfo = null, lfoGain = null;
  try { const s = localStorage.getItem('zlecenia_dzwiek'); if (s) { const o = JSON.parse(s); mute = !!o.mute; if (typeof o.vol === 'number') vol = o.vol; if (o.music === false) musicOn = false; } } catch (e) {}
  const persist = () => { try { localStorage.setItem('zlecenia_dzwiek', JSON.stringify({ mute, vol, music: musicOn })); } catch (e) {} };

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return false;
    try {
      ctx = new AC(); master = ctx.createGain(); master.gain.value = vol; master.connect(ctx.destination);
      const n = ctx.sampleRate * 1, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; noiseBuf = b;
    } catch (e) { ctx = null; return false; }
    return true;
  }
  /* pojedynczy ton: typ fali, częstotliwość (opcjonalnie glissando), obwiednia */
  function tone(f, t0, dur, o) {
    o = o || {}; const osc = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + t0;
    osc.type = o.type || 'square'; osc.frequency.setValueAtTime(f, t); if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.to), t + dur);
    const v = (o.gain == null ? 0.25 : o.gain);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + Math.min(0.01, dur / 4)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(master); osc.start(t); osc.stop(t + dur + 0.02);
  }
  /* szum filtrowany (stuki, szlifowanie, wałek) */
  function noise(t0, dur, o) {
    o = o || {}; const src = ctx.createBufferSource(), flt = ctx.createBiquadFilter(), g = ctx.createGain(), t = ctx.currentTime + t0;
    src.buffer = noiseBuf; src.loop = true; flt.type = o.filter || 'bandpass'; flt.frequency.setValueAtTime(o.f || 1500, t); if (o.to) flt.frequency.exponentialRampToValueAtTime(o.to, t + dur); flt.Q.value = o.q || 1;
    const v = (o.gain == null ? 0.3 : o.gain);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + Math.min(0.02, dur / 3)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(flt); flt.connect(g); g.connect(master); src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
  }

  const SFX = {
    tap() { tone(520, 0, 0.05, { type: 'square', gain: 0.08 }); },
    ok() { tone(660, 0, 0.07, { gain: 0.14 }); tone(990, 0.07, 0.1, { gain: 0.14 }); },
    bad() { tone(220, 0, 0.14, { type: 'sawtooth', gain: 0.16 }); tone(165, 0.12, 0.2, { type: 'sawtooth', gain: 0.16 }); },
    modal() { tone(440, 0, 0.06, { type: 'triangle', gain: 0.14 }); tone(587, 0.06, 0.09, { type: 'triangle', gain: 0.14 }); },
    start() { tone(330, 0, 0.08, { gain: 0.14 }); tone(440, 0.09, 0.08, { gain: 0.14 }); tone(660, 0.18, 0.14, { gain: 0.16 }); },
    coin() { tone(988, 0, 0.07, { gain: 0.16 }); tone(1319, 0.07, 0.28, { gain: 0.16 }); },
    cash() { for (let i = 0; i < 4; i++) tone(1200 + i * 150, i * 0.06, 0.08, { gain: 0.12 }); noise(0.25, 0.12, { f: 6000, q: 2, gain: 0.12 }); tone(1568, 0.28, 0.3, { gain: 0.14 }); },
    win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.2, { gain: 0.17 })); tone(1047, 0.5, 0.5, { type: 'triangle', gain: 0.17 }); },
    meh() { tone(392, 0, 0.14, { type: 'triangle', gain: 0.16 }); tone(392, 0.16, 0.22, { type: 'triangle', gain: 0.16 }); },
    lose() { tone(311, 0, 0.22, { type: 'sawtooth', gain: 0.15 }); tone(262, 0.22, 0.22, { type: 'sawtooth', gain: 0.15 }); tone(196, 0.44, 0.5, { type: 'sawtooth', gain: 0.15, to: 150 }); },
    level() { [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.07, 0.14, { gain: 0.15 })); },
    crash() { noise(0, 0.5, { f: 900, to: 120, q: 0.7, gain: 0.5, filter: 'lowpass' }); tone(110, 0, 0.4, { type: 'sawtooth', to: 40, gain: 0.25 }); },
    call() { for (let i = 0; i < 3; i++) { tone(880, i * 0.22, 0.08, { type: 'square', gain: 0.12 }); tone(1100, i * 0.22 + 0.09, 0.08, { type: 'square', gain: 0.12 }); } },
    night() { tone(300, 0, 0.35, { type: 'sine', to: 220, gain: 0.14 }); tone(250, 0.4, 0.5, { type: 'sine', to: 180, gain: 0.14 }); },
  };
  /* narzędzia: seria stuknięć/przeciągnięć rozłożona na czas animacji (ms) */
  const TOOLS = {
    wrench(ms) { const n = Math.max(2, Math.round(ms / 260)); for (let i = 0; i < n; i++) { tone(1800, i * 0.26, 0.05, { type: 'square', gain: 0.1, to: 900 }); noise(i * 0.26, 0.05, { f: 3000, q: 3, gain: 0.12 }); } },
    hammer(ms) { const n = Math.max(2, Math.round(ms / 300)); for (let i = 0; i < n; i++) { tone(140, i * 0.3, 0.12, { type: 'triangle', to: 60, gain: 0.35 }); noise(i * 0.3, 0.06, { f: 2500, q: 1, gain: 0.2 }); } },
    drill(ms) { const d = ms / 1000; tone(180, 0, d, { type: 'sawtooth', to: 260, gain: 0.14 }); tone(360, 0, d, { type: 'square', to: 520, gain: 0.05 }); noise(0, d, { f: 2200, q: 2, gain: 0.08 }); },
    roller(ms) { const n = Math.max(2, Math.round(ms / 380)); for (let i = 0; i < n; i++) noise(i * 0.38, 0.34, { f: 500, to: 1400, q: 0.6, gain: 0.16 }); },
    trowel(ms) { const n = Math.max(2, Math.round(ms / 320)); for (let i = 0; i < n; i++) noise(i * 0.32, 0.26, { f: 1800, to: 900, q: 1.2, gain: 0.14 }); },
    sander(ms) { const d = ms / 1000; noise(0, d, { f: 3200, q: 0.8, gain: 0.2 }); tone(90, 0, d, { type: 'sawtooth', gain: 0.05 }); },
    tester(ms) { const n = Math.max(1, Math.round(ms / 330)); for (let i = 0; i < n; i++) tone(1400 + i * 160, i * 0.33, 0.09, { type: 'sine', gain: 0.14 }); },
    pliers(ms) { const n = Math.max(2, Math.round(ms / 280)); for (let i = 0; i < n; i++) { tone(900, i * 0.28, 0.03, { type: 'square', gain: 0.1 }); tone(700, i * 0.28 + 0.06, 0.03, { type: 'square', gain: 0.1 }); } },
    screwdriver(ms) { const n = Math.max(3, Math.round(ms / 110)); for (let i = 0; i < n; i++) tone(1200 + (i % 2) * 200, i * 0.11, 0.04, { type: 'square', gain: 0.08 }); },
    pencil(ms) { noise(0, Math.min(0.5, ms / 1000), { f: 4500, q: 2, gain: 0.1 }); },
  };

  // ---------- muzyka: disco polo w stylu starego radia ----------
  /* Pętla 8 taktów, 132 BPM, Am–F–C–G. „Oom-pah”: bas na 1 i 3, akord na 2 i 4, werbel, hat, klawisz z melodią.
     Całość idzie przez „radio”: pasmo 300–3200 Hz, lekkie przester, falowanie strojenia, szum i trzaski. */
  const BPM = 132, EIGHTH = 60 / BPM / 2;
  const CHORDS = [{ root: 45, tri: [57, 60, 64] }, { root: 41, tri: [53, 57, 60] }, { root: 48, tri: [55, 60, 64] }, { root: 43, tri: [55, 59, 62] }];
  const MELODY = [
    [76, 76, 74, 72, 74, 72, 69, 0], [72, 72, 77, 77, 76, 74, 72, 0], [76, 76, 79, 76, 72, 74, 76, 0], [74, 74, 71, 74, 79, 77, 76, 74],
    [81, 81, 79, 76, 79, 76, 72, 0], [77, 77, 76, 74, 72, 74, 77, 0], [76, 79, 76, 72, 74, 76, 79, 0], [74, 76, 74, 71, 67, 71, 74, 0]];
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  function curve(k) { const n = 256, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i * 2 / n - 1; c[i] = (1 + k) * x / (1 + k * Math.abs(x)); } return c; }
  function buildRadio() {
    musicBus = ctx.createGain(); musicBus.gain.value = 0.9;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 300; hp.Q.value = 0.7;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200; lp.Q.value = 0.9;
    const pk = ctx.createBiquadFilter(); pk.type = 'peaking'; pk.frequency.value = 1500; pk.gain.value = 6; pk.Q.value = 1.1;
    const ws = ctx.createWaveShaper(); ws.curve = curve(4); ws.oversample = '2x';
    const out = ctx.createGain(); out.gain.value = 0.8; radioOut = out;
    musicBus.connect(hp); hp.connect(pk); pk.connect(ws); ws.connect(lp); lp.connect(out); out.connect(master);
    // szum eteru
    const hiss = ctx.createBufferSource(), hf = ctx.createBiquadFilter(), hg = ctx.createGain(); hiss.buffer = noiseBuf; hiss.loop = true; hf.type = 'bandpass'; hf.frequency.value = 2400; hf.Q.value = 0.5; hg.gain.value = 0.012;
    hiss.connect(hf); hf.connect(hg); hg.connect(out); hiss.start();
    // falowanie strojenia (wow & flutter)
    lfo = ctx.createOscillator(); lfoGain = ctx.createGain(); lfo.frequency.value = 0.6; lfoGain.gain.value = 14; lfo.connect(lfoGain); lfo.start();
  }
  function mTone(f, t, dur, type, gain, detuneLfo) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = f; o.detune.value = (Math.random() - 0.5) * 10;
    if (detuneLfo && lfoGain) lfoGain.connect(o.detune);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + dur + 0.03);
  }
  function mNoise(t, dur, f, q, gain, type) {
    const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noiseBuf; fl.type = type || 'bandpass'; fl.frequency.value = f; fl.Q.value = q;
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(fl); fl.connect(g); g.connect(musicBus); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }
  function scheduleStep(step, t) {
    const bar = Math.floor(step / 8) % 8, pos = step % 8, ch = CHORDS[bar % 4], mel = MELODY[bar][pos], d = EIGHTH;
    if (pos === 0 || pos === 4) { mTone(mtof(ch.root), t, d * 1.6, 'triangle', 0.5, false); mTone(110, t, 0.12, 'sine', 0.5, false); }       // oom + stopa
    if (pos === 2 || pos === 6) { ch.tri.forEach(n => mTone(mtof(n), t, d * 0.8, 'sawtooth', 0.07, true)); mNoise(t, 0.13, 1800, 0.8, 0.35); }   // pah + werbel
    mNoise(t, pos % 2 ? 0.05 : 0.03, 7000, 1.5, pos % 2 ? 0.1 : 0.06, 'highpass');                                                               // hat
    if (mel) { mTone(mtof(mel), t, d * 0.92, 'square', 0.11, true); mTone(mtof(mel) * 2.003, t, d * 0.6, 'square', 0.025, true); }               // klawisz
    if (Math.random() < 0.05) mNoise(t + Math.random() * d, 0.012, 3500, 0.7, 0.5);                                                              // trzask
  }
  function musicTick() {
    if (!ctx || !musicOn || mute) return;
    while (musicNext < ctx.currentTime + 0.4) { scheduleStep(musicStep, Math.max(musicNext, ctx.currentTime)); musicNext += EIGHTH; musicStep++; }
  }
  function startMusic() {
    if (!musicOn || mute || !ensure() || musicTimer) return;
    try { if (!musicBus) buildRadio(); if (radioOut) radioOut.gain.value = 0.8; musicNext = ctx.currentTime + 0.1; musicStep = 0; musicTimer = setInterval(musicTick, 100); musicTick(); } catch (e) { musicTimer = null; }
  }
  function stopMusic() { if (musicTimer) { clearInterval(musicTimer); musicTimer = null; } if (radioOut) radioOut.gain.value = 0; }
  function toggleMusic() { musicOn = !musicOn; persist(); if (musicOn) startMusic(); else stopMusic(); return musicOn; }

  function play(name) { if (mute || !ensure() || !SFX[name]) return; try { SFX[name](); } catch (e) {} }
  function tool(kind, ms) { if (mute || !ensure()) return; try { (TOOLS[kind] || TOOLS.pencil)(ms || 800); } catch (e) {} }
  function result(stars) { play(stars >= 4 ? 'win' : stars === 3 ? 'meh' : 'lose'); }
  function toggle() { mute = !mute; persist(); if (mute) stopMusic(); else { ensure(); play('ok'); startMusic(); } return !mute; }
  function setVolume(v) { vol = Math.max(0, Math.min(1, v)); if (master) master.gain.value = vol; persist(); }
  /* przeglądarki wymagają gestu użytkownika: pierwszy dotyk odblokowuje audio */
  function bind(doc) {
    if (!doc) return;
    const unlock = () => { if (!ensure()) return; if (ctx.state === 'running') { startMusic(); } else ctx.resume().then(startMusic, () => {}); };
    ['click', 'touchend', 'keydown', 'pointerup'].forEach(ev => doc.addEventListener(ev, unlock, { capture: true, passive: true }));
    doc.addEventListener('click', e => {
      const b = e.target && e.target.closest && e.target.closest('button, .lvl, .opt');
      if (!b || b.disabled || b.id === 'snd' || b.id === 'mus') return; play('tap');
    }, true);
    if (doc.addEventListener) doc.addEventListener('visibilitychange', () => { if (!ctx) return; if (doc.hidden) { stopMusic(); ctx.suspend(); } else { ctx.resume().then(startMusic, () => {}); } });
  }
  return { play, tool, result, toggle, setVolume, bind, startMusic, stopMusic, toggleMusic, musicEnabled: () => musicOn, muted: () => mute, volume: () => vol, SFX, TOOLS };
});
