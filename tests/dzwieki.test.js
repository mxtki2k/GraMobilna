/* Dźwięki: w Node (bez AudioContext) każde wywołanie jest cichym no-opem, a lista efektów jest kompletna. */
const assert = require('assert');
const D = require('../prototypes/janusz/dzwieki.js');
for (const n of ['tap', 'ok', 'bad', 'modal', 'start', 'coin', 'cash', 'win', 'meh', 'lose', 'level', 'crash', 'call', 'night']) assert.strictEqual(typeof D.SFX[n], 'function', n);
for (const k of ['wrench', 'hammer', 'drill', 'roller', 'trowel', 'sander', 'tester', 'pliers', 'screwdriver', 'pencil']) assert.strictEqual(typeof D.TOOLS[k], 'function', k);
// każde narzędzie ze scen ma swój dźwięk
const sc = require('fs').readFileSync(__dirname + '/../prototypes/janusz/scenes.js', 'utf8');
const used = new Set((sc.match(/ACTIONS = \{[^}]*\}/)[0].match(/'([a-z]+)'/g) || []).map(x => x.replace(/'/g, '')).filter(x => !/^(kran|sciana|gniazdko|polka|syfon|drzwi|plytki|grzejnik|okno|malowanie)$/.test(x)));
used.forEach(k => assert(D.TOOLS[k], 'brak dźwięku narzędzia: ' + k));
D.play('ok'); D.tool('hammer', 500); D.result(5); D.result(1);
console.log('dzwieki OK');
