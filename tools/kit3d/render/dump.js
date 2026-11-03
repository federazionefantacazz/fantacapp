// node dump.js <uscita.json>: geometria dei modelli per gli script Python (serve _dump.html nella radice, vedi README)
const { open } = require('./launch.js');
(async () => {
  const { b, p } = await open('http://localhost:8765/_dump.html');
  require('fs').writeFileSync(process.argv[2], await p.evaluate(() => window.OUT));
  await b.close();
})();
