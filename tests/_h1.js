const H = require('../tools/headless.js');
(async () => {
  const g = await H.start({ seed: 3 });
  console.log('errors', g.errors(), 'modal', g.text('#mtitle').slice(0, 60), g.visible('#modal'));
  console.log('menu lvls', g.$$('.lvl').length);
  g.close();
})().catch(e => { console.error(e); process.exit(1); });
