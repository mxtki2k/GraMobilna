#!/usr/bin/env node
// Lokalny agent (Ollama) pisze szkic roboty w formacie .rob; walidator z tools/nowa_robota.js odsyła mu błędy, aż plik przejdzie.
// Użycie:
//   node tools/ollama_robota.js --id okno2 --opis "Wymiana zamka w drzwiach wejściowych, klient bez klucza" [--model qwen2.5-coder:7b] [--proby 4] [--dry] [--force]
// Zmienne: OLLAMA_HOST (domyślnie http://127.0.0.1:11434), OLLAMA_MODEL.
// Po sukcesie plik ląduje w roboty/<id>.rob. Potem: node tools/nowa_robota.js && node tests/roboty.test.js && node tools/balans.js
const fs = require('fs'), path = require('path');
const NR = require('./nowa_robota.js');
const ROOT = path.join(__dirname, '..');

function known() {
  const need = p => { try { return require(path.join(ROOT, 'prototypes', 'janusz', p)); } catch (e) { return null; } };
  const J = need('jobs.js'), Sz = need('szkolenia.js'), Al = need('alledrogo.js');
  return { clients: J ? Object.keys(J.CLIENTS) : [], certs: Sz ? Object.keys(Sz.CERTS) : [], tools: Al ? Object.keys(Al.TYPES) : [], jobs: J ? Object.keys(J.JOBS) : [] };
}
const stripFences = t => t.replace(/^```[a-z]*\n?/im, '').replace(/```\s*$/m, '').replace(/^```[a-z]*\n?/gim, '').trim();

function systemPrompt(k) {
  const example = fs.readFileSync(path.join(ROOT, 'roboty', 'prysznic.rob'), 'utf8');
  const head = fs.readFileSync(path.join(__dirname, 'nowa_robota.js'), 'utf8').split('\n').filter(l => l.startsWith('//')).slice(1, 28).map(l => l.slice(3)).join('\n');
  return 'Jesteś pisarzem robót do polskiej gry satyrycznej „Janusz Biznesu” (naprawy w mieszkaniach, humor z memów, bez wulgaryzmów). ' +
    'Odpowiadasz WYŁĄCZNIE zawartością pliku .rob, bez komentarzy i bez bloków kodu. Format:\n' + head + '\n\nPrzykład kompletnego pliku:\n' + example +
    '\nZasady: 5–6 kroków; w każdym kroku opcje d, s, f; czasy d ≥ s ≥ f; suma czasów d mieści się w 80–100% terminu, suma s < 60%, suma f < 30%; d bez wad; f ma wadę o większej wadze niż s; ' +
    'każdy fx unikalny w robocie (np. prefiks robota-); co najmniej jedna niespodzianka z następstwem (then=…); co najmniej dwa poziomy (dzień i noc z intro zawierającym godzinę). ' +
    'Dozwoleni klienci: ' + k.clients.join(', ') + '. Dozwolone kursy: ' + k.certs.join(', ') + '. Dozwolone narzędzia: ' + k.tools.join(', ') + '. Wady: etykieta:sev(0-6):vis(0-1)[:hazard].';
}

/* chat(messages) → Promise<string>. Zwraca { ok, text, errors, tries }. */
async function generate(opts) {
  const k = opts.known || known(), id = opts.id, maxTries = opts.tries || 4;
  const msgs = [{ role: 'system', content: systemPrompt(k) }, { role: 'user', content: 'Napisz plik roboty o id „' + id + '”: ' + opts.opis + '. Pierwsza linia: robota ' + id + ' | Tytuł | Miejsce | baza N | termin N.' }];
  let last = { text: '', errors: ['brak odpowiedzi'] };
  for (let t = 1; t <= maxTries; t++) {
    const raw = await opts.chat(msgs), text = stripFences(raw);
    const p = NR.parse(text, id + '.rob'), errors = NR.validate(p, k);
    if (p.job && p.job.id !== id) errors.push('id roboty ma być „' + id + '”, jest „' + p.job.id + '”');
    if (p.job && k.jobs.includes(p.job.id) && !opts.allowExisting) errors.push('id „' + p.job.id + '” jest już zajęte');
    last = { text, errors };
    if (!errors.length) return { ok: true, text, errors: [], tries: t };
    msgs.push({ role: 'assistant', content: text }, { role: 'user', content: 'Walidator zgłosił błędy:\n- ' + errors.slice(0, 12).join('\n- ') + '\nPopraw i wypisz cały plik od nowa (tylko plik).' });
  }
  return { ok: false, text: last.text, errors: last.errors, tries: maxTries };
}

function ollamaChat(host, model) {
  return async messages => {
    const r = await fetch(host.replace(/\/$/, '') + '/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model, messages, stream: false, options: { temperature: 0.7, num_ctx: 8192 } }) });
    if (!r.ok) throw new Error('Ollama ' + r.status + ': ' + (await r.text()).slice(0, 200));
    return (await r.json()).message.content;
  };
}
module.exports = { generate, systemPrompt, stripFences, ollamaChat };

if (require.main === module) {
  const a = process.argv.slice(2), arg = (n, d) => { const i = a.indexOf('--' + n); return i >= 0 ? a[i + 1] : d; };
  const id = arg('id'), opis = arg('opis');
  if (!id || !opis) { console.error('Użycie: node tools/ollama_robota.js --id okno2 --opis "krótki opis roboty" [--model nazwa] [--proby 4] [--dry] [--force]'); process.exit(2); }
  const model = arg('model', process.env.OLLAMA_MODEL || 'qwen2.5-coder:7b'), host = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434', out = path.join(ROOT, 'roboty', id + '.rob');
  if (fs.existsSync(out) && !a.includes('--force')) { console.error(out + ' już istnieje (użyj --force)'); process.exit(2); }
  generate({ id, opis, tries: +arg('proby', 4), chat: ollamaChat(host, model) }).then(r => {
    if (!r.ok) { console.error('Nie udało się po ' + r.tries + ' próbach. Ostatnie błędy:\n - ' + r.errors.join('\n - ')); fs.writeFileSync(path.join(ROOT, 'roboty', id + '.rob.szkic'), r.text); console.error('Szkic: roboty/' + id + '.rob.szkic'); process.exit(1); }
    if (a.includes('--dry')) { console.log(r.text); return; }
    fs.writeFileSync(out, r.text + '\n'); console.log('OK po ' + r.tries + ' próbach → roboty/' + id + '.rob\nDalej: node tools/nowa_robota.js && node tests/roboty.test.js && node tools/balans.js --style-table');
  }).catch(e => { console.error('Błąd: ' + e.message + '\nSprawdź, czy działa: ollama serve, i czy model jest pobrany (ollama pull ' + model + ').'); process.exit(1); });
}
