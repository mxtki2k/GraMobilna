// Stałe listy dozwolonych wartości dla testów generatora/agenta (żeby nie zależały od bieżących plików .rob).
const J = require('../prototypes/janusz/jobs.js'), Sz = require('../prototypes/janusz/szkolenia.js'), Al = require('../prototypes/janusz/alledrogo.js');
module.exports = { clients: Object.keys(J.CLIENTS), certs: Object.keys(Sz.CERTS), tools: Object.keys(Al.TYPES), jobs: Object.keys(J.JOBS) };
