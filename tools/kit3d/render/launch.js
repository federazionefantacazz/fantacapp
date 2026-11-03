// Avvio di Chromium senza GPU (SwiftShader) con Firebase finto e niente rete esterna. Usato da zoomshot.js e dump.js.
const { chromium } = require('playwright');
const fs = require('fs');
exports.open = async (url, initScript) => {
  const shell = '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
  const b = await chromium.launch({
    ...(fs.existsSync(shell) ? { executablePath: shell } : {}),
    args: ['--no-proxy-server', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
  });
  const p = await b.newPage({ viewport: { width: 600, height: 600 } });
  p.on('pageerror', e => console.log('err:', e.message));
  await p.route('https://www.gstatic.com/**', r => r.fulfill({ contentType: 'application/javascript', body: 'const f=()=>({});export const initializeApp=f,getDatabase=f,ref=f,onValue=()=>()=>{},set=async()=>{},update=async()=>{},get=async()=>({val:()=>null,exists:()=>false}),getAuth=f,signInWithEmailAndPassword=f,createUserWithEmailAndPassword=f,onAuthStateChanged=()=>()=>{},signOut=f;' }));
  await p.route(u => !u.href.startsWith('http://localhost') && !u.href.includes('gstatic'), r => r.abort());
  if (initScript) await p.addInitScript(initScript);
  await p.goto(url);
  await p.waitForFunction(() => window.DONE, null, { timeout: 1500000 });
  return { b, p };
};
