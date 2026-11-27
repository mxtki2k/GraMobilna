/* Dźwięki gry: syntezowane w WebAudio, bez plików audio (zero wagi, działa offline i w PWA).
   API: Dzwieki.play('tap'|'coin'|'ok'|'bad'|'modal'|'start'|'call'|'crash'|'level'|'cash'|'win'|'lose'|'meh'),
        Dzwieki.tool(kind, ms) dźwięk narzędzia w akcji, Dzwieki.result(stars), Dzwieki.toggle(), Dzwieki.muted(). */
(function (root, factory) { const m = factory(); if (typeof module === 'object' && module.exports) module.exports = m; else root.Dzwieki = m; })(typeof self !== 'undefined' ? self : this, function () {
  let ctx = null, master = null, mute = false, vol = 0.5, noiseBuf = null;
  try { const s = localStorage.getItem('zlecenia_dzwiek'); if (s) { const o = JSON.parse(s); mute = !!o.mute; if (typeof o.vol === 'number') vol = o.vol; } } catch (e) {}
  const persist = () => { try { localStorage.setItem('zlecenia_dzwiek', JSON.stringify({ mute, vol })); } catch (e) {} };

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

  function play(name) { if (mute || !ensure() || !SFX[name]) return; try { SFX[name](); } catch (e) {} }
  function tool(kind, ms) { if (mute || !ensure()) return; try { (TOOLS[kind] || TOOLS.pencil)(ms || 800); } catch (e) {} }
  function result(stars) { play(stars >= 4 ? 'win' : stars === 3 ? 'meh' : 'lose'); }
  function toggle() { mute = !mute; persist(); if (!mute) { ensure(); play('ok'); } return !mute; }
  function setVolume(v) { vol = Math.max(0, Math.min(1, v)); if (master) master.gain.value = vol; persist(); }
  /* przeglądarki wymagają gestu użytkownika: pierwszy dotyk odblokowuje audio */
  function bind(doc) {
    if (!doc) return;
    const unlock = () => { ensure(); };
    doc.addEventListener('pointerdown', unlock, { once: true, capture: true });
    doc.addEventListener('click', e => {
      const b = e.target && e.target.closest && e.target.closest('button, .lvl, .opt');
      if (!b || b.disabled || b.id === 'snd') return; play('tap');
    }, true);
  }
  return { play, tool, result, toggle, setVolume, bind, muted: () => mute, volume: () => vol, SFX, TOOLS };
});
