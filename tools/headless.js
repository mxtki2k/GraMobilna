/* Headless: uruchamia prawdziwy zlecenia.html w jsdom (bez przeglądarki), z deterministycznym RNG,
   atrapą canvas i przyspieszonym zegarem animacji. Używane przez tests/scenariusze.test.js (etap R0).
   Użycie: const g = await Headless.start({ seed: 7 }); await g.click('.lvl[data-i="0"]'); g.state() ... */
const path = require('path');
let JSDOM;
let VirtualConsole;
try { ({ JSDOM, VirtualConsole } = require('jsdom')); } catch (e) { JSDOM = null; }
const DIR = path.join(__dirname, '..', 'prototypes', 'janusz');

function lcg(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
function tick(w, n) { return new Promise(res => { let i = 0; const f = () => { if (++i >= n) res(); else w.setTimeout(f, 1); }; w.setTimeout(f, 1); }); }

/* jsdom po close() potrafi jeszcze raz wywołać zaległe requestAnimationFrame i rzucić wyjątek o `_location`: ignorujemy tylko ten przypadek. */
let guarded = false;
function guard() { if (guarded) return; guarded = true; process.on('uncaughtException', e => { if (/_location/.test(String(e && e.message))) return; console.error(e); process.exit(1); }); }
async function start(opts) {
  guard();
  if (!JSDOM) throw new Error('Brak jsdom: uruchom `npm install` w katalogu głównym repozytorium.');
  opts = opts || {};
  const dom = await JSDOM.fromFile(path.join(DIR, 'zlecenia.html'), {
    virtualConsole: new VirtualConsole().on('jsdomError', e => { if (process.env.HEADLESS_DEBUG) console.error(e.detail || e); }),
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, 
    beforeParse(w) {
      w.Math.random = lcg(opts.seed == null ? 1 : opts.seed);
      const noop = () => {};
      w.ImageData = class { constructor(a, b, c) { if (typeof a === 'number') { this.width = a; this.height = b; this.data = new Uint8ClampedArray(a * b * 4); } else { this.data = a; this.width = b; this.height = c; } } };
      const mem = {}; const store = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; }, clear: () => { for (const k in mem) delete mem[k]; } };
      Object.defineProperty(w, 'localStorage', { value: store, configurable: true });
      w.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, { get: (t, k) => k === 'canvas' ? {} : (k === 'measureText' ? () => ({ width: 0 }) : noop), set: () => true });
      w.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,';
      w.__errors = []; w.addEventListener('error', e => w.__errors.push(String(e.message || e.error)));
      const st = w.setTimeout.bind(w); w.setTimeout = (fn, ms, ...a) => st(fn, ms > 20 ? 1 : ms, ...a);
      let tt = 0; w.performance.now = () => (tt += 16);
      if (opts.tutorial !== true) store.setItem('zlecenia_tut', '{"off":true}');
      if (opts.storage) for (const k of Object.keys(opts.storage)) store.setItem(k, opts.storage[k]);
    },
  });
  const w = dom.window, d = w.document;
  await new Promise(res => { if (d.readyState === 'complete') res(); else w.addEventListener('load', res); });
  await tick(w, 5);
  return {
    w, d, dom,
    z: () => w.__z,
    state: () => w.__z.ST,
    errors: () => w.__errors,
    $: s => d.querySelector(s),
    $$: s => Array.from(d.querySelectorAll(s)),
    visible: s => { const el = d.querySelector(s); return !!el && !el.closest('[hidden]'); },
    async click(sel) { const el = d.querySelector(sel); if (!el) throw new Error('Brak elementu: ' + sel); el.click(); await tick(w, 3); },
    async tryClick(sel) { const el = d.querySelector(sel); if (!el || el.closest('[hidden]') || el.disabled) return false; el.click(); await tick(w, 3); return true; },
    async settle(n) { await tick(w, n || 5); },
    text: s => { const el = d.querySelector(s); return el ? el.textContent : ''; },
    /* skrót stanu do porównań między przebiegami */
    digest() { const S = w.__z.ST; return JSON.stringify({ money: Math.round(S.money), done: S.done, clock: S.clock, day: S.day, unlocked: S.unlocked, rat: S.ratings.length, crew: S.crew.length, contracts: Object.keys(S.contracts || {}).length, claims: S.claims.length, fatigue: S.fatigue, burnout: S.burnout }); },
    close() { w.close(); },
  };
}
module.exports = { start, lcg, available: !!JSDOM };
