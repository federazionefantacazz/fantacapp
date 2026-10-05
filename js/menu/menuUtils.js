export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const sid = (v) => (v === undefined || v === null ? '' : String(v));

/** Foto del giocatore (personale > standard) con fallback al badge del ruolo. */
export function playerThumb(p, cls = '') {
  const url = p.photoPersonal || p.photoStandard || '';
  const role = esc(p.role || '');
  const badge = `<div class="ph rbadge r${role}" style="display:flex; align-items:center; justify-content:center; font-size:.8rem;">${role}</div>`;
  if (!url) return badge;
  return `<img src="${esc(url)}" alt="" loading="lazy" decoding="async" class="${cls}" onerror="this.outerHTML=this.dataset.fb" data-fb='${badge.replace(/'/g, '&#39;')}'>`;
}
