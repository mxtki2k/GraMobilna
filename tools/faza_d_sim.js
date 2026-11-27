// Faza D: średni mnożnik popytu i wypłat z wydarzeń sezonowych w ciągu roku (po miesiącach i robotach). Uruchomienie: node tools/faza_d_sim.js
const Sz = require('../prototypes/janusz/sezon.js'), C = require('../prototypes/janusz/czas.js'), R = require('../prototypes/janusz/rok.js');
const { JOBS } = require('../prototypes/janusz/jobs.js');
const MN = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];
const at = (m, d) => Math.round((Date.UTC(2028, m, d, 12) - C.START) / 60000);
console.log('Średni mnożnik (popyt × wypłata) wg miesiąca i roboty\n');
const ids = Object.keys(JOBS); console.log('mies. ', ids.map(i => i.slice(0, 5).padEnd(6)).join(''), ' wszystkie');
let tot = 0, cnt = 0; const per = Object.fromEntries(ids.map(i => [i, 0]));
for (let m = 0; m < 12; m++) {
  const days = new Date(2028, m + 1, 0).getDate(); let row = ids.map(() => 0);
  for (let d = 1; d <= days; d++) ids.forEach((id, k) => { const v = Sz.demand(at(m, d), id) * Sz.pay(at(m, d)); row[k] += v / days; per[id] += v / (366); });
  const avg = row.reduce((a, b) => a + b, 0) / ids.length; tot += avg; cnt++; console.log(MN[m].padEnd(6), row.map(x => x.toFixed(2).padEnd(6)).join(''), ' ' + avg.toFixed(2));
}
console.log('\nśrednio w roku:', ids.map(i => i + ' ' + per[i].toFixed(2)).join(', '), '\nwszystkie roboty:', (tot / cnt).toFixed(3));
console.log('\nPerki (maksymalne): bonusy na start =', JSON.stringify(R.bonuses({ perks: { kapital: 3, renoma: 5, znajomosci: 3, kursy: 3 } })));
console.log('Koszt wszystkich perków (pkt):', Object.values(R.PERKS).reduce((s, p) => s + p.cost.reduce((a, b) => a + b, 0), 0));
