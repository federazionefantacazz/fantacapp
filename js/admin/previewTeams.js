import { esc } from '../utils.js';

/**
 * Opzioni della combobox "Squadra" sopra il telefono dell'anteprima (sezione Temi e anteprima
 * della barra laterale): la squadra con cui l'app viene mostrata, con il suo logo.
 * Ridisegna solo se l'elenco cambia; tiene la scelta fatta.
 */
export function fillPreviewTeams(select, teams) {
  if (!select) return '';
  const list = [...(teams || [])].filter(t => t && t.id).sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id), 'it'));
  const html = list.length
    ? list.map(t => `<option value="${esc(t.id)}" ${t.logo ? `data-img="${esc(t.logo)}"` : 'data-icon="ri-shield-line"'}>${esc(t.name || t.id)}</option>`).join('')
    : '<option value="">Nessuna squadra</option>';
  if (select.dataset.sig !== html) {
    const keep = select.value;
    select.dataset.sig = html;
    select.innerHTML = html;
    if (keep && list.some(t => String(t.id) === keep)) select.value = keep;
  }
  return select.value;
}
