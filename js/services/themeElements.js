/**
 * Elementi dell'app modificabili dal tema, pagina per pagina, ognuno con il suo nome
 * (es. Home → "Nome squadra", "Pannello logo", "Riquadro maglia").
 *
 * Nel tema: theme.el[sezione][elemento] = { color, font, size, weight, bg, border, radius }
 *   color  = colore del testo (o dell'icona)        font   = chiave di THEME_FONTS
 *   size   = dimensione del testo in px              weight = 'normal' | 'bold'
 *   bg     = sfondo (colore, rgba o gradiente)       border = colore del bordo
 *   radius = arrotondamento degli angoli in px
 *
 * Ogni elemento ha:
 *   key   = nome nel tema               label = nome mostrato nel Patron
 *   hint  = dove si trova               sel   = selettore CSS (molti usano l'attributo data-th="…" messo nel markup)
 *   kind  = tipo, decide quali proprietà si possono cambiare (vedi KINDS) — oppure props = elenco esplicito
 *   vars  = { proprietà: '--variabile' }: quella proprietà imposta una variabile CSS invece della regola diretta
 *           (es. il nome squadra si adatta alla larghezza partendo da --fit-max), sull'elemento o su vscope
 *   fill  = true: testo disegnato con un gradiente (il colore sostituisce il gradiente)
 *
 * Ogni sezione ha go = cosa aprire nell'anteprima del Patron (pagina, pannello del menu, menu laterale, avviso…).
 */

export const PROPS = {
  color:  { label: 'Colore',     type: 'color' },
  font:   { label: 'Font',       type: 'font' },
  size:   { label: 'Dimensione', type: 'px', min: 6, max: 72 },
  weight: { label: 'Spessore',   type: 'weight' },
  bg:     { label: 'Sfondo',     type: 'color', free: true },
  border: { label: 'Bordo',      type: 'color', free: true },
  radius: { label: 'Angoli',     type: 'px', min: 0, max: 40 }
};

export const KINDS = {
  text:   ['color', 'font', 'size', 'weight'],
  icon:   ['color', 'size'],
  panel:  ['bg', 'border', 'radius'],
  box:    ['bg', 'border', 'radius', 'color', 'font', 'size'],
  button: ['bg', 'color', 'border', 'font', 'size', 'radius'],
  input:  ['bg', 'color', 'border', 'font', 'size'],
  fill:   ['bg']
};

export const propsOf = (el) => el.props || KINDS[el.kind] || KINDS.text;

const th = (k) => `[data-th="${k}"]`;
const P = (page, s) => s.split(',').map(x => `${page} ${x.trim()}`).join(', ');

/* Elementi comuni alle card delle partite (Home, Calendario) */
const matchCards = (page, label) => [
  { key: 'matchCard',   label: `${label} · card`,           kind: 'panel', sel: P(page, '.match-card-vs, .match-card-result'), hint: 'Sfondo e bordo delle card delle partite' },
  { key: 'matchTeam',   label: `${label} · nomi squadre`,   kind: 'text',  sel: P(page, '.match-card-vs .fit-name, .match-card-result .fit-name'), vars: { size: '--fit-max' }, hint: 'Nomi delle due squadre (la dimensione è la massima: i nomi lunghi si rimpiccioliscono)' },
  { key: 'matchVs',     label: `${label} · VS`,             kind: 'text',  sel: P(page, th('match-vs')) },
  { key: 'matchScore',  label: `${label} · risultato`,      kind: 'box',   sel: P(page, th('match-score')), hint: 'Riquadro con i gol (es. 2:1)' },
  { key: 'matchPoints', label: `${label} · punti`,          kind: 'text',  sel: P(page, th('match-points')), hint: 'Punteggio fantacalcio (es. 72 - 68 pt)' },
  { key: 'matchLabel',  label: `${label} · girone/fase`,    kind: 'text',  sel: P(page, th('match-label')) },
  { key: 'matchNum',    label: `${label} · numero match`,   kind: 'text',  sel: P(page, th('match-num')), hint: '"Match 1", "Match 2"…' },
  { key: 'matchChip',   label: `${label} · etichetta stato`, kind: 'text', props: ['font', 'size'], sel: P(page, '.status-chip'), hint: 'LIVE, Conclusa, Da giocare… (il colore dipende dallo stato)' }
];

const playerCards = (page, label, extra = '') => [
  { key: 'playerCard',  label: `${label} · card`,        kind: 'panel', sel: P(page, '.pcard' + extra), hint: 'Sfondo e bordo delle card dei giocatori' },
  { key: 'playerName',  label: `${label} · nome`,        kind: 'text',  sel: P(page, '.pcard .pn') },
  { key: 'playerSub',   label: `${label} · dettagli`,    kind: 'text',  sel: P(page, '.pcard .pm'), hint: 'Squadra, presenze…' }
];

export const THEME_SECTIONS = [
  /* ───────────────────────────── PAGINE ───────────────────────────── */
  { key: 'home', label: 'Home', icon: 'ri-home-4-line', go: 'page:home', group: 'Pagine',
    elements: [
      { key: 'panel',        label: 'Pannello principale',    kind: 'panel', sel: th('home-panel'), hint: 'Grande riquadro in alto con logo, nome, maglia, classifica, stadio e palmarès' },
      { key: 'myTeamLabel',  label: 'Scritta "La mia squadra"', kind: 'text', sel: th('home-myTeamLabel') },
      { key: 'teamName',     label: 'Nome squadra',           kind: 'text',  sel: '#homeTeamName', vars: { size: '--home-team-name-max' }, hint: 'La dimensione è la massima: i nomi lunghi si rimpiccioliscono' },
      { key: 'presidentName', label: 'Nome presidente',       kind: 'text',  sel: '#homeTeamOwner', hint: '"Presidente: …" / "Copresidenti: …" sotto il nome' },
      { key: 'logoPanel',    label: 'Pannello logo squadra',  kind: 'panel', sel: '#userTeamLogo > *' },
      { key: 'kitPanel',     label: 'Riquadro maglia',        kind: 'panel', sel: '#homeKitBox' },
      { key: 'standingsPanel', label: 'Riquadro classifica',  kind: 'panel', sel: '#homeMiniClassifica' },
      { key: 'stadiumPanel', label: 'Riquadro stadio',        kind: 'panel', sel: '#homeStadiumBox' },
      { key: 'palmaresPanel', label: 'Riquadro palmarès',     kind: 'panel', sel: '#homePalmares' },
      { key: 'boxTitle',     label: 'Titoli dei riquadri',    kind: 'text',  sel: P('#page-home', th('home-boxTitle')), hint: '"Maglia", "Stadio", "Classifica"' },
      { key: 'palmaresTitle', label: 'Titolo "Palmarès"',     kind: 'text',  sel: th('home-palmaresTitle') },
      { key: 'boxLink',      label: 'Link "Modifica" / "Info club"', kind: 'text', sel: '#homeKitAction, #homeStadiumAction, #homePalmaresAction, #page-home [data-th="home-boxLink"]' },
      { key: 'stadiumName',  label: 'Nome stadio',            kind: 'text',  sel: th('home-stadiumName') },
      { key: 'stadiumSeats', label: 'Posti dello stadio',     kind: 'text',  sel: th('home-stadiumSeats') },
      { key: 'standingsRow', label: 'Classifica · righe',     props: ['bg', 'border', 'color'], sel: '#page-home', vars: { bg: '--mc-row-bg', border: '--mc-row-border', color: '--mc-row-text' }, noPick: true, hint: 'Righe delle altre squadre nella mini classifica' },
      { key: 'standingsMe',  label: 'Classifica · riga della tua squadra', props: ['bg', 'border', 'color'], sel: '#page-home', vars: { bg: '--mc-active-bg', border: '--mc-active-border', color: '--mc-active-text' }, noPick: true },
      { key: 'standingsTeam', label: 'Classifica · nomi squadre', kind: 'text', props: ['font', 'weight'], sel: '#homeMiniClassifica .fit-name, [data-th="mini-team"]' },
      { key: 'sectionTitle', label: 'Titoli di sezione',      kind: 'text',  sel: '#page-home .sec', hint: '"Ultima Partita", "Live Match", "Prossimo Avversario", "Giocatori On Fire"' },
      ...matchCards('#page-home', 'Partite'),
      ...playerCards('#homeOnFirePlayers', 'On Fire'),
      { key: 'onFireAvg',    label: 'On Fire · media',        kind: 'text',  sel: th('home-onFireAvg') },
      { key: 'gwCard',       label: 'Card giornata reale',    kind: 'panel', sel: '#home-status-banner .card-mini', hint: 'Card piccola in fondo a destra (Serie A, giornata)' },
      { key: 'gwTitle',      label: 'Card giornata · titolo', kind: 'text',  sel: th('home-gwTitle') },
      { key: 'gwText',       label: 'Card giornata · testo',  kind: 'text',  sel: th('home-gwText') },
      { key: 'empty',        label: 'Messaggi "nessun dato"', kind: 'text',  sel: P('#page-home', th('empty')) }
    ] },

  { key: 'calendario', label: 'Calendario', icon: 'ri-calendar-line', go: 'page:calendario', group: 'Pagine',
    elements: [
      { key: 'gwCard',     label: 'Riquadro scelta turno',  kind: 'panel', sel: th('cal-gwCard') },
      { key: 'gwLabel',    label: 'Scritta "Seleziona Turno di Gioco"', kind: 'text', sel: '[data-th="cal-gwCard"] .label' },
      { key: 'gwSelect',   label: 'Selettore turno',        kind: 'input', sel: '[data-cs-for="calGwSelect"]' },
      { key: 'gwTitle',    label: 'Titolo della giornata',  kind: 'text',  sel: '#calGwTitle' },
      ...matchCards('#page-calendario', 'Partite'),
      { key: 'popup',      label: 'Avviso "bloccato"',      kind: 'box',   sel: '#cal-popup .card' }
    ] },

  { key: 'classifica', label: 'Classifica', icon: 'ri-bar-chart-2-line', go: 'page:classifica', group: 'Pagine',
    elements: [
      { key: 'switchBtn',  label: 'Pulsanti Classifica / Tabellone', kind: 'button', sel: '#btn-mostra-classifica, #btn-mostra-tabellone' },
      { key: 'legend',     label: 'Legenda colori',         kind: 'box',   sel: th('cls-legend') },
      { key: 'groupTitle', label: 'Titoli dei gironi',      kind: 'text',  sel: th('cls-groupTitle') },
      { key: 'table',      label: 'Pannello classifica',    kind: 'panel', sel: th('cls-table') },
      { key: 'head',       label: 'Intestazione colonne',   kind: 'box',   sel: th('cls-head'), hint: 'G V N P Gf Gs Pt Pt Totali' },
      { key: 'row',        label: 'Righe squadre',          props: ['bg', 'border'], sel: th('cls-row') },
      { key: 'myRow',      label: 'Riga della tua squadra', props: ['bg', 'border'], sel: '[data-th="cls-row"][data-me]' },
      { key: 'pos',        label: 'Posizione',              kind: 'text',  sel: th('cls-pos') },
      { key: 'team',       label: 'Nome squadra',           kind: 'text',  sel: th('cls-team') },
      { key: 'stats',      label: 'Numeri (G V N P Gf Gs)', kind: 'text',  sel: th('cls-stats') },
      { key: 'pts',        label: 'Punti',                  kind: 'text',  sel: th('cls-pts') },
      { key: 'tot',        label: 'Punti totali',           kind: 'text',  props: ['font', 'size', 'weight'], sel: th('cls-tot') },
      { key: 'phase',      label: 'Tabellone · nome fase',  kind: 'box',   sel: th('cls-phase') },
      { key: 'koMatch',    label: 'Tabellone · incontro',   kind: 'box',   sel: th('cls-koMatch') }
    ] },

  { key: 'formazione', label: 'Formazione', icon: 'ri-shield-user-line', go: 'page:formazione', group: 'Pagine',
    elements: [
      { key: 'moduleCard', label: 'Riquadro modulo',        kind: 'panel', sel: th('f-moduleCard') },
      { key: 'cardLabel',  label: 'Scritte dei riquadri',   kind: 'text',  sel: '#page-formazione .card .label', hint: '"Seleziona Modulo", "Capitano", "Salva per tutte le competizioni"' },
      { key: 'select',     label: 'Selettori (modulo, capitano)', kind: 'input', sel: '#page-formazione .cs-btn' },
      { key: 'titleXI',    label: 'Titolo "Titolari"',      kind: 'text',  sel: th('f-titleXI') },
      { key: 'field',      label: 'Campo da gioco',         kind: 'panel', sel: '#page-formazione .soccer-field' },
      { key: 'playerName', label: 'Nomi sul campo',         kind: 'box',   sel: '#page-formazione .player-name-label' },
      { key: 'captainCard', label: 'Riquadro capitano',     kind: 'panel', sel: '#f-captain' },
      { key: 'titleBench', label: 'Titolo "Panchina"',      kind: 'text',  sel: th('f-titleBench') },
      { key: 'bench',      label: 'Panchinari',             kind: 'box',   sel: '#page-formazione .pan-pick' },
      { key: 'saveAll',    label: 'Riquadro "Salva per tutte"', kind: 'panel', sel: th('f-saveAll') },
      { key: 'saveInfo',   label: 'Nota sotto',             kind: 'text',  sel: '#f-save-info' },
      { key: 'saveBtn',    label: 'Pulsante Salva Formazione', kind: 'button', sel: '#btn-save-lineup' },
      { key: 'lock',       label: 'Avviso formazione chiusa', kind: 'box', sel: '#f-lock-banner > *' }
    ] },

  { key: 'mercato', label: 'Mercato', icon: 'ri-shopping-cart-line', go: 'page:mercato', group: 'Pagine',
    elements: [
      { key: 'tabs',      label: 'Barra delle schede',     kind: 'panel', sel: '#page-mercato .mk-tabs' },
      { key: 'tab',       label: 'Schede',                 kind: 'button', sel: '#page-mercato .mk-tabs .btn-outline' },
      { key: 'tabOn',     label: 'Scheda attiva',          kind: 'button', sel: '#page-mercato .mk-tabs .btn-green' },
      { key: 'badge',     label: 'Contatore sulle schede', kind: 'box',   sel: '#page-mercato .mk-dot' },
      { key: 'card',      label: 'Riquadri',               kind: 'panel', sel: '#page-mercato .card' },
      { key: 'label',     label: 'Scritte dei campi',      kind: 'text',  sel: '#page-mercato .label:not(.mk-sec)' },
      { key: 'sec',       label: 'Titoli di sezione',      kind: 'text',  sel: '#page-mercato .mk-sec' },
      { key: 'select',    label: 'Selettori',              kind: 'input', sel: '#page-mercato .cs-btn' },
      { key: 'rosterHead', label: 'Rose · intestazione',   kind: 'text',  sel: '#page-mercato .mk-rhead' },
      { key: 'rosterGroup', label: 'Rose · ruoli',         kind: 'text',  sel: '#page-mercato .mk-rgroup' },
      { key: 'row',       label: 'Giocatori',              kind: 'panel', sel: '#page-mercato .mk-prow' },
      { key: 'rowSel',    label: 'Giocatore scelto',       kind: 'panel', sel: '#page-mercato .mk-prow.sel' },
      { key: 'rowName',   label: 'Giocatori · nome',       kind: 'text',  sel: '#page-mercato .mk-prow .nm' },
      { key: 'rowSub',    label: 'Giocatori · dettagli',   kind: 'text',  sel: '#page-mercato .mk-prow .sub' },
      { key: 'sum',       label: 'Riepilogo scambio',      kind: 'box',   sel: '#page-mercato .mk-sumcol' },
      { key: 'line',      label: 'Righe delle proposte',   kind: 'text',  sel: '#page-mercato .mk-line' },
      { key: 'badgeState', label: 'Etichette di stato',    props: ['font', 'size', 'radius'], sel: '#page-mercato .mk-badge' },
      { key: 'btn',       label: 'Pulsante principale',    kind: 'button', sel: '#page-mercato .btn-green:not(.tab-btn)' },
      { key: 'btn2',      label: 'Pulsanti secondari',     kind: 'button', sel: '#page-mercato .btn-outline:not(.tab-btn)' }
    ] },

  { key: 'teams', label: 'Squadre', icon: 'ri-team-line', go: 'page:teams', group: 'Pagine',
    elements: [
      { key: 'card',        label: 'Card squadra',          kind: 'panel', sel: '#teams-grid-container .card-mini' },
      { key: 'logo',        label: 'Logo nella card',       props: ['bg', 'radius'], sel: th('t-logo') },
      { key: 'name',        label: 'Nome squadra',          kind: 'text',  sel: th('t-name') },
      { key: 'presidentLabel', label: 'Scritta "Presidente"', kind: 'text', sel: th('t-owner') },
      { key: 'presidentName', label: 'Nome presidente',     kind: 'text',  sel: th('t-ownerNames') },
      { key: 'arrow',       label: 'Freccia',               kind: 'icon',  props: ['color'], sel: th('t-arrow') },
      { key: 'detailTitle', label: 'Scheda · nome squadra', kind: 'text',  sel: '#team-detail-title' },
      { key: 'backBtn',     label: 'Scheda · pulsante Indietro', kind: 'button', sel: '#team-detail-view > div:first-child .btn-outline' },
      { key: 'infoBtn',     label: 'Scheda · pulsante Info Club', kind: 'button', sel: '#btn-info-club' },
      { key: 'roleTitle',   label: 'Scheda · titoli dei ruoli', kind: 'text', sel: '#team-roster-container .label' },
      ...playerCards('#team-roster-container', 'Rosa'),
      { key: 'price',       label: 'Rosa · prezzo',         kind: 'text',  sel: '#team-roster-container .price' },
      { key: 'avg',         label: 'Rosa · media',          kind: 'text',  sel: '#team-roster-container .pavg' },
      { key: 'clubBox',     label: 'Info Club · finestra',  kind: 'panel', sel: '#club-info-modal > .card' },
      { key: 'clubVeil',    label: 'Info Club · velo dietro', kind: 'fill', sel: '#club-info-modal' },
      { key: 'clubName',    label: 'Info Club · nome squadra', kind: 'text', sel: th('t-clubName') },
      { key: 'clubStaff',   label: 'Info Club · presidenza', kind: 'text', sel: th('t-clubStaff'), hint: 'Titoli (Presidente, Vicepresidente…)' },
      { key: 'clubStaffName', label: 'Info Club · nomi della presidenza', kind: 'text', sel: '[data-th="t-clubStaff"] span' },
      { key: 'clubMotto',   label: 'Info Club · motto',     kind: 'text',  sel: th('t-clubMotto') },
      { key: 'clubCard',    label: 'Info Club · riquadri',  kind: 'panel', sel: '#club-info-content .card' },
      { key: 'clubLabel',   label: 'Info Club · titoli dei riquadri', kind: 'text', sel: '#club-info-content .card .label' },
      { key: 'clubDesc',    label: 'Info Club · descrizione', kind: 'text', sel: th('t-clubDesc') },
      { key: 'trophy',      label: 'Info Club · trofei',    kind: 'panel', sel: th('t-trophy') },
      { key: 'trophyName',  label: 'Info Club · nome trofeo', kind: 'text', sel: th('t-trophyName') },
      { key: 'closeBtn',    label: 'Info Club · pulsante Chiudi', kind: 'button', sel: '#close-info-modal' }
    ] },

  { key: 'live', label: 'Live', icon: 'ri-live-line', go: 'page:live', group: 'Pagine',
    elements: [
      { key: 'head',      label: 'Tabellone del match',    kind: 'panel', sel: '.lv-head' },
      { key: 'teamName',  label: 'Nomi squadre',           kind: 'text',  sel: '.lv-tname .fit-name, .lv-tname', vars: { size: '--fit-max' } },
      { key: 'president', label: 'Presidenti',             kind: 'text',  sel: '.lv-towner' },
      { key: 'module',    label: 'Moduli',                 kind: 'text',  sel: '.lv-tmod' },
      { key: 'score',     label: 'Punteggio',              kind: 'text',  sel: '.lv-pts' },
      { key: 'scoreSub',  label: 'Scritta sotto il punteggio', kind: 'text', sel: '.lv-pts-sub' },
      { key: 'goals',     label: 'Gol',                    kind: 'text',  sel: '.lv-pts-goals' },
      { key: 'liveChip',  label: 'Etichetta LIVE',         kind: 'box',   sel: '.lv-livechip' },
      { key: 'seg',       label: 'Selettori a schede',     kind: 'panel', sel: '.lv-seg' },
      { key: 'sim',       label: 'Riquadro simulazione',   kind: 'panel', sel: '.lv-sim' },
      { key: 'simTitle',  label: 'Simulazione · titolo',   kind: 'text',  sel: '.lv-sim-title' },
      { key: 'btn',       label: 'Pulsanti',               kind: 'button', sel: '.lv-btn:not(.prim)' },
      { key: 'btnPrim',   label: 'Pulsante principale',    kind: 'button', sel: '.lv-btn.prim' },
      { key: 'sec',       label: 'Titoli (Titolari, Panchina)', kind: 'text', sel: '.lv-sec' },
      { key: 'player',    label: 'Giocatori · card',       kind: 'panel', sel: '.lv-half:not(.empty)' },
      { key: 'playerName', label: 'Giocatori · nome',      kind: 'text',  sel: '.lv-name' },
      { key: 'event',     label: 'Giocatori · bonus/malus', kind: 'text', sel: '.lv-ev' },
      { key: 'chip',      label: 'Giocatori · etichette',  kind: 'box',   sel: '.lv-chip' },
      { key: 'foot',      label: 'Riquadro totali',        kind: 'panel', sel: '.lv-foot' },
      { key: 'footTitle', label: 'Totali · titolo',        kind: 'box',   sel: '.lv-foot-title' },
      { key: 'tot',       label: 'Totali · righe',         kind: 'text',  sel: '.lv-tot' },
      { key: 'legend',    label: 'Legenda',                kind: 'text',  sel: '.lv-legend' },
      { key: 'select',    label: 'Scelta della partita',   kind: 'input', sel: '#page-live .cs-btn' }
    ] },

  { key: 'login', label: 'Login', icon: 'ri-login-box-line', go: 'login', group: 'Pagine',
    elements: [
      { key: 'logo',     label: 'Scritta FANTACAPP',       kind: 'text', fill: true, sel: '#page-login .logo' },
      { key: 'card',     label: 'Riquadri',                kind: 'panel', sel: '#page-login .card' },
      { key: 'label',    label: 'Scritte dei campi',       kind: 'text', sel: '#page-login .label' },
      { key: 'input',    label: 'Campi (email, password)', kind: 'input', sel: '#page-login .input-login, #page-login .cs-btn' },
      { key: 'placeholder', label: 'Testo di esempio nei campi', kind: 'text', props: ['color'], sel: '#page-login .input-login::placeholder' },
      { key: 'btn',      label: 'Pulsante Accedi / Entra', kind: 'button', sel: '#page-login .btn-green' },
      { key: 'btn2',     label: 'Pulsante Disconnetti',    kind: 'button', sel: '#page-login .btn-outline' },
      { key: 'link',     label: 'Link Registrati / Accedi', kind: 'text', sel: '#page-login .link-toggle' },
      { key: 'note',     label: 'Note',                    kind: 'text', sel: '#page-login .login-note' }
    ] },

  /* ───────────────────────────── MENU ───────────────────────────── */
  { key: 'header', label: 'Barra in alto', icon: 'ri-layout-top-line', go: 'page:home', group: 'Menu',
    elements: [
      { key: 'bar',    label: 'Barra',                  kind: 'fill', sel: '#app-header' },
      { key: 'comp',   label: 'Selettore competizione', kind: 'input', sel: '[data-cs-for="userCompSelect"]' },
      { key: 'icons',  label: 'Icone (notifiche, menu)', kind: 'icon', sel: '#app-header .menu-header-btn' },
      { key: 'badge',  label: 'Pallino delle notifiche', kind: 'fill', sel: '#app-header .badge-dot' }
    ] },
  { key: 'nav', label: 'Barra in basso', icon: 'ri-layout-bottom-line', go: 'page:home', group: 'Menu',
    elements: [
      { key: 'bar',    label: 'Barra',          kind: 'fill', sel: '#nav, #status-bar', vars: { bg: '--nav-bg' }, hint: 'Colora anche la fascia sotto l\'ora su iPhone' },
      { key: 'tab',    label: 'Pulsanti',       kind: 'text', props: ['color', 'font', 'size', 'weight'], sel: '#nav .nav-btn' },
      { key: 'tabOn',  label: 'Pulsante attivo', props: ['color', 'bg'], sel: '#nav .nav-btn.active', vars: { color: '--nav-active' }, vscope: '#nav' },
      { key: 'icon',   label: 'Icone',          kind: 'icon', props: ['size'], sel: '#nav .nav-btn i' }
    ] },
  { key: 'drawer', label: 'Menu laterale', icon: 'ri-menu-line', go: 'drawer', group: 'Menu',
    elements: [
      { key: 'panel',  label: 'Pannello',           kind: 'fill', sel: '#side-menu' },
      { key: 'title',  label: 'Titolo "Menu"',      kind: 'text', sel: '#side-menu .side-menu-title' },
      { key: 'item',   label: 'Voci',               kind: 'text', sel: '#side-menu .side-menu-item' },
      { key: 'icon',   label: 'Icone delle voci',   kind: 'icon', sel: '#side-menu .side-menu-item:not(.patron):not(.danger) i' },
      { key: 'patron', label: 'Voce "Passa a Patron"', kind: 'text', props: ['color'], sel: '#side-menu .side-menu-item.patron, #side-menu .side-menu-item.patron i' },
      { key: 'logout', label: 'Voce "Log out"',     kind: 'text', props: ['color'], sel: '#side-menu .side-menu-item.danger, #side-menu .side-menu-item.danger i' },
      { key: 'sep',    label: 'Linea di separazione', kind: 'fill', sel: '#side-menu .side-menu-sep' },
      { key: 'veil',   label: 'Velo dietro',        kind: 'fill', sel: '#side-menu-backdrop' }
    ] },
  { key: 'panels', label: 'Pannelli del menu', icon: 'ri-window-line', go: 'menu:settings', group: 'Menu',
    desc: 'Impostazioni, Configurazione squadra, Divisa, Stadio, Listone, Svincolati, Notifiche.',
    elements: [
      { key: 'panel',  label: 'Sfondo del pannello', kind: 'fill', sel: '#menu-panel', vars: { bg: '--menu-bg' }, hint: 'Con un colore trasparente (rgba) si vede lo sfondo del tema' },
      { key: 'head',   label: 'Barra del titolo',   kind: 'fill', sel: '#menu-panel .mp-head' },
      { key: 'title',  label: 'Titolo del pannello', kind: 'text', sel: '#menu-panel .mp-title' },
      { key: 'back',   label: 'Freccia indietro',   kind: 'icon', sel: '#menu-panel .mp-head .menu-header-btn' },
      { key: 'card',   label: 'Riquadri',           kind: 'panel', sel: '#menu-panel .mp-card' },
      { key: 'cardTitle', label: 'Titoli dei riquadri', kind: 'text', sel: '#menu-panel .mp-card-title' },
      { key: 'rowLabel', label: 'Nomi delle opzioni', kind: 'text', sel: '#menu-panel .mp-row-label' },
      { key: 'muted',  label: 'Spiegazioni',        kind: 'text', sel: '#menu-panel .mp-muted' },
      { key: 'select', label: 'Selettori',          kind: 'input', sel: '#menu-panel .cs-btn, #menu-panel .mp-select' },
      { key: 'input',  label: 'Campi di testo',     kind: 'input', sel: '#menu-panel input[type="text"], #menu-panel input[type="search"], #menu-panel textarea' },
      { key: 'switchOn', label: 'Interruttori accesi', props: ['bg', 'border'], sel: '#menu-panel .mp-switch input:checked + span' },
      { key: 'chip',   label: 'Filtri',             kind: 'button', sel: '#menu-panel .lv-chip:not(.on)' },
      { key: 'chipOn', label: 'Filtro attivo',      kind: 'button', sel: '#menu-panel .lv-chip.on' },
      { key: 'btn',    label: 'Pulsante principale', kind: 'button', sel: '#menu-panel .mp-btn:not(.ghost):not(.danger)' },
      { key: 'btn2',   label: 'Pulsanti secondari', kind: 'button', sel: '#menu-panel .mp-btn.ghost' },
      { key: 'btnDanger', label: 'Pulsanti di eliminazione', kind: 'button', sel: '#menu-panel .mp-btn.danger' },
      ...playerCards('#menu-panel', 'Listone/Svincolati'),
      { key: 'price',  label: 'Listone · prezzo',   kind: 'text', sel: '#menu-panel .price' }
    ] },

  /* ───────────────────────────── NOTIFICHE ───────────────────────────── */
  { key: 'toast', label: 'Messaggi brevi', icon: 'ri-chat-1-line', go: 'toast', group: 'Notifiche',
    desc: 'Messaggi che compaiono per qualche secondo in alto (es. "Formazione salvata").',
    elements: [
      { key: 'info', label: 'Messaggio informativo', kind: 'box', sel: '.toast' },
      { key: 'ok',   label: 'Messaggio di conferma', props: ['bg', 'border', 'color'], sel: '.toast.ok' },
      { key: 'err',  label: 'Messaggio di errore',   props: ['bg', 'border', 'color'], sel: '.toast.err' }
    ] },
  { key: 'updateBanner', label: 'Avviso aggiornamento', icon: 'ri-refresh-line', go: 'update', group: 'Notifiche',
    elements: [
      { key: 'box',   label: 'Riquadro',          kind: 'panel', sel: '#update-banner' },
      { key: 'icon',  label: 'Icona',             kind: 'icon',  sel: '#update-banner > i' },
      { key: 'text',  label: 'Testo',             kind: 'text',  sel: '#update-banner > span' },
      { key: 'go',    label: 'Pulsante Aggiorna', kind: 'button', sel: '#update-banner .upd-go' },
      { key: 'later', label: 'Pulsante Dopo',     kind: 'button', sel: '#update-banner .upd-no' }
    ] },
  { key: 'notifInvite', label: 'Invito alle notifiche', icon: 'ri-notification-badge-line', go: 'invite', group: 'Notifiche',
    elements: [
      { key: 'box',   label: 'Riquadro',          kind: 'panel', sel: '#notif-invite' },
      { key: 'icon',  label: 'Icona',             kind: 'box',   props: ['bg', 'color', 'size', 'radius'], sel: '#notif-invite .ni-ico' },
      { key: 'title', label: 'Titolo',            kind: 'text',  sel: '#notif-invite .ni-txt b' },
      { key: 'text',  label: 'Spiegazione',       kind: 'text',  sel: '#notif-invite .ni-txt' },
      { key: 'yes',   label: 'Pulsante Attiva',   kind: 'button', sel: '#notif-invite .ni-yes' },
      { key: 'no',    label: 'Pulsante Non ora',  kind: 'button', sel: '#notif-invite .ni-no' }
    ] },
  { key: 'offlineBanner', label: 'Avviso offline', icon: 'ri-wifi-off-line', go: 'offline', group: 'Notifiche',
    elements: [
      { key: 'box',  label: 'Etichetta', kind: 'box',  sel: '#offline-banner' },
      { key: 'icon', label: 'Icona',     kind: 'icon', sel: '#offline-banner i' }
    ] },
  { key: 'notifList', label: 'Elenco notifiche', icon: 'ri-notification-3-line', go: 'menu:notifiche', group: 'Notifiche',
    elements: [
      { key: 'item',  label: 'Notifica',          kind: 'panel', sel: '#menu-panel .nf-item' },
      { key: 'icon',  label: 'Icona',             kind: 'box',   props: ['bg', 'color', 'size', 'radius'], sel: '#menu-panel .nf-ico' },
      { key: 'title', label: 'Titolo',            kind: 'text',  sel: '#menu-panel .nf-t' },
      { key: 'body',  label: 'Testo',             kind: 'text',  sel: '#menu-panel .nf-b' },
      { key: 'date',  label: 'Data',              kind: 'text',  sel: '#menu-panel .nf-d' },
      { key: 'dot',   label: 'Pallino "non letta"', kind: 'fill', sel: '#menu-panel .nf-dot' }
    ] },

  /* ───────────────────────────── FINESTRE ───────────────────────────── */
  { key: 'playerSheet', label: 'Scheda giocatore', icon: 'ri-user-3-line', go: 'player', group: 'Finestre',
    elements: [
      { key: 'veil',   label: 'Velo dietro',        kind: 'fill',  sel: '#pc-overlay' },
      { key: 'sheet',  label: 'Finestra',           kind: 'panel', sel: '#pc-overlay .pc-sheet' },
      { key: 'name',   label: 'Nome giocatore',     kind: 'text',  sel: '#pc-overlay .pc-name' },
      { key: 'club',   label: 'Squadra di Serie A', kind: 'text',  sel: '#pc-overlay .pc-club' },
      { key: 'owner',  label: 'Squadra fanta',      kind: 'text',  sel: '#pc-overlay .pc-owner' },
      { key: 'avg',    label: 'Media',              kind: 'text',  sel: '#pc-overlay .pc-avg .pc-num' },
      { key: 'title',  label: 'Titoli delle sezioni', kind: 'text', sel: '#pc-overlay .pc-h3' },
      { key: 'lab',    label: 'Etichette',          kind: 'text',  sel: '#pc-overlay .pc-lab' },
      { key: 'cell',   label: 'Giornate',           kind: 'box',   sel: '#pc-overlay .pc-cell:not(.sel)' },
      { key: 'cellOn', label: 'Giornata scelta',    kind: 'box',   sel: '#pc-overlay .pc-cell.sel' },
      { key: 'close',  label: 'Pulsante chiudi',    kind: 'button', sel: '#pc-overlay .pc-close' },
      { key: 'fav',    label: 'Stella preferiti',   kind: 'icon',  sel: '#pc-overlay .pc-fav' }
    ] },
  { key: 'choiceSheet', label: 'Liste di scelta', icon: 'ri-list-check', go: 'choice', group: 'Finestre',
    desc: 'Liste che si aprono dal basso per scegliere squadra, competizione, giornata, modulo, tema…',
    elements: [
      { key: 'veil',  label: 'Velo dietro',     kind: 'fill',  sel: '.cs-overlay' },
      { key: 'sheet', label: 'Finestra',        kind: 'panel', sel: '.cs-sheet' },
      { key: 'title', label: 'Titolo',          kind: 'text',  sel: '.cs-title' },
      { key: 'search', label: 'Campo di ricerca', kind: 'input', sel: '.cs-search input' },
      { key: 'group', label: 'Gruppi',          kind: 'text',  sel: '.cs-group' },
      { key: 'row',   label: 'Voci',            kind: 'box',   sel: '.cs-row:not(.on)' },
      { key: 'rowOn', label: 'Voce scelta',     kind: 'box',   sel: '.cs-row.on' },
      { key: 'label', label: 'Nomi delle voci', kind: 'text',  sel: '.cs-label' },
      { key: 'sub',   label: 'Dettagli delle voci', kind: 'text', sel: '.cs-sub' },
      { key: 'check', label: 'Spunta',          kind: 'icon',  sel: '.cs-check' },
      { key: 'btn',   label: 'Pulsanti che aprono le liste (ovunque)', kind: 'input', sel: '.cs-btn' }
    ] },
  { key: 'playerPicker', label: 'Scelta giocatore (Formazione)', icon: 'ri-user-add-line', go: 'page:formazione', group: 'Finestre',
    elements: [
      { key: 'veil',  label: 'Velo dietro',      kind: 'fill',  sel: '.fp-overlay' },
      { key: 'sheet', label: 'Finestra',         kind: 'panel', sel: '.fp-sheet' },
      { key: 'title', label: 'Titolo',           kind: 'text',  sel: '.fp-title' },
      { key: 'sub',   label: 'Sottotitolo',      kind: 'text',  sel: '.fp-sub' },
      { key: 'row',   label: 'Giocatori',        kind: 'panel', sel: '.fp-row' },
      { key: 'rowOn', label: 'Giocatore attuale', kind: 'panel', sel: '.fp-row.is-current' },
      { key: 'name',  label: 'Nomi',             kind: 'text',  sel: '.fp-name' },
      { key: 'meta',  label: 'Dettagli',         kind: 'text',  sel: '.fp-meta' }
    ] },
  { key: 'matchViewer', label: 'Partita (replay)', icon: 'ri-play-circle-line', go: 'page:calendario', group: 'Finestre',
    desc: 'Replay delle giornate passate e formazioni schierate (dalla Home e dal Calendario). Il contenuto usa gli elementi del Live.',
    elements: [
      { key: 'bg',    label: 'Sfondo',          kind: 'fill',  sel: '#match-viewer' },
      { key: 'bar',   label: 'Barra in alto',   kind: 'fill',  sel: th('mv-bar') },
      { key: 'sub',   label: 'Scritta "Replay match"', kind: 'text', sel: th('mv-sub') },
      { key: 'title', label: 'Squadre',         kind: 'text',  sel: th('mv-title') },
      { key: 'back',  label: 'Pulsante Indietro', kind: 'button', sel: '#mv-close' }
    ] },
  { key: 'liveEditor', label: 'Modifica voto (Live)', icon: 'ri-edit-line', go: 'page:live', group: 'Finestre',
    elements: [
      { key: 'sheet', label: 'Finestra',        kind: 'panel', sel: '.lv-ed' },
      { key: 'row',   label: 'Bonus e malus',   kind: 'box',   sel: '.lv-ed-e' },
      { key: 'fv',    label: 'Fantavoto',       kind: 'text',  sel: '.lv-ed-fv' }
    ] },
  { key: 'kitWindows', label: 'Finestre della divisa', icon: 'ri-t-shirt-2-line', go: 'menu:kit', group: 'Finestre',
    elements: [
      { key: 'zoom',      label: 'Zoom maglia · sfondo', kind: 'fill', sel: '.kit-zoom' },
      { key: 'zoomBtn',   label: 'Zoom maglia · pulsanti', kind: 'button', sel: '.kit-zoom button' },
      { key: 'modal',     label: 'Scelta disegni · finestra', kind: 'panel', sel: '.kit-modal-box' },
      { key: 'modalHead', label: 'Scelta disegni · titolo', kind: 'text', sel: '.kit-modal-head' }
    ] }
];

export const SECTION_GROUPS = ['Pagine', 'Menu', 'Notifiche', 'Finestre'];

/* ------------------------------------------------------------------------ *
 * CSS
 * Le regole usano !important e due :not(#…) per vincere sugli stili scritti
 * nel markup (style="…") e su quelli dei componenti.
 * ------------------------------------------------------------------------ */
const BOOST = ':not(#th-x):not(#th-x)';

function boost(sel) {
  return sel.split(',').map(s => {
    s = s.trim();
    const i = s.indexOf('::');
    return i >= 0 ? s.slice(0, i) + BOOST + s.slice(i) : s + BOOST;
  }).join(', ');
}

const clean = (v) => String(v).replace(/[;{}<>\\]/g, '').trim();
const px = (v, p) => {
  const n = parseFloat(v);
  if (!isFinite(n)) return '';
  const { min, max } = PROPS[p];
  return Math.min(max, Math.max(min, n)) + 'px';
};

/**
 * CSS degli elementi. fonts = THEME_FONTS (passato da themeService per non creare un giro di import).
 */
export function buildElementsCss(el, fonts) {
  if (!el || typeof el !== 'object') return '';
  const out = [];
  THEME_SECTIONS.forEach(sec => {
    const vals = el[sec.key];
    if (!vals || typeof vals !== 'object') return;
    sec.elements.forEach(e => {
      const v = vals[e.key];
      if (!v || typeof v !== 'object') return;
      const decl = [], vdecl = [];
      propsOf(e).forEach(p => {
        const raw = v[p];
        if (raw === undefined || raw === null || raw === '') return;
        let val;
        if (p === 'font') {
          const f = fonts.find(x => x.key === raw && x.css);
          if (!f) return;
          val = f.css;
        } else if (p === 'size' || p === 'radius') val = px(raw, p);
        else if (p === 'weight') val = raw === 'bold' ? '700' : (raw === 'normal' ? '400' : '');
        else val = clean(raw);
        if (!val) return;

        if (e.vars && e.vars[p]) { vdecl.push(`${e.vars[p]}: ${val};`); return; }
        const css = { color: 'color', font: 'font-family', size: 'font-size', weight: 'font-weight', bg: 'background', border: 'border-color', radius: 'border-radius' }[p];
        decl.push(`${css}: ${val} !important;`);
        if (p === 'color' && e.fill) decl.push(`-webkit-text-fill-color: ${val} !important; background: none !important;`);
      });
      if (decl.length) out.push(`${boost(e.sel)} { ${decl.join(' ')} }`);
      if (vdecl.length) out.push(`${boost(e.vscope || e.sel)} { ${vdecl.join(' ')} }`);
    });
  });
  return out.join('\n');
}

/**
 * Elemento del catalogo che contiene il nodo (per "tocca per modificare" nell'anteprima).
 * Risale dal nodo toccato: vince il primo antenato che corrisponde a un elemento;
 * a parità, quello di una delle sezioni preferite (la pagina aperta).
 */
export function findElementAt(node, preferred = []) {
  for (let n = node; n && n.nodeType === 1; n = n.parentElement) {
    const hits = [];
    THEME_SECTIONS.forEach(sec => sec.elements.forEach(e => {
      if (e.noPick || e.sel.includes('::')) return;
      try { if (n.matches(e.sel)) hits.push({ section: sec.key, key: e.key }); } catch (err) { /* selettore non valido qui */ }
    }));
    if (hits.length) return hits.find(h => preferred.includes(h.section)) || hits[0];
  }
  return null;
}
