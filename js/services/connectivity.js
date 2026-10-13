/**
 * Stato della connessione: banner "Offline" sotto la barra in alto.
 *
 * Usa sia navigator.onLine sia .info/connected di Firebase (la rete può esserci
 * ma il database no). All'avvio .info/connected è false per un attimo: il banner
 * compare solo dopo un breve ritardo, per non lampeggiare.
 */
import { db, ref, onValue } from '../firebase-config.js';
import { OfflineStore } from './offlineStore.js';

const SHOW_DELAY = 2500;

function timeAgo(ms) {
  if (!ms) return '';
  const min = Math.round((Date.now() - ms) / 60000);
  if (min < 1) return 'aggiornati ora';
  if (min < 60) return `aggiornati ${min} min fa`;
  const h = Math.round(min / 60);
  if (h < 24) return `aggiornati ${h} ${h === 1 ? 'ora' : 'ore'} fa`;
  return `aggiornati il ${new Date(ms).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}`;
}

export const Connectivity = {
  online: navigator.onLine,
  _fbConnected: false,
  _timer: null,
  _shown: false,
  _everConnected: false,

  init() {
    if (this._init) return;
    this._init = true;
    window.addEventListener('online', () => this._update());
    window.addEventListener('offline', () => this._update());
    onValue(ref(db, '.info/connected'), snap => {
      this._fbConnected = snap.val() === true;
      if (this._fbConnected) this._everConnected = true;
      this._update();
    });
    this._update();
  },

  isOffline() {
    return !navigator.onLine || !this._fbConnected;
  },

  _update() {
    clearTimeout(this._timer);
    if (!this.isOffline()) {
      if (this._shown) {
        this._hide();
        if (window.showToast) window.showToast('Di nuovo online', 'ok');
      }
      return;
    }
    // offline certo (navigator) → subito; solo database scollegato → dopo un attimo
    const delay = navigator.onLine ? SHOW_DELAY : 300;
    this._timer = setTimeout(() => { if (this.isOffline()) this._show(); }, delay);
  },

  _el() {
    let el = document.getElementById('offline-banner');
    if (!el) {
      el = document.createElement('div');
      el.id = 'offline-banner';
      document.body.appendChild(el);
    }
    return el;
  },

  _show() {
    const el = this._el();
    const ago = timeAgo(OfflineStore.lastSync());
    // pillola compatta: il dettaglio resta nel title
    el.title = "Le modifiche partiranno al ritorno della rete: tieni l'app aperta.";
    el.innerHTML = `<i class="ri-wifi-off-line"></i><span>Offline${ago ? ` · dati ${ago}` : ''}</span>`;
    el.classList.add('show');
    document.documentElement.classList.add('is-offline');
    this._shown = true;
  },

  _hide() {
    const el = this._el();
    el.classList.remove('show');
    document.documentElement.classList.remove('is-offline');
    this._shown = false;
  }
};
