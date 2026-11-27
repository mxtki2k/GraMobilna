// Test pętli „lokalny agent + walidator” na atrapie modelu (bez Ollamy). Uruchomienie: node tests/ollama.test.js
const assert = require('assert'), fs = require('fs'), path = require('path'), http = require('http');
const O = require('../tools/ollama_robota.js');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'roboty', 'prysznic.rob'), 'utf8');
let n = 0; const t = async (name, fn) => { await fn(); n++; console.log('ok  -', name); };
const withId = (id, txt) => txt.replace(/^robota prysznic/m, 'robota ' + id).replace(/^poziom klient=mirek/m, 'poziom klient=mirek').replace(/^niespodzianka rdza/m, 'niespodzianka rdza');

(async () => {
  await t('prompt systemowy zawiera format, przykład i listy dozwolonych wartości', () => {
    const p = O.systemPrompt({ clients: ['mirek'], certs: ['hydr'], tools: ['klucze'], jobs: [] });
    assert(p.includes('robota ID | Tytuł') && p.includes('robota prysznic') && p.includes('Dozwoleni klienci: mirek') && p.includes('Dozwolone kursy: hydr') && p.includes('klucze'));
  });
  await t('pętla poprawek: błędny szkic dostaje błędy z walidatora i dopiero poprawiony jest przyjęty', async () => {
    const calls = []; const good = withId('prysznic2', SRC), bad = good.replace('| 6 | 0 | pr-woda-off |', '| 0 | 0 | pr-woda-off |');
    const chat = async msgs => { calls.push(msgs.map(m => m.role).join()); return calls.length === 1 ? '```\n' + bad + '\n```' : good; };
    const r = await O.generate({ id: 'prysznic2', opis: 'test', chat, tries: 3, known: require('./_known.js') });
    assert(r.ok && r.tries === 2 && calls.length === 2 && calls[1].endsWith('assistant,user'));
  });
  await t('błędy trafiają do kolejnego zapytania, a po wyczerpaniu prób wynik jest nieudany', async () => {
    let lastUser = ''; const chat = async msgs => { lastUser = msgs[msgs.length - 1].content; return 'robota x | T | M | baza 1 | termin 1'; };
    const r = await O.generate({ id: 'x', opis: 'test', chat, tries: 2, known: require('./_known.js') });
    assert(!r.ok && r.tries === 2 && /Walidator zgłosił błędy/.test(lastUser) && r.errors.length > 0);
  });
  await t('odrzuca zajęte id i złe id w odpowiedzi', async () => {
    const k = require('./_known.js');
    const r1 = await O.generate({ id: 'kran', opis: 'x', chat: async () => withId('kran', SRC), tries: 1, known: k }); assert(!r1.ok && r1.errors.some(e => /zajęte/.test(e)));
    const r2 = await O.generate({ id: 'inne', opis: 'x', chat: async () => withId('prysznic3', SRC), tries: 1, known: k }); assert(!r2.ok && r2.errors.some(e => /ma być „inne”/.test(e)));
  });
  await t('klient HTTP rozmawia z serwerem w formacie Ollamy (/api/chat)', async () => {
    const srv = http.createServer((req, res) => { let b = ''; req.on('data', c => b += c); req.on('end', () => { const j = JSON.parse(b); res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ message: { role: 'assistant', content: 'model=' + j.model + ' wiadomości=' + j.messages.length + ' stream=' + j.stream } })); }); });
    await new Promise(r => srv.listen(0, '127.0.0.1', r));
    const out = await O.ollamaChat('http://127.0.0.1:' + srv.address().port, 'test-model')([{ role: 'user', content: 'cześć' }]); srv.close();
    assert.strictEqual(out, 'model=test-model wiadomości=1 stream=false');
  });
  await t('czyszczenie ogrodzeń kodu', () => { assert.strictEqual(O.stripFences('```rob\nrobota a\n```'), 'robota a'); assert.strictEqual(O.stripFences('robota a'), 'robota a'); });
  console.log('\n' + n + ' testów przeszło');
})().catch(e => { console.error(e); process.exit(1); });
