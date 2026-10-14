import { GwService } from './services/gwService.js';
import { createMatchCardVS } from './components/MatchCardVS.js';
import { renderAnteprimaClassifica } from './components/AnteprimaClassifica.js';
import { CalcoloMatchService } from './services/calcoloMatch.js';
import { createMatchCardResult } from './components/MatchCardResult.js';
import { LiveMatchModule } from './liveMatch.js';
import { kitImageHTML } from './components/Kit3D.js';
import { MenuPanel } from './components/MenuPanel.js';
import { DivisaSquadra } from './menu/DivisaSquadra.js';
import { getWonTrophies } from './services/palmaresService.js';
import { esc, sameId, toArray } from './utils.js';

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

const LOGO_PLACEHOLDER = `<div style="width:100px; height:100px; background:var(--bg3); border:1px solid rgba(255,255,255,0.08); display:flex; align-items:center; justify-content:center; border-radius:8px;"><i class="ri-shield-fill" style="font-size:1.5rem; color:var(--text2);font-family:var(--font-sub,inherit)"></i></div>`;

// riquadri dentro la card della squadra (maglia, classifica, palmarès)
const BOX = 'background: rgba(0,0,0,0.18); border: 1px solid var(--border); border-radius: 14px; padding: 0.6rem 0.7rem;';

// "Modifica" sulla maglia apre direttamente l'editor della divisa
window.openKitEditor = () => MenuPanel.open(DivisaSquadra, 'kit');

export const HomePage = {
  renderHTML(STATE = {}) {
    return `
      <div class="page" id="page-home" style="padding-top: 0.5rem;">

        <!-- CARD SQUADRA -->
        <div class="card" style="margin-bottom: 1.2rem; background: var(--subbox-bg); border: 1px solid var(--border); padding: 1.25rem;">
          
          <!-- RIGA PRINCIPALE: LOGO + NOME SQUADRA -->
          <div style="display: flex; align-items: center; gap: 0.8rem; margin-bottom: 1rem; min-width: 0;">
            <div id="userTeamLogo" style="flex-shrink: 0;"></div>
            <div style="flex: 1; min-width: 0; overflow: hidden;">
              <div class="label" style="margin: 0; font-size: 0.68rem;">La mia squadra</div>
              <h3 id="homeTeamName" style="font-family: var(--font-team-name, 'Bebas Neue', sans-serif); font-size: 2rem; letter-spacing: 0.5px; color: var(--team-name, var(--text)); margin: 0; line-height: 1.1; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere;">Caricamento...</h3>
              <p id="homeTeamOwner" style="font-size: 0.75rem; color: var(--team-owner, var(--text2)); font-family: var(--font-team-owner, var(--font-sub, inherit)); margin: 2px 0 0 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">...</p>
            </div>
          </div>

          <!-- RIQUADRI: MAGLIA + CLASSIFICA affiancati, PALMARÈS sotto -->
          <div id="homeBoxes" style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem; width: 100%;">
            <div id="homeKitBox" style="${BOX} display: flex; flex-direction: column; min-width: 0;">
              <div onclick="window.openKitEditor && window.openKitEditor()" style="display: flex; align-items: center; justify-content: space-between; gap: 0.3rem; margin-bottom: 0.3rem; cursor: pointer;">
                <div style="font-size: 0.7rem; font-weight: 700; color: var(--text2); font-family: var(--font-sub, inherit); text-transform: uppercase;">Maglia</div>
                <div id="homeKitAction" style="font-size: 0.65rem; color: var(--accent); display: flex; align-items: center; flex-shrink: 0;">Modifica <i class="ri-arrow-right-s-line"></i></div>
              </div>
              <div id="homeTeamKit" onclick="window.openKitEditor && window.openKitEditor()" style="flex: 1; display: flex; align-items: center; justify-content: center; cursor: pointer;"></div>
            </div>
            <div id="homeMiniClassifica" style="${BOX} min-width: 0;">
              <div style="font-size: 0.7rem; font-weight: 600; color: var(--text2); font-family: var(--font-sub, inherit);">Caricamento...</div>
            </div>
            <div style="${BOX} grid-column: 1 / -1;">
              <div class="label" style="margin-bottom: 0.4rem; font-size: 0.65rem; color: var(--gold); letter-spacing: 0.5px; text-transform: uppercase;"><i class="ri-trophy-line"></i> Palmarès</div>
              <div id="homeTeamTrophies" style="display: flex; align-items: flex-end; justify-content: flex-start; gap: 0.6rem; flex-wrap: wrap;">
                <span style="font-size: 0.75rem; color: var(--text3); font-family: var(--font-text3, inherit); font-style: italic;">Nessun trofeo</span>
              </div>
            </div>
          </div>

        </div>
        
        <div id="home-status-banner" style="margin-bottom: 1.2rem;"></div>

        <!-- ULTIMA PARTITA (visibile solo se in questa competizione ne è già stata giocata una) -->
        <div id="homeLastMatchWrap" style="display:none; margin-bottom:1.5rem;">
          <div class="sec" style="margin-bottom:.6rem;">Ultima Partita</div>
          <div id="homeLastMatch" class="row-link" style="border-radius:16px;"></div>
        </div>

        <!-- PROSSIMO AVVERSARIO -->
        <div class="sec" style="margin-bottom:.6rem;">Prossimo Avversario</div>
        <div id="homeNextMatch" style="margin-bottom:1.5rem;">
          <div style="text-align:center; color:var(--text3);font-family:var(--font-text3,inherit); padding:1rem; font-size:.85rem;">Nessun match programmato.</div>
        </div>

        <div class="sec" id="onFireTitle" style="margin-bottom:.6rem;">Giocatori On Fire <i class="ri-fire-fill" style="color: #ff4757;"></i></div>
        <div class="scroll-voti" id="homeOnFirePlayers">
          <div style="text-align:center; color:var(--text3);font-family:var(--font-text3,inherit); padding:1.5rem; font-size:.85rem; width:100%;">Nessun dato sulle prestazioni disponibile.</div>
        </div>
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
    const boxes = document.getElementById('homeBoxes');

    const competitionsList = toArray(STATE.competitions);
    const comp = competitionsList.find(c => sameId(c.id, STATE.currentCompetition));

    const realGw = Number(STATE.giornataRealeCorrente) || 0;
    if (banner) {
      if (realGw === 0) {
        banner.innerHTML = `
          <div class="card card-sm card-mini" style="border-left: 4px solid var(--accent2); background: var(--mini-bg, var(--bg2)); padding: .75rem 1rem; margin-bottom: 0;">
            <div style="display: flex; align-items: center; gap: .6rem;">
              <i class="ri-time-line" style="font-size: 1.2rem; color: var(--accent2);"></i>
              <div>
                <div style="font-size: .85rem; font-weight: 600; color: var(--text);">Pre-Campionato Attivo</div>
                <div style="font-size: .75rem; color: var(--text2); font-family: var(--font-sub, inherit); margin-top: 1px;">Le liste sono aperte. Prepara la rosa prima della 1ª Giornata!</div>
              </div>
            </div>
          </div>
        `;
      } else {
        banner.innerHTML = `
          <div class="card card-sm card-mini" style="border-left: 4px solid var(--accent); background: var(--mini-bg, var(--bg2)); padding: .75rem 1rem; margin-bottom: 0;">
            <div style="display: flex; align-items: center; gap: .6rem;">
              <i class="ri-football-line" style="font-size: 1.2rem; color: var(--accent);"></i>
              <div>
                <div style="font-size: .85rem; font-weight: 600; color: var(--text);">Campionato Live — Serie A</div>
                <div style="font-size: .75rem; color: var(--text2); font-family: var(--font-sub, inherit); margin-top: 1px;">Siamo attualmente alla <strong style="color: var(--accent);">${realGw}ª Giornata</strong> reale.</div>
              </div>
            </div>
          </div>
        `;
      }
    }

    if (!STATE.user) return;
    
    const teamsList = toArray(STATE.teams);
    const myTeam = teamsList.find(t => sameId(t.id, STATE.user.id));

    if (myTeam) {
      if (tn) tn.textContent = myTeam.name || "Senza Nome";
      if (to) to.textContent = `Patron: ${myTeam.owner || "Sconosciuto"}`;
      
      if (onFireTitle) {
        onFireTitle.textContent = `Giocatori ${myTeam.name || ''} On Fire`;
      }

      if (teamLogoContainer) {
        if (myTeam.logo) {
          // logo non caricabile: al suo posto lo scudo segnaposto
          teamLogoContainer.innerHTML = `<img src="${esc(myTeam.logo)}" style="width:100px; height:100px; object-fit:contain; border-radius:8px; background:var(--bg3); padding:2px; border:1px solid rgba(255,255,255,0.08);" onerror="this.outerHTML=this.dataset.fb" data-fb="${esc(LOGO_PLACEHOLDER)}" alt="Logo">`;
        } else {
          teamLogoContainer.innerHTML = LOGO_PLACEHOLDER;
        }
      }

      if (kitBox) {
        const key = myTeam.kit ? (myTeam.kit.image || JSON.stringify(myTeam.kit)) + '|' + (myTeam.logo || '') : 'none';
        if (kitBox.dataset.key !== key) {
          kitBox.dataset.key = key;
          kitBox.innerHTML = myTeam.kit
            ? kitImageHTML(myTeam.kit, { crestUrl: myTeam.logo || '', width: 360 }, 'style="width:100%; max-width:150px; margin:0 auto;"')
            : `<i class="ri-shirt-line" style="font-size: 3rem; color: var(--text3); font-family: var(--font-text3, inherit);"></i>`;
          if (kitAction) kitAction.innerHTML = `${myTeam.kit ? 'Modifica' : 'Crea'} <i class="ri-arrow-right-s-line"></i>`;
        }
      }
      if (kitWrap) kitWrap.style.display = '';
      if (boxes) boxes.style.gridTemplateColumns = '1fr 1fr';

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
          trophiesContainer.innerHTML = `<span style="font-size: 0.72rem; color: var(--text3); font-family: var(--font-text3, inherit); font-style: italic;">Nessun trofeo in bacheca</span>`;
        }
      }

    } else {
      if (tn) tn.textContent = "Spettatore";
      if (to) to.textContent = STATE.user.email;
      if (onFireTitle) onFireTitle.textContent = `Giocatori On Fire`;
      if (teamLogoContainer) teamLogoContainer.innerHTML = `<div style="width:52px; height:52px; background:var(--bg3); border:1px solid rgba(255,255,255,0.08); display:flex; align-items:center; justify-content:center; border-radius:8px;"><i class="ri-eye-line" style="font-size:1.5rem; color:var(--text2);font-family:var(--font-sub,inherit)"></i></div>`;
      if (trophiesContainer) trophiesContainer.innerHTML = `<span style="font-size: 0.72rem; color: var(--text3); font-family: var(--font-text3, inherit);">--</span>`;
      if (miniClassificaBox) miniClassificaBox.innerHTML = `<div style="font-size: 0.7rem; color: var(--text3); font-family: var(--font-text3, inherit);">Non associato a una squadra.</div>`;
      if (kitBox) { kitBox.dataset.key = ''; kitBox.innerHTML = ''; }
      if (kitWrap) kitWrap.style.display = 'none';
      if (boxes) boxes.style.gridTemplateColumns = '1fr';
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
      const getFantavoto = (entry) => {
        if (entry === undefined || entry === null) return null;
        if (typeof entry !== 'object') {
          const n = Number(entry);
          return isNaN(n) || n <= 0 ? null : n;
        }
        if (entry.voto === undefined || entry.voto === null || Number(entry.voto) <= 0) return null; // s.v. / non sceso in campo
        const fv = entry.fantavoto !== undefined && entry.fantavoto !== null
          ? Number(entry.fantavoto)
          : CalcoloMatchService.calcolaFantavoto(entry);
        return isNaN(fv) ? null : fv;
      };

      const stats = targetPlayers.map(p => {
        let sum = 0;
        let count = 0;
        targetGwKeys.forEach(gwKey => {
          const fv = getFantavoto(allVotes[gwKey][p.id]);
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
            <div class="pcard" style="background:var(--card2); border: 1px solid rgba(255,255,255,0.05); margin-bottom: 0.4rem;">
              <div style="font-family:'DM Mono',monospace; font-size:.7rem; color:var(--text3); width:14px; text-align:center;">${i + 1}</div>
              ${photoHtml}
              <div class="pi" style="flex:1; min-width:0;">
                <div class="pn" style="color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${esc(p.name)} <span class="rbadge r${role}" style="display:inline-flex; width:16px; height:16px; font-size:.6rem; border-radius:4px; vertical-align:middle;">${role}</span></div>
                <div class="pm" style="color:var(--text2);font-family:var(--font-sub,inherit); font-size:0.7rem;">${esc(p.club || '')} • ${count} pres. nelle ${periodo}</div>
              </div>
              <div style="text-align:right;">
                <div style="${customStyle}">${avg.toFixed(2)}</div>
              </div>
            </div>
          `;
        }).join('');
      } else {
        onFireContainer.innerHTML = `<div style="text-align:center; color:var(--text3);font-family:var(--font-text3,inherit); padding:1.5rem; font-size:.85rem; width:100%;">Nessun fantavoto registrato nelle ${periodo}.</div>`;
      }
    }
  }
};
