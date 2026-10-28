/**
 * Presidenza della squadra: chi la guida e con quale titolo.
 *
 * teams/{id}/staff = [{ name, role, title }]
 *   - il primo è Presidente o Copresidente
 *   - dal secondo in poi: Copresidente oppure un altro titolo scritto a mano (role 'altro', es. Vicepresidente)
 *   - se il primo è Copresidente almeno un altro deve esserlo; con un Presidente non ci sono Copresidenti
 * teams/{id}/owner resta il testo con i nomi di chi presiede (lo leggono le parti dell'app che lo usavano già).
 * Le squadre senza staff hanno come Presidente il vecchio owner.
 */
export const ROLES = {
  presidente: 'Presidente',
  copresidente: 'Copresidente',
  altro: 'Altro titolo'
};

const isLeader = (m) => m.role === 'presidente' || m.role === 'copresidente';

function normalizeMember(m, i) {
  const role = m && m.role === 'copresidente' ? 'copresidente' : (i === 0 ? 'presidente' : 'altro');
  return {
    name: String((m && m.name) || '').trim(),
    role,
    title: role === 'altro' ? String((m && m.title) || '').trim() : ''
  };
}

/** Presidenza della squadra (sempre un array, il primo è chi presiede). */
export function getStaff(team) {
  const raw = team && team.staff;
  const list = Array.isArray(raw) ? raw : (raw && typeof raw === 'object' ? Object.values(raw) : []);
  const clean = list.filter(m => m && typeof m === 'object');
  if (clean.length) return clean.map(normalizeMember);
  const owner = String((team && team.owner) || '').trim();
  return owner ? [{ name: owner, role: 'presidente', title: '' }] : [];
}

/** Titolo da mostrare accanto al nome. */
export function titleOf(m) {
  return m.role === 'altro' ? (m.title || 'Altro') : ROLES[m.role];
}

/** Errore da mostrare ('' se va bene). */
export function validateStaff(staff) {
  const list = staff.map(normalizeMember);
  if (!list.length || !list[0].name) return 'Scrivi il nome del Presidente.';
  if (list.some(m => !m.name)) return 'Scrivi il nome di ogni persona aggiunta.';
  if (list.some((m, i) => i > 0 && m.role === 'altro' && !m.title)) return 'Scrivi il titolo di ogni persona aggiunta (es. Vicepresidente).';
  const others = list.slice(1);
  if (list[0].role === 'copresidente' && !others.some(m => m.role === 'copresidente')) {
    return 'Se il primo è Copresidente, almeno un altro deve essere Copresidente.';
  }
  if (list[0].role === 'presidente' && others.some(m => m.role === 'copresidente')) {
    return 'Con un Presidente non ci sono Copresidenti: scegli Copresidente anche per il primo.';
  }
  return '';
}

/** Dati da salvare: staff pulito e owner (nomi di chi presiede). */
export function staffToSave(staff) {
  const list = staff.map(normalizeMember).filter(m => m.name);
  return { staff: list.length ? list : null, owner: list.filter(isLeader).map(m => m.name).join(' & ') };
}

/** Chi presiede: { label: 'Presidente' | 'Copresidenti', names } oppure null. */
export function leadersOf(team) {
  const leaders = getStaff(team).filter(m => isLeader(m) && m.name);
  if (!leaders.length) return null;
  const co = leaders.length > 1 || leaders[0].role === 'copresidente';
  return { label: co ? 'Copresidenti' : 'Presidente', names: leaders.map(m => m.name).join(' & ') };
}

/** "Presidente: Mario" / "Copresidenti: Mario & Luca" ('' se non c'è nessuno). */
export function leadersLine(team) {
  const l = leadersOf(team);
  return l ? `${l.label}: ${l.names}` : '';
}
