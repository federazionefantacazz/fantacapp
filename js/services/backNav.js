/**
 * Tasto/gesto "Indietro" del telefono (Android, browser).
 *
 * Senza questo, "Indietro" chiude subito la PWA anche con una scheda o un pannello aperto.
 * Ogni livello che si apre (menu laterale, pannello, scheda giocatore, scheda squadra,
 * pagina diversa dalla Home) entra in una pila: "Indietro" chiude il livello più in alto
 * invece di uscire dall'app.
 *
 * Nella cronologia c'è al massimo UNA voce in più (finché la pila non è vuota):
 * così chiudere un livello e aprirne subito un altro non crea voci sfasate.
 *
 *  - BackNav.push(id, closeFn): un livello si è aperto
 *  - BackNav.pop(id): il livello si è chiuso da solo (X, Esc, click fuori)
 */
const stack = [];
let entry = false;      // la voce extra è nella cronologia
let ignorePops = 0;
let releaseTimer = null;

function ensureEntry() {
  if (entry) return;
  entry = true;
  try { history.pushState({ fcLayer: true }, ''); } catch (e) {}
}

window.addEventListener('popstate', () => {
  if (ignorePops > 0) { ignorePops--; return; }
  entry = false;
  const layer = stack.pop();
  // tolto dalla pila PRIMA di chiuderlo: il suo pop() diventa un no-op
  if (layer) layer.close();
  if (stack.length) ensureEntry();
});

export const BackNav = {
  push(id, close) {
    const i = stack.findIndex(l => l.id === id);
    if (i >= 0) stack.splice(i, 1);
    stack.push({ id, close });
    ensureEntry();
  },

  pop(id) {
    const i = stack.map(l => l.id).lastIndexOf(id);
    if (i < 0) return;
    stack.splice(i, 1);
    // la voce extra si toglie dopo un attimo: se nel frattempo si apre un altro livello, resta
    clearTimeout(releaseTimer);
    releaseTimer = setTimeout(() => {
      if (stack.length || !entry) return;
      entry = false;
      ignorePops++;
      history.back();
    }, 60);
  }
};
