// node zoomshot.js '<json [[kit,[foci]],...]>' <prefisso> [dbg]  → <prefisso>_0.png, _1.png, ...
// dbg: interno della maglia verde, rovescio della costina presa dall'altra maglia rosso (serve window.__stage, vedi README)
const { open } = require('./launch.js');
(async () => {
  const dbg = process.argv[4] === 'dbg' ? () => { window.__dbg = () => { const s = window.__stage; s.applyKit = ((f) => function (k, t) { f.call(this, k, t); this.innerMats.forEach(m => m.color.set(0x00ff00)); (this.ribInnerMats || []).forEach(m => m.color.set(0xff0000)); })(s.applyKit); }; } : null;
  const { b, p } = await open('http://localhost:8765/_test_zoom.html#' + encodeURIComponent(process.argv[2]), dbg);
  const out = await p.evaluate(() => window.OUT);
  out.forEach((u, i) => require('fs').writeFileSync(`${process.argv[3]}_${i}.png`, Buffer.from(u.split(',')[1], 'base64')));
  await b.close();
})();
