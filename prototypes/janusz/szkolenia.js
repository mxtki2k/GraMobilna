/* Szkolenia i uprawnienia: kosztują pieniądze i czas, a dają bezpieczniejszą i lepiej płatną robotę danego rodzaju. Czysta logika. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Szkolenia = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const CERTS = {
    sep: { name: 'Uprawnienia SEP (elektryka)', job: 'gniazdko', cost: 650, hours: 16, hazard: 0.35, acc: 0.05, pay: 1.12, desc: 'Gniazdka bez ryzyka pożaru, klient płaci za papier z pieczątką.' },
    hydr: { name: 'Kurs hydrauliczny', job: 'kran', cost: 420, hours: 10, hazard: 0.7, acc: 0.05, pay: 1.08, desc: 'Kran robisz pewniej i szybciej.' },
    wyk: { name: 'Kurs wykończeniówki', job: 'sciana', cost: 380, hours: 10, hazard: 0.8, acc: 0.06, pay: 1.08, desc: 'Gładzie jak z katalogu.' },
    mont: { name: 'Szkolenie z montażu', job: 'polka', cost: 180, hours: 5, hazard: 0.7, acc: 0.04, pay: 1.05, desc: 'Poziomica przestaje być tajemnicą.' },
  };
  const forJob = (certs, jobId) => { const id = Object.keys(CERTS).find(k => CERTS[k].job === jobId); return id && certs && certs[id] ? CERTS[id] : null; };
  const modsFor = (certs, jobId) => { const c = forJob(certs, jobId); return c ? { hazard: c.hazard, acc: c.acc, pay: c.pay } : { hazard: 1, acc: 0, pay: 1 }; };
  function buy(certs, id, money) {
    const c = CERTS[id]; if (!c) return { ok: false, reason: 'Nieznane szkolenie.' };
    if (certs[id]) return { ok: false, reason: 'Już masz te uprawnienia.' };
    if (money < c.cost) return { ok: false, reason: 'Za mało gotówki.' };
    return { ok: true, cost: c.cost, hours: c.hours, certs: Object.assign({}, certs, { [id]: true }) };
  }
  return { CERTS, forJob, modsFor, buy };
});
