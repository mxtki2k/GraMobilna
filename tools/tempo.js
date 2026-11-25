// Tempo progresji: w którym dniu gry bot osiąga kolejne kamienie milowe (siedziba, kursy, bus, kasa).
// Uruchomienie: node tools/tempo.js [dni] [styl]   (styl: mieszanie|solid)
const { run } = require('./balans2.js');
const DAYS = +process.argv[2] || 180, style = process.argv[3] || 'mieszanie', N = 60;
const pol = { style, contest: 'normal', rushSkips: style !== 'solid', sleepAt: 60, serviceAt: 60, certs: true, oc: false, progress: true, start: 0, days: DAYS };
const evs = {}, perDay = [];
for (let i = 0; i < N; i++) { const r = run(pol, 700 + i); perDay.push(r.perDay); for (const [k, d] of Object.entries(r.ev)) (evs[k] = evs[k] || []).push(d); }
const med = a => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
console.log('Tempo progresji, ' + DAYS + ' dni, styl ' + style + ', ' + N + ' przebiegów (mediana dnia osiągnięcia; w nawiasie ile przebiegów dotarło)\n');
for (const [k, d] of Object.entries(evs).sort((a, b) => med(a[1]) - med(b[1]))) console.log(k.padEnd(34), 'dzień', String(med(d)).padStart(6), ' (' + d.length + '/' + N + ')');
console.log('\nśredni zysk netto na dzień (po wszystkich zakupach): ' + Math.round(perDay.reduce((a, b) => a + b, 0) / N) + ' zł');
