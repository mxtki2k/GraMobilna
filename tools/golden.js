/* Złote dane do testów parytetu JS ↔ GDScript (etap G0/G1 planu Godot).
   Użycie: node tools/golden.js [moduł ...]   (bez argumentów: wszystkie)
   Wynik: janusz_godot/tests/golden/<moduł>.json = { module, source, version, cases: [{ fn, args, out }] }.
   `fn` to nazwa funkcji w GDScript (snake_case), `out` to wynik z JS. Wersja to skrót pliku źródłowego. */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.join(__dirname, '..'), SRC = path.join(ROOT, 'prototypes', 'janusz'), OUT = path.join(ROOT, 'janusz_godot', 'tests', 'golden');

function lcg(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
const ver = file => crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex').slice(0, 12);
const jsPad = n => (n < 10 ? '0' : '') + n;

const MODULES = {
  czas() {
    const C = require(path.join(SRC, 'czas.js')), cases = [], r = lcg(2027);
    const clocks = [-1441, -1440, -1, 0, 1, 59, 60, 479, 480, 1439, 1440, 1441, 2879, 2880, 10079, 10080, 43200, 44639, 44640]; // minuty od startu
    for (let i = 0; i < 300; i++) clocks.push(Math.floor(r() * 10 * 365 * 1440));
    for (let i = 0; i < 30; i++) clocks.push(Math.floor(r() * 4000) + r()); // ułamki: Math.floor w dateOf
    clocks.push(366 * 1440 - 0.5, 1440 * 365, 1440 * 366, 1440 * (365 + 366 - 1), 1440 * 1000); // granice roku i 29 lutego 2028
    const add = (fn, js, args) => cases.push({ fn, args, out: C[js](...args) });
    for (const c of clocks) { add('date_of', 'dateOf', [c]); add('hm', 'hm', [c]); add('label', 'label', [c]); add('day_label', 'dayLabel', [c]); add('season', 'season', [c]); add('is_night', 'isNight', [c]); }
    for (let h = 0; h < 24; h++) add('is_night_hour', 'isNightHour', [h]);
    for (const k of ['2027-03', '2027-01', '2027-12', '2028-02', '2030-11']) add('month_name', 'monthName', [k]);
    for (const c of clocks.slice(0, 60)) for (const t of ['00:00', '06:00', '08:00', '12:30', '22:30', '23:59']) { add('next_at', 'nextAt', [c, t]); }
    for (const c of clocks.slice(0, 20)) { add('job_start', 'jobStart', [c, '10:15', 2]); add('job_start', 'jobStart', [c, '07:00', 0]); }
    for (const u of [0, 0.1, 0.2, 0.5, 1, 1.5, 2.5, 3.7, 6, 10, 12.5, 24, 99.9]) for (const n of [false, true]) { add('minutes', 'minutes', [u, n]); add('fmt_units', 'fmtUnits', [u, n]); }
    for (const m of [0, 0.4, 0.5, 1.5, 59.4, 59.5, 60, 61, 119.5, 120, 125, 599, 1000, 1440, 5000]) add('fmt_min', 'fmtMin', [m]);
    for (const n of [false, true]) add('mods', 'mods', [n]);
    for (let i = 0; i < 40; i++) add('days_between', 'daysBetween', [clocks[i], clocks[(i * 7 + 3) % clocks.length]]);
    add('start_clock', 'startClock', []);
    return { source: 'prototypes/janusz/czas.js', cases };
  },
  mathx() {
    const cases = [], rounds = [-3.5, -2.5, -1.5, -0.6, -0.5, -0.4, 0, 0.4, 0.5, 0.6, 1.5, 2.5, 3.5, 1e6 + 0.5, 99999.5, -99999.5, 0.49999999999999994];
    const money = [0, 1, 999, 1234, 9999, 10000, 12345, 99999, 100000, 1234567, 12345678, -1, -1234, -9999, -10000, -12345, -1234567, -0.4, -0.5, 0.5, 2.5, -2.5, 15000.6];
    for (const x of rounds) cases.push({ fn: 'round_js', args: [x], out: Math.round(x) });
    for (const x of money) cases.push({ fn: 'zl', args: [x], out: Math.round(x).toLocaleString('pl-PL') + ' zł' });
    for (const n of [0, 5, 9, 10, 59, 100]) cases.push({ fn: 'pad2', args: [n], out: jsPad(n) });
    for (const [a, b] of [[7, 2], [-7, 2], [-1, 1440], [-1440, 1440], [-1441, 1440], [1439, 1440], [0, 7], [100, 60]]) { cases.push({ fn: 'fdiv', args: [a, b], out: Math.floor(a / b) }); cases.push({ fn: 'pmod', args: [a, b], out: ((a % b) + b) % b }); }
    return { source: null, cases };
  },
  rng() {
    const cases = [];
    for (const seed of [0, 1, 2, 7, 42, 12345, 2147483648, 4294967295]) { const r = lcg(seed), out = []; for (let i = 0; i < 25; i++) out.push(r()); cases.push({ fn: 'sequence', args: [seed, 25], out }); }
    return { source: null, cases };
  },
};

function build(name) {
  const m = MODULES[name](), file = m.source ? path.join(ROOT, m.source) : __filename;
  return { module: name, source: m.source, version: ver(file), cases: m.cases };
}
if (require.main === module) {
  const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(MODULES);
  fs.mkdirSync(OUT, { recursive: true });
  for (const n of names) { if (!MODULES[n]) throw new Error('Nieznany moduł: ' + n); const g = build(n); fs.writeFileSync(path.join(OUT, n + '.json'), JSON.stringify(g)); console.log(n + ': ' + g.cases.length + ' przypadków (wersja ' + g.version + ')'); }
}
module.exports = { build, MODULES, lcg };
