import { GwService } from './services/gwService.js';
import { createMatchCardVS } from './components/MatchCardVS.js';
import { renderAnteprimaClassifica } from './components/AnteprimaClassifica.js';
import { CalcoloMatchService } from './services/calcoloMatch.js';
import { createMatchCardResult } from './components/MatchCardResult.js';
import { LiveMatchModule } from './liveMatch.js';
import { kitPairHTML, kitPairShown } from './components/Kit3D.js';
import { MenuPanel } from './components/MenuPanel.js';
import { DivisaSquadra } from './menu/DivisaSquadra.js';
import { StadioSquadra } from './menu/StadioSquadra.js';
import { renderStadiumImage } from './components/Stadium3D.js';
import { getWonTrophies } from './services/palmaresService.js';
import { esc, sameId, toArray } from './utils.js';
import { leadersLine } from './services/staffService.js';

const isByeId = (id) => /BYE|RIPOSO/i.test(String(id ?? ''));

/**
 * Ultima partita già giocata dalla squadra nella competizione:
 * la giornata più recente (per giornata di Serie A associata) con un incontro concluso.
 */
function findLastPlayedMatch(comp, teamId) {
  if (!comp || !comp.matches || !teamId) return null;
  const gwN = (k) => parseInt(String(k).replace(/\D/g, ''), 10) || 0;
  const winners = GwService.getWinners(comp);
  let best = null;

  Object.keys(comp.matches).forEach(gwKey => {
    const mine = GwService.getCouples(comp, gwKey, winners).find(c =>
      (String(c.homeId) === String(teamId) || String(c.awayId) === String(teamId)) &&
      !isByeId(c.homeId) && !isByeId(c.awayId) && c.finished === true
    );
    if (!mine) return;
    const real = GwService.getRealOf(comp, gwKey);
    const order = real !== null ? real : gwN(gwKey);
    if (!best || order > best.order || (order === best.order && gwN(gwKey) > gwN(best.gwKey))) {
      best = { gwKey, couple: mine, order };
    }
  });
  return best;
}

// card del logo: sfondo e bordo dal tema (pagina Home)
const LOGO_CARD = 'background:var(--home-logo-bg, var(--bg3)); border:1px solid var(--home-logo-border, rgba(255,255,255,0.08));';

const LOGO_PLACEHOLDER = `<div style="width:100px; height:100px; ${LOGO_CARD} display:flex; align-items:center; justify-content:center; border-radius:8px;"><i class="ri-shield-fill" style="font-size:1.5rem; color:var(--text2);font-family:var(--font-sub,inherit)"></i></div>`;

// riquadri dentro la card della squadra (maglia, classifica, palmarès)
const BOX = 'background: var(--home-box-bg, rgba(0,0,0,0.18)); border: 1px solid var(--home-box-border, var(--border)); border-radius: 14px; padding: 0.6rem 0.7rem;';

/* Nome della squadra su una sola riga: il testo si rimpicciolisce finché il nome ci sta
   (da 32px fino a 16px); se non basta, alla misura minima va a capo.
   Si ricalcola quando cambia la larghezza o arriva il font. */
const TEAM_NAME_MAX = 32, TEAM_NAME_MIN = 16; // px
function fitTeamName(el) {
  if (!el || !el.clientWidth) return;
  // il tema può cambiare la misura massima (Home → Nome squadra → Dimensione)
  let size = parseFloat(getComputedStyle(el).getPropertyValue('--home-team-name-max')) || TEAM_NAME_MAX;
  el.style.whiteSpace = 'nowrap';
  el.style.fontSize = size + 'px';
  while (el.scrollWidth > el.clientWidth && size > TEAM_NAME_MIN) {
    size -= 1;
    el.style.fontSize = size + 'px';
  }
  if (el.scrollWidth > el.clientWidth) el.style.whiteSpace = 'normal';
}
let teamNameObserver = null;
window.addEventListener('fc-theme', () => fitTeamName(document.getElementById('homeTeamName')));
function watchTeamName(el) {
  if (!el) return;
  fitTeamName(el);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => fitTeamName(el));
  if (!teamNameObserver && 'ResizeObserver' in window) {
    teamNameObserver = new ResizeObserver(() => fitTeamName(el));
    teamNameObserver.observe(el);
  }
}

// "Modifica" sulla maglia apre direttamente l'editor della divisa, sulla maglia mostrata in grande
window.openKitEditor = () => {
  const team = window.STATE && window.STATE.user;
  const shown = kitPairShown(document.getElementById('homeTeamKit'));
  DivisaSquadra.startSlot = team && team.kit && team.kit2 ? shown : (team && !team.kit && team.kit2 ? 2 : 1);
  MenuPanel.open(DivisaSquadra, 'kit');
};

// "Modifica" sullo stadio apre l'editor dello stadio
window.openStadiumEditor = () => MenuPanel.open(StadioSquadra, 'stadium');

// Palmarès: apre l'Info Club della mia squadra nella pagina Squadre
window.openMyClubInfo = () => {
  const team = window.STATE && window.STATE.user;
  const mine = team && toArray(window.STATE.teams).find(t => sameId(t.id, team.id));
  if (mine && window.openTeamPage) window.openTeamPage(mine.id, 'home', { info: true });
};

export const HomePage = {
  renderHTML(STATE = {}) {
    return `
      <div class="page" id="page-home">

        <!-- CARD SQUADRA -->
        <div class="card" data-th="home-panel" style="margin-bottom: 1.2rem; background: var(--subbox-bg); border: 1px solid var(--border); padding: 1.25rem;">
          
          <!-- RIGA PRINCIPALE: LOGO + NOME SQUADRA -->
          <div style="display: flex; align-items: center; gap: 0.8rem; margin-bottom: 1rem; min-width: 0;">
            <div id="userTeamLogo" style="flex-shrink: 0;"></div>
            <div style="flex: 1; min-width: 0; overflow: hidden;">
              <div class="label" data-th="home-myTeamLabel" style="margin: 0; font-size: 0.68rem;">La mia squadra</div>
              <h3 id="homeTeamName" style="font-family: var(--font-team-name, 'Bebas Neue', sans-serif); font-size: var(--home-team-name-max, 2rem); letter-spacing: 0.5px; text-transform: uppercase; color: var(--team-name, var(--text)); margin: 0; line-height: 1.1; white-space: nowrap; overflow: hidden; overflow-wrap: anywhere;">Caricamento...</h3>
              <p id="homeTeamOwner" style="font-size: 0.75rem; color: var(--team-owner, var(--text2)); font-family: var(--font-team-owner, var(--font-sub, inherit)); margin: 2px 0 0 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">...</p>
            </div>
          </div>

          <!-- RIQUADRI: MAGLIA + CLASSIFICA affiancati, STADIO e PALMARÈS sotto -->
          <div id="homeBoxes" style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem; width: 100%;">
            <div id="homeKitBox" style="${BOX} display: flex; flex-direction: column; min-width: 0;">
              <div onclick="window.openKitEditor && window.openKitEditor()" style="display: flex; align-items: center; justify-content: space-between; gap: 0.3rem; margin-bottom: 0.3rem; cursor: pointer;">
                <div data-th="home-boxTitle" style="font-size: 0.7rem; font-weight: 700; color: var(--text2); font-family: var(--font-sub, inherit); text-transform: uppercase;">Maglia</div>
                <div id="homeKitAction" style="font-size: 0.65rem; color: var(--accent); display: flex; align-items: center; flex-shrink: 0;">Modifica <i class="ri-arrow-right-s-line"></i></div>
              </div>
              <div id="homeTeamKit" onclick="window.openKitEditor && window.openKitEditor()" style="flex: 1; display: flex; align-items: center; justify-content: center; cursor: pointer;"></div>
            </div>
            <div id="homeMiniClassifica" style="${BOX} min-width: 0;">
              <div style="font-size: 0.7rem; font-weight: 600; color: var(--text2); font-family: var(--font-sub, inherit);">Caricamento...</div>
            </div>
            <div id="homeStadiumBox" onclick="window.openStadiumEditor && window.openStadiumEditor()" style="${BOX} grid-column: 1 / -1; cursor: pointer;">
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.3rem; margin-bottom: 0.3rem;">
                <div data-th="home-boxTitle" style="font-size: 0.7rem; font-weight: 700; color: var(--text2); font-family: var(--font-sub, inherit); text-transform: uppercase;">Stadio</div>
                <div id="homeStadiumAction" style="font-size: 0.65rem; color: var(--accent); display: flex; align-items: center; flex-shrink: 0;">Modifica <i class="ri-arrow-right-s-line"></i></div>
              </div>
              <div id="homeStadium"></div>
            </div>
            <div id="homePalmares" onclick="window.openMyClubInfo && window.openMyClubInfo()" style="${BOX} grid-column: 1 / -1; cursor: pointer;">
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.3rem; margin-bottom: 0.4rem;">
                <div class="label" data-th="home-palmaresTitle" style="margin: 0; font-size: 0.65rem; color: var(--gold); letter-spacing: 0.5px; text-transform: uppercase;"><i class="ri-trophy-line"></i> Palmarès</div>
                <div id="homePalmaresAction" style="font-size: 0.65rem; color: var(--accent); display: flex; align-items: center; flex-shrink: 0;">Info club <i class="ri-arrow-right-s-line"></i></div>
              </div>
              <div id="homeTeamTrophies" style="display: flex; align-items: flex-end; justify-content: flex-start; gap: 0.6rem; flex-wrap: wrap;">
                <span data-th="empty" style="font-size: 0.75rem; color: var(--text3); font-family: var(--font-text3, inherit); font-style: italic;">Nessun trofeo</span>
              </div>
            </div>
          </div>

        </div>

        <!-- ULTIMA PARTITA (visibile solo se in questa competizione ne è già stata giocata una) -->
        <div id="homeLastMatchWrap" style="display:none; margin-bottom:1.5rem;">
          <div class="sec" style="margin-bottom:.6rem;">Ultima Partita</div>
          <div id="homeLastMatch" class="row-link" style="border-radius:16px;"></div>
        </div>

        <!-- LIVE: durante il live prende il posto del prossimo avversario; tocco -> pagina Live -->
        <div id="homeLiveMatchWrap" style="display:none; margin-bottom:1.5rem;">
          <div class="sec" style="margin-bottom:.6rem;">Live Match</div>
          <div id="homeLiveMatch" class="row-link" style="border-radius:16px;"></div>
        </div>

        <!-- PROSSIMO AVVERSARIO (nascosto durante il live) -->
        <div id="homeNextMatchWrap">
          <div class="sec" style="margin-bottom:.6rem;">Prossimo Avversario</div>
          <div id="homeNextMatch" style="margin-bottom:1.5rem;">
            <div data-th="empty" style="text-align:center; color:var(--text3);font-family:var(--font-text3,inherit); padding:1rem; font-size:.85rem;">Nessun match programmato.</div>
          </div>
        </div>

        <div class="sec" id="onFireTitle" style="margin-bottom:.6rem;">Giocatori On Fire <i class="ri-fire-fill" style="color: #ff4757;"></i></div>
        <div class="scroll-voti" id="homeOnFirePlayers">
          <div data-th="empty" style="text-align:center; color:var(--text3);font-family:var(--font-text3,inherit); padding:1.5rem; font-size:.85rem; width:100%;">Nessun dato sulle prestazioni disponibile.</div>
        </div>

        <!-- GIORNATA REALE: card piccola in fondo a destra -->
        <div id="home-status-banner" style="display: flex; justify-content: flex-end; margin-top: 1rem;"></div>
      </div>
    `;
  },

  render(STATE) {
    const banner = document.getElementById('home-status-banner');
    const tn = document.getElementById('homeTeamName');
    const to = document.getElementById('homeTeamOwner');
    const trophiesContainer = document.getElementById('homeTeamTrophies');
    const nm = document.getElementById('homeNextMatch');
    const onFireContainer = document.getElementById('homeOnFirePlayers');
    const onFireTitle = document.getElementById('onFireTitle');
    const teamLogoContainer = document.getElementById('userTeamLogo');
    const miniClassificaBox = document.getElementById('homeMiniClassifica');
    const kitBox = document.getElementById('homeTeamKit');
    const kitWrap = document.getElementById('homeKitBox');
    const kitAction = document.getElementById('homeKitAction');
    const stadiumBox = document.getElementById('homeStadium');
    const stadiumWrap = document.getElementById('homeStadiumBox');
    const stadiumAction = document.getElementById('homeStadiumAction');
    const boxes = document.getElementById('homeBoxes');
    const palmaresAction = document.getElementById('homePalmaresAction');

    const competitionsList = toArray(STATE.competitions);
    const comp = competitionsList.find(c => sameId(c.id, STATE.currentCompetition));

    const realGw = Number(STATE.giornataRealeCorrente) || 0;
    if (banner) {
      // card piccola: stesso stile di prima (bordo a sinistra, sfondo delle card piccole), solo più compatta
      const mini = (color, icon, title, text) => `
          <div class="card card-sm card-mini" style="border-left: 3px solid ${color}; border-radius: 12px; background: var(--mini-bg, var(--bg2)); padding: .4rem .75rem .4rem .55rem; margin-bottom: 0; display: flex; align-items: center; gap: .5rem; max-width: 100%;">
            ${icon}
            <div style="min-width: 0; line-height: 1.25;">
              <div data-th="home-gwTitle" style="font-size: .6rem; font-weight: 600; color: var(--text2); font-family: var(--font-sub, inherit); text-transform: uppercase; letter-spacing: .3px;">${title}</div>
              <div data-th="home-gwText" style="font-size: .78rem; font-weight: 600; color: var(--text);">${text}</div>
            </div>
          </div>`;
      banner.innerHTML = realGw === 0
        ? mini('var(--accent2)', '<i class="ri-time-line" style="font-size: 1.1rem; color: var(--accent2);"></i>', 'Pre-campionato', 'Liste aperte')
        : mini('var(--accent)', '<img src="icons/serie-a.svg" alt="Serie A" style="height: 24px; width: auto; flex-shrink: 0;">', 'Serie A', `<strong style="color: var(--accent);">${realGw}ª Giornata</strong>`);
    }

    if (!STATE.user) return;
    
    const teamsList = toArray(STATE.teams);
    const myTeam = teamsList.find(t => sameId(t.id, STATE.user.id));

    if (myTeam) {
      if (tn) { tn.textContent = myTeam.name || "Senza Nome"; watchTeamName(tn); }
      if (to) to.textContent = leadersLine(myTeam) || 'Presidente: —';
      
      if (onFireTitle) {
        onFireTitle.textContent = `Giocatori ${myTeam.name || ''} On Fire`;
      }

      if (teamLogoContainer) {
        if (myTeam.logo) {
          // logo non caricabile: al suo posto lo scudo segnaposto
          teamLogoContainer.innerHTML = `<img src="${esc(myTeam.logo)}" style="width:100px; height:100px; object-fit:contain; border-radius:8px; ${LOGO_CARD} padding:2px;" onerror="this.outerHTML=this.dataset.fb" data-fb="${esc(LOGO_PLACEHOLDER)}" alt="Logo">`;
        } else {
          teamLogoContainer.innerHTML = LOGO_PLACEHOLDER;
        }
      }

      if (kitBox) {
        const kitKey = (k) => k ? (k.image || JSON.stringify(k)) : 'none';
        const hasKit = !!(myTeam.kit || myTeam.kit2);
        const key = hasKit ? kitKey(myTeam.kit) + '|' + kitKey(myTeam.kit2) + '|' + (myTeam.logo || '') : 'none';
        if (kitBox.dataset.key !== key) {
          kitBox.dataset.key = key;
          // prima maglia in grande, seconda piccola in basso a destra (la freccia le scambia)
          kitBox.innerHTML = hasKit
            ? kitPairHTML(myTeam.kit, myTeam.kit2, { crestUrl: myTeam.logo || '', width: 360 },
                `style="width:100%; max-width:${myTeam.kit && myTeam.kit2 ? 190 : 150}px; margin:0 auto;"`)
            : `<div style="display: flex; flex-direction: column; align-items: center; gap: 0.2rem; text-align: center;">
                <i class="ri-t-shirt-2-line" style="font-size: 3.45rem; line-height: 1; color: var(--text3); font-family: var(--font-text3, inherit);"></i>
                <div style="font-size: 0.7rem; font-weight: 600; color: var(--text2); font-family: var(--font-sub, inherit);">Crea kit squadra</div>
              </div>`;
          if (kitAction) kitAction.innerHTML = `${hasKit ? 'Modifica' : 'Crea'} <i class="ri-arrow-right-s-line"></i>`;
        }
      }
      if (kitWrap) kitWrap.style.display = '';

      if (stadiumBox) {
        const st = myTeam.stadium;
        const key = st ? JSON.stringify([st.image || '', st.name || '', st.capacity || 0, st.image ? '' : st]) : 'none';
        if (stadiumBox.dataset.key !== key) {
          stadiumBox.dataset.key = key;
          stadiumBox.innerHTML = st
            ? `<div style="display: flex; align-items: center; gap: 0.7rem; min-width: 0;">
                <div style="width: 58%; max-width: 230px; flex-shrink: 0; aspect-ratio: 5 / 3; display: flex; align-items: center; justify-content: center;">
                  ${st.image ? `<img src="${esc(st.image)}" alt="Stadio" loading="lazy" decoding="async" style="width: 100%; height: 100%; object-fit: contain;">` : '<i class="ri-building-2-line" style="font-size: 2.4rem; color: var(--text3);"></i>'}
                </div>
                <div style="min-width: 0;">
                  <div data-th="home-stadiumName" style="font-size: 0.85rem; font-weight: 700; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${esc(st.name || 'Stadio senza nome')}</div>
                  ${st.capacity ? `<div data-th="home-stadiumSeats" style="font-size: 0.7rem; color: var(--text2); font-family: var(--font-sub, inherit); margin-top: 2px;">${Number(st.capacity).toLocaleString('it-IT')} posti</div>` : ''}
                </div>
              </div>`
            : `<div style="display: flex; align-items: center; gap: 0.6rem;">
                <i class="ri-building-2-line" style="font-size: 2.6rem; line-height: 1; color: var(--text3); font-family: var(--font-text3, inherit);"></i>
                <div style="font-size: 0.7rem; font-weight: 600; color: var(--text2); font-family: var(--font-sub, inherit);">Crea lo stadio della squadra: anelli, curve, tetto e colori</div>
              </div>`;
          // stadio salvato senza foto (caricamento non riuscito): la disegno qui
          if (st && !st.image) {
            renderStadiumImage(st, { width: 600, logo: myTeam.logo || '' }).then(url => {
              const box = stadiumBox.querySelector('div > div');
              if (url && box && stadiumBox.dataset.key === key) box.innerHTML = `<img src="${url}" alt="Stadio" style="width: 100%; height: 100%; object-fit: contain;">`;
            });
          }
          if (stadiumAction) stadiumAction.innerHTML = `${st ? 'Modifica' : 'Crea'} <i class="ri-arrow-right-s-line"></i>`;
        }
      }
      if (stadiumWrap) stadiumWrap.style.display = '';
      if (boxes) boxes.style.gridTemplateColumns = '1fr 1fr';
      if (palmaresAction) palmaresAction.style.display = '';

      if (miniClassificaBox && comp) {
        miniClassificaBox.innerHTML = renderAnteprimaClassifica(comp, teamsList, myTeam.id, { compact: true });
      }

      // --- RECUPERO ED ORDINAMENTO TROFEI IN HOME ---
      if (trophiesContainer) {
        trophiesContainer.style.alignItems = 'flex-end'; // Forza l'allineamento in basso

        const wonTrophies = getWonTrophies(myTeam, STATE.trophies, competitionsList);

        // ORDINAMENTO PER LA HOME: prima ordine_home, poi tipo di trofeo (così i trofei
        // dello stesso tipo risultano adiacenti), infine stagione.
        wonTrophies.sort((a, b) =>
          a.ordineHome - b.ordineHome ||
          String(a.trophyId).localeCompare(String(b.trophyId)) ||
          String(a.season).localeCompare(String(b.season), undefined, { numeric: true })
        );

        if (wonTrophies.length > 0) {
          // Distanza uniforme per TUTTI i trofei (ordine invariato): i PNG hanno margini
          // trasparenti, quindi si usa un margine negativo proporzionale alla dimensione
          // (dal secondo trofeo in poi) per tenerli vicinissimi.
          const renderTrophy = (tr, idx) => {
            const sizePx = Math.round(38 * (tr.scale / 100));
            const overlap = idx > 0 ? `margin-left: -${Math.round(sizePx * 0.28)}px;` : '';
            const title = esc(`${tr.name} (${tr.season})`);
            const icon = `<i class="ri-trophy-fill" style="font-size: 1.4rem; color: var(--gold); ${overlap}" title="${title}"></i>`;
            if (tr.image) {
              return `<img src="${esc(tr.image)}" alt="${esc(tr.name)}" title="${title}" style="width: ${sizePx}px; height: ${sizePx}px; object-fit: contain; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5)); ${overlap}" onerror="this.outerHTML=this.dataset.fb" data-fb="${esc(icon)}">`;
            }
            return icon;
          };

          trophiesContainer.style.gap = '0';
          trophiesContainer.style.flexWrap = 'wrap';
          trophiesContainer.innerHTML = wonTrophies.map(renderTrophy).join('');
        } else {
          trophiesContainer.innerHTML = `<span data-th="empty" style="font-size: 0.72rem; color: var(--text3); font-family: var(--font-text3, inherit); font-style: italic;">Nessun trofeo in bacheca</span>`;
        }
      }

    } else {
      if (tn) { tn.textContent = "Spettatore"; watchTeamName(tn); }
      if (to) to.textContent = STATE.user.email;
      if (onFireTitle) onFireTitle.textContent = `Giocatori On Fire`;
      if (teamLogoContainer) teamLogoContainer.innerHTML = `<div style="width:52px; height:52px; background:var(--bg3); border:1px solid var(--border); display:flex; align-items:center; justify-content:center; border-radius:8px;"><i class="ri-eye-line" style="font-size:1.5rem; color:var(--text2);font-family:var(--font-sub,inherit)"></i></div>`;
      if (trophiesContainer) trophiesContainer.innerHTML = `<span style="font-size: 0.72rem; color: var(--text3); font-family: var(--font-text3, inherit);">--</span>`;
      if (miniClassificaBox) miniClassificaBox.innerHTML = `<div style="font-size: 0.7rem; color: var(--text3); font-family: var(--font-text3, inherit);">Non associato a una squadra.</div>`;
      if (kitBox) { kitBox.dataset.key = ''; kitBox.innerHTML = ''; }
      if (kitWrap) kitWrap.style.display = 'none';
      if (stadiumBox) { stadiumBox.dataset.key = ''; stadiumBox.innerHTML = ''; }
      if (stadiumWrap) stadiumWrap.style.display = 'none';
      if (boxes) boxes.style.gridTemplateColumns = '1fr';
      if (palmaresAction) palmaresAction.style.display = 'none';
    }

    if (comp) {
      const targetGwKey = GwService.getGwKey(comp, realGw || 1);
      // incontri con i segnaposto del tabellone ("VINCENTE_...") già risolti
      const myMatch = GwService.getCouples(comp, targetGwKey)
        .find(m => sameId(m.homeId, STATE.user.id) || sameId(m.awayId, STATE.user.id));

      if (nm) {
        nm.innerHTML = createMatchCardVS(myMatch, teamsList);
      }
    } else {
      if (nm) nm.innerHTML = `<div style="text-align:center; color:var(--text3);font-family:var(--font-text3,inherit); padding:1rem; font-size:.85rem;">Seleziona una competizione dal menu in alto.</div>`;
    }

    // --- LIVE: al posto del prossimo avversario, risultato simulato con il 6 a chi deve ancora giocare (come "Simula partita") ---
    const liveWrap = document.getElementById('homeLiveMatchWrap');
    const liveBox = document.getElementById('homeLiveMatch');
    const nextWrap = document.getElementById('homeNextMatchWrap');
    if (liveWrap && liveBox) {
      const status = STATE.live && comp && myTeam && realGw ? GwService.getTeamStatus(comp, realGw, myTeam.id) : null;
      if (nextWrap) nextWrap.style.display = status ? 'none' : '';
      if (!liveBox.dataset.bound) {
        liveBox.dataset.bound = '1';
        liveBox.addEventListener('click', () => {
          LiveMatchModule._pendingKey = HomePage._liveKey;
          window.goPage('live');
        });
      }
      if (status && status.canPlay) {
        const couple = status.couple;
        const res = LiveMatchModule.liveSummary({ comp, gwKey: status.gwKey, couple, gwReale: realGw });
        const extra = couple.label || couple.girone;
        const hasPts = res.ptsHome !== null || res.ptsAway !== null;
        liveBox.innerHTML = createMatchCardResult({ ...couple, goalHome: res.goalHome, goalAway: res.goalAway }, teamsList, {
          label: `${GwService.label(status.gwKey)}${extra ? ' · ' + extra : ''}`,
          chip: { live: true, text: 'LIVE', color: 'var(--accent3)' },
          points: hasPts ? `${res.ptsHome ?? '-'} - ${res.ptsAway ?? '-'} pt` : ''
        });
        liveWrap.style.display = 'block';
        HomePage._liveKey = couple.key;
      } else if (status) {
        // live, ma la mia squadra non gioca questa giornata (riposo, eliminata...): si possono seguire gli altri incontri
        liveBox.innerHTML = `
          <div class="card card-sm card-mini" style="background:var(--mini-bg,var(--card)); border:1px solid var(--border); padding:1rem; margin-bottom:0; display:flex; align-items:center; gap:.7rem;">
            <span class="status-chip live" style="--chip-color:var(--accent3);"><span class="dot"></span>LIVE</span>
            <div style="flex:1; min-width:0;">
              <div style="font-size:.85rem; font-weight:600; color:var(--text);">Non giochi in questa giornata</div>
              <div style="font-size:.75rem; color:var(--text2); font-family:var(--font-sub,inherit); margin-top:1px;">${esc(status.reason || '')} Tocca per seguire gli altri incontri.</div>
            </div>
            <i class="ri-arrow-right-s-line" style="color:var(--text3); font-size:1.1rem;"></i>
          </div>`;
        liveWrap.style.display = 'block';
        HomePage._liveKey = null;
      } else {
        liveWrap.style.display = 'none';
        liveBox.innerHTML = '';
        HomePage._liveKey = null;
      }
    }

    // --- ULTIMA PARTITA GIOCATA nella competizione selezionata ---
    const lastWrap = document.getElementById('homeLastMatchWrap');
    const lastBox = document.getElementById('homeLastMatch');
    if (lastWrap && lastBox) {
      const last = myTeam ? findLastPlayedMatch(comp, myTeam.id) : null;
      if (last) {
        const extra = last.couple.label || last.couple.girone;
        const label = `${GwService.label(last.gwKey)}${extra ? ' · ' + extra : ''}`;
        lastBox.innerHTML = createMatchCardResult(last.couple, teamsList, {
          label,
          chip: { icon: 'ri-play-circle-line', text: 'Rivedi', color: 'var(--text2)' }
        });
        lastBox.dataset.gwKey = last.gwKey;
        lastBox.dataset.matchKey = last.couple.key;
        lastWrap.style.display = 'block';
        HomePage._lastCtx = { comp, gwKey: last.gwKey, couple: last.couple };

        if (!lastBox.dataset.bound) {
          lastBox.dataset.bound = '1';
          lastBox.addEventListener('click', () => {
            const ctx = HomePage._lastCtx;
            if (ctx) LiveMatchModule.openViewer({ comp: ctx.comp, gwKey: ctx.gwKey, couple: ctx.couple, mode: 'past' });
          });
        }
      } else {
        lastWrap.style.display = 'none';
        lastBox.innerHTML = '';
        HomePage._lastCtx = null;
      }
    }

    if (onFireContainer) {
      const cfg = STATE.onFire || {};
      const weeks = Math.max(1, parseInt(cfg.weeks, 10) || 4);
      const topN = Math.max(1, parseInt(cfg.players, 10) || 5);

      // Solo i giocatori della mia rosa (come nella pagina Squadre: player.teamId)
      let targetPlayers = toArray(STATE.players);
      if (myTeam) {
        targetPlayers = targetPlayers.filter(p => sameId(p.teamId, myTeam.id));
      }

      // Ultime N giornate che hanno dei voti (fino alla giornata reale corrente, se avviata)
      const allVotes = STATE.votes || {};
      const gwNum = (k) => parseInt(String(k).replace(/\D/g, ''), 10);
      const targetGwKeys = Object.keys(allVotes)
        .filter(k => /^gw\d+$/i.test(k) && allVotes[k] && typeof allVotes[k] === 'object')
        .filter(k => realGw > 0 ? gwNum(k) <= realGw : true)
        .sort((a, b) => gwNum(b) - gwNum(a))
        .slice(0, weeks);

      // Fantavoto di un giocatore in una giornata: se non ancora salvato lo calcola da voto + bonus/malus
      const getFantavoto = (entry, ruolo) => {
        if (entry === undefined || entry === null) return null;
        if (typeof entry !== 'object') {
          const n = Number(entry);
          return isNaN(n) || n <= 0 ? null : n;
        }
        if (entry.voto === undefined || entry.voto === null || Number(entry.voto) <= 0) return null; // s.v. / non sceso in campo
        const fv = entry.fantavoto !== undefined && entry.fantavoto !== null
          ? Number(entry.fantavoto)
          : CalcoloMatchService.calcolaFantavoto(entry, ruolo);
        return isNaN(fv) ? null : fv;
      };

      const stats = targetPlayers.map(p => {
        let sum = 0;
        let count = 0;
        targetGwKeys.forEach(gwKey => {
          const fv = getFantavoto(allVotes[gwKey][p.id], p.role);
          if (fv !== null) { sum += fv; count++; }
        });
        return { player: p, avg: count > 0 ? sum / count : 0, count };
      }).filter(item => item.count > 0);

      // Media fantavoto più alta; a parità, più presenze
      stats.sort((a, b) => b.avg - a.avg || b.count - a.count);
      const top = stats.slice(0, topN);

      const periodo = `ultime ${targetGwKeys.length || weeks} ${(targetGwKeys.length || weeks) === 1 ? 'giornata' : 'giornate'}`;

      if (top.length > 0) {
        onFireContainer.innerHTML = top.map(({ player: p, avg, count }, i) => {
          let customStyle = 'padding: .2rem .5rem; border-radius: 6px; font-weight: bold; font-family: "DM Mono", monospace; ';
          if (avg >= 7) customStyle += 'background: color-mix(in srgb, var(--accent) 15%, transparent); color: var(--accent);';
          else if (avg < 6) customStyle += 'background: rgba(255, 107, 107, 0.15); color: var(--accent3);';
          else customStyle += 'background: rgba(255, 255, 255, 0.08); color: var(--text);';

          const role = esc(p.role);
          const photoUrl = p.photoPersonal || p.photoStandard || '';
          const badge = `<div class="rbadge r${role}" style="width:44px; height:44px; font-size:.95rem; flex-shrink:0;">${role}</div>`;
          const photoHtml = photoUrl
            ? `<img src="${esc(photoUrl)}" alt="${esc(p.name)}" loading="lazy" decoding="async" style="width:44px; height:44px; object-fit:contain; flex-shrink:0; border-radius:8px;" onerror="this.outerHTML=this.dataset.fb" data-fb="${esc(badge)}">`
            : badge;

          return `
            <div class="pcard row-link" data-player-id="${esc(p.id)}" style="border-color: var(--pcard-border, rgba(255,255,255,0.05)); margin-bottom: 0.4rem;">
              <div style="font-family:'DM Mono',monospace; font-size:.7rem; color:var(--text3); width:14px; text-align:center;">${i + 1}</div>
              ${photoHtml}
              <div class="pi" style="flex:1; min-width:0;">
                <div class="pn" style="color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${esc(p.name)} <span class="rbadge r${role}" style="display:inline-flex; width:16px; height:16px; font-size:.6rem; border-radius:4px; vertical-align:middle;">${role}</span></div>
                <div class="pm" style="color:var(--text2);font-family:var(--font-sub,inherit); font-size:0.7rem;">${esc(p.club || '')} • ${count} pres. nelle ${periodo}</div>
              </div>
              <div style="text-align:right;">
                <div data-th="home-onFireAvg" style="${customStyle}">${avg.toFixed(2)}</div>
              </div>
            </div>
          `;
        }).join('');
      } else {
        onFireContainer.innerHTML = `<div data-th="empty" style="text-align:center; color:var(--text3);font-family:var(--font-text3,inherit); padding:1.5rem; font-size:.85rem; width:100%;">Nessun fantavoto registrato nelle ${periodo}.</div>`;
      }
    }
  }
};
