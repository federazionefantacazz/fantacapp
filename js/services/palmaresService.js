import { toArray } from '../utils.js';

const intOr = (v, def) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
};

/**
 * Trofei vinti da una squadra (team.palmares), con i dati del trofeo già risolti.
 * Usato dalla Home (bacheca) e dalla scheda "Info Club": prima la stessa logica era copiata in entrambi.
 *
 * team.palmares = { "<stagione>": { "<compId>": { trofeo_vinto: true | "<trophyId>" } } }
 * Se trofeo_vinto non è un id, vale il trofeo associato alla competizione (comp.trophyId) o l'id della competizione.
 *
 * Ritorna [{ trophyId, season, name, image, scale, ordineHome }]
 */
export function getWonTrophies(team, trophies, competitions) {
  if (!team || !team.palmares) return [];

  // trophies può arrivare come lista [{id, ...}] o come nodo Firebase { id: {...} | "nome" }
  const trophyList = Array.isArray(trophies)
    ? trophies
    : Object.entries(trophies || {}).map(([id, v]) => (typeof v === 'object' ? { id, ...v } : { id, name: v }));
  const trophiesById = Object.fromEntries(trophyList.map(t => [t.id, t]));
  const compsById = Object.fromEntries(toArray(competitions).map(c => [c.id, c]));

  const won = [];
  Object.entries(team.palmares).forEach(([season, seasonComps]) => {
    if (!seasonComps || typeof seasonComps !== 'object') return;
    Object.entries(seasonComps).forEach(([compId, item]) => {
      if (!item || !item.trofeo_vinto) return;
      const trophyId = typeof item.trofeo_vinto === 'string'
        ? item.trofeo_vinto
        : (compsById[compId]?.trophyId || compId);
      const trophy = trophiesById[trophyId];
      won.push({
        trophyId,
        season,
        name: trophy?.name || compsById[compId]?.name || trophyId,
        image: trophy?.image || trophy?.img || trophy?.url || '',
        scale: intOr(trophy?.scale, 100),
        ordineHome: intOr(trophy?.ordine_home, 1)
      });
    });
  });
  return won;
}
